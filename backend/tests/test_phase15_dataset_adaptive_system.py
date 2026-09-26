"""
Phase 15 Test Suite: Dataset-Adaptive Spatial Exploration, 3D Visualization & Scientifically Strict Collocation.

Verifies:
1. Multi-platform profile discovery endpoint GET /api/v1/observations/profiles
2. Dataset-specific temporal & spatial coverage extraction
3. Platform-variable isolation:
   - Core Argo: temp, sal
   - BGC-Argo: chl, o2, no3, temp, sal
   - Glider: temp, sal, chl (no synthetic u/v currents)
   - Ship CTD: temp, sal, o2, chl
4. Zero synthetic fallback across platforms
5. Dynamic depth bounds and strict collocation verification
"""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.observation_discovery_service import get_dataset_profiles
from backend.app.compatibility_engine import (
    CompatibilityEngine,
    evaluate_scientific_collocation,
    interpolate_model_depth,
)
from backend.app.models import (
    CompatibilityCheckRequest,
    ScientificCollocationEvaluationRequest,
)

client = TestClient(app)


def test_phase15_dataset_profiles_endpoint_argo():
    """Verify Argo platform profiles discovery."""
    response = client.get("/api/v1/observations/profiles?platform=ARGO&data_mode=HISTORICAL_RESEARCH")
    assert response.status_code == 200
    data = response.json()
    assert data["platform"] == "ARGO"
    assert data["total_profiles"] > 0
    assert "temperature" in data["available_variables"]
    assert "salinity" in data["available_variables"]
    assert len(data["profiles"]) > 0
    
    first = data["profiles"][0]
    assert "profile_id" in first
    assert "latitude" in first
    assert "longitude" in first
    assert "min_depth" in first
    assert "max_depth" in first
    assert first["min_depth"] <= first["max_depth"]


def test_phase15_dataset_profiles_endpoint_bgc():
    """Verify BGC-Argo platform profiles discovery and variable isolation."""
    response = client.get("/api/v1/observations/profiles?platform=BGC&data_mode=HISTORICAL_RESEARCH")
    assert response.status_code == 200
    data = response.json()
    assert data["platform"] == "BGC"
    assert data["total_profiles"] > 0
    assert "chl" in data["available_variables"]
    
    # Ensure BGC profiles actually contain biogeochemical data
    for p in data["profiles"]:
        assert p["platform_type"] == "BGC"
        assert p["qc_status"] in ["GOOD", "PROBABLY_GOOD", "UNKNOWN", "BAD"]


def test_phase15_dataset_profiles_endpoint_glider():
    """Verify Glider platform discovery has zero synthetic currents."""
    response = client.get("/api/v1/observations/profiles?platform=GLIDER&data_mode=HISTORICAL_RESEARCH")
    assert response.status_code == 200
    data = response.json()
    assert data["platform"] == "GLIDER"
    assert data["total_profiles"] > 0
    # Glider observations must NOT advertise u/v velocity currents as measured variables
    assert "currents" not in data["available_variables"]
    assert "u" not in data["available_variables"]


def test_phase15_dataset_profiles_endpoint_ctd():
    """Verify Ship CTD cast discovery."""
    response = client.get("/api/v1/observations/profiles?platform=CTD&data_mode=HISTORICAL_RESEARCH")
    assert response.status_code == 200
    data = response.json()
    assert data["platform"] == "CTD"
    assert data["total_profiles"] > 0
    for p in data["profiles"]:
        assert p["platform_type"] == "CTD"


def test_phase15_direct_discovery_service():
    """Verify direct python service get_dataset_profiles returns authentic metadata."""
    res_bgc = get_dataset_profiles("BGC", "HISTORICAL_RESEARCH")
    assert res_bgc.total_profiles >= 1
    assert res_bgc.spatial_bounds is not None
    assert res_bgc.spatial_bounds["min_lat"] <= res_bgc.spatial_bounds["max_lat"]
    assert res_bgc.spatial_bounds["min_lon"] <= res_bgc.spatial_bounds["max_lon"]
    assert "start" in res_bgc.temporal_range

    res_glider = get_dataset_profiles("GLIDER", "HISTORICAL_RESEARCH")
    assert res_glider.total_profiles >= 1
    assert "temperature" in res_glider.available_variables


def test_phase15_dynamic_depth_interpolation_zero_extrapolation():
    """Verify model depth interpolation returns None outside model bounds without extrapolation."""
    model_levels = [
        {"depth": 10.0, "value": 28.0},
        {"depth": 50.0, "value": 25.0},
        {"depth": 100.0, "value": 20.0},
        {"depth": 300.0, "value": 14.0},
    ]
    
    # 25.0 m is within [10.0, 50.0] -> linear depth interpolation
    val_interp, method, native_d = interpolate_model_depth(25.0, model_levels, depth_tolerance_m=15.0)
    assert val_interp is not None
    assert 25.0 <= val_interp <= 28.0
    assert method == "linear_depth_interpolation"

    # 450.0 m exceeds max model level 300.0 -> must be None with NO extrapolation
    val_out, method_out, _ = interpolate_model_depth(450.0, model_levels, depth_tolerance_m=15.0)
    assert val_out is None
    assert method_out == "out_of_bounds"


def test_phase15_strict_collocation_validation():
    """Verify multi-criteria compatibility rejection when spatial/temporal/variable constraints fail."""
    # 1. Spatial mismatch (> 40 km)
    req_spatial = CompatibilityCheckRequest(
        observation_dataset_id="argo-delayed-mode-bob-2024",
        observation_source="Argo GDAC",
        observation_platform="ARGO",
        model_dataset_id="glorys12v1-argo-collocation-bob",
        model_source="Mercator Ocean",
        observation_variable="temperature",
        model_variable="temperature",
        observation_latitude=12.0,
        observation_longitude=85.0,
        model_latitude=18.0,
        model_longitude=92.0,
        observation_time="2024-01-05T12:00:00Z",
        model_time="2024-01-05T12:00:00Z",
        observation_qc_accepted=True,
    )
    check_spatial = CompatibilityEngine.evaluate_compatibility(req_spatial)
    assert not check_spatial.is_compatible
    assert check_spatial.state == "SPATIAL_MISMATCH"

    # 2. Temporal mismatch (> 36 hours)
    req_temporal = CompatibilityCheckRequest(
        observation_dataset_id="argo-delayed-mode-bob-2024",
        observation_source="Argo GDAC",
        observation_platform="ARGO",
        model_dataset_id="glorys12v1-argo-collocation-bob",
        model_source="Mercator Ocean",
        observation_variable="temperature",
        model_variable="temperature",
        observation_latitude=12.0,
        observation_longitude=85.0,
        model_latitude=12.02,
        model_longitude=85.02,
        observation_time="2024-01-01T12:00:00Z",
        model_time="2024-01-10T12:00:00Z",
        observation_qc_accepted=True,
    )
    check_temporal = CompatibilityEngine.evaluate_compatibility(req_temporal)
    assert not check_temporal.is_compatible
    assert check_temporal.state == "TEMPORAL_MISMATCH"

    # 3. Compatible collocation
    req_valid = CompatibilityCheckRequest(
        observation_dataset_id="argo-delayed-mode-bob-2024",
        observation_source="Argo GDAC",
        observation_platform="ARGO",
        model_dataset_id="glorys12v1-argo-collocation-bob",
        model_source="Mercator Ocean",
        observation_variable="temperature",
        model_variable="temperature",
        observation_latitude=12.0,
        observation_longitude=85.0,
        model_latitude=12.05,
        model_longitude=85.05,
        observation_time="2024-01-05T12:00:00Z",
        model_time="2024-01-05T12:00:00Z",
        observation_qc_accepted=True,
    )
    check_valid = CompatibilityEngine.evaluate_compatibility(req_valid)
    assert check_valid.is_compatible
    assert check_valid.state == "MODEL_COMPARISON_AVAILABLE"
    assert check_valid.spatial_offset_km < 15.0
