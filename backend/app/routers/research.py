"""
Research endpoints — GLORYS × Argo 3D Visualization.

POST /api/v1/research/visualization/3d

Returns real collocation records from processed/glorys_argo_collocation_2024.nc
as a 3D point cloud (longitude, latitude, depth) with Argo and GLORYS values.
"""

from fastapi import APIRouter
from datetime import datetime, timezone
import numpy as np

from ..models import VisualizationRequest
from ..config import (
    COMPARISON_VARIABLES,
    ARGO_LAT_RANGE,
    ARGO_LON_RANGE,
    ARGO_TEMPORAL_DATES,
    VAR_UNITS,
)
from ..datasets import (
    validate_coordinate,
    get_collocation,
)

router = APIRouter()


def _error(code: str, message: str):
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


# ── POST /research/visualization/3d ─────────────────────────────────────────

@router.post("/research/visualization/3d")
def research_visualization_3d(req: VisualizationRequest):
    """
    Research 3D visualization of real GLORYS × Argo collocated observations.

    Returns all collocation records for the requested date as a 3D point cloud.
    Each point contains: latitude, longitude, pressure (depth), Argo value,
    GLORYS value, and difference/error.

    Source: processed/glorys_argo_collocation_2024.nc
    """
    coord_err = validate_coordinate(req.location.latitude, req.location.longitude)
    if coord_err:
        return _error("INVALID_COORDINATE", coord_err)

    # Only temperature and salinity are supported for Research comparison
    if req.variable not in COMPARISON_VARIABLES:
        return _error(
            "UNSUPPORTED_VARIABLE",
            f"Variable '{req.variable}' is not supported for Research visualization. "
            f"Supported: {', '.join(COMPARISON_VARIABLES)}.",
        )

    # Check date validity
    if req.date not in ARGO_TEMPORAL_DATES:
        return _error(
            "INVALID_DATE",
            f"Date {req.date} is not available in the Research collocation dataset. "
            f"Available dates: {', '.join(ARGO_TEMPORAL_DATES)}.",
        )

    ds = get_collocation()

    # Filter by date
    times = ds["time"].values
    target_date = np.datetime64(req.date, "D")
    dates_only = times.astype("datetime64[D]")
    date_mask = dates_only == target_date

    # Get matching indices
    indices = np.where(date_mask)[0]

    if len(indices) == 0:
        return _error(
            "NO_DATA_AVAILABLE",
            f"No collocation observations found for {req.date}.",
        )

    # Build variable-specific field names
    argo_var = f"argo_{req.variable}"
    model_var = f"model_{req.variable}"
    error_var = f"{req.variable}_error"
    unit = VAR_UNITS.get(req.variable, "")

    # Extract all records for this date
    lats = ds["latitude"].values[indices]
    lons = ds["longitude"].values[indices]
    pressures = ds["pressure"].values[indices]
    argo_vals = ds[argo_var].values[indices]
    model_vals = ds[model_var].values[indices]
    error_vals = ds[error_var].values[indices]
    times_vals = ds["time"].values[indices]
    platforms = ds["platform_number"].values[indices]
    cycles = ds["cycle_number"].values[indices]

    import pandas as pd

    points = []
    for i in range(len(indices)):
        # Skip any NaN values
        if np.isnan(argo_vals[i]) or np.isnan(model_vals[i]):
            continue

        # Clean platform number (may have trailing spaces/bytes)
        plat = str(platforms[i]).strip().strip("'b").strip("'").strip()
        cyc = str(cycles[i]).strip()

        points.append({
            "latitude": round(float(lats[i]), 4),
            "longitude": round(float(lons[i]), 4),
            "pressure": round(float(pressures[i]), 2),
            "argoValue": round(float(argo_vals[i]), 4),
            "glorysValue": round(float(model_vals[i]), 4),
            "difference": round(float(error_vals[i]), 4),
            "timestamp": pd.Timestamp(times_vals[i]).isoformat(),
            "platformNumber": plat,
            "cycleNumber": cyc,
        })

    if not points:
        return _error("NO_DATA_AVAILABLE", "No valid collocation records found.")

    # Compute summary statistics
    argo_arr = np.array([p["argoValue"] for p in points])
    glorys_arr = np.array([p["glorysValue"] for p in points])
    diff_arr = np.array([p["difference"] for p in points])

    stats = {
        "totalPoints": len(points),
        "argoMean": round(float(np.mean(argo_arr)), 4),
        "glorysMean": round(float(np.mean(glorys_arr)), 4),
        "meanDifference": round(float(np.mean(diff_arr)), 4),
        "rmsDifference": round(float(np.sqrt(np.mean(diff_arr ** 2))), 4),
        "maxDifference": round(float(np.max(np.abs(diff_arr))), 4),
        "depthRange": [
            round(float(np.min(pressures)), 2),
            round(float(np.max(pressures)), 2),
        ],
        "spatialBounds": {
            "north": round(float(np.max(lats)), 4),
            "south": round(float(np.min(lats)), 4),
            "east": round(float(np.max(lons)), 4),
            "west": round(float(np.min(lons)), 4),
        },
    }

    return _success({
        "variable": req.variable,
        "unit": unit,
        "date": req.date,
        "time": req.time,
        "sourceModel": "GLORYS12V1",
        "sourceObservation": "Argo Delayed Mode",
        "temporalCoverage": "2024-01-01 to 2024-01-14",
        "points": points,
        "stats": stats,
    })
