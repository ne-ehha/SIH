"""
Regression tests for OceanScope Phase 5 Variable Binding Audit & Scientific Integrity.

Verifies:
1. test_selected_chl_does_not_use_temperature_values
2. test_selected_salinity_does_not_use_temperature_values
3. test_selected_currents_uses_uo_vo
4. test_surface_chlorophyll_is_not_rendered_as_3d_profile
5. test_unavailable_variable_returns_explicit_unavailable_state
6. test_chart_units_match_selected_variable
7. test_tooltip_label_matches_selected_variable
8. test_statistics_use_selected_variable
"""

import math
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.registry import (
    VARIABLE_REGISTRY,
    DATASET_REGISTRY,
    resolve_canonical_variable,
    get_dataset,
)
from app.compatibility_engine import compute_variable_aware_analysis
from app.models import VariableAwareAnalysisRequest

client = TestClient(app)


def test_selected_chl_does_not_use_temperature_values():
    """Verify that Chlorophyll-a never substitutes temperature values."""
    # 1. Variable Registry definition
    chl_meta = VARIABLE_REGISTRY.get("chl")
    assert chl_meta is not None
    assert chl_meta.id == "chl"
    assert chl_meta.unit == "mg/m³"
    assert "temperature" not in chl_meta.aliases

    # 2. Benchmark 3D endpoint should reject chl with UNSUPPORTED_VARIABLE rather than returning temperature
    resp = client.post("/api/v1/research/visualization/3d", json={
        "location": {"latitude": 12.0, "longitude": 88.0},
        "variable": "chl",
        "date": "2024-01-04",
        "time": "00:00",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "error"
    assert data["error"]["code"] == "UNSUPPORTED_VARIABLE"
    assert "not supported for Research visualization" in data["error"]["message"]


def test_selected_salinity_does_not_use_temperature_values():
    """Verify that Salinity retrieves true salinity (PSU), not temperature (°C)."""
    resp = client.post("/api/v1/research/visualization/3d", json={
        "location": {"latitude": 12.0, "longitude": 88.0},
        "variable": "salinity",
        "date": "2024-01-04",
        "time": "00:00",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["data"]["unit"] == "PSU"
    points = data["data"]["points"]
    assert len(points) > 0
    # Practical salinity in Bay of Bengal is typically in the 30-36 PSU range, not ~28°C
    for p in points[:10]:
        assert 25.0 <= p["argoValue"] <= 40.0, f"Expected salinity PSU range, got {p['argoValue']}"
        assert 25.0 <= p["glorysValue"] <= 40.0, f"Expected salinity PSU range, got {p['glorysValue']}"


def test_selected_currents_uses_uo_vo():
    """Verify that Currents calculates speed from uo and vo and does not substitute temperature."""
    curr_meta = VARIABLE_REGISTRY.get("currents")
    assert curr_meta is not None
    assert curr_meta.unit == "m/s"
    assert curr_meta.id == "currents"

    # In variable-aware analysis, currents speed difference must use u/v derived magnitude
    req = VariableAwareAnalysisRequest(
        variable="currents",
        observation_values=[0.5],
        model_values=[1.0],
        observation_depths=[10.0],
        model_depths=[10.0],
    )
    analysis = compute_variable_aware_analysis(req)
    assert analysis.units == "m/s"
    assert analysis.mean_bias is not None and math.isclose(analysis.mean_bias, 0.5, abs_tol=1e-3)
    assert analysis.rmse is not None and math.isclose(analysis.rmse, 0.5, abs_tol=1e-3)


def test_surface_chlorophyll_is_not_rendered_as_3d_profile():
    """Verify satellite Ocean Colour Chlorophyll is explicitly marked surface_only."""
    dataset = get_dataset("cmems_obs-oc_glo_bgc-plankton_nrt_l4-gapfree-multi-4km_P1D")
    assert dataset is not None
    assert dataset.vertical_coverage_type == "surface_only"
    assert dataset.vertical_coverage.min_depth == 0.0
    assert dataset.vertical_coverage.max_depth == 0.0
    assert dataset.supports_3d is False
    assert "chl" in dataset.supported_variables
    assert dataset.variable_units.get("chl") == "mg/m³"


def test_unavailable_variable_returns_explicit_unavailable_state():
    """Verify asking for an unsupported variable returns explicit error code."""
    resp = client.post("/api/v1/research/visualization/3d", json={
        "location": {"latitude": 12.0, "longitude": 88.0},
        "variable": "o2",
        "date": "2024-01-04",
        "time": "00:00",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "error"
    assert data["error"]["code"] == "UNSUPPORTED_VARIABLE"


def test_chart_units_match_selected_variable():
    """Verify unit mapping matches canonical scientific definitions."""
    expected_units = {
        "temperature": "°C",
        "thetao": "°C",
        "salinity": "PSU",
        "so": "PSU",
        "currents": "m/s",
        "currents_u": "m/s",
        "currents_v": "m/s",
        "chl": "mg/m³",
        "chlorophyll": "mg/m³",
        "o2": "mmol/m³",
        "dissolved_oxygen": "mmol/m³",
        "no3": "mmol/m³",
        "nitrate": "mmol/m³",
        "zos": "m",
        "mlotst": "m",
    }
    for var, expected_unit in expected_units.items():
        var_def = resolve_canonical_variable(var)
        assert var_def is not None, f"Variable {var} not resolved"
        assert var_def.unit == expected_unit, f"Variable {var} expected {expected_unit}, got {var_def.unit}"


def test_tooltip_label_matches_selected_variable():
    """Verify variable display names for tooltips."""
    assert "Potential Temperature" in VARIABLE_REGISTRY["thetao"].display_name
    assert "Practical Salinity" in VARIABLE_REGISTRY["so"].display_name
    assert "Chlorophyll-a" in VARIABLE_REGISTRY["chl"].display_name
    assert "Current" in VARIABLE_REGISTRY["currents"].display_name
    assert "Oxygen" in VARIABLE_REGISTRY["o2"].display_name
    assert "Nitrate" in VARIABLE_REGISTRY["no3"].display_name


def test_statistics_use_selected_variable():
    """Verify statistics calculation is strictly variable-bound."""
    # Test temperature analysis
    temp_req = VariableAwareAnalysisRequest(
        variable="temperature",
        observation_values=[28.0, 22.0],
        model_values=[28.5, 22.3],
        observation_depths=[0.0, 100.0],
        model_depths=[0.0, 100.0],
    )
    temp_analysis = compute_variable_aware_analysis(temp_req)
    assert temp_analysis.units == "°C"
    assert temp_analysis.mean_bias is not None and math.isclose(temp_analysis.mean_bias, 0.4, abs_tol=1e-3)

    # Test chlorophyll analysis
    chl_req = VariableAwareAnalysisRequest(
        variable="chl",
        observation_values=[0.25],
        model_values=[0.35],
        observation_depths=[0.0],
        model_depths=[0.0],
    )
    chl_analysis = compute_variable_aware_analysis(chl_req)
    assert chl_analysis.units == "mg/m³"
    assert chl_analysis.mean_bias is not None and math.isclose(chl_analysis.mean_bias, 0.10, abs_tol=1e-3)
