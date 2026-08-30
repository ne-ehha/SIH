"""
Health and datasets metadata endpoints.
GET /api/v1/health
GET /api/v1/datasets
"""

from fastapi import APIRouter
from datetime import datetime, timezone

from ..config import (
    HYCOM_DEPTH_LEVELS,
    HYCOM_LAT_RANGE,
    HYCOM_LON_RANGE,
    HYCOM_TEMPORAL_START,
    HYCOM_TEMPORAL_END,
    ARGO_LAT_RANGE,
    ARGO_LON_RANGE,
    MODEL_VARIABLES,
    COMPARISON_VARIABLES,
)
from ..datasets import get_hycom, get_argo, get_collocation

router = APIRouter()


@router.get("/health")
def health_check():
    """API health check with dataset availability status."""
    # Check dataset availability
    hycom_ok = False
    argo_ok = False
    collocation_ok = False

    try:
        ds = get_hycom()
        hycom_ok = True
        hycom_lat_min = float(ds["LAT"].min())
        hycom_lat_max = float(ds["LAT"].max())
        hycom_lon_min = float(ds["LON"].min())
        hycom_lon_max = float(ds["LON"].max())
    except Exception:
        hycom_lat_min, hycom_lat_max = HYCOM_LAT_RANGE
        hycom_lon_min, hycom_lon_max = HYCOM_LON_RANGE

    try:
        ds = get_argo()
        argo_ok = True
        n_profiles = len(set(zip(
            ds["platform_number"].values,
            ds["cycle_number"].values,
        )))
        n_obs = ds.dims["observation"]
    except Exception:
        n_profiles = 0
        n_obs = 0

    try:
        ds = get_collocation()
        collocation_ok = True
        n_matches = ds.dims["observation"]
    except Exception:
        n_matches = 0

    # Count valid Argo observations
    valid_obs = 0
    if argo_ok:
        try:
            ds = get_argo()
            valid_mask = (
                ds["temperature"].notnull()
                & ds["salinity"].notnull()
            )
            valid_obs = int(valid_mask.sum())
        except Exception:
            pass

    return {
        "status": "success",
        "data": {
            "api": "healthy",
            "datasets": {
                "hycom": {
                    "available": hycom_ok,
                    "type": "model_forecast",
                    "source": "INCOIS HYCOM 2.35",
                    "temporalCoverage": {
                        "start": HYCOM_TEMPORAL_START,
                        "end": HYCOM_TEMPORAL_END,
                    },
                    "spatialCoverage": {
                        "north": round(hycom_lat_max, 3),
                        "south": round(hycom_lat_min, 3),
                        "east": round(hycom_lon_max, 3),
                        "west": round(hycom_lon_min, 3),
                    },
                    "depthLevels": HYCOM_DEPTH_LEVELS,
                    "variables": MODEL_VARIABLES,
                    "pipeline": "B",
                },
                "argo_dm": {
                    "available": argo_ok,
                    "type": "observation",
                    "source": "Argo Delayed Mode (GDAC)",
                    "temporalCoverage": {
                        "start": "2024-01-01",
                        "end": "2024-01-14",
                    },
                    "spatialCoverage": {
                        "north": ARGO_LAT_RANGE[1],
                        "south": ARGO_LAT_RANGE[0],
                        "east": ARGO_LON_RANGE[1],
                        "west": ARGO_LON_RANGE[0],
                    },
                    "totalProfiles": n_profiles,
                    "totalObservations": n_obs,
                    "validObservations": valid_obs,
                    "variables": COMPARISON_VARIABLES,
                    "pipeline": "A",
                },
                "glorys_argo_collocation": {
                    "available": collocation_ok,
                    "type": "precomputed_match",
                    "model": "GLORYS12V1",
                    "observation": "Argo Delayed Mode",
                    "temporalCoverage": {
                        "start": "2024-01-01",
                        "end": "2024-01-14",
                    },
                    "spatialCoverage": {
                        "north": ARGO_LAT_RANGE[1],
                        "south": ARGO_LAT_RANGE[0],
                        "east": ARGO_LON_RANGE[1],
                        "west": ARGO_LON_RANGE[0],
                    },
                    "totalMatches": n_matches,
                    "variables": COMPARISON_VARIABLES,
                    "pipeline": "A",
                },
            },
            "pipelines": {
                "A": {
                    "name": "Scientific Comparison",
                    "model": "GLORYS12V1",
                    "observation": "Argo DM",
                    "variables": COMPARISON_VARIABLES,
                    "temporalNote": "Jan 1-14, 2024 only",
                },
                "B": {
                    "name": "Model Exploration",
                    "model": "INCOIS HYCOM 2.35",
                    "observation": None,
                    "variables": MODEL_VARIABLES,
                    "temporalNote": (
                        "Aug 26 - Sep 1, 2026 only. "
                        "No temporally matched observations."
                    ),
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    }


@router.get("/datasets")
def dataset_metadata():
    """Metadata about all available datasets."""
    return health_check()  # Same data, different endpoint name
