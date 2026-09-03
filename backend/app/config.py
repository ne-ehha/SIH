"""
Backend configuration — dataset paths, coordinate bounds, depth levels.
All values verified from actual dataset inspection (Phase 1).
"""

from pathlib import Path

# ── Project paths ────────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

HYCOM_FILE = PROJECT_ROOT / "RSMC_hycom_20260827.nc"
ARGO_FILE = PROJECT_ROOT / "argo_dm_BOB_2024.nc"
COLLOCATION_FILE = PROJECT_ROOT / "backend" / "data" / "glorys_argo_collocation_2024.nc"
ARGO_INDEX_FILE = PROJECT_ROOT / "argo_dm_BOB_index.csv"

# ── API configuration ────────────────────────────────────────────────────────

API_HOST = "0.0.0.0"
API_PORT = 8000
API_PREFIX = "/api/v1"

# ── HYCOM dataset constants (verified from actual data) ─────────────────────

HYCOM_DEPTH_LEVELS = [0.0, 17.5, 52.5, 125.0, 275.0, 500.0]

HYCOM_LAT_RANGE = (5.063, 21.943)   # min, max latitude
HYCOM_LON_RANGE = (78.02, 99.86)    # min, max longitude
HYCOM_LAT_SPACING = 0.239           # approximate
HYCOM_LON_SPACING = 0.240           # approximate

HYCOM_TEMPORAL_START = "2026-08-26T06:00:00Z"
HYCOM_TEMPORAL_END = "2026-09-01T00:00:00Z"
HYCOM_TIMESTEPS = ["00:00", "06:00", "12:00", "18:00"]

# ── Argo dataset constants (verified from actual data) ──────────────────────

ARGO_LAT_RANGE = (7.80, 15.52)
ARGO_LON_RANGE = (83.47, 90.26)
ARGO_PRESSURE_RANGE = (0.0, 500.0)

ARGO_TEMPORAL_DATES = [
    "2024-01-01", "2024-01-04", "2024-01-06", "2024-01-07",
    "2024-01-08", "2024-01-09", "2024-01-10", "2024-01-11",
    "2024-01-14",
]

# ── Variable mappings ────────────────────────────────────────────────────────

# INTEG1 variable name → HYCOM NetCDF variable name
HYCOM_VAR_MAP = {
    "temperature": "TEMP",
    "salinity": "SALN",
    "currents_u": "UVEL",
    "currents_v": "VVEL",
}

# Variable → unit (HYCOM standard convention, inferred not declared)
VAR_UNITS = {
    "temperature": "°C",
    "salinity": "PSU",
    "currents_u": "m/s",
    "currents_v": "m/s",
}

# Variables supported for model-observation comparison (Pipeline A)
COMPARISON_VARIABLES = ["temperature", "salinity"]

# Variables supported for model exploration (Pipeline B)
MODEL_VARIABLES = ["temperature", "salinity", "currents_u", "currents_v"]

# ── 3D visualization grid ───────────────────────────────────────────────────

VIZ_GRID_HALF_SIZE = 4  # 8x8 grid = ±4 from center

# ── Missing data sentinels ──────────────────────────────────────────────────

# HYCOM fill values (before xarray masking)
HYCOM_FILL_TEMP = -1e34
HYCOM_FILL_SALN = -1e34
HYCOM_FILL_CURRENTS = 1.2676506e30
