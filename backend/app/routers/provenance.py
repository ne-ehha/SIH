"""
Provenance, Data Lineage & Archival Inspection Router.

Exposes endpoints for auditing the scientific data pipeline transformations:
RAW -> SCHEMA VALIDATED -> GEO VALIDATED -> SENTINEL FILTERED -> QC INTERPRETED ->
MONOTONIC DEPTH -> CANONICAL UNITS -> CANONICAL OBSERVATION.
"""

from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, Query

from ..data_cleaning_pipeline import data_cleaning_pipeline
from ..raw_data_archive import raw_data_archive
from ..models import ResponseMetadata

router = APIRouter()


@router.get("/provenance/pipeline-steps")
async def get_pipeline_transformation_steps() -> dict[str, Any]:
    """Return the formal 8-stage transformation pipeline definition and rules."""
    return {
        "status": "success",
        "pipeline_name": "OceanScope Scientific Data Ingestion & Cleaning Pipeline",
        "version": "1.0.0",
        "qc_policy": "WMO / Argo GDAC QF 1 (Good) and 2 (Probably Good) accepted. Flags 3, 4, 9 rejected.",
        "depth_formulation": "UNESCO Saunders & Fofonoff (1976)",
        "stages": [
            {"stage": 1, "name": "Schema Validation", "rule": "Mandatory keys (latitude, longitude, observed_at, levels, platform_type)"},
            {"stage": 2, "name": "Coordinate Validation", "rule": "WGS84 lat [-90, 90], lon [-180, 180]"},
            {"stage": 3, "name": "Sentinel & Fill-Value Filter", "rule": "Removes -1e34, 1.267e30, 99999, NaN, Inf"},
            {"stage": 4, "name": "QC Interpretation", "rule": "Evaluates WMO flags against accepted policy"},
            {"stage": 5, "name": "Monotonic Sorting & Deduplication", "rule": "Ascending depth sorting, duplicates within 0.05m collapsed"},
            {"stage": 6, "name": "UNESCO Depth Normalization", "rule": "P (dbar) -> Z (m) using Saunders-Fofonoff gravity by latitude"},
            {"stage": 7, "name": "Physical Unit Normalization", "rule": "Standardizes to °C (ITS-90), PSU, mg/m³, mmol/m³, m/s"},
            {"stage": 8, "name": "Variable Canonicalization", "rule": "Resolves aliases to canonical IDs with sealed lineage"},
        ],
        "metadata": ResponseMetadata(timestamp=datetime.now(timezone.utc).isoformat(), source="api"),
    }


@router.get("/provenance/archive")
async def list_raw_archive_manifests() -> dict[str, Any]:
    """List all locally archived raw dataset subsets and retrieval manifests."""
    manifests = raw_data_archive.list_archived_datasets()
    return {
        "status": "success",
        "archived_datasets_count": len(manifests),
        "datasets": manifests,
        "metadata": ResponseMetadata(timestamp=datetime.now(timezone.utc).isoformat(), source="api"),
    }
