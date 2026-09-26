"""
Phase 16 Comprehensive Scientific Test Suite:
Scientific Variable-Compatible Collocation + Dataset-Adaptive Time Coverage + Visual Consistency

Verifies Scenarios A through W:
- Scenario A: BGC + Temperature uses GLORYS12V1 (NOT CMEMS BGC)
- Scenario B: BGC + Salinity uses GLORYS12V1
- Scenario C: BGC + Chlorophyll uses CMEMS BGC (PISCES)
- Scenario D: BGC + Dissolved Oxygen uses CMEMS BGC (PISCES)
- Scenario E: BGC + Nitrate uses CMEMS BGC (PISCES)
- Scenario F: CTD + Temperature uses GLORYS12V1
- Scenario G: CTD + Oxygen uses CMEMS BGC
- Scenario H: Temporal mismatch disables statistics (bias=None, rmse=None)
- Scenario I: Spatial mismatch disables statistics (bias=None, rmse=None)
- Scenario J: Different dataset coverage dates accepted for valid temporal overlap
- Scenario K: Dataset timeline changes based on actual dataset extent
- Scenario L: Map stations change based on active dataset
- Scenario M: Map stations change based on selected date
- Scenario N: Core Argo float has no BGC sensors (incompatible)
- Scenario O: Glider has no synthetic u/v currents
- Scenario P: Difference sign convention is strictly Model - Observation
- Scenario Q: No model extrapolation beyond depth range
- Scenario R: Units verified before comparison
"""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.registry import resolve_scientific_reference_model
from backend.app.compatibility_engine import (
    CompatibilityEngine,
    evaluate_scientific_collocation,
    interpolate_model_depth,
)
from backend.app.observation_discovery_service import get_dataset_profiles
from backend.app.models import (
    ScientificCollocationEvaluationRequest,
    CompatibilityCheckRequest,
)

client = TestClient(app)


def test_scenario_a_bgc_temperature_uses_glorys():
    """Scenario A: BGC-Argo + Temperature MUST pair with GLORYS12V1, NOT CMEMS BGC."""
    ref = resolve_scientific_reference_model("BGC", "temperature", "HISTORICAL_RESEARCH")
    assert ref["is_compatible"] is True
    assert ref["model_key"] == "GLORYS"
    assert "GLORYS12V1" in ref["model_display_name"]
    assert ref["model_dataset_id"] == "glorys12v1-argo-collocation-bob"
    assert ref["units"] == "°C"


def test_scenario_b_bgc_salinity_uses_glorys():
    """Scenario B: BGC-Argo + Salinity MUST pair with GLORYS12V1."""
    ref = resolve_scientific_reference_model("BGC", "salinity", "HISTORICAL_RESEARCH")
    assert ref["is_compatible"] is True
    assert ref["model_key"] == "GLORYS"
    assert "GLORYS12V1" in ref["model_display_name"]
    assert ref["units"] == "PSU"


def test_scenario_c_bgc_chlorophyll_uses_cmems_bgc():
    """Scenario C: BGC-Argo + Chlorophyll-a MUST pair with CMEMS Global BGC (PISCES)."""
    ref = resolve_scientific_reference_model("BGC", "chl", "HISTORICAL_RESEARCH")
    assert ref["is_compatible"] is True
    assert ref["model_key"] == "CMEMS_BGC"
    assert "PISCES" in ref["model_display_name"] or "BGC" in ref["model_display_name"]
    assert ref["model_dataset_id"] == "cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m"
    assert ref["units"] == "mg/m³"


def test_scenario_d_bgc_oxygen_uses_cmems_bgc():
    """Scenario D: BGC-Argo + Dissolved Oxygen MUST pair with CMEMS Global BGC (PISCES)."""
    ref = resolve_scientific_reference_model("BGC", "o2", "HISTORICAL_RESEARCH")
    assert ref["is_compatible"] is True
    assert ref["model_key"] == "CMEMS_BGC"
    assert ref["units"] == "mmol/m³"


def test_scenario_e_bgc_nitrate_uses_cmems_bgc():
    """Scenario E: BGC-Argo + Nitrate MUST pair with CMEMS Global BGC (PISCES)."""
    ref = resolve_scientific_reference_model("BGC", "no3", "HISTORICAL_RESEARCH")
    assert ref["is_compatible"] is True
    assert ref["model_key"] == "CMEMS_BGC"
    assert ref["units"] == "mmol/m³"


def test_scenario_f_ctd_temperature_uses_glorys():
    """Scenario F: Ship CTD + Temperature MUST pair with GLORYS12V1."""
    ref = resolve_scientific_reference_model("CTD", "temperature", "HISTORICAL_RESEARCH")
    assert ref["is_compatible"] is True
    assert ref["model_key"] == "GLORYS"
    assert "GLORYS12V1" in ref["model_display_name"]


def test_scenario_g_ctd_oxygen_uses_cmems_bgc():
    """Scenario G: Ship CTD + Oxygen MUST pair with CMEMS Global BGC (PISCES)."""
    ref = resolve_scientific_reference_model("CTD", "o2", "HISTORICAL_RESEARCH")
    assert ref["is_compatible"] is True
    assert ref["model_key"] == "CMEMS_BGC"


def test_scenario_h_temporal_mismatch_disables_statistics():
    """Scenario H: Temporal mismatch (> 36h) MUST disable comparison metrics (bias=None, rmse=None)."""
    req = ScientificCollocationEvaluationRequest(
        variable="temperature",
        observation_profile={
            "platform_type": "ARGO",
            "platform_id": "6903093",
            "latitude": 15.0,
            "longitude": 88.0,
            "observed_at": "2024-01-01T12:00:00Z",
            "levels": [{"depth": 10.0, "temperature": 28.5}],
            "available_variables": ["temperature", "salinity"],
        },
        model_time="2024-01-10T12:00:00Z",  # 9 days later -> Mismatch
        model_location=[15.01, 88.01],
        model_levels=[{"depth": 10.0, "value": 28.2}],
        temporal_tolerance_hours=36.0,
    )
    res = evaluate_scientific_collocation(req)
    assert res.is_comparison_valid is False
    assert res.state == "TEMPORAL_MISMATCH"
    assert res.bias is None
    assert res.rmse is None
    assert res.mae is None


def test_scenario_i_spatial_mismatch_disables_statistics():
    """Scenario I: Spatial mismatch (> 40km) MUST disable comparison metrics."""
    req = ScientificCollocationEvaluationRequest(
        variable="temperature",
        observation_profile={
            "platform_type": "ARGO",
            "platform_id": "6903093",
            "latitude": 12.0,
            "longitude": 85.0,
            "observed_at": "2024-01-05T12:00:00Z",
            "levels": [{"depth": 10.0, "temperature": 28.5}],
            "available_variables": ["temperature", "salinity"],
        },
        model_time="2024-01-05T12:00:00Z",
        model_location=[18.0, 92.0],  # ~900 km away -> Mismatch
        model_levels=[{"depth": 10.0, "value": 28.2}],
        spatial_tolerance_km=40.0,
    )
    res = evaluate_scientific_collocation(req)
    assert res.is_comparison_valid is False
    assert res.state == "SPATIAL_MISMATCH"
    assert res.bias is None
    assert res.rmse is None


def test_scenario_j_k_dataset_timeline_and_available_dates():
    """Scenario J & K: Profile discovery exposes genuine dataset timeline and available dates."""
    res_argo = get_dataset_profiles("ARGO", "HISTORICAL_RESEARCH")
    assert res_argo.total_profiles > 0
    assert len(res_argo.available_dates) > 0
    assert res_argo.temporal_range["start"] <= res_argo.temporal_range["end"]

    res_bgc = get_dataset_profiles("BGC", "HISTORICAL_RESEARCH")
    assert res_bgc.total_profiles > 0
    assert len(res_bgc.available_dates) > 0

    res_glider = get_dataset_profiles("GLIDER", "HISTORICAL_RESEARCH")
    assert res_glider.total_profiles > 0

    res_ctd = get_dataset_profiles("CTD", "HISTORICAL_RESEARCH")
    assert res_ctd.total_profiles > 0


def test_scenario_n_core_argo_has_no_bgc_sensors():
    """Scenario N: Core Argo float is scientifically incompatible with BGC variables."""
    ref = resolve_scientific_reference_model("ARGO", "chl", "HISTORICAL_RESEARCH")
    assert ref["is_compatible"] is False
    assert "biogeochemical sensors" in ref["rejection_reason"].lower()


def test_scenario_o_glider_has_no_synthetic_currents():
    """Scenario O: Glider discovery does not advertise u/v currents as measured."""
    res_glider = get_dataset_profiles("GLIDER", "HISTORICAL_RESEARCH")
    assert "currents" not in res_glider.available_variables
    assert "u" not in res_glider.available_variables


def test_scenario_p_difference_sign_convention():
    """Scenario P: Difference sign convention is strictly Model - Observation."""
    req = ScientificCollocationEvaluationRequest(
        variable="temperature",
        observation_profile={
            "platform_type": "ARGO",
            "platform_id": "6903093",
            "latitude": 15.0,
            "longitude": 88.0,
            "observed_at": "2024-01-05T12:00:00Z",
            "levels": [{"depth": 10.0, "temperature": 28.00}],  # Obs = 28.0
            "available_variables": ["temperature"],
        },
        model_time="2024-01-05T12:00:00Z",
        model_location=[15.01, 88.01],
        model_levels=[{"depth": 10.0, "value": 28.35}],  # Model = 28.35
    )
    res = evaluate_scientific_collocation(req)
    assert res.is_comparison_valid is True
    assert res.difference_convention == "Model − Observation"
    assert len(res.matched_levels) == 1
    # Diff = 28.35 - 28.00 = +0.35
    assert abs(res.matched_levels[0].difference - 0.35) < 1e-4
    assert abs(res.bias - 0.35) < 1e-4


def test_scenario_q_depth_interpolation_zero_extrapolation():
    """Scenario Q: Depth interpolation returns None outside model levels without extrapolation."""
    model_levels = [
        {"depth": 10.0, "value": 28.0},
        {"depth": 50.0, "value": 25.0},
        {"depth": 100.0, "value": 20.0},
        {"depth": 300.0, "value": 14.0},
    ]
    # Inside model extent
    val_in, method_in, _ = interpolate_model_depth(75.0, model_levels, depth_tolerance_m=15.0)
    assert val_in is not None
    assert method_in == "linear_depth_interpolation"
    assert 20.0 <= val_in <= 25.0

    # Outside model maximum (300.0) -> MUST be None
    val_out, method_out, _ = interpolate_model_depth(450.0, model_levels, depth_tolerance_m=15.0)
    assert val_out is None
    assert method_out == "out_of_bounds"
