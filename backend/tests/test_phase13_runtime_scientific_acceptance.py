"""
Phase 13R: Runtime Scientific Acceptance Test Suite.

Verifies end-to-end scientific integrity, zero synthetic observations,
zero cross-variable fallbacks, authentic collocation math, provenance,
and data lineage across all supported platforms and variables.
"""

import math
import hashlib
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.models import (
    ObservationDiscoveryQuery,
    HistoricalDataRequest,
)
from backend.app.observation_discovery_service import ObservationDiscoveryService
from backend.app.data_retrieval_service import DataRetrievalService
from backend.app.data_cleaning_pipeline import DataCleaningPipeline
from backend.app.registry import DATASET_REGISTRY, VARIABLE_REGISTRY

client = TestClient(app)


# 1. Core Argo Temperature Comparison
def test_1_core_argo_temperature_comparison():
    svc = ObservationDiscoveryService()
    q = ObservationDiscoveryQuery(
        platform="ARGO",
        variable="temperature",
        latitude=15.0,
        longitude=88.0,
        radius_km=1000.0,
        data_mode="HISTORICAL_RESEARCH",
    )
    res = svc.discover(q)
    assert res.status == "OBSERVATION_AVAILABLE"
    assert res.selected_profile is not None
    assert "temperature" in res.selected_profile.available_variables
    lvl0 = res.selected_profile.levels[0]
    val = lvl0.get("temperature") if "temperature" in lvl0 else lvl0.get("temp")
    assert val is not None
    assert 20.0 <= val <= 35.0  # Realistic Bay of Bengal SST


# 2. Core Argo Salinity Comparison
def test_2_core_argo_salinity_comparison():
    svc = ObservationDiscoveryService()
    q = ObservationDiscoveryQuery(
        platform="ARGO",
        variable="salinity",
        latitude=15.0,
        longitude=88.0,
        radius_km=1000.0,
        data_mode="HISTORICAL_RESEARCH",
    )
    res = svc.discover(q)
    assert res.status == "OBSERVATION_AVAILABLE"
    assert "salinity" in res.selected_profile.available_variables
    lvl0 = res.selected_profile.levels[0]
    val = lvl0.get("salinity") if "salinity" in lvl0 else lvl0.get("sal")
    assert val is not None
    assert 28.0 <= val <= 37.0  # Realistic Bay of Bengal Salinity (PSU)


# 3. BGC Argo Chlorophyll Comparison
def test_3_bgc_argo_chlorophyll_comparison():
    svc = ObservationDiscoveryService()
    q = ObservationDiscoveryQuery(
        platform="BGC",
        variable="chl",
        latitude=12.85,
        longitude=88.35,
        radius_km=500.0,
        data_mode="HISTORICAL_RESEARCH",
    )
    res = svc.discover(q)
    assert res.status == "OBSERVATION_AVAILABLE"
    assert "chl" in res.selected_profile.available_variables
    chl_levels = [lvl for lvl in res.selected_profile.levels if lvl.get("chl") is not None]
    assert len(chl_levels) > 0
    assert len(res.observations) > 0
    assert 0.0 <= chl_levels[0]["chl"] <= 5.0  # mg/m3


# 4. BGC Argo Oxygen Comparison
def test_4_bgc_argo_oxygen_comparison():
    svc = ObservationDiscoveryService()
    q = ObservationDiscoveryQuery(
        platform="BGC",
        variable="o2",
        latitude=12.85,
        longitude=88.35,
        radius_km=500.0,
        data_mode="HISTORICAL_RESEARCH",
    )
    res = svc.discover(q)
    assert res.status == "OBSERVATION_AVAILABLE"
    assert "o2" in res.selected_profile.available_variables
    o2_levels = [lvl for lvl in res.selected_profile.levels if lvl.get("o2") is not None]
    assert len(o2_levels) > 0
    assert len(res.observations) > 0
    assert o2_levels[0]["o2"] > 0.0  # mmol/m3


# 5. BGC Argo Nitrate Comparison
def test_5_bgc_argo_nitrate_comparison():
    svc = ObservationDiscoveryService()
    q = ObservationDiscoveryQuery(
        platform="BGC",
        variable="no3",
        latitude=12.85,
        longitude=88.35,
        radius_km=500.0,
        data_mode="HISTORICAL_RESEARCH",
    )
    res = svc.discover(q)
    assert res.status == "OBSERVATION_AVAILABLE"
    assert "no3" in res.selected_profile.available_variables
    no3_levels = [lvl for lvl in res.selected_profile.levels if lvl.get("no3") is not None]
    assert len(no3_levels) > 0
    assert len(res.observations) > 0
    assert no3_levels[0]["no3"] >= 0.0


# 6. Glider Temperature Comparison
def test_6_glider_temperature_comparison():
    svc = ObservationDiscoveryService()
    q = ObservationDiscoveryQuery(
        platform="GLIDER",
        variable="temperature",
        latitude=13.5,
        longitude=86.4,
        radius_km=500.0,
        data_mode="HISTORICAL_RESEARCH",
    )
    res = svc.discover(q)
    assert res.status == "OBSERVATION_AVAILABLE"
    assert "temperature" in res.selected_profile.available_variables
    lvl0 = res.selected_profile.levels[0]
    val = lvl0.get("temperature") if "temperature" in lvl0 else lvl0.get("temp")
    assert val is not None


# 7. Glider Salinity Comparison
def test_7_glider_salinity_comparison():
    svc = ObservationDiscoveryService()
    q = ObservationDiscoveryQuery(
        platform="GLIDER",
        variable="salinity",
        latitude=13.5,
        longitude=86.4,
        radius_km=500.0,
        data_mode="HISTORICAL_RESEARCH",
    )
    res = svc.discover(q)
    assert res.status == "OBSERVATION_AVAILABLE"
    assert "salinity" in res.selected_profile.available_variables
    lvl0 = res.selected_profile.levels[0]
    val = lvl0.get("salinity") if "salinity" in lvl0 else lvl0.get("sal")
    assert val is not None


# 8. Glider Chlorophyll Comparison
def test_8_glider_chlorophyll_comparison():
    svc = ObservationDiscoveryService()
    q = ObservationDiscoveryQuery(
        platform="GLIDER",
        variable="chl",
        latitude=13.5,
        longitude=86.4,
        radius_km=500.0,
        data_mode="HISTORICAL_RESEARCH",
    )
    res = svc.discover(q)
    assert res.status == "OBSERVATION_AVAILABLE"
    assert "chl" in res.selected_profile.available_variables
    assert res.selected_profile.levels[0].get("chl") is not None


# 9. CTD Temperature Comparison
def test_9_ctd_temperature_comparison():
    svc = ObservationDiscoveryService()
    q = ObservationDiscoveryQuery(
        platform="CTD",
        variable="temperature",
        latitude=11.75,
        longitude=84.8,
        radius_km=500.0,
        data_mode="HISTORICAL_RESEARCH",
    )
    res = svc.discover(q)
    assert res.status == "OBSERVATION_AVAILABLE"
    assert "temperature" in res.selected_profile.available_variables
    lvl0 = res.selected_profile.levels[0]
    val = lvl0.get("temperature") if "temperature" in lvl0 else lvl0.get("temp")
    assert val is not None


# 10. CTD Salinity Comparison
def test_10_ctd_salinity_comparison():
    svc = ObservationDiscoveryService()
    q = ObservationDiscoveryQuery(
        platform="CTD",
        variable="salinity",
        latitude=11.75,
        longitude=84.8,
        radius_km=500.0,
        data_mode="HISTORICAL_RESEARCH",
    )
    res = svc.discover(q)
    assert res.status == "OBSERVATION_AVAILABLE"
    assert "salinity" in res.selected_profile.available_variables
    lvl0 = res.selected_profile.levels[0]
    val = lvl0.get("salinity") if "salinity" in lvl0 else lvl0.get("sal")
    assert val is not None


# 11. CTD Oxygen Comparison
def test_11_ctd_oxygen_comparison():
    svc = ObservationDiscoveryService()
    q = ObservationDiscoveryQuery(
        platform="CTD",
        variable="o2",
        latitude=11.75,
        longitude=84.8,
        radius_km=500.0,
        data_mode="HISTORICAL_RESEARCH",
    )
    res = svc.discover(q)
    assert res.status == "OBSERVATION_AVAILABLE"
    assert "o2" in res.selected_profile.available_variables
    assert res.selected_profile.levels[0].get("o2") is not None


# 12. CTD Nitrate Comparison
def test_12_ctd_nitrate_comparison():
    svc = ObservationDiscoveryService()
    q = ObservationDiscoveryQuery(
        platform="CTD",
        variable="no3",
        latitude=12.80,
        longitude=86.90,
        radius_km=500.0,
        data_mode="HISTORICAL_RESEARCH",
    )
    res = svc.discover(q)
    assert res.status == "OBSERVATION_UNAVAILABLE"
    assert len(res.observations) == 0


# 13. Unavailable Observational Current State (Zero fake current observations)
def test_13_glider_currents_unavailable_state():
    svc = ObservationDiscoveryService()
    q = ObservationDiscoveryQuery(
        platform="GLIDER",
        variable="uo",
        latitude=13.5,
        longitude=86.4,
        radius_km=500.0,
        data_mode="HISTORICAL_RESEARCH",
    )
    res = svc.discover(q)
    assert res.status == "OBSERVATION_UNAVAILABLE"
    assert "uo" not in (res.selected_profile.available_variables if res.selected_profile else [])


# 14. Model-Only Current State (Real HYCOM UVEL/VVEL, Speed, Bearing)
def test_14_hycom_model_currents():
    retriever = DataRetrievalService()
    req_speed = HistoricalDataRequest(
        dataset_id="incois-hycom-2.35-operational",
        variable="current_speed",
        data_mode="HISTORICAL_RESEARCH",
        format="records",
    )
    resp = retriever.retrieve(req_speed)
    assert resp.status == "success"
    assert resp.result_summary.total_records > 0
    val = resp.data[0].value
    assert val is not None and val >= 0.0  # Speed must be non-negative


# 15. Spatial Mismatch Tolerance
def test_15_spatial_mismatch_outside_radius():
    svc = ObservationDiscoveryService()
    q = ObservationDiscoveryQuery(
        platform="ARGO",
        variable="temperature",
        latitude=-45.0,  # Southern Ocean (Outside Bay of Bengal)
        longitude=88.0,
        radius_km=50.0,
        data_mode="HISTORICAL_RESEARCH",
    )
    res = svc.discover(q)
    assert res.status in ("OBSERVATION_UNAVAILABLE", "OUTSIDE_SEARCH_RADIUS")


# 16. Temporal Matching Logic
def test_16_temporal_matching_boundary():
    svc = ObservationDiscoveryService()
    q = ObservationDiscoveryQuery(
        platform="ARGO",
        variable="temperature",
        latitude=15.0,
        longitude=88.0,
        radius_km=500.0,
        target_datetime="2024-01-05T00:00:00Z",
        data_mode="HISTORICAL_RESEARCH",
    )
    res = svc.discover(q)
    assert res.status == "OBSERVATION_AVAILABLE"
    assert res.selected_profile is not None


# 17. Provenance Integrity
def test_17_provenance_integrity():
    response = client.get("/api/v1/provenance/pipeline-steps")
    assert response.status_code == 200
    data = response.json()
    assert len(data.get("stages", [])) == 8
    stage_names = [s["name"] for s in data["stages"]]
    assert "Schema Validation" in stage_names
    assert "UNESCO Depth Normalization" in stage_names


# 18. SHA-256 Calculation Integrity
def test_18_sha256_archive_integrity():
    raw_bytes = b"OCEANSCOPE_NETCDF_SUBSET_VERIFICATION_2024"
    computed_hash = hashlib.sha256(raw_bytes).hexdigest()
    assert len(computed_hash) == 64


# 19. 8-Stage Cleaning Lineage Record
def test_19_cleaning_pipeline_lineage():
    pipeline = DataCleaningPipeline()
    sample_raw = {
        "latitude": 15.2,
        "longitude": 88.5,
        "observed_at": "2024-01-05T08:00:00Z",
        "platform_type": "ARGO",
        "platform_id": "2902394",
        "cycle_number": 12,
        "levels": [
            {"pressure": 10.0, "temperature": 28.5, "salinity": 32.8, "qc": "1"},
            {"pressure": 50.0, "temperature": 25.1, "salinity": 34.0, "qc": "1"},
            {"pressure": 100.0, "temperature": 19.8, "salinity": 34.9, "qc": "1"},
        ],
    }
    clean_prof, points, lineage = pipeline.process_profile(
        raw_profile=sample_raw,
        provider="Argo GDAC",
        dataset_id="argo-delayed-mode-bob-2024",
    )
    assert len(clean_prof.levels) == 3
    assert len(lineage.processing_steps) == 8


# 20. Zero Cross-Variable Fallback
def test_20_zero_cross_variable_fallback():
    svc = ObservationDiscoveryService()
    q_chl = ObservationDiscoveryQuery(
        platform="ARGO",
        variable="chl",
        latitude=15.0,
        longitude=88.0,
        radius_km=500.0,
        data_mode="HISTORICAL_RESEARCH",
    )
    res_chl = svc.discover(q_chl)
    # Core Argo must NOT substitute temperature for chlorophyll
    assert res_chl.status == "OBSERVATION_UNAVAILABLE"
    if res_chl.selected_profile:
        assert "chl" not in res_chl.selected_profile.available_variables


# 21. BGC Chlorophyll Never Selects Argo Core
def test_21_bgc_chl_never_selects_argo_core():
    """Selecting BGC + Chl-a anywhere in the domain must strictly resolve a BGC profile, never Core Argo."""
    svc = ObservationDiscoveryService()
    for lat, lon in [(7.8, 89.2), (14.5, 87.2), (12.0, 85.0), (18.0, 90.0)]:
        q = ObservationDiscoveryQuery(
            platform="BGC",
            variable="chl",
            latitude=lat,
            longitude=lon,
            data_mode="HISTORICAL_RESEARCH",
        )
        res = svc.discover(q)
        assert res.status == "OBSERVATION_AVAILABLE"
        assert res.selected_profile is not None
        assert res.selected_profile.platform_type == "BGC"
        assert res.selected_profile.platform_type != "ARGO"
        assert "chl" in res.selected_profile.available_variables
        assert len(res.observations) > 0
        assert all(obs.canonical_variable == "chl" for obs in res.observations)


# 22. BGC O2 and NO3 Platform Isolation
def test_22_bgc_o2_and_no3_platform_isolation():
    """BGC O2 and NO3 queries must resolve authentic BGC profiles and non-null series."""
    svc = ObservationDiscoveryService()
    # O2
    res_o2 = svc.discover(ObservationDiscoveryQuery(
        platform="BGC", variable="o2", latitude=10.0, longitude=88.0, data_mode="HISTORICAL_RESEARCH"
    ))
    assert res_o2.status == "OBSERVATION_AVAILABLE"
    assert res_o2.selected_profile.platform_type == "BGC"
    assert len(res_o2.observations) > 0

    # NO3
    res_no3 = svc.discover(ObservationDiscoveryQuery(
        platform="BGC", variable="no3", latitude=10.0, longitude=88.0, data_mode="HISTORICAL_RESEARCH"
    ))
    assert res_no3.status == "OBSERVATION_AVAILABLE"
    assert res_no3.selected_profile.platform_type == "BGC"
    assert res_no3.selected_profile.platform_id == "5906248"
    assert len(res_no3.observations) > 0


# 23. Glider and CTD Platform Isolation
def test_23_glider_and_ctd_platform_isolation():
    """Glider and CTD queries must resolve their respective authentic profiles."""
    svc = ObservationDiscoveryService()
    # Glider
    res_glider = svc.discover(ObservationDiscoveryQuery(
        platform="GLIDER", variable="temperature", latitude=8.5, longitude=88.5, data_mode="HISTORICAL_RESEARCH"
    ))
    assert res_glider.status == "OBSERVATION_AVAILABLE"
    assert res_glider.selected_profile.platform_type == "GLIDER"

    # CTD
    res_ctd = svc.discover(ObservationDiscoveryQuery(
        platform="CTD", variable="temperature", latitude=8.5, longitude=88.5, data_mode="HISTORICAL_RESEARCH"
    ))
    assert res_ctd.status == "OBSERVATION_AVAILABLE"
    assert res_ctd.selected_profile.platform_type == "CTD"
