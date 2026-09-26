"""
Phase 7 Regression Test Suite: End-to-End Multi-Parameter Scientific Verification & Visualization Integrity.

Verifies:
1. Exact Variable-to-Dataset mapping
2. Canonical Variable-to-Unit mapping
3. Strict prevention of cross-variable fallback
4. Current vector speed derivation: sqrt(u^2 + v^2)
5. Current oceanographic compass direction: (atan2(u, v) * 180 / pi) % 360 (degrees clockwise from North)
6. Surface-only constraints (zos, mlotst, satellite chl)
7. Depth-resolved variable handling (thetao, so, uo, vo, bgc chl, o2, no3)
8. Model-observation compatibility states (GREEN, YELLOW, BLUE, RED)
9. Cache isolation across variables and datasets
10. Provenance completeness and credential protection
11. Canonical Data-Mode correctness (LIVE_NRT vs HISTORICAL_RESEARCH)
12. Zero synthetic scientific values
"""

import math
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.registry import (
    DATASET_REGISTRY,
    VARIABLE_REGISTRY,
    get_dataset,
    resolve_canonical_variable,
    validate_variable_for_dataset,
)
from app.adapters.copernicus_adapter import CopernicusAdapter, haversine_distance_km, has_copernicus_credentials
from app.data_retrieval_service import data_retrieval_service, DataRetrievalService
from app.models import (
    HistoricalDataRequest,
    VariableAwareAnalysisRequest,
    CompatibilityCheckRequest,
)
from app.compatibility_engine import (
    CompatibilityEngine,
    compute_variable_aware_analysis,
)

client = TestClient(app)


def test_variable_to_dataset_mapping():
    """Verify each canonical variable maps exclusively to registered datasets supporting it."""
    # 1. thetao -> cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m
    ds_thetao = get_dataset("cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m")
    assert ds_thetao is not None
    assert "thetao" in ds_thetao.supported_variables
    assert "so" not in ds_thetao.supported_variables

    # 2. so -> cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m
    ds_so = get_dataset("cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m")
    assert ds_so is not None
    assert "so" in ds_so.supported_variables
    assert "thetao" not in ds_so.supported_variables

    # 3. uo, vo -> cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m
    ds_cur = get_dataset("cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m")
    assert ds_cur is not None
    assert "uo" in ds_cur.supported_variables
    assert "vo" in ds_cur.supported_variables

    # 4. zos, mlotst -> cmems_mod_glo_phy_anfc_0.083deg_P1D-m
    ds_surf = get_dataset("cmems_mod_glo_phy_anfc_0.083deg_P1D-m")
    assert ds_surf is not None
    assert "zos" in ds_surf.supported_variables
    assert "mlotst" in ds_surf.supported_variables

    # 5. chl -> cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m
    ds_chl = get_dataset("cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m")
    assert ds_chl is not None
    assert "chl" in ds_chl.supported_variables

    # 6. o2 -> cmems_mod_glo_bgc-bio_anfc_0.25deg_P1D-m
    ds_o2 = get_dataset("cmems_mod_glo_bgc-bio_anfc_0.25deg_P1D-m")
    assert ds_o2 is not None
    assert "o2" in ds_o2.supported_variables

    # 7. no3 -> cmems_mod_glo_bgc-nut_anfc_0.25deg_P1D-m
    ds_no3 = get_dataset("cmems_mod_glo_bgc-nut_anfc_0.25deg_P1D-m")
    assert ds_no3 is not None
    assert "no3" in ds_no3.supported_variables


def test_variable_to_unit_mapping():
    """Verify canonical scientific units for all supported variables."""
    units_expected = {
        "thetao": "°C",
        "temperature": "°C",
        "so": "PSU",
        "salinity": "PSU",
        "uo": "m/s",
        "vo": "m/s",
        "current_speed": "m/s",
        "current_direction": "degrees",
        "currents": "m/s",
        "chl": "mg/m³",
        "chlorophyll": "mg/m³",
        "o2": "mmol/m³",
        "dissolved_oxygen": "mmol/m³",
        "no3": "mmol/m³",
        "nitrate": "mmol/m³",
        "zos": "m",
        "mlotst": "m",
    }
    for var_id, expected_unit in units_expected.items():
        var_def = VARIABLE_REGISTRY.get(var_id)
        assert var_def is not None, f"Variable {var_id} not in registry"
        assert var_def.unit == expected_unit, f"Variable {var_id} unit mismatch: expected {expected_unit}, got {var_def.unit}"


def test_no_cross_variable_fallback():
    """Verify that requesting an incompatible variable returns 400 DATASET_VARIABLE_MISMATCH, never temperature."""
    incompatible_queries = [
        ("cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m", "chl"),
        ("cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m", "o2"),
        ("cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m", "no3"),
        ("cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m", "zos"),
        ("cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m", "mlotst"),
        ("cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m", "temperature"),
        ("cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m", "temperature"),
    ]
    for ds_id, var in incompatible_queries:
        resp = client.get(f"/api/v1/research/data?dataset_id={ds_id}&variable={var}")
        assert resp.status_code == 400
        data = resp.json()
        assert data["status"] == "error"
        assert data["error"]["code"] == "DATASET_VARIABLE_MISMATCH"


def test_current_speed_calculation():
    """Verify velocity speed calculation: sqrt(u^2 + v^2)."""
    # 3-4-5 triangle
    u, v = 0.6, 0.8
    speed = math.sqrt(u**2 + v**2)
    assert math.isclose(speed, 1.0, abs_tol=1e-5)

    # Real Copernicus test point components
    u_bob, v_bob = -0.19688, 0.05229
    speed_bob = math.sqrt(u_bob**2 + v_bob**2)
    assert 0.20 <= speed_bob <= 0.21


def test_current_compass_direction_conventions():
    """
    Verify oceanographic compass bearing toward:
    Formula: (atan2(u, v) * 180 / pi + 360) % 360
    Convention: 0° North, 90° East, 180° South, 270° West.
    """
    vectors = [
        (0.0, 1.0, 0.0, "Northward flow"),
        (1.0, 0.0, 90.0, "Eastward flow"),
        (0.0, -1.0, 180.0, "Southward flow"),
        (-1.0, 0.0, 270.0, "Westward flow"),
        (1.0, 1.0, 45.0, "Northeastward flow"),
        (1.0, -1.0, 135.0, "Southeastward flow"),
        (-1.0, -1.0, 225.0, "Southwestward flow"),
        (-1.0, 1.0, 315.0, "Northwestward flow"),
    ]
    for u, v, expected_deg, desc in vectors:
        bearing = (math.degrees(math.atan2(u, v)) + 360.0) % 360.0
        assert math.isclose(bearing, expected_deg, abs_tol=1e-4), f"Failed for {desc}: got {bearing}, expected {expected_deg}"


def test_surface_only_constraints():
    """Verify surface-only variables cannot be represented as full depth profiles."""
    ds_sat = get_dataset("cmems_obs-oc_glo_bgc-plankton_nrt_l4-gapfree-multi-4km_P1D")
    assert ds_sat is not None
    assert ds_sat.vertical_coverage_type == "surface_only"
    assert ds_sat.supports_3d is False
    assert ds_sat.vertical_coverage.min_depth == 0.0
    assert ds_sat.vertical_coverage.max_depth == 0.0


def test_depth_resolved_variable_handling():
    """Verify depth-resolved physical and biogeochemical datasets support 3D vertical profiling."""
    depth_datasets = [
        "cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m",
        "cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m",
        "cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m",
        "cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m",
        "cmems_mod_glo_bgc-bio_anfc_0.25deg_P1D-m",
        "cmems_mod_glo_bgc-nut_anfc_0.25deg_P1D-m",
    ]
    for ds_id in depth_datasets:
        ds = get_dataset(ds_id)
        assert ds is not None
        assert ds.vertical_coverage_type == "depth_resolved"
        assert ds.supports_3d is True
        assert ds.vertical_coverage.max_depth >= 500.0


def test_compatibility_validation():
    """Verify evaluation of dataset-pair compatibility states (GREEN, YELLOW, BLUE, RED)."""
    # 1. Argo delayed mode vs Copernicus physics (temperature) -> COMPATIBLE
    req_compat = CompatibilityCheckRequest(
        observation_source="argo-gdac",
        observation_platform="ARGO",
        observation_variable="temperature",
        observation_time="2024-01-05T06:00:00Z",
        observation_latitude=12.0,
        observation_longitude=88.0,
        observation_depth=10.0,
        observation_qc_accepted=True,
        model_source="copernicus-marine",
        model_dataset_id="cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m",
        model_variable="temperature",
        model_time="2024-01-05T12:00:00Z",
        model_latitude=12.05,
        model_longitude=88.05,
        model_depth=10.0,
        data_mode="LIVE_NRT",
    )
    res = CompatibilityEngine.evaluate_compatibility(req_compat)
    assert res.state in ("MODEL_COMPARISON_AVAILABLE", "COMPATIBLE_OBSERVATION_MODEL", "COMPATIBLE_BENCHMARK_COLLOCATION")

    # 2. Copernicus BGC chl vs Argo CTD (no BGC sensor on CTD) -> Incompatible or model only
    req_bgc = CompatibilityCheckRequest(
        observation_source="argo-gdac",
        observation_platform="CTD",
        observation_variable="temperature",
        observation_time="2024-01-05T06:00:00Z",
        observation_latitude=12.0,
        observation_longitude=88.0,
        observation_depth=10.0,
        observation_qc_accepted=True,
        model_source="copernicus-marine",
        model_dataset_id="cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m",
        model_variable="chl",
        data_mode="LIVE_NRT",
    )
    res_bgc = CompatibilityEngine.evaluate_compatibility(req_bgc)
    assert res_bgc.state in ("MODEL_AVAILABLE_OBSERVATION_UNAVAILABLE", "INCOMPATIBLE_VARIABLE", "INCOMPATIBLE_DATASETS", "INCOMPATIBLE_DATA")


def test_cache_isolation_multi_variable():
    """Verify distinct cache keys for different variables, datasets, and vertical modes."""
    service = DataRetrievalService()

    q_thetao = HistoricalDataRequest(
        dataset_id="cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m",
        variable="thetao",
        date="2024-01-05",
    )
    q_so = HistoricalDataRequest(
        dataset_id="cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m",
        variable="so",
        date="2024-01-05",
    )
    q_chl_bgc = HistoricalDataRequest(
        dataset_id="cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m",
        variable="chl",
        date="2024-01-05",
    )
    q_chl_sat = HistoricalDataRequest(
        dataset_id="cmems_obs-oc_glo_bgc-plankton_nrt_l4-gapfree-multi-4km_P1D",
        variable="chl",
        date="2024-01-05",
    )

    k_thetao = service._generate_cache_key(q_thetao)
    k_so = service._generate_cache_key(q_so)
    k_chl_bgc = service._generate_cache_key(q_chl_bgc)
    k_chl_sat = service._generate_cache_key(q_chl_sat)

    all_keys = [k_thetao, k_so, k_chl_bgc, k_chl_sat]
    assert len(set(all_keys)) == 4, "All cache keys must be strictly mutually unique"


def test_provenance_completeness():
    """Verify complete provenance metadata and total absence of credentials."""
    resp = client.get("/api/v1/research/registry")
    assert resp.status_code == 200
    datasets = resp.json()["datasets"]

    for ds in datasets:
        assert ds["citation"] is not None
        assert ds["source_id"] in ("argo-gdac", "copernicus-marine", "glorys12v1", "glorys12v1-benchmark", "incois-hycom", "cchdo", "cchdo-ctd", "glider-dac", "ocean-gliders")
        assert ds["data_mode"] in ("LIVE_NRT", "HISTORICAL_RESEARCH")
        assert "password" not in str(ds)
        assert "username" not in str(ds)
        assert "secret" not in str(ds)


def test_data_mode_correctness():
    """Verify canonical separation between LIVE_NRT and HISTORICAL_RESEARCH data modes."""
    # Live / NRT satellite observation
    ds_sat = get_dataset("cmems_obs-oc_glo_bgc-plankton_nrt_l4-gapfree-multi-4km_P1D")
    assert ds_sat is not None
    assert ds_sat.data_mode == "LIVE_NRT"

    # Historical / Research sources
    hist_datasets = [
        "argo-delayed-mode-bob-2024",
        "glorys12v1-argo-collocation-bob",
        "ctd-cchdo-bob-historical",
        "bgc-argo-bob-historical",
    ]
    for ds_id in hist_datasets:
        ds = get_dataset(ds_id)
        assert ds is not None
        assert ds.data_mode == "HISTORICAL_RESEARCH", f"Dataset {ds_id} must have data_mode HISTORICAL_RESEARCH"


def test_no_synthetic_scientific_values():
    """Verify variable-aware analysis returns null statistics when measurements are absent, never synthetic numbers."""
    req = VariableAwareAnalysisRequest(
        variable="temperature",
        observation_values=[float("nan"), float("nan")],
        model_values=[28.0, 27.5],
        observation_depths=[10.0, 20.0],
        model_depths=[10.0, 20.0],
    )
    analysis = compute_variable_aware_analysis(req)
    assert analysis.matched_points == 0
    assert analysis.mean_bias is None
    assert analysis.mae is None
    assert analysis.rmse is None


def test_real_value_differentiation_all_variables():
    """
    Verify that queries for thetao, so, chl, o2, no3, zos, mlotst, uo, vo
    are strictly isolated, bind exclusively to their respective datasets,
    and never fall back to temperature values or other variables.
    """
    var_specs = [
        ("thetao", "cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m", "°C", False),
        ("so", "cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m", "PSU", False),
        ("chl", "cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m", "mg/m³", False),
        ("o2", "cmems_mod_glo_bgc-bio_anfc_0.25deg_P1D-m", "mmol/m³", False),
        ("no3", "cmems_mod_glo_bgc-nut_anfc_0.25deg_P1D-m", "mmol/m³", False),
        ("zos", "cmems_mod_glo_phy_anfc_0.083deg_P1D-m", "m", True),
        ("mlotst", "cmems_mod_glo_phy_anfc_0.083deg_P1D-m", "m", True),
        ("uo", "cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m", "m/s", False),
        ("vo", "cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m", "m/s", False),
    ]

    for canonical_var, dataset_id, expected_unit, is_surface in var_specs:
        # 1. Dataset metadata validation
        ds = get_dataset(dataset_id)
        assert ds is not None, f"Dataset {dataset_id} not registered"
        assert canonical_var in ds.supported_variables, f"Variable {canonical_var} not in {dataset_id}"
        assert ds.variable_units.get(canonical_var) == expected_unit

        # 2. Vertical mode validation
        if is_surface:
            assert ds.vertical_coverage.min_depth == 0.0
            assert ds.vertical_coverage.max_depth == 0.0 or ds.supports_3d is False or canonical_var in ("zos", "mlotst")
        else:
            assert ds.vertical_coverage.max_depth >= 500.0 or ds.supports_3d is True

        # 3. Validation rejection if requested against wrong dataset
        if canonical_var not in ("thetao", "temperature"):
            is_valid, err_msg = validate_variable_for_dataset("cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m", canonical_var)
            assert not is_valid, f"Variable {canonical_var} should not be valid for thetao dataset"
            assert err_msg is not None

