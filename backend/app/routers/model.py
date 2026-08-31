"""
Pipeline B endpoints — Model Exploration (HYCOM 2026).

POST /api/v1/visualization/3d
POST /api/v1/model/profile
POST /api/v1/model/grid
"""

from fastapi import APIRouter
from datetime import datetime, timezone
import numpy as np

from ..models import (
    VisualizationRequest,
    ModelProfileRequest,
    ModelGridRequest,
)
from ..config import (
    HYCOM_DEPTH_LEVELS,
    HYCOM_LAT_RANGE,
    HYCOM_LON_RANGE,
    HYCOM_TIMESTEPS,
    HYCOM_VAR_MAP,
    MODEL_VARIABLES,
    VAR_UNITS,
    VIZ_GRID_HALF_SIZE,
)
from ..datasets import (
    validate_coordinate,
    is_in_hycom_coverage,
    find_nearest_hycom_indices,
    find_nearest_hycom_time_index,
    get_hycom,
    get_hycom_value,
    get_hycom_depth_index,
    get_hycom_vertical_profile,
    get_hycom_grid_around,
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


# ── POST /visualization/3d ──────────────────────────────────────────────────

@router.post("/visualization/3d")
def visualization_3d(req: VisualizationRequest):
    """
    3D model visualization data.
    Source: HYCOM 2026 (model-only, no observations).
    Returns 8×8 grid at each of 6 HYCOM depth levels (max 384 grid points).
    """
    coord_err = validate_coordinate(req.location.latitude, req.location.longitude)
    if coord_err:
        return _error("INVALID_COORDINATE", coord_err)

    if req.variable not in MODEL_VARIABLES:
        return _error(
            "UNSUPPORTED_VARIABLE",
            f"Variable '{req.variable}' is not supported.",
        )

    if not is_in_hycom_coverage(req.location.latitude, req.location.longitude):
        return _error(
            "OUTSIDE_COVERAGE",
            f"lat={req.location.latitude}, lon={req.location.longitude} "
            f"is outside HYCOM coverage "
            f"({HYCOM_LAT_RANGE[0]}–{HYCOM_LAT_RANGE[1]}°N, "
            f"{HYCOM_LON_RANGE[0]}–{HYCOM_LON_RANGE[1]}°E).",
        )

    # Find time index (may fail if HYCOM dataset is unavailable)
    try:
        time_idx = find_nearest_hycom_time_index(req.date, req.time)
    except FileNotFoundError:
        return _error(
            "DATASET_UNAVAILABLE",
            "HYCOM model dataset is not available on this server. "
            "Pipeline B (model exploration) requires the INCOIS HYCOM 2.35 file.",
        )

    if time_idx is None:
        return _error(
            "INVALID_DATE",
            f"Date {req.date} {req.time} is outside HYCOM coverage "
            f"(2026-08-26 to 2026-09-01, 6-hourly steps: "
            f"{', '.join(HYCOM_TIMESTEPS)}).",
        )

    unit = VAR_UNITS.get(req.variable, "")
    try:
        lat_idx, lon_idx = find_nearest_hycom_indices(
            req.location.latitude, req.location.longitude
        )
    except FileNotFoundError:
        return _error(
            "DATASET_UNAVAILABLE",
            "HYCOM model dataset is not available on this server.",
        )

    # Build depth slices with 8×8 grid at each depth
    depth_slices = []
    for d_idx, depth in enumerate(HYCOM_DEPTH_LEVELS):
        try:
            grid_points = get_hycom_grid_around(
                variable=req.variable,
                latitude=req.location.latitude,
                longitude=req.location.longitude,
                time_idx=time_idx,
                depth_idx=d_idx,
            )
        except FileNotFoundError:
            return _error(
                "DATASET_UNAVAILABLE",
                "HYCOM model dataset is not available on this server.",
            )

        # Compute mean of non-null values
        valid_values = [p["value"] for p in grid_points if p["value"] is not None]
        mean_value = round(float(np.mean(valid_values)), 4) if valid_values else 0.0

        depth_slices.append({
            "depth": depth,
            "meanValue": mean_value,
            "unit": unit,
            "gridPoints": grid_points,
        })

    # Build vertical profile (model-only)
    try:
        profile_points = get_hycom_vertical_profile(
            variable=req.variable,
            lat_idx=lat_idx,
            lon_idx=lon_idx,
            time_idx=time_idx,
        )
    except FileNotFoundError:
        return _error(
            "DATASET_UNAVAILABLE",
            "HYCOM model dataset is not available on this server.",
        )

    # For currents, omit observationValue from profile points
    is_currents = req.variable in ("currents_u", "currents_v")

    vertical_profile = []
    for p in profile_points:
        entry = {
            "depth": p["depth"],
            "modelValue": p["modelValue"],
            "unit": p["unit"],
        }
        if not is_currents:
            entry["observationValue"] = None
        # For currents, observationValue is omitted entirely (not included in dict)
        vertical_profile.append(entry)

    # Surface layer = depth 0 grid points (for INTEG1 surfaceLayer field)
    surface_layer = depth_slices[0]["gridPoints"] if depth_slices else []

    obs_note = (
        "Observation data unavailable for currents. Model-only visualization."
        if is_currents
        else "Observation data not available for this variable and time period. Model-only visualization."
    )

    return _success({
        "variable": req.variable,
        "unit": unit,
        "sourceModel": "INCOIS HYCOM 2.35",
        "sourceObservation": None,
        "observationNote": obs_note,
        "date": req.date,
        "time": req.time,
        "depthLevels": HYCOM_DEPTH_LEVELS,
        "depthSlices": depth_slices,
        "verticalProfile": vertical_profile,
        "surfaceLayer": surface_layer,
    })


# ── POST /model/profile ─────────────────────────────────────────────────────

@router.post("/model/profile")
def model_profile(req: ModelProfileRequest):
    """
    Model-only vertical profile.
    Source: HYCOM 2026.
    """
    coord_err = validate_coordinate(req.location.latitude, req.location.longitude)
    if coord_err:
        return _error("INVALID_COORDINATE", coord_err)

    if req.variable not in MODEL_VARIABLES:
        return _error("UNSUPPORTED_VARIABLE", f"Variable '{req.variable}' not supported.")

    if not is_in_hycom_coverage(req.location.latitude, req.location.longitude):
        return _error("OUTSIDE_COVERAGE", "Coordinate outside HYCOM coverage.")

    try:
        time_idx = find_nearest_hycom_time_index(req.date, req.time)
    except FileNotFoundError:
        return _error("DATASET_UNAVAILABLE", "HYCOM model dataset is not available on this server.")

    if time_idx is None:
        return _error("INVALID_DATE", "Date/time outside HYCOM coverage.")

    try:
        lat_idx, lon_idx = find_nearest_hycom_indices(
            req.location.latitude, req.location.longitude
        )
    except FileNotFoundError:
        return _error("DATASET_UNAVAILABLE", "HYCOM model dataset is not available on this server.")

    try:
        profile_points = get_hycom_vertical_profile(
            variable=req.variable,
            lat_idx=lat_idx,
            lon_idx=lon_idx,
            time_idx=time_idx,
        )
    except FileNotFoundError:
        return _error("DATASET_UNAVAILABLE", "HYCOM model dataset is not available on this server.")

    if not profile_points:
        return _error("NO_MODEL_DATA", "No model data at this location (likely land).")

    is_currents = req.variable in ("currents_u", "currents_v")
    unit = VAR_UNITS.get(req.variable, "")

    points = []
    for p in profile_points:
        entry = {
            "depth": p["depth"],
            "modelValue": p["modelValue"],
            "unit": p["unit"],
        }
        if not is_currents:
            entry["observationValue"] = None
        points.append(entry)

    obs_note = (
        "Observation data unavailable for currents. Model-only profile."
        if is_currents
        else "Observation data not available for HYCOM 2026. Model-only profile."
    )

    return _success({
        "points": points,
        "variable": req.variable,
        "unit": unit,
        "maxDepth": max(p["depth"] for p in profile_points),
        "sourceModel": "INCOIS HYCOM 2.35",
        "sourceObservation": None,
        "observationNote": obs_note,
    })


# ── POST /model/grid ────────────────────────────────────────────────────────

@router.post("/model/grid")
def model_grid(req: ModelGridRequest):
    """
    HYCOM model grid data for a region.
    Source: HYCOM 2026.
    """
    if req.variable not in MODEL_VARIABLES:
        return _error("UNSUPPORTED_VARIABLE", f"Variable '{req.variable}' not supported.")

    # Validate depth is a HYCOM level
    if req.depth not in HYCOM_DEPTH_LEVELS:
        return _error(
            "UNSUPPORTED_DEPTH",
            f"Depth {req.depth}m is not available. "
            f"HYCOM depth levels: {', '.join(str(d) for d in HYCOM_DEPTH_LEVELS)}m.",
        )

    try:
        time_idx = find_nearest_hycom_time_index(req.date, req.time)
    except FileNotFoundError:
        return _error("DATASET_UNAVAILABLE", "HYCOM model dataset is not available on this server.")

    if time_idx is None:
        return _error("INVALID_DATE", "Date/time outside HYCOM coverage.")

    depth_idx = get_hycom_depth_index(req.depth)
    if depth_idx is None:
        return _error("UNSUPPORTED_DEPTH", "Depth outside HYCOM range.")

    try:
        ds = get_hycom()
    except FileNotFoundError:
        return _error("DATASET_UNAVAILABLE", "HYCOM model dataset is not available on this server.")
    nc_var = HYCOM_VAR_MAP.get(req.variable)
    unit = VAR_UNITS.get(req.variable, "")

    # Clamp bounds to HYCOM coverage
    lat_min = max(req.bounds.south, HYCOM_LAT_RANGE[0])
    lat_max = min(req.bounds.north, HYCOM_LAT_RANGE[1])
    lon_min = max(req.bounds.west, HYCOM_LON_RANGE[0])
    lon_max = min(req.bounds.east, HYCOM_LON_RANGE[1])

    if lat_min > lat_max or lon_min > lon_max:
        return _error("OUTSIDE_COVERAGE", "No overlap with HYCOM coverage.")

    # Get all grid points within bounds
    lats = ds["LAT"].values
    lons = ds["LON"].values
    n_lat = ds.dims["LAT"]
    n_lon = ds.dims["LON"]

    grid_points = []
    valid_count = 0
    land_count = 0
    total_count = 0

    for i in range(n_lat):
        lat = float(lats[i])
        if lat < lat_min or lat > lat_max:
            continue
        for j in range(n_lon):
            lon = float(lons[j])
            if lon < lon_min or lon > lon_max:
                continue

            total_count += 1
            try:
                val = float(ds[nc_var].values[time_idx, depth_idx, i, j])
                if np.isnan(val):
                    land_count += 1
                    grid_points.append({
                        "latitude": round(lat, 4),
                        "longitude": round(lon, 4),
                        "value": None,
                        "unit": unit,
                    })
                else:
                    valid_count += 1
                    grid_points.append({
                        "latitude": round(lat, 4),
                        "longitude": round(lon, 4),
                        "value": round(val, 4),
                        "unit": unit,
                    })
            except (IndexError, KeyError):
                land_count += 1
                continue

    return _success({
        "variable": req.variable,
        "unit": unit,
        "depth": req.depth,
        "date": req.date,
        "time": req.time,
        "sourceModel": "INCOIS HYCOM 2.35",
        "gridPoints": grid_points,
        "gridInfo": {
            "latMin": round(float(lat_min), 4),
            "latMax": round(float(lat_max), 4),
            "lonMin": round(float(lon_min), 4),
            "lonMax": round(float(lon_max), 4),
            "latSpacing": round(float(lats[1] - lats[0]), 4) if n_lat > 1 else 0,
            "lonSpacing": round(float(lons[1] - lons[0]), 4) if n_lon > 1 else 0,
            "totalPoints": total_count,
            "validPoints": valid_count,
            "landPoints": land_count,
        },
    })
