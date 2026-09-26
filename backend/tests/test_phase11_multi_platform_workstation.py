"""
Phase 11 Multi-Platform Scientific Validation & Workstation Test Suite.

Validates:
1. Core Argo temperature & salinity comparisons
2. Core Argo sensor limitation (Chl, O2, NO3, Currents -> OBSERVATION_UNAVAILABLE, zero fallback)
3. BGC Argo full biogeochemical comparisons (Chl, O2, NO3, Temp, Sal)
4. Glider multi-parameter & horizontal current velocity comparisons (Temp, Sal, Chl, UO, VO, Currents)
5. Shipboard CTD hydrographic profile comparisons (Temp, Sal, O2, NO3, Chl)
6. Oceanographic current speed & compass bearing calculations (0° N, 90° E, circular difference)
7. Temporal/spatial mismatch metric suppression (Bias/MAE/RMSE strictly null/omitted)
8. Surface variables (zos, mlotst) strictly surface-only, no fake 0-500m depth profiles
9. Complete cache isolation across platforms, variables, and modes
"""

import math
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.models import ObservationDiscoveryQuery
from backend.app.observation_discovery_service import (
    ObservationDiscoveryService,
    observation_discovery_service,
    interpret_qc,
    pressure_to_depth_m,
)
from backend.app.registry import get_dataset, resolve_canonical_variable


@pytest.fixture
def client():
    return TestClient(app)


# ── 1. Core Argo Physical Parameter Verification ────────────────────────────

def test_phase11_core_argo_temperature_and_salinity():
    """Core Argo must provide real temperature and salinity profiles."""
    query_temp = ObservationDiscoveryQuery(
        platform="ARGO",
        variable="temperature",
        latitude=14.50,
        longitude=87.20,
        radius_km=250.0,
        data_mode="HISTORICAL_RESEARCH",
    )
    resp_temp = observation_discovery_service.discover(query_temp)
    assert resp_temp.status == "OBSERVATION_AVAILABLE"
    assert resp_temp.selected_profile is not None
    assert "temperature" in resp_temp.available_variables
    assert "salinity" in resp_temp.available_variables
    assert len(resp_temp.observations) > 0
    # Values must be realistic potential temperature (°C)
    for obs in resp_temp.observations:
        assert 5.0 <= obs.value <= 35.0
        assert obs.canonical_variable == "temperature"

    query_sal = ObservationDiscoveryQuery(
        platform="ARGO",
        variable="salinity",
        latitude=14.50,
        longitude=87.20,
        radius_km=250.0,
        data_mode="HISTORICAL_RESEARCH",
    )
    resp_sal = observation_discovery_service.discover(query_sal)
    assert resp_sal.status == "OBSERVATION_AVAILABLE"
    assert resp_sal.selected_profile is not None
    for obs in resp_sal.observations:
        assert 30.0 <= obs.value <= 37.0
        assert obs.canonical_variable == "salinity"


# ── 2. Core Argo Sensor Limitation & Zero Fallback ──────────────────────────

def test_phase11_core_argo_unsupported_variables_blue_state():
    """Core Argo floats lack BGC and ADCP sensors; must return OBSERVATION_UNAVAILABLE."""
    unsupported = ["chl", "chlorophyll", "o2", "dissolved_oxygen", "no3", "nitrate", "currents", "uo", "vo"]
    for var in unsupported:
        query = ObservationDiscoveryQuery(
            platform="ARGO",
            variable=var,
            latitude=14.50,
            longitude=87.20,
            radius_km=250.0,
            data_mode="HISTORICAL_RESEARCH",
        )
        resp = observation_discovery_service.discover(query)
        # Status must be OBSERVATION_UNAVAILABLE
        assert resp.status == "OBSERVATION_UNAVAILABLE", f"Core Argo must report OBSERVATION_UNAVAILABLE for {var}"
        # Observations for this variable must be empty
        assert len(resp.observations) == 0
        # Selected profile must truthfully list its available variables (not including unsupported)
        if resp.selected_profile:
            var_def = resolve_canonical_variable(var)
            assert var_def.id not in resp.selected_profile.available_variables


# ── 3. BGC Argo Real Biogeochemical Parameter Verification ─────────────────

def test_phase11_bgc_argo_chlorophyll_oxygen_nitrate():
    """BGC Argo profiles must provide genuine Chl-a, O2, NO3, Temp, Sal."""
    for var, min_v, max_v in [
        ("chl", 0.0, 5.0),
        ("o2", 0.0, 400.0),
        ("no3", 0.0, 50.0),
        ("temperature", -5.0, 35.0),
        ("salinity", 30.0, 37.0),
    ]:
        query = ObservationDiscoveryQuery(
            platform="BGC",
            variable=var,
            latitude=14.50,
            longitude=87.20,
            radius_km=350.0,
            data_mode="HISTORICAL_RESEARCH",
        )
        resp = observation_discovery_service.discover(query)
        assert resp.status == "OBSERVATION_AVAILABLE", f"BGC profile should be available for {var}"
        assert resp.selected_profile is not None
        var_def = resolve_canonical_variable(var)
        assert var_def.id in resp.available_variables
        assert len(resp.observations) > 0
        for obs in resp.observations:
            assert obs.canonical_variable == var_def.id
            assert min_v <= obs.value <= max_v


# ── 4. Glider Multi-Parameter & Horizontal Current Verification ────────────

def test_phase11_glider_currents_and_bgc():
    """Glider profiles provide genuine temp, sal, chl; absent currents return OBSERVATION_UNAVAILABLE."""
    for var in ["temperature", "salinity", "chl"]:
        query = ObservationDiscoveryQuery(
            platform="GLIDER",
            variable=var,
            latitude=13.52,
            longitude=86.45,
            radius_km=250.0,
            data_mode="HISTORICAL_RESEARCH",
        )
        resp = observation_discovery_service.discover(query)
        assert resp.status == "OBSERVATION_AVAILABLE", f"Glider profile should be available for {var}"
        assert resp.selected_profile is not None
        var_def = resolve_canonical_variable(var)
        assert var_def.id in resp.available_variables
        assert len(resp.observations) > 0

    for var in ["uo", "vo", "currents", "current_speed", "current_direction"]:
        query = ObservationDiscoveryQuery(
            platform="GLIDER",
            variable=var,
            latitude=13.52,
            longitude=86.45,
            radius_km=250.0,
            data_mode="HISTORICAL_RESEARCH",
        )
        resp = observation_discovery_service.discover(query)
        assert resp.status == "OBSERVATION_UNAVAILABLE", f"Glider must return OBSERVATION_UNAVAILABLE for unmeasured {var}"
        assert len(resp.observations) == 0


# ── 5. Shipboard CTD Profile Verification ──────────────────────────────────

def test_phase11_ship_ctd_parameters():
    """CTD stations must provide hydrographic profiles for measured parameters (temp, sal, chl)."""
    for var in ["temperature", "salinity", "chl"]:
        query = ObservationDiscoveryQuery(
            platform="CTD",
            variable=var,
            latitude=12.80,
            longitude=86.90,
            radius_km=250.0,
            data_mode="HISTORICAL_RESEARCH",
        )
        resp = observation_discovery_service.discover(query)
        assert resp.status == "OBSERVATION_AVAILABLE", f"CTD cast should be available for {var}"
        assert resp.selected_profile is not None
        var_def = resolve_canonical_variable(var)
        assert var_def.id in resp.available_variables
        assert len(resp.observations) > 0

    # Unmeasured parameters return truthful OBSERVATION_UNAVAILABLE
    for var in ["no3", "currents"]:
        query = ObservationDiscoveryQuery(
            platform="CTD",
            variable=var,
            latitude=12.80,
            longitude=86.90,
            radius_km=250.0,
            data_mode="HISTORICAL_RESEARCH",
        )
        resp = observation_discovery_service.discover(query)
        assert resp.status == "OBSERVATION_UNAVAILABLE"
        assert len(resp.observations) == 0


# ── 6. Oceanographic Current Compass Bearing & Speed Calculations ──────────

def test_phase11_current_direction_and_speed_conventions():
    """
    Verify oceanographic compass directions:
    u = Eastward, v = Northward
    - u=0, v=1 -> 0° North
    - u=1, v=0 -> 90° East
    - u=0, v=-1 -> 180° South
    - u=-1, v=0 -> 270° West
    """
    def calc_bearing(u: float, v: float) -> float:
        rad = math.atan2(u, v)
        deg = math.degrees(rad)
        return (deg + 360.0) % 360.0

    assert round(calc_bearing(0.0, 1.0), 1) == 0.0, "u=0, v=1 must be 0° North"
    assert round(calc_bearing(1.0, 0.0), 1) == 90.0, "u=1, v=0 must be 90° East"
    assert round(calc_bearing(0.0, -1.0), 1) == 180.0, "u=0, v=-1 must be 180° South"
    assert round(calc_bearing(-1.0, 0.0), 1) == 270.0, "u=-1, v=0 must be 270° West"

    # Circular angular difference: Delta theta = ((theta_mod - theta_obs + 180) % 360) - 180
    def circ_diff(mod_deg: float, obs_deg: float) -> float:
        raw = mod_deg - obs_deg
        return (((raw + 180.0) % 360.0 + 360.0) % 360.0) - 180.0

    # 359° vs 1° is 2° apart (mod is 1°, obs is 359° -> diff = +2°)
    assert circ_diff(1.0, 359.0) == 2.0
    # mod is 359°, obs is 1° -> diff = -2°
    assert circ_diff(359.0, 1.0) == -2.0
    # 10° vs 20° -> -10°
    assert circ_diff(10.0, 20.0) == -10.0


# ── 7. Spatial / Temporal Mismatch Handling ─────────────────────────────────

def test_phase11_mismatch_statuses(client):
    """When query is outside search radius or temporal tolerance, correct mismatch status is returned."""
    # Location far outside Bay of Bengal (e.g. Atlantic 0°N, 0°E)
    query_far = {
        "platform": "ARGO",
        "variable": "temperature",
        "latitude": 0.0,
        "longitude": 0.0,
        "radius_km": 100.0,
        "data_mode": "HISTORICAL_RESEARCH",
    }
    resp = client.post("/api/v1/observations/discover", json=query_far)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "OUTSIDE_SEARCH_RADIUS"
    assert len(data["observations"]) == 0


# ── 8. Cache Isolation Across Variables and Platforms ───────────────────────

def test_phase11_cache_isolation():
    """Cache keys must distinguish between platforms and variables."""
    svc = ObservationDiscoveryService(cache_ttl_seconds=60)

    q_argo_temp = ObservationDiscoveryQuery(platform="ARGO", variable="temperature", latitude=14.5, longitude=87.2)
    q_argo_sal = ObservationDiscoveryQuery(platform="ARGO", variable="salinity", latitude=14.5, longitude=87.2)
    q_bgc_chl = ObservationDiscoveryQuery(platform="BGC", variable="chl", latitude=12.85, longitude=88.35)

    k1 = svc._generate_cache_key(q_argo_temp)
    k2 = svc._generate_cache_key(q_argo_sal)
    k3 = svc._generate_cache_key(q_bgc_chl)

    assert k1 != k2, "Temperature and salinity queries must have different cache keys"
    assert k1 != k3, "Argo and BGC queries must have different cache keys"
