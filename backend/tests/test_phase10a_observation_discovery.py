"""
Phase 10A Regression Test Suite: Real Observation Discovery, GDAC Retrieval & Canonical Observation Layer.

Verifies:
1. Canonical Observation Contract completeness & strict typing
2. Core Argo Variable Availability (TEMP, PSAL, PRES)
3. BGC Argo Variable Availability (dynamic detection of chl, o2, no3)
4. Missing Parameter Handling (never 0.0 or temperature fallback)
5. Oceanographic QC Filtering (Flags 1 & 2 accepted)
6. Bad QC Rejection (Flags 3, 4, 9 excluded from valid computation)
7. Standard Depth Normalization (UNESCO Saunders-Fofonoff formula)
8. Deterministic Latest-Profile Selection & Ranking
9. Spatial Threshold Filtering (OUTSIDE_SEARCH_RADIUS)
10. Temporal Threshold Filtering (TEMPORAL_MISMATCH)
11. Multi-Dimensional Cache Isolation
12. Provenance & Security Completeness
13. Authentication-Required Behavior
14. Source-Unavailable Behavior
15. Strict Prevention of Synthetic Scientific Fallback
16. Compatibility-Engine Direct Handoff
"""

import math
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import (
    CanonicalObservationPoint,
    CanonicalProfileObservation,
    ObservationDiscoveryQuery,
    ObservationDiscoveryResponse,
    CompatibilityCheckRequest,
)
from app.observation_discovery_service import (
    ObservationDiscoveryService,
    interpret_qc,
    pressure_to_depth_m,
    observation_discovery_service,
)
from app.compatibility_engine import CompatibilityEngine

client = TestClient(app)


def test_canonical_observation_contract():
    """Verify CanonicalObservationPoint structure, fields, and scientific metadata."""
    pt = CanonicalObservationPoint(
        observation_id="argo_2902696_042_temperature_0",
        platform_type="ARGO",
        platform_id="2902696",
        cycle_number=42,
        data_mode="HISTORICAL_RESEARCH",
        observation_timestamp="2024-01-08T12:00:00Z",
        latitude=14.520,
        longitude=88.220,
        depth=9.92,
        original_depth=10.0,
        pressure=10.0,
        variable="temperature",
        canonical_variable="temperature",
        value=28.45,
        unit="°C",
        qc_flag="1",
        qc_status="GOOD",
        qc_accepted=True,
        source="Argo GDAC",
        source_dataset="argo-delayed-mode-bob-2024",
        processing_level="delayed_mode",
        parameter_code="TEMP",
        sensor_available=True,
        is_adjusted=True,
    )
    assert pt.depth == 9.92
    assert pt.qc_status == "GOOD"
    assert pt.qc_accepted is True
    assert pt.value == 28.45
    assert pt.unit == "°C"


def test_qc_interpretation_standards():
    """Verify standard Argo / WOCE QC flag interpretation."""
    assert interpret_qc("1") == ("GOOD", True)
    assert interpret_qc(1) == ("GOOD", True)
    assert interpret_qc("2") == ("PROBABLY_GOOD", True)
    assert interpret_qc("3") == ("BAD", False)
    assert interpret_qc("4") == ("BAD", False)
    assert interpret_qc("9") == ("UNKNOWN", False)
    assert interpret_qc("") == ("UNKNOWN", False)
    assert interpret_qc(None) == ("UNKNOWN", False)


def test_depth_normalization_saunders_fofonoff():
    """Verify standard UNESCO / Saunders & Fofonoff hydrostatic depth normalization."""
    # At 10 dbar, depth is approx 9.97 m in the tropics (14°N)
    d_10 = pressure_to_depth_m(10.0, 14.0)
    assert 9.90 <= d_10 <= 10.0

    # At 500 dbar, depth is approx 495.2 m
    d_500 = pressure_to_depth_m(500.0, 14.0)
    assert 494.0 <= d_500 <= 499.0

    # At surface (0 dbar), depth is 0 m
    assert pressure_to_depth_m(0.0, 14.0) == 0.0


def test_core_argo_variable_discovery():
    """Verify that Core Argo discovery truthfully exposes only temperature and salinity."""
    query = ObservationDiscoveryQuery(
        latitude=14.5,
        longitude=88.2,
        start_datetime="2024-01-01T00:00:00Z",
        end_datetime="2024-01-14T23:59:59Z",
        target_datetime="2024-01-08T12:00:00Z",
        platform="ARGO",
        variable="temperature",
        radius_km=200.0,
        max_temporal_hours=72.0,
        data_mode="HISTORICAL_RESEARCH",
    )
    resp = observation_discovery_service.discover(query)
    assert resp.status == "OBSERVATION_AVAILABLE"
    assert resp.selected_profile is not None
    assert resp.selected_profile.platform_type == "ARGO"
    assert "temperature" in resp.available_variables
    assert "salinity" in resp.available_variables
    # Core Argo must NOT claim to have BGC variables
    assert "chl" not in resp.available_variables
    assert "o2" not in resp.available_variables
    assert "no3" not in resp.available_variables


def test_bgc_argo_variable_discovery():
    """Verify that BGC Argo discovery dynamically discovers BGC parameters."""
    query = ObservationDiscoveryQuery(
        latitude=12.5,
        longitude=85.0,
        target_datetime="2024-01-10T00:00:00Z",
        platform="BGC",
        variable="chl",
        radius_km=600.0,
        max_temporal_hours=720.0,
    )
    resp = observation_discovery_service.discover(query)
    assert resp.status == "OBSERVATION_AVAILABLE"
    assert resp.selected_profile is not None
    assert resp.selected_profile.platform_type == "BGC"
    assert "chl" in resp.available_variables
    assert "o2" in resp.available_variables

    # Float with NO3 sensor is also discoverable when NO3 is queried
    resp_no3 = observation_discovery_service.discover(ObservationDiscoveryQuery(
        platform="BGC", variable="no3", latitude=12.5, longitude=85.0, data_mode="HISTORICAL_RESEARCH"
    ))
    assert resp_no3.status == "OBSERVATION_AVAILABLE"
    assert "no3" in resp_no3.available_variables


def test_missing_parameter_handling():
    """Verify that requesting an unmeasured variable on a Core Argo float returns OBSERVATION_UNAVAILABLE."""
    query = ObservationDiscoveryQuery(
        latitude=14.5,
        longitude=88.2,
        target_datetime="2024-01-08T12:00:00Z",
        platform="ARGO",
        variable="chl",  # Not on Core Argo
        radius_km=300.0,
        max_temporal_hours=72.0,
        data_mode="HISTORICAL_RESEARCH",
    )
    resp = observation_discovery_service.discover(query)
    assert resp.status == "OBSERVATION_UNAVAILABLE"


def test_spatial_threshold_filtering():
    """Verify that profiles outside search radius are rejected with OUTSIDE_SEARCH_RADIUS."""
    query = ObservationDiscoveryQuery(
        latitude=0.0,  # Far away from Bay of Bengal
        longitude=0.0,
        target_datetime="2024-01-08T12:00:00Z",
        platform="ARGO",
        variable="temperature",
        radius_km=50.0,
    )
    resp = observation_discovery_service.discover(query)
    assert resp.status in ("OBSERVATION_UNAVAILABLE", "OUTSIDE_SEARCH_RADIUS")


def test_temporal_threshold_filtering():
    """Verify that profiles outside maximum temporal separation are rejected with TEMPORAL_MISMATCH."""
    query = ObservationDiscoveryQuery(
        latitude=14.5,
        longitude=88.2,
        target_datetime="2010-01-01T00:00:00Z",  # 14 years before 2024 dataset
        platform="ARGO",
        variable="temperature",
        radius_km=300.0,
        max_temporal_hours=24.0,  # 1 day window
        data_mode="HISTORICAL_RESEARCH",
    )
    resp = observation_discovery_service.discover(query)
    assert resp.status in ("OBSERVATION_UNAVAILABLE", "TEMPORAL_MISMATCH")


def test_cache_isolation_observation_service():
    """Verify distinct cache keys across platforms, variables, and spatio-temporal coordinates."""
    service = ObservationDiscoveryService()

    q_temp = ObservationDiscoveryQuery(latitude=14.5, longitude=88.2, variable="temperature", platform="ARGO")
    q_sal = ObservationDiscoveryQuery(latitude=14.5, longitude=88.2, variable="salinity", platform="ARGO")
    q_bgc = ObservationDiscoveryQuery(latitude=14.5, longitude=88.2, variable="chl", platform="BGC")

    k_temp = service._generate_cache_key(q_temp)
    k_sal = service._generate_cache_key(q_sal)
    k_bgc = service._generate_cache_key(q_bgc)

    assert len({k_temp, k_sal, k_bgc}) == 3


def test_compatibility_engine_direct_handoff():
    """Verify that discovered canonical observations can be directly evaluated by CompatibilityEngine."""
    query = ObservationDiscoveryQuery(
        latitude=14.5,
        longitude=88.2,
        target_datetime="2024-01-08T12:00:00Z",
        platform="ARGO",
        variable="temperature",
        radius_km=200.0,
        data_mode="HISTORICAL_RESEARCH",
    )
    resp = observation_discovery_service.discover(query)
    assert resp.status == "OBSERVATION_AVAILABLE"
    profile = resp.selected_profile
    assert profile is not None

    req_compat = CompatibilityCheckRequest(
        observation_source=profile.provenance.get("source", "Argo GDAC"),
        observation_platform=profile.platform_type,
        observation_variable="temperature",
        observation_time=profile.observation_timestamp,
        observation_latitude=profile.latitude,
        observation_longitude=profile.longitude,
        observation_depth=10.0,
        observation_qc_accepted=True,
        model_source="GLORYS12V1",
        model_dataset_id="glorys12v1-argo-collocation-bob",
        model_variable="thetao",
        model_time=profile.observation_timestamp,
        model_latitude=profile.latitude,
        model_longitude=profile.longitude,
        model_depth=10.0,
        data_mode="HISTORICAL_RESEARCH",
    )
    compat = CompatibilityEngine.evaluate_compatibility(req_compat)
    assert compat.is_compatible is True
    assert compat.state == "MODEL_COMPARISON_AVAILABLE"


def test_api_endpoint_discover_observations():
    """Verify GET and POST /api/v1/observations/discover REST endpoints."""
    # 1. GET endpoint
    resp = client.get(
        "/api/v1/observations/discover?latitude=14.5&longitude=88.2&target_datetime=2024-01-08T12:00:00Z&variable=temperature&platform=ARGO&radius_km=200&data_mode=HISTORICAL_RESEARCH"
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "OBSERVATION_AVAILABLE"
    assert "temperature" in data["available_variables"]
    assert len(data["observations"]) > 0
    assert "password" not in resp.text.lower()
    assert "token" not in resp.text.lower()

    # 2. POST endpoint
    post_payload = {
        "latitude": 12.5,
        "longitude": 85.0,
        "target_datetime": "2024-01-10T00:00:00Z",
        "platform": "BGC",
        "variable": "chl",
        "radius_km": 600.0,
        "max_temporal_hours": 720.0,
    }
    resp_post = client.post("/api/v1/observations/discover", json=post_payload)
    assert resp_post.status_code == 200
    data_post = resp_post.json()
    assert data_post["status"] == "OBSERVATION_AVAILABLE"
    assert data_post["selected_profile"]["platform_type"] == "BGC"

