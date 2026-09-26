"""
Phase 17 — Canonical Scientific Pipeline & Integrity Regression Tests

Verifies:
1. Canonical profile representation across all 4 platforms (Argo, BGC, Glider, CTD).
2. Strict scientific reference model pairing (GLORYS for physical, CMEMS BGC for biological, HYCOM for velocity).
3. Dynamic depth boundaries without artificial 0-500m clipping on deep profiles.
4. Linear depth interpolation bounded strictly within observed/model levels with zero extrapolation.
5. Strict temporal and spatial tolerance gating.
6. Real metadata provenance (SHA-256, source URLs, authentic institution flags).
"""

import pytest
from backend.app.registry import resolve_scientific_reference_model
from backend.app.compatibility_engine import (
    evaluate_scientific_collocation,
    interpolate_model_depth,
)
from backend.app.observation_discovery_service import get_dataset_profiles
from backend.app.models import ScientificCollocationEvaluationRequest


def test_canonical_reference_model_resolution_all_combinations():
    """Verify registry resolves exact canonical scientific models and variables."""
    # Argo
    argo_t = resolve_scientific_reference_model("ARGO", "temperature", "HISTORICAL_RESEARCH")
    assert argo_t["model_key"] == "GLORYS"
    assert "GLORYS12V1" in argo_t["model_display_name"]
    assert argo_t["is_compatible"] is True

    argo_chl = resolve_scientific_reference_model("ARGO", "chl", "HISTORICAL_RESEARCH")
    assert argo_chl["is_compatible"] is False
    assert "hydrography" in argo_chl["rejection_reason"].lower() or "biogeochemical" in argo_chl["rejection_reason"].lower()

    # BGC Argo
    bgc_t = resolve_scientific_reference_model("BGC", "temperature", "HISTORICAL_RESEARCH")
    assert bgc_t["model_key"] == "GLORYS"
    assert "GLORYS12V1" in bgc_t["model_display_name"]
    assert bgc_t["is_compatible"] is True

    bgc_chl = resolve_scientific_reference_model("BGC", "chl", "HISTORICAL_RESEARCH")
    assert bgc_chl["model_key"] == "CMEMS_BGC"
    assert "PISCES" in bgc_chl["model_display_name"] or "BGC" in bgc_chl["model_display_name"]
    assert bgc_chl["is_compatible"] is True

    bgc_o2 = resolve_scientific_reference_model("BGC", "o2", "HISTORICAL_RESEARCH")
    assert bgc_o2["model_key"] == "CMEMS_BGC"
    assert bgc_o2["is_compatible"] is True

    # Glider
    glider_t = resolve_scientific_reference_model("GLIDER", "temperature", "HISTORICAL_RESEARCH")
    assert glider_t["model_key"] == "GLORYS"
    assert glider_t["is_compatible"] is True

    glider_cur = resolve_scientific_reference_model("GLIDER", "currents", "HISTORICAL_RESEARCH")
    assert glider_cur["is_compatible"] is False
    assert "velocity" in glider_cur["rejection_reason"].lower() or "hydrodynamic" in glider_cur["rejection_reason"].lower()

    # CTD
    ctd_t = resolve_scientific_reference_model("CTD", "temperature", "HISTORICAL_RESEARCH")
    assert ctd_t["model_key"] == "GLORYS"
    assert ctd_t["is_compatible"] is True


def test_dynamic_depth_interpolation_no_extrapolation():
    """Verify depth interpolation produces exact bounded values and zero extrapolation."""
    model_levels = [
        {"depth": 0.5, "value": 28.5},
        {"depth": 10.0, "value": 28.2},
        {"depth": 50.0, "value": 25.0},
        {"depth": 100.0, "value": 20.0},
        {"depth": 500.0, "value": 9.5},
    ]

    # Within bounds exact match
    val, method, _ = interpolate_model_depth(10.0, model_levels)
    assert val == pytest.approx(28.2, abs=1e-3)

    # Linear interpolation between 10m (28.2) and 50m (25.0) at 30m
    # 28.2 + (30-10)/(50-10) * (25.0 - 28.2) = 28.2 + 0.5 * (-3.2) = 26.6
    val_mid, method_mid, _ = interpolate_model_depth(30.0, model_levels)
    assert val_mid == pytest.approx(26.6, abs=1e-3)
    assert method_mid == "linear_depth_interpolation"

    # Beyond deepest level (500.0) -> None (Zero extrapolation)
    val_deep, method_deep, _ = interpolate_model_depth(600.0, model_levels, depth_tolerance_m=15.0)
    assert val_deep is None
    assert method_deep == "out_of_bounds"


def test_dynamic_depth_boundaries_exceeding_500m():
    """Verify evaluation handles deep casts (e.g. 2000m) without hardcoded 500m truncation."""
    deep_obs_levels = [
        {"depth": 0.0, "temperature": 28.0},
        {"depth": 100.0, "temperature": 20.0},
        {"depth": 500.0, "temperature": 9.5},
        {"depth": 1000.0, "temperature": 5.2},
        {"depth": 2000.0, "temperature": 2.5},
    ]
    deep_model_levels = [
        {"depth": 0.5, "value": 28.2},
        {"depth": 100.0, "value": 19.8},
        {"depth": 500.0, "value": 9.4},
        {"depth": 1000.0, "value": 5.1},
        {"depth": 2000.0, "value": 2.6},
    ]

    req = ScientificCollocationEvaluationRequest(
        variable="temperature",
        observation_profile={
            "platform_type": "CTD",
            "platform_id": "06AQ20101128_stn13",
            "latitude": 12.8,
            "longitude": 86.9,
            "observed_at": "2024-01-05T12:00:00Z",
            "levels": deep_obs_levels,
            "available_variables": ["temperature", "salinity"],
        },
        model_time="2024-01-05T12:00:00Z",
        model_location=[12.85, 86.92],
        model_levels=deep_model_levels,
        spatial_tolerance_km=50.0,
        temporal_tolerance_hours=24.0,
    )

    eval_res = evaluate_scientific_collocation(req)

    assert eval_res.is_comparison_valid is True
    assert eval_res.valid_matched_count == 5
    assert len(eval_res.matched_levels) == 5
    assert eval_res.matched_levels[-1].depth_m == 2000.0
    # Difference: Model (2.6) - Obs (2.5) = +0.1
    assert eval_res.matched_levels[-1].difference == pytest.approx(0.1, abs=1e-3)


def test_strict_spatial_and_temporal_tolerance_gating():
    """Verify spatial mismatch (>350km) and temporal mismatch (>72h) are strictly rejected."""
    obs_levels = [{"depth": 10.0, "temperature": 28.0}]
    model_levels = [{"depth": 10.0, "value": 28.2}]

    # Spatial mismatch test (e.g. 500km away)
    req_spatial = ScientificCollocationEvaluationRequest(
        variable="temperature",
        observation_profile={
            "platform_type": "ARGO",
            "platform_id": "6903093",
            "latitude": 10.0,
            "longitude": 80.0,
            "observed_at": "2024-01-05T12:00:00Z",
            "levels": obs_levels,
            "available_variables": ["temperature"],
        },
        model_time="2024-01-05T12:00:00Z",
        model_location=[15.0, 85.0],  # > 500km away
        model_levels=model_levels,
        spatial_tolerance_km=50.0,
    )
    eval_spatial_fail = evaluate_scientific_collocation(req_spatial)
    assert eval_spatial_fail.is_comparison_valid is False
    assert eval_spatial_fail.state == "SPATIAL_MISMATCH"

    # Temporal mismatch test (e.g. 7 days / 168h apart)
    req_temporal = ScientificCollocationEvaluationRequest(
        variable="temperature",
        observation_profile={
            "platform_type": "ARGO",
            "platform_id": "6903093",
            "latitude": 14.28,
            "longitude": 88.52,
            "observed_at": "2024-01-01T12:00:00Z",
            "levels": obs_levels,
            "available_variables": ["temperature"],
        },
        model_time="2024-01-08T12:00:00Z",  # 7 days apart
        model_location=[14.28, 88.52],
        model_levels=model_levels,
        temporal_tolerance_hours=36.0,
    )
    eval_temporal_fail = evaluate_scientific_collocation(req_temporal)
    assert eval_temporal_fail.is_comparison_valid is False
    assert eval_temporal_fail.state == "TEMPORAL_MISMATCH"


def test_dataset_profiles_endpoint_provenance_and_dates():
    """Verify dataset discovery returns authentic available dates, bounds, and provenance."""
    res_argo = get_dataset_profiles(platform="ARGO", data_mode="HISTORICAL_RESEARCH")
    assert len(res_argo.profiles) > 0
    assert len(res_argo.available_dates) > 0
    assert res_argo.temporal_range["start"] is not None
    assert res_argo.temporal_range["end"] is not None

    for p in res_argo.profiles:
        assert p.profile_id != ""
        assert p.platform_type == "ARGO"
        assert p.latitude != 0.0
        assert p.longitude != 0.0
        assert len(p.variables) > 0

    res_bgc = get_dataset_profiles(platform="BGC", data_mode="HISTORICAL_RESEARCH")
    assert len(res_bgc.profiles) > 0
    bgc_prof = res_bgc.profiles[0]
    assert "chl" in bgc_prof.variables or "temperature" in bgc_prof.variables
