"""
Pipeline A endpoints — Scientific Comparison (GLORYS×Argo, Jan 2024).

POST /api/v1/comparison
POST /api/v1/profile
POST /api/v1/discrepancy
POST /api/v1/observations
"""

from fastapi import APIRouter
from datetime import datetime, timezone
import numpy as np
import traceback

from ..models import (
    ComparisonRequest,
    ProfileRequest,
    DiscrepancyRequest,
    ObservationRequest,
)
from ..config import (
    COMPARISON_VARIABLES,
    ARGO_LAT_RANGE,
    ARGO_LON_RANGE,
    ARGO_TEMPORAL_DATES,
    VAR_UNITS,
)
from ..datasets import (
    validate_coordinate,
    query_collocation,
    get_collocation_point,
    get_collocation,
    query_argo_stations,
    get_collocation_nearest_point,
)

router = APIRouter()


def _error(code: str, message: str):
    """
    Standardized application-level error response.

    Returned with HTTP 200 (not 4xx/5xx) to preserve INTEG1 apiClient.ts
    compatibility. The apiClient checks response.ok (HTTP 2xx) before parsing
    the JSON body, so returning the error inside a 200 response allows the
    frontend to receive the specific error code and message rather than a
    generic HTTP_ERROR.

    Validation errors (Pydantic) are handled separately as HTTP 422 by the
    global RequestValidationError handler in main.py.
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


def _compute_confidence(diff: float, variable: str) -> str:
    """Compute confidence level from difference magnitude."""
    abs_diff = abs(diff)
    if variable == "temperature":
        if abs_diff < 1:
            return "high"
        elif abs_diff < 2:
            return "medium"
        return "low"
    else:  # salinity
        if abs_diff < 0.3:
            return "high"
        elif abs_diff < 0.5:
            return "medium"
        return "low"


def _compute_health_score(diff: float, variable: str) -> int:
    """Compute health score 0-100 from difference."""
    abs_diff = abs(diff)
    if variable == "temperature":
        return max(0, round(100 - abs_diff * 20))
    else:
        return max(0, round(100 - abs_diff * 40))


def _health_status(score: int) -> str:
    if score >= 85:
        return "excellent"
    elif score >= 70:
        return "good"
    elif score >= 50:
        return "fair"
    return "poor"


# ── POST /comparison ────────────────────────────────────────────────────────

@router.post("/comparison")
def comparison(req: ComparisonRequest):
    """
    Model vs observation comparison at a specific point.
    Source: GLORYS×Argo collocation (Jan 2024).
    Supported variables: temperature, salinity only.
    """
    try:
        # Validate coordinate
        coord_err = validate_coordinate(req.location.latitude, req.location.longitude)
        if coord_err:
            return _error("INVALID_COORDINATE", coord_err)

        # Check if variable is supported for comparison
        if req.variable not in COMPARISON_VARIABLES:
            return _error(
                "UNSUPPORTED_VARIABLE",
                f"Variable '{req.variable}' is not supported for model-observation "
                f"comparison. Argo observations do not include ocean current "
                f"measurements. Use /visualization/3d or /model/profile for "
                f"model-only currents data.",
            )

        # Check date validity
        if req.date not in ARGO_TEMPORAL_DATES:
            return _error(
                "INVALID_DATE",
                f"Date {req.date} is not available in the collocation dataset. "
                f"Available dates: {', '.join(ARGO_TEMPORAL_DATES)}",
            )

        # Check spatial coverage
        if not (ARGO_LAT_RANGE[0] <= req.location.latitude <= ARGO_LAT_RANGE[1]):
            return _error(
                "OUTSIDE_COVERAGE",
                f"Latitude {req.location.latitude} is outside the collocation "
                f"coverage ({ARGO_LAT_RANGE[0]}–{ARGO_LAT_RANGE[1]}°N).",
            )
        if not (ARGO_LON_RANGE[0] <= req.location.longitude <= ARGO_LON_RANGE[1]):
            return _error(
                "OUTSIDE_COVERAGE",
                f"Longitude {req.location.longitude} is outside the collocation "
                f"coverage ({ARGO_LON_RANGE[0]}–{ARGO_LON_RANGE[1]}°E).",
            )

        # Find nearest collocation point within ±10 dbar of requested depth
        point = get_collocation_nearest_point(
            latitude=req.location.latitude,
            longitude=req.location.longitude,
            date=req.date,
            variable=req.variable,
            depth=req.depth,
        )

        if point is None:
            return _error(
                "NO_DATA_AVAILABLE",
                f"No collocation data available at "
                f"lat={req.location.latitude}, lon={req.location.longitude}, "
                f"depth={req.depth}m, date={req.date}.",
            )

        # Compute health metrics — ensure native Python types for JSON serialization
        diff = float(point["difference"])
        unit = VAR_UNITS.get(req.variable, "")
        confidence = _compute_confidence(diff, req.variable)
        health_score = int(_compute_health_score(diff, req.variable))
        health_status = _health_status(health_score)

        summary_parts = [
            f"GLORYS12V1 model {req.variable} at {float(point['pressure']):.0f}m",
            f"shows {'+'if diff >= 0 else ''}{diff:.2f}{unit} bias",
            f"vs Argo observation.",
        ]
        if health_status in ("excellent", "good"):
            summary_parts.append("Bias within typical range.")
        elif health_status == "fair":
            summary_parts.append("Bias exceeds typical range.")
        else:
            summary_parts.append("Bias is unusually large.")

        return _success({
            "point": {
                "modelValue": float(point["modelValue"]),
                "observationValue": float(point["observationValue"]),
                "difference": diff,
                "unit": str(unit),
                "variable": str(req.variable),
                "depth": float(point["pressure"]),
                "confidence": str(confidence),
                "timestamp": str(point["timestamp"]),
            },
            "healthScore": health_score,
            "healthStatus": health_status,
            "healthSummary": " ".join(summary_parts),
            "sourceModel": "GLORYS12V1",
            "sourceObservation": "Argo Delayed Mode",
        })
    except Exception as exc:
        return _error(
            "COMPARISON_ERROR",
            f"Failed to compute comparison: {type(exc).__name__}: {str(exc)}",
        )


# ── POST /profile ───────────────────────────────────────────────────────────

@router.post("/profile")
def profile(req: ProfileRequest):
    """
    Vertical profile (model + observation) at a location.
    Source: GLORYS×Argo collocation (Jan 2024).
    """
    try:
        coord_err = validate_coordinate(req.location.latitude, req.location.longitude)
        if coord_err:
            return _error("INVALID_COORDINATE", coord_err)

        if req.variable not in COMPARISON_VARIABLES:
            return _error(
                "UNSUPPORTED_VARIABLE",
                f"Variable '{req.variable}' is not supported for comparison. "
                f"Use /model/profile for model-only data.",
            )

        if req.date not in ARGO_TEMPORAL_DATES:
            return _error(
                "INVALID_DATE",
                f"Date {req.date} is not available. "
                f"Available: {', '.join(ARGO_TEMPORAL_DATES)}",
            )

        # Query collocation at this location and date
        indices = query_collocation(
            variable=req.variable,
            latitude=req.location.latitude,
            longitude=req.location.longitude,
            date=req.date,
        )

        if len(indices) == 0:
            return _error(
                "NO_DATA_AVAILABLE",
                f"No collocation data near lat={req.location.latitude}, "
                f"lon={req.location.longitude}, date={req.date}.",
            )

        ds = get_collocation()
        unit = VAR_UNITS.get(req.variable, "")
        model_var = f"model_{req.variable}"
        obs_var = f"argo_{req.variable}"

        points = []
        for idx in sorted(indices, key=lambda i: ds["pressure"].values[i]):
            try:
                pressure = float(ds["pressure"].values[idx])
                model_val = float(ds[model_var].values[idx])
                obs_val = float(ds[obs_var].values[idx])

                if np.isnan(model_val) or np.isnan(obs_val):
                    continue

                points.append({
                    "depth": round(float(pressure), 2),
                    "modelValue": round(float(model_val), 4),
                    "observationValue": round(float(obs_val), 4),
                    "unit": str(unit),
                })
            except Exception:
                continue

        if not points:
            return _error("NO_DATA_AVAILABLE", "No valid profile data found.")

        max_depth = max(p["depth"] for p in points)

        return _success({
            "points": points,
            "variable": str(req.variable),
            "unit": str(unit),
            "maxDepth": float(max_depth),
            "sourceModel": "GLORYS12V1",
            "sourceObservation": "Argo Delayed Mode",
            "temporalCoverage": "2024-01-01 to 2024-01-14",
        })
    except Exception as exc:
        return _error(
            "PROFILE_ERROR",
            f"Failed to compute profile: {type(exc).__name__}: {str(exc)}",
        )


# ── POST /discrepancy ───────────────────────────────────────────────────────

@router.post("/discrepancy")
def discrepancy(req: DiscrepancyRequest):
    """
    Error magnitude map for a region.
    Source: GLORYS×Argo collocation (Jan 2024).
    """
    try:
        if req.variable not in COMPARISON_VARIABLES:
            return _error(
                "UNSUPPORTED_VARIABLE",
                f"Variable '{req.variable}' is not supported for comparison.",
            )

        if req.date not in ARGO_TEMPORAL_DATES:
            return _error(
                "INVALID_DATE",
                f"Date {req.date} is not available.",
            )

        # Clamp bounds to collocation coverage
        lat_min = max(req.bounds.south, ARGO_LAT_RANGE[0])
        lat_max = min(req.bounds.north, ARGO_LAT_RANGE[1])
        lon_min = max(req.bounds.west, ARGO_LON_RANGE[0])
        lon_max = min(req.bounds.east, ARGO_LON_RANGE[1])

        if lat_min > lat_max or lon_min > lon_max:
            return _error(
                "OUTSIDE_COVERAGE",
                "Requested region has no overlap with collocation coverage.",
            )

        indices = query_collocation(
            variable=req.variable,
            lat_min=lat_min,
            lat_max=lat_max,
            lon_min=lon_min,
            lon_max=lon_max,
            date=req.date,
        )

        if len(indices) == 0:
            return _error(
                "NO_DATA_AVAILABLE",
                "No collocation data in the requested region and date.",
            )

        ds = get_collocation()
        error_var = f"{req.variable}_error"

        points = []
        errors = []
        for idx in indices:
            try:
                lat = float(ds["latitude"].values[idx])
                lon = float(ds["longitude"].values[idx])
                pressure = float(ds["pressure"].values[idx])
                err = float(ds[error_var].values[idx])

                if np.isnan(err):
                    continue

                error_mag = abs(err)
                errors.append(error_mag)

                points.append({
                    "latitude": round(float(lat), 4),
                    "longitude": round(float(lon), 4),
                    "depth": round(float(pressure), 2),
                    "errorMagnitude": round(float(error_mag), 4),
                    "variable": str(req.variable),
                })
            except Exception:
                continue

        if not points:
            return _error("NO_DATA_AVAILABLE", "No valid discrepancy data found.")

        errors_arr = np.array(errors)
        stats = {
            "meanError": round(float(np.mean(errors_arr)), 4),
            "maxError": round(float(np.max(errors_arr)), 4),
            "rmsError": round(float(np.sqrt(np.mean(errors_arr ** 2))), 4),
            "totalPoints": len(points),
        }

        return _success({
            "points": points,
            "stats": stats,
            "sourceModel": "GLORYS12V1",
            "sourceObservation": "Argo Delayed Mode",
            "temporalCoverage": "2024-01-01 to 2024-01-14",
        })
    except Exception as exc:
        return _error(
            "DISCREPANCY_ERROR",
            f"Failed to compute discrepancy: {type(exc).__name__}: {str(exc)}",
        )


# ── POST /observations ──────────────────────────────────────────────────────

@router.post("/observations")
def observations(req: ObservationRequest):
    """
    List observation stations in a region.
    Source: Argo DM.
    """
    try:
        if req.date not in ARGO_TEMPORAL_DATES:
            return _error(
                "INVALID_DATE",
                f"Date {req.date} is not available.",
            )

        # Determine bounds
        lat_min = ARGO_LAT_RANGE[0]
        lat_max = ARGO_LAT_RANGE[1]
        lon_min = ARGO_LON_RANGE[0]
        lon_max = ARGO_LON_RANGE[1]

        if req.bounds:
            lat_min = max(req.bounds.south, ARGO_LAT_RANGE[0])
            lat_max = min(req.bounds.north, ARGO_LAT_RANGE[1])
            lon_min = max(req.bounds.west, ARGO_LON_RANGE[0])
            lon_max = min(req.bounds.east, ARGO_LON_RANGE[1])

        stations = query_argo_stations(
            date=req.date,
            lat_min=lat_min,
            lat_max=lat_max,
            lon_min=lon_min,
            lon_max=lon_max,
        )

        return _success({
            "stations": stations,
            "totalActive": len(stations),
            "totalPending": 0,
            "region": req.region,
            "temporalCoverage": "2024-01-01 to 2024-01-14",
            "spatialCoverage": {
                "north": ARGO_LAT_RANGE[1],
                "south": ARGO_LAT_RANGE[0],
                "east": ARGO_LON_RANGE[1],
                "west": ARGO_LON_RANGE[0],
            },
        })
    except Exception as exc:
        return _error(
            "OBSERVATIONS_ERROR",
            f"Failed to fetch observations: {type(exc).__name__}: {str(exc)}",
        )
