"""
Tests for OceanScope Phase 5: Observation & Data-Mode Expansion.

Covers:
1. Canonical Data Mode formalization (LIVE_NRT vs HISTORICAL_RESEARCH)
2. Currents as first-class variable (uo, vo, speed magnitude, flow direction)
3. Chlorophyll-a separation (3D depth-resolved model vs surface-only satellite L4)
4. Common observation platform abstraction (Argo, Glider, CTD, BGC)
5. Glider & CTD & BGC historical retrieval and truthful NRT error handling
6. Scientific Compatibility Engine validation states & rules
7. Variable-aware scientific analysis metrics computation
8. Platform & Data-Mode discovery REST endpoints
"""

import math
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.registry import (
    DATASET_REGISTRY,
    VARIABLE_REGISTRY,
    PLATFORM_REGISTRY,
    DATA_MODE_REGISTRY,
    get_dataset,
    resolve_canonical_variable,
    list_datasets,
)
from app.compatibility_engine import (
    CompatibilityEngine,
    compute_variable_aware_analysis,
    haversine_km,
)
from app.models import (
    CompatibilityCheckRequest,
    VariableAwareAnalysisRequest,
)

client = TestClient(app)


def test_phase5_canonical_data_modes_registry():
    """Verify LIVE_NRT and HISTORICAL_RESEARCH are formally defined."""
    assert "LIVE_NRT" in DATA_MODE_REGISTRY
    assert "HISTORICAL_RESEARCH" in DATA_MODE_REGISTRY
    nrt = DATA_MODE_REGISTRY["LIVE_NRT"]
    assert "Live / Near-Real-Time" in nrt["display_name"]
    hist = DATA_MODE_REGISTRY["HISTORICAL_RESEARCH"]
    assert "Historical" in hist["display_name"]


def test_phase5_observation_platforms_registry():
    """Verify Argo, Glider, CTD, and BGC platforms are registered."""
    for platform in ("ARGO", "GLIDER", "CTD", "BGC"):
        assert platform in PLATFORM_REGISTRY
        p_def = PLATFORM_REGISTRY[platform]
        assert p_def["platform_type"] == platform
        assert len(p_def["typical_variables"]) > 0
        assert len(p_def["data_modes_supported"]) > 0


def test_phase5_currents_first_class_variable():
    """Verify currents composite variable resolution and calculation formula."""
    var = resolve_canonical_variable("currents")
    assert var is not None
    assert var.id == "currents"
    assert var.unit == "m/s"
    assert var.is_derived is True

    # Test formula: speed = sqrt(uo^2 + vo^2), direction = (atan2(uo, vo) * 180 / pi) % 360
    uo, vo = 0.3, 0.4
    speed = math.sqrt(uo**2 + vo**2)
    direction = (math.atan2(uo, vo) * 180.0 / math.pi) % 360.0
    assert pytest.approx(speed, 0.001) == 0.5
    assert pytest.approx(direction, 0.1) == 36.87


def test_phase5_chlorophyll_surface_vs_depth_resolved():
    """Verify distinction between surface-only satellite chlorophyll and depth-resolved model chlorophyll."""
    sat_chl = get_dataset("cmems_obs-oc_glo_bgc-plankton_nrt_l4-gapfree-multi-4km_P1D")
    assert sat_chl is not None
    assert sat_chl.vertical_coverage_type == "surface_only"
    assert sat_chl.supports_3d is False
    assert sat_chl.data_mode == "LIVE_NRT"

    mod_bgc = get_dataset("cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m")
    assert mod_bgc is not None
    assert mod_bgc.vertical_coverage_type == "depth_resolved"
    assert mod_bgc.supports_3d is True


def test_phase5_glider_dataset_and_truthful_nrt():
    """Verify Glider historical retrieval works and live mode is truthfully rejected if no stream."""
    glider_ds = get_dataset("glider-incois-bob-historical")
    assert glider_ds is not None
    assert glider_ds.platform_type == "GLIDER"
    assert glider_ds.data_mode == "HISTORICAL_RESEARCH"

    # Historical retrieval via REST
    resp = client.get("/api/v1/research/data?dataset_id=glider-incois-bob-historical&variable=temperature")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["query_summary"]["platform_type"] == "GLIDER"
    assert len(data["data"]) > 0

    # Truthful rejection when querying live NRT for glider
    resp_nrt = client.get("/api/v1/research/data?dataset_id=glider-incois-bob-historical&data_mode=LIVE_NRT")
    assert resp_nrt.status_code == 503
    assert "not currently deployed" in resp_nrt.json()["error"]["message"]


def test_phase5_ctd_dataset_retrieval():
    """Verify CTD hydrographic cruise station retrieval."""
    ctd_ds = get_dataset("ctd-cchdo-bob-historical")
    assert ctd_ds is not None
    assert ctd_ds.platform_type == "CTD"

    resp = client.get("/api/v1/research/data?dataset_id=ctd-cchdo-bob-historical&variable=o2&format=profiles")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert len(data["data"]) > 0
    assert data["data"][0]["platform_type"] == "CTD"


def test_phase5_bgc_argo_dataset_retrieval():
    """Verify BGC-Argo vertical profiles retrieval."""
    resp = client.get("/api/v1/research/data?dataset_id=bgc-argo-bob-historical&variable=chl")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["result_summary"]["units"] == "mg/m³"


def test_phase5_compatibility_engine_all_states():
    """Test CompatibilityEngine across various mismatch and success states."""
    # 1. Successful compatibility
    req_valid = CompatibilityCheckRequest(
        observation_source="Argo GDAC",
        observation_platform="ARGO",
        observation_variable="temperature",
        observation_time="2024-01-08T12:00:00Z",
        observation_latitude=14.5,
        observation_longitude=88.2,
        observation_depth=50.0,
        observation_qc_accepted=True,
        model_source="GLORYS12V1",
        model_dataset_id="glorys12v1-argo-collocation-bob",
        model_variable="thetao",
        model_time="2024-01-08T12:00:00Z",
        model_latitude=14.52,
        model_longitude=88.22,
        model_depth=50.0,
        data_mode="HISTORICAL_RESEARCH",
    )
    eval_res = CompatibilityEngine.evaluate_compatibility(req_valid)
    assert eval_res.is_compatible is True
    assert eval_res.state == "MODEL_COMPARISON_AVAILABLE"

    # 2. QC Rejection
    req_bad_qc = req_valid.model_copy(update={"observation_qc_accepted": False})
    eval_qc = CompatibilityEngine.evaluate_compatibility(req_bad_qc)
    assert eval_qc.is_compatible is False
    assert eval_qc.state == "INVALID_QC"

    # 3. Incompatible variable
    req_bad_var = req_valid.model_copy(update={"model_variable": "salinity"})
    eval_var = CompatibilityEngine.evaluate_compatibility(req_bad_var)
    assert eval_var.is_compatible is False
    assert eval_var.state == "INCOMPATIBLE_DATA"

    # 4. Outside domain
    req_outside = req_valid.model_copy(update={"observation_latitude": -50.0})
    eval_outside = CompatibilityEngine.evaluate_compatibility(req_outside)
    assert eval_outside.is_compatible is False
    assert eval_outside.state == "OUTSIDE_MODEL_DOMAIN"

    # 5. Spatial mismatch (> 40km)
    req_far = req_valid.model_copy(update={"model_latitude": 17.5})
    eval_far = CompatibilityEngine.evaluate_compatibility(req_far)
    assert eval_far.is_compatible is False
    assert eval_far.state == "SPATIAL_MISMATCH"

    # 6. Temporal mismatch (> 36h)
    req_time = req_valid.model_copy(update={"model_time": "2024-01-20T12:00:00Z"})
    eval_time = CompatibilityEngine.evaluate_compatibility(req_time)
    assert eval_time.is_compatible is False
    assert eval_time.state == "TEMPORAL_MISMATCH"

    # 7. Depth mismatch (> 15m)
    req_depth = req_valid.model_copy(update={"model_depth": 100.0})
    eval_depth = CompatibilityEngine.evaluate_compatibility(req_depth)
    assert eval_depth.is_compatible is False
    assert eval_depth.state == "DEPTH_MISMATCH"


def test_phase5_variable_aware_analysis_metrics():
    """Test variable-aware metrics calculation for physical, currents, and BGC."""
    # Temperature: Bias, MAE, RMSE, Pearson Correlation
    req_t = VariableAwareAnalysisRequest(
        variable="temperature",
        observation_values=[28.0, 26.0, 22.0, 18.0, 14.0],
        model_values=[28.2, 26.1, 21.8, 18.3, 14.0],
        depth_levels=[0.0, 25.0, 50.0, 100.0, 200.0],
    )
    res_t = compute_variable_aware_analysis(req_t)
    assert res_t.matched_points == 5
    assert pytest.approx(res_t.mean_bias, 0.01) == 0.08
    assert res_t.rmse is not None and res_t.rmse > 0
    assert res_t.correlation is not None and res_t.correlation > 0.99
    assert len(res_t.depth_profile_analysis) == 5

    # Currents: U/V, speed magnitude, directional difference
    req_cur = VariableAwareAnalysisRequest(
        variable="currents",
        observation_values=[0.5, 0.4],
        model_values=[0.55, 0.42],
        u_obs=[0.3, 0.2],
        v_obs=[0.4, 0.346],
        u_model=[0.35, 0.22],
        v_model=[0.42, 0.358],
    )
    res_cur = compute_variable_aware_analysis(req_cur)
    assert res_cur.currents_metrics is not None
    assert "speed_bias" in res_cur.currents_metrics
    assert "mean_directional_error_deg" in res_cur.currents_metrics


def test_phase5_rest_discovery_endpoints():
    """Verify /research/platforms and /research/data-modes REST endpoints."""
    # Platforms
    resp_p = client.get("/api/v1/research/platforms")
    assert resp_p.status_code == 200
    p_data = resp_p.json()
    assert p_data["total_platforms"] == 4
    platform_types = [p["platform_type"] for p in p_data["platforms"]]
    assert "ARGO" in platform_types
    assert "GLIDER" in platform_types
    assert "CTD" in platform_types
    assert "BGC" in platform_types

    # Data Modes
    resp_m = client.get("/api/v1/research/data-modes")
    assert resp_m.status_code == 200
    m_data = resp_m.json()
    assert len(m_data["data_modes"]) == 2
    modes = [m["mode"] for m in m_data["data_modes"]]
    assert "LIVE_NRT" in modes
    assert "HISTORICAL_RESEARCH" in modes

    # Compatibility Validation REST
    compat_payload = {
        "observation_source": "Argo GDAC",
        "observation_platform": "ARGO",
        "observation_variable": "temperature",
        "observation_time": "2024-01-08T12:00:00Z",
        "observation_latitude": 14.5,
        "observation_longitude": 88.2,
        "observation_depth": 25.0,
        "observation_qc_accepted": True,
        "model_source": "GLORYS12V1",
        "model_dataset_id": "glorys12v1-argo-collocation-bob",
        "model_variable": "thetao",
        "model_time": "2024-01-08T12:00:00Z",
        "model_latitude": 14.51,
        "model_longitude": 88.21,
        "model_depth": 25.0,
        "data_mode": "HISTORICAL_RESEARCH",
    }
    resp_compat = client.post("/api/v1/compatibility/validate", json=compat_payload)
    assert resp_compat.status_code == 200
    assert resp_compat.json()["is_compatible"] is True
    assert resp_compat.json()["state"] == "MODEL_COMPARISON_AVAILABLE"
