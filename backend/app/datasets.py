"""
Core dataset access layer.

Handles lazy NetCDF loading with xarray, coordinate validation,
nearest-neighbour lookup, and grid indexing.

All dataset access goes through this module. No other module
opens NetCDF files directly.
"""

import numpy as np
import xarray as xr
from pathlib import Path
from typing import Optional

from .config import (
    HYCOM_FILE,
    ARGO_FILE,
    COLLOCATION_FILE,
    HYCOM_DEPTH_LEVELS,
    HYCOM_LAT_RANGE,
    HYCOM_LON_RANGE,
    ARGO_LAT_RANGE,
    ARGO_LON_RANGE,
    HYCOM_VAR_MAP,
    VIZ_GRID_HALF_SIZE,
)


# ── Dataset singletons ──────────────────────────────────────────────────────

_hycom_ds: Optional[xr.Dataset] = None
_argo_ds: Optional[xr.Dataset] = None
_collocation_ds: Optional[xr.Dataset] = None

# Pre-computed grid index arrays for fast nearest-neighbour
_hycom_lats: Optional[np.ndarray] = None
_hycom_lons: Optional[np.ndarray] = None


def _load_hycom() -> xr.Dataset:
    """Load HYCOM dataset lazily. Called once, cached."""
    global _hycom_ds, _hycom_lats, _hycom_lons
    if _hycom_ds is None:
        if not HYCOM_FILE.exists():
            raise FileNotFoundError(f"HYCOM file not found: {HYCOM_FILE}")
        _hycom_ds = xr.open_dataset(str(HYCOM_FILE))
        _hycom_lats = _hycom_ds["LAT"].values
        _hycom_lons = _hycom_ds["LON"].values
    return _hycom_ds


def _load_argo() -> xr.Dataset:
    """Load Argo dataset lazily. Called once, cached."""
    global _argo_ds
    if _argo_ds is None:
        if not ARGO_FILE.exists():
            raise FileNotFoundError(f"Argo file not found: {ARGO_FILE}")
        _argo_ds = xr.open_dataset(str(ARGO_FILE))
    return _argo_ds


def _load_collocation() -> xr.Dataset:
    """Load collocation dataset lazily. Called once, cached."""
    global _collocation_ds
    if _collocation_ds is None:
        if not COLLOCATION_FILE.exists():
            raise FileNotFoundError(f"Collocation file not found: {COLLOCATION_FILE}")
        _collocation_ds = xr.open_dataset(str(COLLOCATION_FILE))
    return _collocation_ds


def get_hycom() -> xr.Dataset:
    """Get the HYCOM dataset."""
    return _load_hycom()


def get_argo() -> xr.Dataset:
    """Get the Argo dataset."""
    return _load_argo()


def get_collocation() -> xr.Dataset:
    """Get the collocation dataset."""
    return _load_collocation()


def close_all():
    """Close all datasets. Called on shutdown."""
    global _hycom_ds, _argo_ds, _collocation_ds, _hycom_lats, _hycom_lons
    for ds in [_hycom_ds, _argo_ds, _collocation_ds]:
        if ds is not None:
            ds.close()
    _hycom_ds = None
    _argo_ds = None
    _collocation_ds = None
    _hycom_lats = None
    _hycom_lons = None


# ── Coordinate validation ───────────────────────────────────────────────────

def validate_coordinate(latitude: float, longitude: float) -> Optional[str]:
    """
    Validate latitude and longitude.
    Returns None if valid, or an error message string.
    """
    if not (-90 <= latitude <= 90):
        return f"Latitude must be between -90 and 90. Received: {latitude}"
    if not (-180 <= longitude <= 180):
        return f"Longitude must be between -180 and 180. Received: {longitude}"
    return None


def is_in_hycom_coverage(latitude: float, longitude: float) -> bool:
    """Check if a coordinate is within the HYCOM spatial coverage."""
    return (
        HYCOM_LAT_RANGE[0] <= latitude <= HYCOM_LAT_RANGE[1]
        and HYCOM_LON_RANGE[0] <= longitude <= HYCOM_LON_RANGE[1]
    )


def is_in_argo_coverage(latitude: float, longitude: float) -> bool:
    """Check if a coordinate is within the Argo/collocation spatial coverage."""
    return (
        ARGO_LAT_RANGE[0] <= latitude <= ARGO_LAT_RANGE[1]
        and ARGO_LON_RANGE[0] <= longitude <= ARGO_LON_RANGE[1]
    )


# ── HYCOM nearest-neighbour lookup ─────────────────────────────────────────

def find_nearest_hycom_indices(
    latitude: float, longitude: float
) -> tuple[int, int]:
    """
    Find the nearest HYCOM grid indices for a given coordinate.
    Returns (lat_idx, lon_idx).
    """
    ds = _load_hycom()
    lats = _hycom_lats
    lons = _hycom_lons

    lat_idx = int(np.argmin(np.abs(lats - latitude)))
    lon_idx = int(np.argmin(np.abs(lons - longitude)))

    return lat_idx, lon_idx


def find_nearest_hycom_time_index(date_str: str, time_str: str) -> Optional[int]:
    """
    Find the nearest HYCOM time index for a given date and time.
    Returns the index or None if date is outside coverage.

    date_str: "YYYY-MM-DD"
    time_str: "HH:mm"
    """
    ds = _load_hycom()

    # Parse requested datetime
    from datetime import datetime
    try:
        requested_dt = np.datetime64(f"{date_str}T{time_str}:00")
    except ValueError:
        return None

    # Find nearest timestep
    times = ds["TIME"].values
    diffs = np.abs(times - requested_dt)
    idx = int(np.argmin(diffs))

    # Check if the match is reasonable (within 6 hours for 6-hourly data)
    min_diff = diffs[idx]
    max_acceptable = np.timedelta64(6, "h")
    if min_diff > max_acceptable:
        return None

    return idx


def get_hycom_value(
    variable: str,
    lat_idx: int,
    lon_idx: int,
    time_idx: int,
    depth_idx: int,
) -> Optional[float]:
    """
    Get a single value from the HYCOM dataset.
    Returns None if the value is NaN (land point).
    """
    ds = _load_hycom()
    nc_var = HYCOM_VAR_MAP.get(variable)
    if nc_var is None:
        return None

    try:
        val = float(ds[nc_var].values[time_idx, depth_idx, lat_idx, lon_idx])
        if np.isnan(val):
            return None
        return val
    except (IndexError, KeyError):
        return None


def get_hycom_depth_index(depth: float) -> Optional[int]:
    """
    Find the nearest HYCOM depth index.
    Returns None if depth is outside range.
    """
    if depth < 0 or depth > 500:
        return None

    depths = np.array(HYCOM_DEPTH_LEVELS)
    idx = int(np.argmin(np.abs(depths - depth)))
    return idx


def get_hycom_vertical_profile(
    variable: str,
    lat_idx: int,
    lon_idx: int,
    time_idx: int,
) -> list[dict]:
    """
    Get model-only vertical profile at a HYCOM grid point.
    Returns list of {depth, modelValue, unit} dicts.
    """
    ds = _load_hycom()
    nc_var = HYCOM_VAR_MAP.get(variable)
    if nc_var is None:
        return []

    from .config import VAR_UNITS
    unit = VAR_UNITS.get(variable, "")

    points = []
    for d_idx, depth in enumerate(HYCOM_DEPTH_LEVELS):
        try:
            val = float(ds[nc_var].values[time_idx, d_idx, lat_idx, lon_idx])
            if np.isnan(val):
                continue  # skip land points
            points.append({
                "depth": depth,
                "modelValue": round(val, 4),
                "unit": unit,
            })
        except (IndexError, KeyError):
            continue

    return points


# ── 8×8 grid generation ────────────────────────────────────────────────────

def get_hycom_grid_around(
    variable: str,
    latitude: float,
    longitude: float,
    time_idx: int,
    depth_idx: int,
) -> list[dict]:
    """
    Get an 8×8 grid of HYCOM values centered on the nearest grid point
    to the given coordinate.

    Returns list of {latitude, longitude, value, unit} dicts.
    Land points are included with value: null.
    Points outside the domain are omitted.
    """
    ds = _load_hycom()
    nc_var = HYCOM_VAR_MAP.get(variable)
    if nc_var is None:
        return []

    from .config import VAR_UNITS
    unit = VAR_UNITS.get(variable, "")

    center_lat_idx, center_lon_idx = find_nearest_hycom_indices(latitude, longitude)

    n_lat = ds.dims["LAT"]
    n_lon = ds.dims["LON"]
    half = VIZ_GRID_HALF_SIZE

    grid_points = []
    for i in range(center_lat_idx - half, center_lat_idx + half):
        for j in range(center_lon_idx - half, center_lon_idx + half):
            # Bounds check
            if i < 0 or i >= n_lat or j < 0 or j >= n_lon:
                continue

            lat = float(_hycom_lats[i])
            lon = float(_hycom_lons[j])

            try:
                val = float(ds[nc_var].values[time_idx, depth_idx, i, j])
                if np.isnan(val):
                    grid_points.append({
                        "latitude": round(lat, 4),
                        "longitude": round(lon, 4),
                        "value": None,
                        "unit": unit,
                    })
                else:
                    grid_points.append({
                        "latitude": round(lat, 4),
                        "longitude": round(lon, 4),
                        "value": round(val, 4),
                        "unit": unit,
                    })
            except (IndexError, KeyError):
                continue

    return grid_points


# ── Collocation queries ─────────────────────────────────────────────────────

def query_collocation(
    variable: str,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    date: Optional[str] = None,
    lat_min: Optional[float] = None,
    lat_max: Optional[float] = None,
    lon_min: Optional[float] = None,
    lon_max: Optional[float] = None,
    depth_min: Optional[float] = None,
    depth_max: Optional[float] = None,
    max_distance: float = 0.5,
) -> list[int]:
    """
    Query the collocation dataset with optional spatial/temporal filters.
    Returns list of matching observation indices.

    Uses efficient numpy operations for date filtering.
    """
    ds = _load_collocation()

    lats = ds["latitude"].values
    lons = ds["longitude"].values
    times = ds["time"].values
    pressures = ds["pressure"].values

    mask = np.ones(len(lats), dtype=bool)

    if lat_min is not None:
        mask &= lats >= lat_min
    if lat_max is not None:
        mask &= lats <= lat_max
    if lon_min is not None:
        mask &= lons >= lon_min
    if lon_max is not None:
        mask &= lons <= lon_max
    if depth_min is not None:
        mask &= pressures >= depth_min
    if depth_max is not None:
        mask &= pressures <= depth_max

    # Efficient date filter using numpy datetime64 comparison
    if date is not None:
        target_date = np.datetime64(date, "D")
        # Compare dates only (truncates time component)
        dates_only = times.astype("datetime64[D]")
        mask &= dates_only == target_date

    # Spatial proximity filter
    if latitude is not None and longitude is not None:
        dist = np.sqrt((lats - latitude) ** 2 + (lons - longitude) ** 2)
        mask &= dist <= max_distance

    return np.where(mask)[0].tolist()


def get_collocation_point(
    idx: int,
    variable: str,
) -> dict:
    """
    Get a single collocation data point by index.
    Returns dict with model and observation values.
    """
    ds = _load_collocation()

    from .config import VAR_UNITS

    model_var = f"model_{variable}"
    obs_var = f"argo_{variable}"
    error_var = f"{variable}_error"

    try:
        model_val = float(ds[model_var].values[idx])
        obs_val = float(ds[obs_var].values[idx])
        error_val = float(ds[error_var].values[idx])
        lat = float(ds["latitude"].values[idx])
        lon = float(ds["longitude"].values[idx])
        pressure = float(ds["pressure"].values[idx])
        time_val = ds["time"].values[idx]

        import pandas as pd
        timestamp = pd.Timestamp(time_val).isoformat()

        return {
            "modelValue": round(model_val, 4),
            "observationValue": round(obs_val, 4),
            "difference": round(error_val, 4),
            "latitude": round(lat, 4),
            "longitude": round(lon, 4),
            "pressure": round(pressure, 2),
            "timestamp": timestamp,
        }
    except (KeyError, IndexError, ValueError):
        return {}


def get_collocation_nearest_point(
    latitude: float,
    longitude: float,
    date: Optional[str] = None,
    variable: str = "temperature",
) -> Optional[dict]:
    """
    Find the nearest collocation point to a given coordinate.
    Returns the point dict or None.
    """
    indices = query_collocation(
        variable=variable,
        latitude=latitude,
        longitude=longitude,
        date=date,
    )

    if len(indices) == 0:
        return None

    # Find the closest by distance
    ds = _load_collocation()
    lats = ds["latitude"].values[indices]
    lons = ds["longitude"].values[indices]
    dists = np.sqrt((lats - latitude) ** 2 + (lons - longitude) ** 2)
    closest = indices[np.argmin(dists)]

    return get_collocation_point(closest, variable)


# ── Argo observation queries ────────────────────────────────────────────────

def query_argo_stations(
    date: Optional[str] = None,
    lat_min: Optional[float] = None,
    lat_max: Optional[float] = None,
    lon_min: Optional[float] = None,
    lon_max: Optional[float] = None,
) -> list[dict]:
    """
    Query Argo stations. Groups by (platform, cycle) to create station records.
    """
    ds = _load_argo()

    import pandas as pd

    lats = ds["latitude"].values
    lons = ds["longitude"].values
    times = ds["time"].values
    platforms = ds["platform_number"].values
    cycles = ds["cycle_number"].values
    temps = ds["temperature"].values
    sals = ds["salinity"].values
    pressures = ds["pressure"].values

    # Build spatial mask
    mask = np.ones(len(lats), dtype=bool)
    if lat_min is not None:
        mask &= lats >= lat_min
    if lat_max is not None:
        mask &= lats <= lat_max
    if lon_min is not None:
        mask &= lons >= lon_min
    if lon_max is not None:
        mask &= lons <= lon_max

    # Date filter
    if date is not None:
        date_dt = pd.Timestamp(date).date()
        dates = pd.to_datetime(times).date
        mask &= np.array([d == date_dt for d in dates])

    indices = np.where(mask)[0]
    if len(indices) == 0:
        return []

    # Group by (platform, cycle) to create stations
    stations = {}
    for idx in indices:
        plat = str(platforms[idx]).strip().strip("'b").strip("'").strip()
        cyc = int(cycles[idx])
        key = (plat, cyc)

        if key not in stations:
            # Find shallowest valid temperature for this profile
            stations[key] = {
                "id": f"argo_{plat}_{cyc}",
                "latitude": round(float(lats[idx]), 4),
                "longitude": round(float(lons[idx]), 4),
                "timestamp": pd.Timestamp(times[idx]).isoformat(),
                "max_depth": round(float(pressures[idx]), 2),
                "status": "active",
                "type": "argo",
                "temperature": None,
                "salinity": None,
            }

        # Update max depth
        if float(pressures[idx]) > stations[key]["max_depth"]:
            stations[key]["max_depth"] = round(float(pressures[idx]), 2)

        # Keep shallowest valid temperature/salinity
        if stations[key]["temperature"] is None:
            if np.isfinite(temps[idx]) and not np.isnan(temps[idx]):
                stations[key]["temperature"] = round(float(temps[idx]), 2)
        if stations[key]["salinity"] is None:
            if np.isfinite(sals[idx]) and not np.isnan(sals[idx]):
                stations[key]["salinity"] = round(float(sals[idx]), 2)

    return list(stations.values())
