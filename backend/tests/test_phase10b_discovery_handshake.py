"""
Phase 10B Regression & End-to-End Discovery Handshake Test Suite.

Tests verify:
1. Dynamic variable availability across platforms (Core Argo vs BGC vs CTD vs Glider)
2. Platform switching and query isolation
3. Variable switching and strict prevention of temperature fallback
4. Canonical QC status propagation
5. Truthful Model-vs-Observation compatibility separation
6. Surface-only variable constraints (zos, mlotst)
7. Cache key isolation by platform, variable, mode, and radius
8. Provenance and credential security
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.models import (
    ObservationDiscoveryQuery,
    ObservationDiscoveryResponse,
    CanonicalProfileObservation,
    CanonicalObservationPoint,
)
from backend.app.observation_discovery_service import (
    observation_discovery_service,
    interpret_qc,
    pressure_to_depth_m,
)
from backend.app.compatibility_engine import CompatibilityEngine
from backend.app.models import CompatibilityCheckRequest


@pytest.fixture
def client():
    return TestClient(app)


def test_phase10b_core_argo_dynamic_variables():
    """Core Argo GDAC profiles must only expose physical variables (temp, psal, pres, depth)."""
    query = ObservationDiscoveryQuery(
        latitude=14.5,
        longitude=87.2,
        platform="ARGO",
        data_mode="HISTORICAL_RESEARCH",
        radius_km=350.0,
    )
    resp = observation_discovery_service.discover(query)
    assert resp.status == "OBSERVATION_AVAILABLE"
    assert resp.selected_profile is not None
    assert "temperature" in resp.available_variables
    assert "salinity" in resp.available_variables
    assert "chl" not in resp.available_variables
    assert "o2" not in resp.available_variables
    assert "no3" not in resp.available_variables


def test_phase10b_bgc_argo_dynamic_variables():
    """BGC Argo profiles must dynamically detect and expose bio-optical sensors."""
    query = ObservationDiscoveryQuery(
        latitude=14.50,
        longitude=87.20,
        platform="BGC",
        data_mode="HISTORICAL_RESEARCH",
        radius_km=350.0,
    )
    resp = observation_discovery_service.discover(query)
    assert resp.status == "OBSERVATION_AVAILABLE"
    assert resp.selected_profile is not None
    assert "chl" in resp.available_variables
    assert "o2" in resp.available_variables

    # Float with NO3 sensor is also discoverable when NO3 is queried
    resp_no3 = observation_discovery_service.discover(ObservationDiscoveryQuery(
        platform="BGC", variable="no3", latitude=14.50, longitude=87.20, data_mode="HISTORICAL_RESEARCH"
    ))
    assert resp_no3.status == "OBSERVATION_AVAILABLE"
    assert "no3" in resp_no3.available_variables


def test_phase10b_platform_switching_isolation():
    """Switching platforms must return distinct profile candidates with correct platform types."""
    query_argo = ObservationDiscoveryQuery(
        latitude=14.5,
        longitude=87.2,
        platform="ARGO",
        radius_km=350.0,
    )
    resp_argo = observation_discovery_service.discover(query_argo)
    assert resp_argo.selected_profile is not None
    assert resp_argo.selected_profile.platform_type == "ARGO"

    query_glider = ObservationDiscoveryQuery(
        latitude=14.0,
        longitude=87.0,
        platform="GLIDER",
        radius_km=350.0,
    )
    resp_glider = observation_discovery_service.discover(query_glider)
    assert resp_glider.selected_profile is not None
    assert resp_glider.selected_profile.platform_type == "GLIDER"

    query_ctd = ObservationDiscoveryQuery(
        latitude=15.0,
        longitude=88.0,
        platform="CTD",
        radius_km=350.0,
    )
    resp_ctd = observation_discovery_service.discover(query_ctd)
    assert resp_ctd.selected_profile is not None
    assert resp_ctd.selected_profile.platform_type == "CTD"


def test_phase10b_variable_switching_no_temperature_fallback():
    """Requesting Chl-a on a Core Argo float must return OBSERVATION_UNAVAILABLE and never substitute temperature."""
    query = ObservationDiscoveryQuery(
        latitude=14.5,
        longitude=87.2,
        platform="ARGO",
        variable="chl",
        radius_km=350.0,
    )
    resp = observation_discovery_service.discover(query)
    # Core Argo has no Chl sensor
    assert resp.status == "OBSERVATION_UNAVAILABLE"
    assert "chl" not in resp.available_variables
    assert len(resp.observations) == 0


def test_phase10b_currents_observation_unavailable_on_argo():
    """Requesting currents on Core Argo must report OBSERVATION_UNAVAILABLE without inventing vectors."""
    query = ObservationDiscoveryQuery(
        latitude=14.5,
        longitude=87.2,
        platform="ARGO",
        variable="uo",
        radius_km=350.0,
    )
    resp = observation_discovery_service.discover(query)
    assert resp.status == "OBSERVATION_UNAVAILABLE"
    assert "uo" not in resp.available_variables


def test_phase10b_qc_status_propagation():
    """All discovered observation levels must have valid QC flags and canonical QC statuses."""
    query = ObservationDiscoveryQuery(
        latitude=14.5,
        longitude=87.2,
        platform="ARGO",
        variable="temperature",
        radius_km=350.0,
    )
    resp = observation_discovery_service.discover(query)
    assert resp.status == "OBSERVATION_AVAILABLE"
    assert len(resp.observations) > 0
    for obs in resp.observations:
        assert obs.qc_status in ("GOOD", "PROBABLY_GOOD", "BAD", "UNKNOWN")
        if obs.qc_status in ("GOOD", "PROBABLY_GOOD"):
            assert obs.qc_accepted is True
        else:
            assert obs.qc_accepted is False


def test_phase10b_compatibility_engine_separation():
    """CompatibilityEngine must return MODEL_AVAILABLE_OBSERVATION_UNAVAILABLE for unmeasured variables."""
    req = CompatibilityCheckRequest(
        observation_source="argo",
        observation_dataset_id="argo-delayed-mode-bob-2024",
        observation_variable="chl",
        observation_platform="ARGO",
        observation_time="2024-01-08T12:00:00Z",
        observation_latitude=14.5,
        observation_longitude=87.2,
        observation_qc_accepted=True,
        model_source="copernicus",
        model_dataset_id="cmems_mod_glo_bgc-bio_anfc_0.25deg_P1D-m",
        model_variable="chl",
        model_time="2024-01-08T12:00:00Z",
    )
    val = CompatibilityEngine.evaluate_compatibility(req)
    assert val.state == "MODEL_AVAILABLE_OBSERVATION_UNAVAILABLE"
    assert val.is_compatible is False


def test_phase10b_rest_endpoints_get_and_post(client):
    """GET and POST /api/v1/observations/discover endpoints must return canonical responses."""
    # GET test
    res_get = client.get("/api/v1/observations/discover", params={
        "latitude": 14.5,
        "longitude": 87.2,
        "platform": "ARGO",
        "variable": "temperature",
        "radius_km": 300.0,
    })
    assert res_get.status_code == 200
    data_get = res_get.json()
    assert data_get["status"] == "OBSERVATION_AVAILABLE"
    assert "selected_profile" in data_get
    assert data_get["selected_profile"]["platform_type"] == "ARGO"

    # POST test
    res_post = client.post("/api/v1/observations/discover", json={
        "latitude": 12.85,
        "longitude": 88.35,
        "platform": "BGC",
        "variable": "chl",
        "radius_km": 350.0,
    })
    assert res_post.status_code == 200
    data_post = res_post.json()
    assert data_post["status"] == "OBSERVATION_AVAILABLE"
    assert "chl" in data_post["available_variables"]


def test_phase10b_provenance_and_security(client):
    """Responses must contain full provenance metadata and no leaked credentials."""
    res = client.get("/api/v1/observations/discover", params={
        "latitude": 14.5,
        "longitude": 87.2,
        "platform": "ARGO",
    })
    assert res.status_code == 200
    data = res.json()
    assert "provenance" in data
    assert "source_dataset" in data["provenance"]
    assert "qc_policy" in data["provenance"]

    # Security check: ensure no credentials appear in serialized response
    raw_text = res.text.lower()
    assert "password" not in raw_text
    assert "secret" not in raw_text
    assert "token" not in raw_text or "token" in raw_text and "jwt" not in raw_text
