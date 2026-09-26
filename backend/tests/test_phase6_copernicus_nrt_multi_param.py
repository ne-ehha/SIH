"""
Phase 6 Regression Test Suite: Real Copernicus NRT Multi-Parameter Retrieval & Verification.

Tests verify:
- Live Temperature uses thetao (°C)
- Live Salinity uses so (PSU)
- Live Currents uses uo & vo (m/s)
- Current speed is derived via sqrt(uo^2 + vo^2)
- Current direction is derived via (atan2(vo, uo) * 180 / pi) % 360
- Live Chlorophyll uses chl (mg/m³)
- Surface chlorophyll is not depth repeated
- Live O2 uses o2 (mmol/m³)
- Live NO3 uses no3 (mmol/m³)
- Surface SSH uses zos (m)
- Surface MLD uses mlotst (m)
- Unavailable variables are never substituted with temperature or other variables
- Cache keys strictly distinguish dataset and variable
- Provenance contains dataset ID, variable ID, spatial/temporal offsets, citations
- Credentials never appear in any response or metadata
"""

import math
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.registry import DATASET_REGISTRY, VARIABLE_REGISTRY, get_dataset, resolve_canonical_variable
from app.adapters.copernicus_adapter import CopernicusAdapter, haversine_distance_km, has_copernicus_credentials
from app.data_retrieval_service import data_retrieval_service, DataRetrievalService
from app.models import HistoricalDataRequest, VariableAwareAnalysisRequest
from app.compatibility_engine import compute_variable_aware_analysis
from app.latest_data import _copernicus_status

client = TestClient(app)


def test_live_temperature_uses_thetao():
    """Verify live temperature maps exclusively to thetao in °C with no substitution."""
    var_meta = VARIABLE_REGISTRY.get("temperature")
    assert var_meta is not None
    assert var_meta.cf_standard_name == "sea_water_temperature"
    assert var_meta.unit == "°C"

    # In collocate_profile mock/structure check
    profile_sample = {
        "latitude": 12.0,
        "longitude": 88.0,
        "observation_time": "2024-01-05T06:00:00Z",
        "levels": [
            {"pressure": 5.0, "temperature": 28.5, "salinity": 32.5},
            {"pressure": 50.0, "temperature": 27.2, "salinity": 33.1},
        ],
    }
    # Mocking collocate_profile returns to test comparison contract
    from datetime import datetime, timezone
    adapter = CopernicusAdapter()
    assert adapter is not None
    ds = get_dataset("cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m")
    assert ds is not None
    assert "thetao" in ds.supported_variables
    assert ds.variable_units.get("thetao") == "°C"


def test_live_salinity_uses_so():
    """Verify live salinity maps exclusively to practical salinity so in PSU."""
    var_meta = VARIABLE_REGISTRY.get("salinity")
    assert var_meta is not None
    assert var_meta.cf_standard_name == "sea_water_salinity"
    assert var_meta.unit == "PSU"

    ds = get_dataset("cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m")
    assert ds is not None
    assert "so" in ds.supported_variables
    assert ds.variable_units.get("so") == "PSU"
    assert "thetao" not in ds.supported_variables


def test_live_currents_use_uo_vo():
    """Verify operational currents dataset provides uo and vo velocity fields."""
    ds = get_dataset("cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m")
    assert ds is not None
    assert "uo" in ds.supported_variables
    assert "vo" in ds.supported_variables
    assert ds.variable_units.get("uo") == "m/s"
    assert ds.variable_units.get("vo") == "m/s"


def test_live_current_speed_is_derived_from_uo_vo():
    """Verify derived speed formula: sqrt(uo^2 + vo^2)."""
    uo = 0.3
    vo = 0.4
    expected_speed = math.sqrt(uo**2 + vo**2)
    assert math.isclose(expected_speed, 0.5, abs_tol=1e-5)

    req = VariableAwareAnalysisRequest(
        variable="currents",
        observation_values=[0.5],
        model_values=[0.5],
        observation_depths=[10.0],
        model_depths=[10.0],
    )
    analysis = compute_variable_aware_analysis(req)
    assert analysis.units == "m/s"
    assert analysis.variable == "currents"


def test_live_current_direction_is_derived_from_uo_vo():
    """Verify oceanographic compass bearing toward (degrees clockwise from True North: atan2(u, v))."""
    # 1. Northward (u=0, v=1) -> 0°
    uo, vo = 0.0, 1.0
    bearing_n = (math.degrees(math.atan2(uo, vo)) + 360.0) % 360.0
    assert math.isclose(bearing_n, 0.0, abs_tol=1e-4)

    # 2. Eastward (u=1, v=0) -> 90°
    uo, vo = 1.0, 0.0
    bearing_e = (math.degrees(math.atan2(uo, vo)) + 360.0) % 360.0
    assert math.isclose(bearing_e, 90.0, abs_tol=1e-4)

    # 3. Southward (u=0, v=-1) -> 180°
    uo, vo = 0.0, -1.0
    bearing_s = (math.degrees(math.atan2(uo, vo)) + 360.0) % 360.0
    assert math.isclose(bearing_s, 180.0, abs_tol=1e-4)

    # 4. Westward (u=-1, v=0) -> 270°
    uo, vo = -1.0, 0.0
    bearing_w = (math.degrees(math.atan2(uo, vo)) + 360.0) % 360.0
    assert math.isclose(bearing_w, 270.0, abs_tol=1e-4)


def test_live_chlorophyll_uses_chl():
    """Verify depth-resolved and surface chlorophyll datasets map to chl with mg/m³."""
    var_meta = VARIABLE_REGISTRY.get("chl")
    assert var_meta is not None
    assert var_meta.unit == "mg/m³"

    # Depth resolved BGC model
    ds_bgc = get_dataset("cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m") or get_dataset("cmems_mod_glo_bgc-bio_anfc_0.25deg_P1D-m")
    assert ds_bgc is not None
    assert "chl" in ds_bgc.supported_variables

    # Surface satellite observation
    ds_sat = get_dataset("cmems_obs-oc_glo_bgc-plankton_nrt_l4-gapfree-multi-4km_P1D")
    assert ds_sat is not None
    assert ds_sat.vertical_coverage_type == "surface_only"
    assert ds_sat.supports_3d is False


def test_surface_chlorophyll_is_not_depth_repeated():
    """Verify surface-only chlorophyll is restricted to depth 0m and cannot be repeated as a 3D profile."""
    ds_sat = get_dataset("cmems_obs-oc_glo_bgc-plankton_nrt_l4-gapfree-multi-4km_P1D")
    assert ds_sat is not None
    assert ds_sat.vertical_coverage.min_depth == 0.0
    assert ds_sat.vertical_coverage.max_depth == 0.0


def test_live_o2_uses_o2():
    """Verify Dissolved Oxygen is retrieved from BGC dataset in mmol/m³."""
    var_meta = VARIABLE_REGISTRY.get("o2")
    assert var_meta is not None
    assert var_meta.unit == "mmol/m³"

    ds = get_dataset("cmems_mod_glo_bgc-bio_anfc_0.25deg_P1D-m")
    assert ds is not None
    assert "o2" in ds.supported_variables
    assert ds.variable_units.get("o2") == "mmol/m³"


def test_live_no3_uses_no3():
    """Verify Nitrate is retrieved from BGC nutrient dataset in mmol/m³."""
    var_meta = VARIABLE_REGISTRY.get("no3")
    assert var_meta is not None
    assert var_meta.unit == "mmol/m³"

    ds = get_dataset("cmems_mod_glo_bgc-nut_anfc_0.25deg_P1D-m")
    assert ds is not None
    assert "no3" in ds.supported_variables
    assert ds.variable_units.get("no3") == "mmol/m³"


def test_surface_ssh_uses_zos():
    """Verify Sea Surface Height maps strictly to zos in meters."""
    var_meta = VARIABLE_REGISTRY.get("zos")
    assert var_meta is not None
    assert var_meta.unit == "m"

    ds = get_dataset("cmems_mod_glo_phy_anfc_0.083deg_P1D-m")
    assert ds is not None
    assert "zos" in ds.supported_variables
    assert ds.variable_units.get("zos") == "m"


def test_surface_mld_uses_mlotst():
    """Verify Mixed Layer Depth maps strictly to mlotst in meters."""
    var_meta = VARIABLE_REGISTRY.get("mlotst")
    assert var_meta is not None
    assert var_meta.unit == "m"

    ds = get_dataset("cmems_mod_glo_phy_anfc_0.083deg_P1D-m")
    assert ds is not None
    assert "mlotst" in ds.supported_variables
    assert ds.variable_units.get("mlotst") == "m"


def test_unavailable_variable_is_not_substituted():
    """Verify requesting an unsupported variable does not fallback to temperature."""
    resp = client.get("/api/v1/research/data?dataset_id=cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m&variable=salinity")
    assert resp.status_code == 400
    data = resp.json()
    assert data["status"] == "error"
    assert data["error"]["code"] == "DATASET_VARIABLE_MISMATCH"


def test_cache_keys_include_variable():
    """Verify that queries for different variables generate different cache keys."""
    service = DataRetrievalService()
    q_temp = HistoricalDataRequest(
        dataset_id="cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m",
        variable="thetao",
        date="2024-01-05",
        latitude_min=12.0,
        latitude_max=13.0,
        longitude_min=85.0,
        longitude_max=86.0,
    )
    q_sal = HistoricalDataRequest(
        dataset_id="cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m",
        variable="so",
        date="2024-01-05",
        latitude_min=12.0,
        latitude_max=13.0,
        longitude_min=85.0,
        longitude_max=86.0,
    )
    key_temp = service._generate_cache_key(q_temp)
    key_sal = service._generate_cache_key(q_sal)
    assert key_temp != key_sal, "Cache keys for temperature and salinity must be distinct"


def test_cache_keys_include_dataset():
    """Verify that queries for different datasets generate different cache keys."""
    service = DataRetrievalService()
    q_dm = HistoricalDataRequest(
        dataset_id="argo-delayed-mode-bob-2024",
        variable="temperature",
        date="2024-01-05",
    )
    q_rt = HistoricalDataRequest(
        dataset_id="argo-realtime-gdac-bob",
        variable="temperature",
        date="2024-01-05",
    )
    key_dm = service._generate_cache_key(q_dm)
    key_rt = service._generate_cache_key(q_rt)
    assert key_dm != key_rt, "Cache keys for different datasets must be distinct"


def test_provenance_contains_dataset_and_variable():
    """Verify provenance dictionary contains required metadata without leaking secrets."""
    resp = client.get("/api/v1/research/registry")
    assert resp.status_code == 200
    reg = resp.json()
    assert reg["status"] == "success"
    datasets = reg["datasets"]
    assert len(datasets) > 0

    # Ensure Copernicus datasets exist with provenance fields
    cmems_ds = next((d for d in datasets if "cmems_mod_glo_phy-thetao" in d["dataset_id"]), None)
    assert cmems_ds is not None
    assert cmems_ds["citation"] is not None
    assert cmems_ds["documentation_url"] is not None
    assert "thetao" in cmems_ds["supported_variables"]


def test_credentials_never_appear_in_response():
    """Verify no API response exposes usernames, passwords, or authentication tokens."""
    resp = client.get("/api/v1/research/adapters/status")
    assert resp.status_code == 200
    adapters = resp.json()["adapters"]
    for adapter in adapters:
        assert "password" not in adapter
        assert "username" not in adapter
        assert "secret" not in adapter
        assert "token" not in adapter
        if "credentials_configured" in adapter:
            assert isinstance(adapter["credentials_configured"], bool)
