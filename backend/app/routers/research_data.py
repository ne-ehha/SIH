"""
FastAPI router for Unified Research Data Retrieval & Registry Discovery.

Endpoints:
- GET  /research/data: Retrieve historical/date-specific scientific data
- POST /research/data: Retrieve historical/date-specific scientific data (body format)
- GET  /research/registry: Authoritative central dataset registry
- GET  /research/variables: Authoritative canonical variable registry
- GET  /research/adapters/status: Source adapter operational status
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal, Optional

from fastapi import APIRouter, Query, status
from fastapi.responses import JSONResponse

from ..adapters import RetrievalError
from ..data_retrieval_service import data_retrieval_service
from ..models import (
    CompatibilityCheckRequest,
    CompatibilityCheckResponse,
    ErrorResponse,
    HistoricalDataRequest,
    HistoricalDataResponse,
    VariableAwareAnalysisRequest,
    VariableAwareAnalysisResponse,
)
from ..registry import (
    DATASET_REGISTRY,
    VARIABLE_REGISTRY,
    list_datasets,
    resolve_canonical_variable,
)

router = APIRouter()


def _error_response(code: str, message: str, status_code: int = 400, details: Optional[dict[str, Any]] = None):
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "error",
            "error": {
                "code": code,
                "message": message,
                "details": details or {},
            },
            "metadata": {
                "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "source": "api",
            },
        },
    )


@router.get(
    "/research/data",
    response_model=HistoricalDataResponse,
    summary="Retrieve scientific ocean data (Historical / Date-Specific)",
    description=(
        "Unified REST endpoint to retrieve normalized ocean observations, model outputs, or "
        "reanalysis collocations from official sources (Copernicus, Argo GDAC, GLORYS, INCOIS)."
    ),
)
def get_research_data(
    dataset_id: str = Query(..., description="Registered dataset identifier (e.g. 'argo-delayed-mode-bob-2024', 'glorys12v1-argo-collocation-bob')"),
    variable: Optional[str] = Query(None, description="Canonical scientific variable (e.g. 'thetao', 'so', 'temperature', 'salinity', 'currents_u')"),
    source: Optional[str] = Query(None, description="Source provider identifier"),
    date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="Specific observation/model date (YYYY-MM-DD)"),
    time: Optional[str] = Query(None, pattern=r"^\d{2}:\d{2}$", description="Specific observation/model time (HH:MM)"),
    start_datetime: Optional[str] = Query(None, description="Start date/time in ISO 8601 format"),
    end_datetime: Optional[str] = Query(None, description="End date/time in ISO 8601 format"),
    latitude_min: Optional[float] = Query(None, ge=-90, le=90, description="Minimum latitude bound (-90 to 90)"),
    latitude_max: Optional[float] = Query(None, ge=-90, le=90, description="Maximum latitude bound (-90 to 90)"),
    longitude_min: Optional[float] = Query(None, ge=-180, le=180, description="Minimum longitude bound (-180 to 180)"),
    longitude_max: Optional[float] = Query(None, ge=-180, le=180, description="Maximum longitude bound (-180 to 180)"),
    depth_min: Optional[float] = Query(None, ge=0, le=6000, description="Minimum depth/pressure level"),
    depth_max: Optional[float] = Query(None, ge=0, le=6000, description="Maximum depth/pressure level"),
    pressure_min: Optional[float] = Query(None, ge=0, le=6000, description="Minimum hydrostatic pressure level in dbar"),
    pressure_max: Optional[float] = Query(None, ge=0, le=6000, description="Maximum hydrostatic pressure level in dbar"),
    temporal_resolution: Optional[str] = Query(None, description="Requested temporal resolution"),
    data_mode: Optional[str] = Query(None, description="Canonical data mode: 'LIVE_NRT' or 'HISTORICAL_RESEARCH'"),
    platform_type: Optional[str] = Query(None, description="Observation platform: 'ARGO', 'GLIDER', 'CTD', 'BGC'"),
    format: Optional[Literal["records", "profiles", "collocation", "grid"]] = Query("records", description="Response data structure format"),
):
    query = HistoricalDataRequest(
        source=source,
        dataset_id=dataset_id,
        variable=variable,
        data_mode=data_mode,  # type: ignore
        platform_type=platform_type,  # type: ignore
        date=date,
        time=time,
        start_datetime=start_datetime,
        end_datetime=end_datetime,
        latitude_min=latitude_min,
        latitude_max=latitude_max,
        longitude_min=longitude_min,
        longitude_max=longitude_max,
        depth_min=depth_min,
        depth_max=depth_max,
        pressure_min=pressure_min,
        pressure_max=pressure_max,
        temporal_resolution=temporal_resolution,
        format=format,
    )
    try:
        return data_retrieval_service.retrieve(query)
    except RetrievalError as exc:
        status_map = {
            "INVALID_REQUEST": 400,
            "UNSUPPORTED_DATASET": 404,
            "UNSUPPORTED_VARIABLE": 400,
            "DATASET_VARIABLE_MISMATCH": 400,
            "AUTHENTICATION_REQUIRED": 401,
            "SOURCE_UNAVAILABLE": 503,
            "UPSTREAM_TIMEOUT": 504,
            "UPSTREAM_ERROR": 502,
            "NO_DATA": 200,
        }
        status_code = status_map.get(exc.code, 400)
        return _error_response(exc.code, exc.message, status_code, exc.details)
    except Exception as exc:
        return _error_response("INTERNAL_ERROR", f"Unexpected error during retrieval: {str(exc)}", 500)


@router.post(
    "/research/data",
    response_model=HistoricalDataResponse,
    summary="Retrieve scientific ocean data via JSON request body",
)
def post_research_data(query: HistoricalDataRequest):
    try:
        return data_retrieval_service.retrieve(query)
    except RetrievalError as exc:
        status_map = {
            "INVALID_REQUEST": 400,
            "UNSUPPORTED_DATASET": 404,
            "UNSUPPORTED_VARIABLE": 400,
            "DATASET_VARIABLE_MISMATCH": 400,
            "AUTHENTICATION_REQUIRED": 401,
            "SOURCE_UNAVAILABLE": 503,
            "UPSTREAM_TIMEOUT": 504,
            "UPSTREAM_ERROR": 502,
            "NO_DATA": 200,
        }
        status_code = status_map.get(exc.code, 400)
        return _error_response(exc.code, exc.message, status_code, exc.details)
    except Exception as exc:
        return _error_response("INTERNAL_ERROR", f"Unexpected error during retrieval: {str(exc)}", 500)


@router.get(
    "/research/registry",
    summary="Authoritative Dataset Registry",
    description="List all registered ocean datasets, their metadata, temporal/spatial/vertical bounds, and availability.",
)
def get_registry(
    source: Optional[str] = Query(None, description="Filter by source ID"),
    variable: Optional[str] = Query(None, description="Filter by supported canonical variable"),
    data_mode: Optional[str] = Query(None, description="Filter by data mode: 'LIVE_NRT' or 'HISTORICAL_RESEARCH'"),
    platform_type: Optional[str] = Query(None, description="Filter by observation platform: 'ARGO', 'GLIDER', 'CTD', 'BGC'"),
    vertical_coverage_type: Optional[str] = Query(None, description="Filter by vertical coverage: 'depth_resolved' or 'surface_only'"),
):
    datasets = list_datasets(
        source_id=source,
        variable=variable,
        data_mode=data_mode,
        platform_type=platform_type,
        vertical_coverage_type=vertical_coverage_type,
    )
    return {
        "status": "success",
        "total_datasets": len(datasets),
        "datasets": [
            {
                "dataset_id": ds.dataset_id,
                "dataset_name": ds.dataset_name,
                "product_id": ds.product_id,
                "product_name": ds.product_name,
                "source_id": ds.source_id,
                "source_name": ds.source_name,
                "source_type": ds.source_type,
                "description": ds.description,
                "supported_variables": list(ds.supported_variables),
                "variable_units": ds.variable_units,
                "data_mode": ds.data_mode,
                "platform_type": ds.platform_type,
                "vertical_coverage_type": ds.vertical_coverage_type,
                "spatial_coverage": {
                    "south": ds.spatial_coverage.south,
                    "north": ds.spatial_coverage.north,
                    "west": ds.spatial_coverage.west,
                    "east": ds.spatial_coverage.east,
                    "region_name": ds.spatial_coverage.region_name,
                },
                "temporal_coverage": {
                    "start": ds.temporal_coverage.start,
                    "end": ds.temporal_coverage.end,
                    "resolution": ds.temporal_coverage.resolution,
                    "available_dates": list(ds.temporal_coverage.available_dates) if ds.temporal_coverage.available_dates else None,
                },
                "vertical_coverage": {
                    "min_depth": ds.vertical_coverage.min_depth,
                    "max_depth": ds.vertical_coverage.max_depth,
                    "unit": ds.vertical_coverage.unit,
                    "standard_levels": list(ds.vertical_coverage.standard_levels) if ds.vertical_coverage.standard_levels else None,
                },
                "availability_status": ds.availability_status,
                "retrieval_capability": ds.retrieval_capability,
                "processing_level": ds.processing_level,
                "quality_control_applied": ds.quality_control_applied,
                "qc_details": ds.qc_details,
                "documentation_url": ds.documentation_url,
                "citation": ds.citation,
            }
            for ds in datasets
        ],
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "source": "api",
        },
    }


@router.get(
    "/research/variables",
    summary="Authoritative Variable Registry",
    description="List all canonical scientific variables, CF standard names, units, and valid physical ranges.",
)
def get_variables():
    return {
        "status": "success",
        "total_variables": len(VARIABLE_REGISTRY),
        "variables": [
            {
                "id": v.id,
                "display_name": v.display_name,
                "cf_standard_name": v.cf_standard_name,
                "unit": v.unit,
                "category": v.category,
                "description": v.description,
                "valid_range": list(v.valid_range),
                "is_derived": v.is_derived,
                "derived_expression": v.derived_expression,
                "aliases": list(v.aliases),
            }
            for v in VARIABLE_REGISTRY.values()
        ],
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "source": "api",
        },
    }


@router.get(
    "/research/platforms",
    summary="Canonical Observation Platform Registry",
    description="List all supported ocean observation platforms (Argo, Glider, CTD, BGC), QC conventions, and operational statuses.",
)
def get_platforms():
    from ..registry import PLATFORM_REGISTRY
    return {
        "status": "success",
        "total_platforms": len(PLATFORM_REGISTRY),
        "platforms": list(PLATFORM_REGISTRY.values()),
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "source": "api",
        },
    }


@router.get(
    "/research/data-modes",
    summary="Canonical Data Mode Registry",
    description="List canonical scientific data modes (LIVE_NRT and HISTORICAL_RESEARCH) and their source criteria.",
)
def get_data_modes():
    from ..registry import DATA_MODE_REGISTRY
    return {
        "status": "success",
        "data_modes": list(DATA_MODE_REGISTRY.values()),
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "source": "api",
        },
    }


@router.post(
    "/compatibility/validate",
    response_model=CompatibilityCheckResponse,
    summary="Scientific Compatibility Validation Engine",
    description="Evaluate scientific compatibility before model-observation comparison (QC, temporal, spatial, depth, variables).",
)
def validate_compatibility(request: CompatibilityCheckRequest):
    from ..compatibility_engine import CompatibilityEngine
    return CompatibilityEngine.evaluate_compatibility(request)


@router.post(
    "/analysis/variable-aware",
    response_model=VariableAwareAnalysisResponse,
    summary="Variable-Aware Scientific Analysis Engine",
    description="Compute variable-specific scientific verification metrics (Bias, MAE, RMSE, current vectors & directional error, log10 BGC scales).",
)
def perform_variable_aware_analysis(request: VariableAwareAnalysisRequest):
    from ..compatibility_engine import compute_variable_aware_analysis
    return compute_variable_aware_analysis(request)


@router.get(
    "/research/adapters/status",
    summary="Source Adapter Status & Capabilities",
    description="List operational and authentication capabilities for all source adapters.",
)
def get_adapters_status():
    return {
        "status": "success",
        "adapters": data_retrieval_service.get_adapter_statuses(),
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "source": "api",
        },
    }
