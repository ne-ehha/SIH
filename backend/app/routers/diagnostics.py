"""
Diagnostics endpoints — Pipeline A.

POST /api/v1/diagnostics
GET  /api/v1/diagnostics/{id}/workflow
"""

from fastapi import APIRouter
from datetime import datetime, timezone
import numpy as np

from ..models import DiagnosticRequest
from ..config import (
    COMPARISON_VARIABLES,
    ARGO_LAT_RANGE,
    ARGO_LON_RANGE,
    ARGO_TEMPORAL_DATES,
)
from ..datasets import (
    validate_coordinate,
    query_collocation,
    get_collocation,
)

router = APIRouter()

# In-memory diagnostic store (for demo — would be a database in production)
_diagnostic_store: dict = {}


def _error(code: str, message: str):
    """
    Standardized application-level error response (HTTP 200 + error body).
    Preserves INTEG1 apiClient.ts compatibility. See comparison.py._error.
    """
    return {
        "status": "error",
        "error": {"code": code, "message": message},
    }


def _success(data: dict):
    return {
        "status": "success",
        "data": data,
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source": "api",
        },
    }


def _analyze_patterns(variable: str, latitude: float, longitude: float) -> dict:
    """
    Analyze collocation data patterns at a location.
    Returns diagnostic results based on actual data analysis.
    """
    ds = get_collocation()

    # Get all collocation data near this location
    lats = ds["latitude"].values
    lons = ds["longitude"].values
    dists = np.sqrt((lats - latitude) ** 2 + (lons - longitude) ** 2)
    nearby_mask = dists < 1.0  # Within 1 degree

    if nearby_mask.sum() == 0:
        return {
            "errorFingerprint": "NO_DATA_NEARBY",
            "possibleCauses": [],
            "topCause": None,
            "status": "complete",
        }

    model_var = f"model_{variable}"
    obs_var = f"argo_{variable}"
    error_var = f"{variable}_error"

    try:
        errors = ds[error_var].values[nearby_mask]
        pressures = ds["pressure"].values[nearby_mask]

        # Remove NaN
        valid = np.isfinite(errors) & np.isfinite(pressures)
        errors = errors[valid]
        pressures = pressures[valid]

        if len(errors) == 0:
            return {
                "errorFingerprint": "INSUFFICIENT_DATA",
                "possibleCauses": [],
                "topCause": None,
                "status": "complete",
            }

        # Depth-dependent analysis
        surface_mask = pressures < 50
        target_mask = (pressures >= 50) & (pressures < 200)
        deep_mask = pressures >= 300

        surface_bias = float(np.mean(errors[surface_mask])) if surface_mask.sum() > 0 else None
        target_bias = float(np.mean(errors[target_mask])) if target_mask.sum() > 0 else None
        deep_bias = float(np.mean(errors[deep_mask])) if deep_mask.sum() > 0 else None

        overall_bias = float(np.mean(errors))
        overall_rmse = float(np.sqrt(np.mean(errors ** 2)))

        # Determine fingerprint
        if target_bias is not None and abs(target_bias) > 0.3 and surface_bias is not None and abs(surface_bias) < abs(target_bias):
            fingerprint = f"SUBSURFACE_{variable.upper()}_BIAS_50_200DBAR"
        elif overall_bias > 0.5:
            fingerprint = f"WARM_{variable.upper()}_BIAS全域"
        elif overall_bias < -0.5:
            fingerprint = f"COLD_{variable.upper()}_BIAS全域"
        else:
            fingerprint = f"SMALL_{variable.upper()}_BIAS"

        # Build causes based on actual patterns
        causes = []

        if target_bias is not None and abs(target_bias) > 0.2:
            causes.append({
                "name": "Vertical Mixing Parameterization",
                "confidence": "medium" if abs(target_bias) > 0.3 else "low",
                "evidence": [
                    f"Target-layer (50-200m) {variable} bias = {target_bias:+.3f}",
                    f"Surface bias = {surface_bias:+.3f}" if surface_bias is not None else "Surface data limited",
                    f"Deep bias = {deep_bias:+.3f}" if deep_bias is not None else "Deep data limited",
                ],
            })

        if surface_bias is not None and abs(surface_bias) > 0.3:
            causes.append({
                "name": "Surface Forcing Error",
                "confidence": "medium",
                "evidence": [
                    f"Surface-layer {variable} bias = {surface_bias:+.3f}",
                    "Wind stress or heat flux may be mis-specified",
                ],
            })

        # Always include sampling as a candidate
        causes.append({
            "name": "Sampling / Collocation Effects",
            "confidence": "low",
            "evidence": [
                f"Analysis based on {len(errors)} nearby observations",
                "Spatial or temporal sampling differences may contribute",
            ],
        })

        causes.append({
            "name": "Bathymetry Resolution",
            "confidence": "low",
            "evidence": [
                "Bathymetric features near the selected location may affect currents",
                "Resolution may not capture important topographic effects",
            ],
        })

        # Select top cause
        confidence_rank = {"high": 3, "medium": 2, "low": 1}
        top_cause = max(causes, key=lambda c: confidence_rank.get(c["confidence"], 0))

        return {
            "errorFingerprint": fingerprint,
            "possibleCauses": causes,
            "topCause": top_cause,
            "status": "complete",
            "_stats": {
                "overall_bias": overall_bias,
                "overall_rmse": overall_rmse,
                "target_bias": target_bias,
                "surface_bias": surface_bias,
                "deep_bias": deep_bias,
                "n_nearby": int(nearby_mask.sum()),
            },
        }
    except (KeyError, ValueError):
        return {
            "errorFingerprint": "ANALYSIS_ERROR",
            "possibleCauses": [],
            "topCause": None,
            "status": "complete",
        }


# ── POST /diagnostics ───────────────────────────────────────────────────────

@router.post("/diagnostics")
def diagnostics(req: DiagnosticRequest):
    """
    Run diagnostic analysis at a location.
    Source: GLORYS×Argo collocation analysis.
    """
    coord_err = validate_coordinate(req.location.latitude, req.location.longitude)
    if coord_err:
        return _error("INVALID_COORDINATE", coord_err)

    if req.variable not in COMPARISON_VARIABLES:
        return _error(
            "UNSUPPORTED_VARIABLE",
            f"Variable '{req.variable}' is not supported for diagnostics.",
        )

    if req.date not in ARGO_TEMPORAL_DATES:
        return _error("INVALID_DATE", f"Date {req.date} not available.")

    result = _analyze_patterns(
        variable=req.variable,
        latitude=req.location.latitude,
        longitude=req.location.longitude,
    )

    diag_id = f"diag_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"

    # Store for workflow retrieval
    _diagnostic_store[diag_id] = {
        "variable": req.variable,
        "depth": req.depth,
        "location": (req.location.latitude, req.location.longitude),
        "result": result,
        "created": datetime.now(timezone.utc).isoformat(),
    }

    # Build scientific caution
    caution = (
        "These are candidate explanations supported by available evidence. "
        "They do NOT establish physical causation. "
        "Possible explanations should be treated as investigation pathways "
        "rather than confirmed causes."
    )

    return _success({
        "id": diag_id,
        "errorFingerprint": result["errorFingerprint"],
        "possibleCauses": result["possibleCauses"],
        "topCause": result["topCause"],
        "status": result["status"],
        "sourceModel": "GLORYS12V1",
        "sourceObservation": "Argo Delayed Mode",
        "caution": caution,
    })


# ── GET /diagnostics/{id}/workflow ──────────────────────────────────────────

@router.get("/diagnostics/{diag_id}/workflow")
def workflow(diag_id: str):
    """
    Investigation workflow for a diagnostic.
    """
    if diag_id not in _diagnostic_store:
        return _error("NOT_FOUND", f"Diagnostic {diag_id} not found.")

    diag = _diagnostic_store[diag_id]
    result = diag["result"]
    variable = diag["variable"]

    # Build workflow steps based on diagnostic results
    steps = [
        {
            "id": "step-1",
            "title": "Detect",
            "description": f"{variable.title()} bias detected at the selected location",
            "status": "complete",
        },
        {
            "id": "step-2",
            "title": "Analyze",
            "description": "Pattern analyzed across depth layers and spatial region",
            "status": "complete",
        },
        {
            "id": "step-3",
            "title": "Diagnose",
            "description": f"Fingerprint: {result['errorFingerprint']}",
            "status": "active" if result.get("possibleCauses") else "complete",
        },
        {
            "id": "step-4",
            "title": "Solutions",
            "description": "Recommended experiments and investigation pathways",
            "status": "inactive",
        },
        {
            "id": "step-5",
            "title": "Evaluate",
            "description": "Compare results against independent data",
            "status": "inactive",
        },
    ]

    # Build solution based on top cause
    top_cause = result.get("topCause")
    solution = None
    if top_cause:
        if "mixing" in top_cause["name"].lower():
            solution = {
                "id": "sol-001",
                "recommendedTest": "Alternative vertical mixing configuration (k-ω vs k-ε)",
                "expectedOutcome": "Check whether subsurface temperature error decreases while surface accuracy is maintained",
                "caution": "This analysis does not establish causality. Results should be validated against multiple independent observations.",
                "status": "inactive",
            }
        elif "forcing" in top_cause["name"].lower():
            solution = {
                "id": "sol-002",
                "recommendedTest": "Compare model surface heat flux with independent forcing product",
                "expectedOutcome": "Determine whether forcing differences contribute to the observed bias",
                "caution": "Forcing comparison is necessary but not sufficient to establish causation.",
                "status": "inactive",
            }
        else:
            solution = {
                "id": "sol-003",
                "recommendedTest": "Repeat analysis with additional time periods and independent Argo profiles",
                "expectedOutcome": "Test whether the pattern is robust across different sampling conditions",
                "caution": "Pattern robustness does not establish physical mechanism.",
                "status": "inactive",
            }

    return _success({
        "steps": steps,
        "solution": solution,
    })
