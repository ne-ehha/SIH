"""
Comprehensive test suite for OceanScope Phase 3 Unified Data Retrieval System.

Covers:
1. Dataset registry tests & official CMEMS/Argo/INCOIS identifiers
2. Variable registry tests & CF conventions
3. Dataset-variable compatibility enforcement
4. Request validation (spatial bounds, depth bounds, datetime semantics)
5. Source adapter architecture (Argo, GLORYS, Copernicus, HYCOM)
6. Normalization & Unified Ocean Data Contract
7. Provenance & timestamp semantics (observed_at vs model_valid_at vs retrieved_at)
8. Error handling & truthful unavailability reporting (Copernicus auth requirement)
9. Historical / date-specific retrieval endpoint (GET & POST)
10. Latest available Argo endpoint compatibility
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.registry import (
    DATASET_REGISTRY,
    VARIABLE_REGISTRY,
    get_dataset,
    list_datasets,
    resolve_canonical_variable,
    validate_variable_for_dataset,
)
from app.data_retrieval_service import data_retrieval_service
from app.models import HistoricalDataRequest
from app.adapters.copernicus_adapter import has_copernicus_credentials

client = TestClient(app)


# ── 1. Registry Tests ────────────────────────────────────────────────────────

def test_variable_registry_contents():
    """Verify canonical scientific variables, CF names, units, and physical ranges."""
    assert "thetao" in VARIABLE_REGISTRY
    assert "so" in VARIABLE_REGISTRY
    assert "uo" in VARIABLE_REGISTRY
    assert "vo" in VARIABLE_REGISTRY
    assert "wo" in VARIABLE_REGISTRY
    assert "temperature" in VARIABLE_REGISTRY
    assert "salinity" in VARIABLE_REGISTRY
    assert "pressure" in VARIABLE_REGISTRY

    thetao = VARIABLE_REGISTRY["thetao"]
    assert thetao.unit == "°C"
    assert thetao.category == "thermodynamic"
    assert thetao.cf_standard_name == "sea_water_potential_temperature"

    so = VARIABLE_REGISTRY["so"]
    assert so.unit == "PSU"
    assert so.cf_standard_name == "sea_water_salinity"


def test_variable_resolution_aliases():
    """Verify alias resolution for variables."""
    assert resolve_canonical_variable("TEMP").id in ("temperature", "thetao")
    assert resolve_canonical_variable("PSAL").id in ("salinity", "so")
    assert resolve_canonical_variable("currents_u").id in ("currents_u", "uo")
    assert resolve_canonical_variable("nonexistent_var") is None


def test_copernicus_physical_datasets_registered():
    """Verify official Copernicus physical product and dataset identifiers."""
    copernicus_daily_temp = "cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m"
    copernicus_6h_temp = "cmems_mod_glo_phy-thetao_anfc_0.083deg_PT6H-i"
    copernicus_daily_sal = "cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m"
    copernicus_daily_cur = "cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m"
    copernicus_daily_wcur = "cmems_mod_glo_phy-wcur_anfc_0.083deg_P1D-m"

    assert copernicus_daily_temp in DATASET_REGISTRY
    assert copernicus_6h_temp in DATASET_REGISTRY
    assert copernicus_daily_sal in DATASET_REGISTRY
    assert copernicus_daily_cur in DATASET_REGISTRY
    assert copernicus_daily_wcur in DATASET_REGISTRY

    ds = DATASET_REGISTRY[copernicus_daily_temp]
    assert ds.product_id == "GLOBAL_ANALYSISFORECAST_PHY_001_024"
    assert ds.source_id == "copernicus-marine"
    assert ds.availability_status in ("registered_access_required", "available")
    assert ds.retrieval_capability in ("auth_required", "live_api")


def test_chlorophyll_separation():
    """Ensure chlorophyll is not attached to physical dataset registry."""
    phys_ds = DATASET_REGISTRY["cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m"]
    assert "chlorophyll" not in phys_ds.supported_variables

    chl = VARIABLE_REGISTRY["chlorophyll"]
    assert chl.category == "biogeochemical"


def test_dataset_variable_compatibility():
    """Test compatibility validation between datasets and requested variables."""
    # Valid pairings
    valid, err = validate_variable_for_dataset("glorys12v1-argo-collocation-bob", "temperature")
    assert valid is True
    assert err is None

    valid, err = validate_variable_for_dataset("argo-delayed-mode-bob-2024", "salinity")
    assert valid is True

    # Incompatible pairings
    valid, err = validate_variable_for_dataset("argo-delayed-mode-bob-2024", "currents_u")
    assert valid is False
    assert "not supported" in err

    valid, err = validate_variable_for_dataset("cmems_mod_glo_phy-wcur_anfc_0.083deg_P1D-m", "temperature")
    assert valid is False


# ── 2. Request Validation Tests ──────────────────────────────────────────────

def test_request_validation_lat_bounds():
    """Test invalid latitude bounding box."""
    response = client.get("/api/v1/research/data", params={
        "dataset_id": "argo-delayed-mode-bob-2024",
        "latitude_min": 15.0,
        "latitude_max": 10.0,
    })
    assert response.status_code == 400
    data = response.json()
    assert data["status"] == "error"
    assert data["error"]["code"] == "INVALID_REQUEST"


def test_request_validation_depth_bounds():
    """Test invalid depth bounds."""
    response = client.get("/api/v1/research/data", params={
        "dataset_id": "argo-delayed-mode-bob-2024",
        "depth_min": 500.0,
        "depth_max": 100.0,
    })
    assert response.status_code == 400
    data = response.json()
    assert data["status"] == "error"
    assert data["error"]["code"] == "INVALID_REQUEST"


def test_request_validation_datetime_range():
    """Test invalid start/end datetime range."""
    response = client.get("/api/v1/research/data", params={
        "dataset_id": "argo-delayed-mode-bob-2024",
        "start_datetime": "2024-01-14T00:00:00Z",
        "end_datetime": "2024-01-01T00:00:00Z",
    })
    assert response.status_code == 400
    data = response.json()
    assert data["status"] == "error"
    assert data["error"]["code"] == "INVALID_REQUEST"


def test_request_unsupported_dataset():
    """Test error returned when requesting an unregistered dataset."""
    response = client.get("/api/v1/research/data", params={
        "dataset_id": "unknown-nonexistent-dataset",
    })
    assert response.status_code == 404
    data = response.json()
    assert data["status"] == "error"
    assert data["error"]["code"] == "UNSUPPORTED_DATASET"


# ── 3. Source Adapter & Truthful Data Tests ──────────────────────────────────

def test_copernicus_truthful_auth_requirement():
    """Test that requesting Copernicus Marine behaves truthfully based on auth state."""
    response = client.get("/api/v1/research/data", params={
        "dataset_id": "cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m",
        "variable": "thetao",
        "latitude_min": 14.9,
        "latitude_max": 15.1,
        "longitude_min": 89.9,
        "longitude_max": 90.1,
        "depth_min": 0,
        "depth_max": 10,
        "date": "2026-09-15",
    })
    if not has_copernicus_credentials():
        assert response.status_code in (401, 503)
        data = response.json()
        assert data["status"] == "error"
        assert data["error"]["code"] in ("AUTHENTICATION_REQUIRED", "SOURCE_UNAVAILABLE")
        assert "Copernicus" in data["error"]["message"]
    else:
        # When authenticated credentials are present
        assert response.status_code in (200, 401, 503)
        data = response.json()
        if response.status_code == 200:
            assert data["status"] == "success"
            assert data["mode"] == "historical"


def test_glorys_collocation_retrieval():
    """Test retrieval of real GLORYS × Argo benchmark collocation data."""
    response = client.get("/api/v1/research/data", params={
        "dataset_id": "glorys12v1-argo-collocation-bob",
        "variable": "temperature",
        "date": "2024-01-06",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["mode"] == "historical"
    assert data["query_summary"]["dataset_id"] == "glorys12v1-argo-collocation-bob"
    assert data["query_summary"]["variable"] == "temperature"
    assert len(data["data"]) > 0

    record = data["data"][0]
    assert record["source"] == "glorys12v1"
    assert "model_value" in record
    assert "observation_value" in record
    assert "difference" in record
    assert record["units"] == "°C"
    assert "observed_at" in record
    assert "retrieved_at" in record
    assert record["qc_status"]["difference_convention"] == "GLORYS - Argo"


def test_argo_delayed_mode_records_retrieval():
    """Test retrieval of historical Argo Delayed Mode observations as normalized records."""
    response = client.get("/api/v1/research/data", params={
        "dataset_id": "argo-delayed-mode-bob-2024",
        "variable": "temperature",
        "date": "2024-01-06",
        "format": "records",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert len(data["data"]) > 0

    record = data["data"][0]
    assert record["source"] == "argo-gdac"
    assert record["variable"] == "temperature"
    assert record["observed_at"].endswith("Z")
    assert record["retrieved_at"].endswith("Z")
    assert record["depth"] is not None
    assert record["value"] is not None


def test_argo_delayed_mode_profiles_retrieval():
    """Test retrieval of historical Argo Delayed Mode in 'profiles' format."""
    response = client.get("/api/v1/research/data", params={
        "dataset_id": "argo-delayed-mode-bob-2024",
        "date": "2024-01-06",
        "format": "profiles",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert len(data["data"]) > 0

    profile = data["data"][0]
    assert "profile_id" in profile
    assert "platform_id" in profile
    assert "cycle_number" in profile
    assert "levels" in profile
    assert len(profile["levels"]) > 0
    level = profile["levels"][0]
    assert "pressure" in level
    assert "temperature" in level
    assert "salinity" in level
    assert level["qc_accepted"] is True


def test_incois_hycom_operational_retrieval():
    """Test retrieval of INCOIS HYCOM operational regional model."""
    response = client.get("/api/v1/research/data", params={
        "dataset_id": "incois-hycom-2.35-operational",
        "variable": "temperature",
        "date": "2026-08-27",
        "time": "06:00",
        "depth_min": 0,
        "depth_max": 100,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert len(data["data"]) > 0

    record = data["data"][0]
    assert record["source"] == "incois-hycom"
    assert record["model_valid_at"] is not None
    assert record["value"] is not None


# ── 4. Discovery Endpoints Tests ─────────────────────────────────────────────

def test_registry_discovery_endpoint():
    """Test /research/registry endpoint."""
    response = client.get("/api/v1/research/registry")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["total_datasets"] >= 5
    assert any(d["dataset_id"] == "glorys12v1-argo-collocation-bob" for d in data["datasets"])


def test_variables_discovery_endpoint():
    """Test /research/variables endpoint."""
    response = client.get("/api/v1/research/variables")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["total_variables"] >= 10
    assert any(v["id"] == "thetao" for v in data["variables"])


def test_adapters_status_endpoint():
    """Test /research/adapters/status endpoint."""
    response = client.get("/api/v1/research/adapters/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert len(data["adapters"]) >= 4


# ── 5. Existing Endpoints Regression Check ────────────────────────────────────

def test_latest_argo_status_endpoint_intact():
    """Test that /research/latest/status remains functional."""
    response = client.get("/api/v1/research/latest/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "stream" in data


def test_research_3d_visualization_intact():
    """Test that /research/visualization/3d endpoint remains intact."""
    response = client.post("/api/v1/research/visualization/3d", json={
        "location": {"latitude": 12.0, "longitude": 88.0},
        "variable": "temperature",
        "date": "2024-01-06",
        "time": "12:00",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "points" in data["data"]
    assert "stats" in data["data"]
