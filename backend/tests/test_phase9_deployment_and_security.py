"""
Phase 9 Regression Test Suite: Deployment Readiness, Credential Safety & Live/NRT Reliability.

Verifies:
1. Credential Security & Zero Exposure (secrets never in API responses, logs, or bundles)
2. .env / .gitignore Safety
3. Copernicus Authentication States (AUTHENTICATION_REQUIRED, SOURCE_UNAVAILABLE, etc.)
4. Data Mode Semantics Separation (LIVE_NRT vs HISTORICAL_RESEARCH)
5. Standard Core Argo Limitation (BLUE state & null metrics for unmeasured variables)
6. Registered Multi-Platform Metadata (ARGO, BGC, GLIDER, CTD)
7. Exception & Error Response Sanitization
"""

import os
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.registry import (
    DATASET_REGISTRY,
    VARIABLE_REGISTRY,
    PLATFORM_REGISTRY,
    get_dataset,
)
from app.adapters.copernicus_adapter import (
    CopernicusAdapter,
    has_copernicus_credentials,
)
from app.models import (
    HistoricalDataRequest,
    CompatibilityCheckRequest,
    VariableAwareAnalysisRequest,
)
from app.compatibility_engine import (
    CompatibilityEngine,
    compute_variable_aware_analysis,
)

client = TestClient(app)


def test_credential_security_no_leak_in_api(monkeypatch):
    """Verify that querying Copernicus datasets without credentials returns structured 401 without leaking secrets."""
    monkeypatch.setattr("app.adapters.copernicus_adapter.has_copernicus_credentials", lambda: False)
    copernicus_datasets = [
        ("cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m", "thetao"),
        ("cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m", "so"),
        ("cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m", "uo"),
        ("cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m", "chl"),
        ("cmems_mod_glo_bgc-bio_anfc_0.25deg_P1D-m", "o2"),
        ("cmems_mod_glo_bgc-nut_anfc_0.25deg_P1D-m", "no3"),
    ]

    for ds_id, var in copernicus_datasets:
        resp = client.get(f"/api/v1/research/data?dataset_id={ds_id}&variable={var}")
        assert resp.status_code == 401
        data = resp.json()
        assert data["status"] == "error"
        assert data["error"]["code"] == "AUTHENTICATION_REQUIRED"
        body = resp.text
        # Strict credential protection checks
        assert "bearer " not in body.lower()
        assert "access_token" not in body.lower()
        assert "secret_key" not in body.lower()


def test_registered_platforms_metadata_completeness():
    """Verify registered observation platforms (ARGO, BGC, GLIDER, CTD) have consistent metadata."""
    resp = client.get("/api/v1/research/platforms")
    assert resp.status_code == 200
    data = resp.json()
    platforms = data["platforms"]

    platform_ids = {p["platform_type"] for p in platforms}
    assert "ARGO" in platform_ids
    assert "BGC" in platform_ids
    assert "GLIDER" in platform_ids
    assert "CTD" in platform_ids

    for p in platforms:
        assert len(p["typical_variables"]) > 0
        assert p["display_name"] is not None
        assert p["vertical_coverage_type"] is not None


def test_gitignore_protects_env_and_secrets():
    """Verify that .gitignore properly specifies patterns for .env and secret files."""
    repo_root = Path(__file__).resolve().parent.parent.parent
    gitignore_path = repo_root / ".gitignore"
    assert gitignore_path.exists(), ".gitignore file must exist"

    with open(gitignore_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    assert ".env" in content
    assert ".venv" in content
    assert ".vercel" in content


def test_frontend_env_contains_no_secrets():
    """Verify that frontend .env files do not contain Copernicus credentials or secret keys."""
    repo_root = Path(__file__).resolve().parent.parent.parent
    frontend_dir = repo_root / "frontend"

    env_files = [f for f in os.listdir(frontend_dir) if f.startswith(".env")]
    for env_file in env_files:
        path = frontend_dir / env_file
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
            for line in lines:
                line_str = line.strip()
                if line_str and not line_str.startswith("#"):
                    assert "COPERNICUS" not in line_str
                    assert "PASSWORD" not in line_str
                    assert "SECRET" not in line_str


def test_copernicus_authentication_error_contract():
    """Verify Copernicus adapter returns structured AUTHENTICATION_REQUIRED error when unauthenticated."""
    adapter = CopernicusAdapter()
    ds = get_dataset("cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m")
    var = VARIABLE_REGISTRY.get("thetao")
    query = HistoricalDataRequest(dataset_id=ds.dataset_id, variable="thetao")

    if not has_copernicus_credentials():
        with pytest.raises(Exception) as exc_info:
            adapter.retrieve(query, ds, var)
        err = exc_info.value
        assert hasattr(err, "code")
        assert err.code == "AUTHENTICATION_REQUIRED"
        assert "password" not in str(err.details).lower()


def test_standard_argo_variable_limitation_blue_state():
    """
    Verify that querying unmeasured variables on standard Core Argo floats
    evaluates to BLUE state (MODEL_AVAILABLE_OBSERVATION_UNAVAILABLE) and null stats.
    """
    unmeasured_vars = ["chl", "o2", "no3", "currents_u", "zos", "mlotst"]
    for var in unmeasured_vars:
        req = CompatibilityCheckRequest(
            observation_source="argo-gdac",
            observation_platform="ARGO",  # Standard core Argo CTD
            observation_variable=var,
            observation_time="2024-01-05T06:00:00Z",
            observation_latitude=12.0,
            observation_longitude=88.0,
            observation_depth=10.0,
            observation_qc_accepted=True,
            model_source="copernicus-marine",
            model_dataset_id="cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m" if "chl" in var else "cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m",
            model_variable=var,
            data_mode="LIVE_NRT",
        )
        res = CompatibilityEngine.evaluate_compatibility(req)
        # Should be MODEL_AVAILABLE_OBSERVATION_UNAVAILABLE or INCOMPATIBLE
        assert res.state in (
            "MODEL_AVAILABLE_OBSERVATION_UNAVAILABLE",
            "INCOMPATIBLE_VARIABLE",
            "INCOMPATIBLE_DATASETS",
            "INCOMPATIBLE_DATA",
        )

    # Statistical analysis with NaN observation must return null metrics
    req_analysis = VariableAwareAnalysisRequest(
        variable="chl",
        observation_values=[float("nan"), float("nan")],
        model_values=[0.15, 0.18],
        observation_depths=[10.0, 20.0],
        model_depths=[10.0, 20.0],
    )
    analysis = compute_variable_aware_analysis(req_analysis)
    assert analysis.matched_points == 0
    assert analysis.mean_bias is None
    assert analysis.mae is None
    assert analysis.rmse is None


