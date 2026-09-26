"""
FastAPI router for Real Observation Discovery & Canonical Observation Layer (Phase 10A).

Endpoints:
- GET  /observations/discover: Discover real in-situ observation profiles
- POST /observations/discover: Discover real in-situ observation profiles (JSON body format)
"""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Query, status
from fastapi.responses import JSONResponse

from ..models import (
    ObservationDiscoveryQuery,
    ObservationDiscoveryResponse,
    ObservationPlatformType,
    CanonicalDataMode,
)
from ..observation_discovery_service import observation_discovery_service

router = APIRouter()


@router.get(
    "/observations/discover",
    response_model=ObservationDiscoveryResponse,
    summary="Discover real in-situ observation profiles (Argo, BGC, Glider, CTD)",
    description=(
        "Search authentic in-situ observation profiles based on coordinates, temporal window, "
        "platform filter, and variable requirements with strict scientific provenance and QC."
    ),
)
def discover_observations_get(
    latitude: float = Query(..., ge=-90, le=90, description="Target latitude in degrees North"),
    longitude: float = Query(..., ge=-180, le=180, description="Target longitude in degrees East"),
    start_datetime: Optional[str] = Query(None, description="Start date/time in ISO 8601 or YYYY-MM-DD format"),
    end_datetime: Optional[str] = Query(None, description="End date/time in ISO 8601 or YYYY-MM-DD format"),
    target_datetime: Optional[str] = Query(None, description="Target observation date/time"),
    platform: Optional[ObservationPlatformType] = Query(None, description="Observation platform filter: 'ARGO', 'BGC', 'GLIDER', 'CTD'"),
    variable: Optional[str] = Query(None, description="Target scientific variable (e.g. 'thetao', 'so', 'chl', 'o2', 'no3')"),
    radius_km: float = Query(300.0, ge=1.0, le=2000.0, description="Maximum search radius in kilometers"),
    max_temporal_hours: float = Query(720.0, ge=1.0, le=8760.0, description="Maximum temporal separation in hours (default 30 days)"),
    data_mode: Optional[CanonicalDataMode] = Query(None, description="Data mode filter: 'LIVE_NRT' or 'HISTORICAL_RESEARCH'"),
):
    query = ObservationDiscoveryQuery(
        latitude=latitude,
        longitude=longitude,
        start_datetime=start_datetime,
        end_datetime=end_datetime,
        target_datetime=target_datetime,
        platform=platform,
        variable=variable,
        radius_km=radius_km,
        max_temporal_hours=max_temporal_hours,
        data_mode=data_mode,
    )
    return observation_discovery_service.discover(query)


@router.post(
    "/observations/discover",
    response_model=ObservationDiscoveryResponse,
    summary="Discover real in-situ observation profiles via JSON body",
)
def discover_observations_post(query: ObservationDiscoveryQuery):
    return observation_discovery_service.discover(query)


@router.get(
    "/observations/profiles",
    summary="List real dataset profile index, temporal extents, and spatial coverage by platform",
    description="Retrieve canonical index of real in-situ profiles for spatial exploration and workstation routing.",
)
def get_dataset_profiles_endpoint(
    platform: Optional[str] = Query(None, description="Observation platform filter: 'ALL', 'ARGO', 'BGC', 'GLIDER', 'CTD'"),
    data_mode: Optional[str] = Query(None, description="Data mode filter: 'LIVE_NRT' or 'HISTORICAL_RESEARCH'"),
):
    return observation_discovery_service.get_dataset_profiles(platform=platform, data_mode=data_mode)

