"""
Unified Data Retrieval Service for OceanScope.

Coordinates registry validation, source adapter dispatch, request validation,
and caching for all scientific ocean datasets.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Any, Optional

from .adapters import (
    ArgoAdapter,
    BGCAdapter,
    BaseSourceAdapter,
    CTDAdapter,
    CopernicusAdapter,
    GLORYSAdapter,
    GliderAdapter,
    HYCOMAdapter,
    RetrievalError,
    utc_now_iso,
)
from .models import (
    HistoricalDataRequest,
    HistoricalDataResponse,
    HistoricalQuerySummary,
    HistoricalResultSummary,
    ResponseMetadata,
)
from .registry import (
    DATASET_REGISTRY,
    VARIABLE_REGISTRY,
    DatasetDefinition,
    VariableDefinition,
    get_dataset,
    resolve_canonical_variable,
    validate_variable_for_dataset,
)


class DataRetrievalService:
    """Central service orchestrating all scientific dataset retrievals."""

    def __init__(self):
        self._adapters: dict[str, BaseSourceAdapter] = {
            "argo": ArgoAdapter(),
            "copernicus": CopernicusAdapter(),
            "glorys": GLORYSAdapter(),
            "hycom": HYCOMAdapter(),
            "glider": GliderAdapter(),
            "ctd": CTDAdapter(),
            "bgc": BGCAdapter(),
        }
        self._cache: dict[str, dict[str, Any]] = {}
        self._cache_lock = Lock()
        self._cache_ttl = timedelta(minutes=5)

    def retrieve(self, query: HistoricalDataRequest) -> HistoricalDataResponse:
        """
        Validate scientific query and execute adapter retrieval.
        """
        # 1. Dataset validation
        dataset_def = get_dataset(query.dataset_id)
        if not dataset_def:
            raise RetrievalError(
                "UNSUPPORTED_DATASET",
                f"Dataset '{query.dataset_id}' is not registered. Registered datasets: {list(DATASET_REGISTRY.keys())}",
            )

        # 2. Variable validation & compatibility check
        var_def: Optional[VariableDefinition] = None
        if query.variable:
            is_valid, err_msg = validate_variable_for_dataset(query.dataset_id, query.variable)
            if not is_valid:
                raise RetrievalError("DATASET_VARIABLE_MISMATCH", err_msg or "Variable mismatch.")
            var_def = resolve_canonical_variable(query.variable)
        else:
            # Default to first supported variable of dataset
            if dataset_def.supported_variables:
                default_var_id = dataset_def.supported_variables[0]
                var_def = resolve_canonical_variable(default_var_id)

        # 3. Spatial bounds validation
        if query.latitude_min is not None and query.latitude_max is not None:
            if query.latitude_min > query.latitude_max:
                raise RetrievalError(
                    "INVALID_REQUEST",
                    f"latitude_min ({query.latitude_min}) cannot be greater than latitude_max ({query.latitude_max}).",
                )
        if query.longitude_min is not None and query.longitude_max is not None:
            if query.longitude_min > query.longitude_max:
                raise RetrievalError(
                    "INVALID_REQUEST",
                    f"longitude_min ({query.longitude_min}) cannot be greater than longitude_max ({query.longitude_max}).",
                )

        # 4. Depth/pressure bounds validation
        if query.depth_min is not None and query.depth_max is not None:
            if query.depth_min > query.depth_max:
                raise RetrievalError(
                    "INVALID_REQUEST",
                    f"depth_min ({query.depth_min}) cannot be greater than depth_max ({query.depth_max}).",
                )
        if query.pressure_min is not None and query.pressure_max is not None:
            if query.pressure_min > query.pressure_max:
                raise RetrievalError(
                    "INVALID_REQUEST",
                    f"pressure_min ({query.pressure_min}) cannot be greater than pressure_max ({query.pressure_max}).",
                )

        # 5. Datetime range validation
        if query.start_datetime and query.end_datetime:
            try:
                dt_start = datetime.fromisoformat(query.start_datetime.replace("Z", "+00:00"))
                dt_end = datetime.fromisoformat(query.end_datetime.replace("Z", "+00:00"))
                if dt_start > dt_end:
                    raise RetrievalError(
                        "INVALID_REQUEST",
                        f"start_datetime ({query.start_datetime}) must be earlier than or equal to end_datetime ({query.end_datetime}).",
                    )
            except ValueError as exc:
                if "invalid" in str(exc).lower():
                    raise RetrievalError("INVALID_REQUEST", f"Malformed datetime string: {exc}")

        # 6. Check Cache
        cache_key = self._generate_cache_key(query)
        with self._cache_lock:
            cached_entry = self._cache.get(cache_key)
            now = datetime.now(timezone.utc)
            if cached_entry and now - cached_entry["cached_at"] < self._cache_ttl:
                cached_resp: HistoricalDataResponse = cached_entry["response"]
                # Return response with cache hit metadata
                return HistoricalDataResponse(
                    status=cached_resp.status,
                    mode="historical",
                    query_summary=cached_resp.query_summary,
                    result_summary=cached_resp.result_summary,
                    data=cached_resp.data,
                    provenance=cached_resp.provenance,
                    cache={
                        "hit": True,
                        "cached_at": cached_entry["cached_at"].isoformat().replace("+00:00", "Z"),
                        "ttl_seconds": int(self._cache_ttl.total_seconds()),
                    },
                    metadata=ResponseMetadata(
                        timestamp=utc_now_iso(),
                        source="api_cache",
                    ),
                )

        # 7. Select and execute Adapter
        adapter_key = dataset_def.adapter_name
        adapter = self._adapters.get(adapter_key)
        if not adapter:
            raise RetrievalError(
                "UNSUPPORTED_SOURCE",
                f"No retrieval adapter available for adapter key '{adapter_key}'.",
            )

        records, result_summary, provenance = adapter.retrieve(query, dataset_def, var_def)

        # 8. Assemble response
        query_summary = HistoricalQuerySummary(
            source=dataset_def.source_id,
            dataset_id=dataset_def.dataset_id,
            dataset_name=dataset_def.dataset_name,
            data_mode=getattr(dataset_def, "data_mode", "HISTORICAL_RESEARCH"),
            platform_type=getattr(dataset_def, "platform_type", None),
            variable=var_def.id if var_def else None,
            variable_name=var_def.display_name if var_def else None,
            units=dataset_def.variable_units.get(var_def.id, "") if var_def else None,
            requested_time={
                "date": query.date,
                "time": query.time,
                "start": query.start_datetime,
                "end": query.end_datetime,
            },
            requested_region={
                "lat_min": query.latitude_min,
                "lat_max": query.latitude_max,
                "lon_min": query.longitude_min,
                "lon_max": query.longitude_max,
            },
            requested_depth={
                "depth_min": query.depth_min,
                "depth_max": query.depth_max,
                "pressure_min": query.pressure_min,
                "pressure_max": query.pressure_max,
            },
        )

        response = HistoricalDataResponse(
            status="success" if result_summary.status in ("complete", "partial") else result_summary.status,
            mode="historical",
            data_mode=getattr(dataset_def, "data_mode", "HISTORICAL_RESEARCH"),
            query_summary=query_summary,
            result_summary=result_summary,
            data=records,
            provenance=provenance,
            cache={
                "hit": False,
                "cached_at": utc_now_iso(),
                "ttl_seconds": int(self._cache_ttl.total_seconds()),
            },
            metadata=ResponseMetadata(
                timestamp=utc_now_iso(),
                source="api",
            ),
        )

        # 9. Store in cache if successful
        with self._cache_lock:
            self._cache[cache_key] = {
                "cached_at": now,
                "response": response,
            }

        return response

    def _generate_cache_key(self, query: HistoricalDataRequest) -> str:
        key_dict = {
            "dataset_id": query.dataset_id,
            "variable": query.variable,
            "date": query.date,
            "time": query.time,
            "start_datetime": query.start_datetime,
            "end_datetime": query.end_datetime,
            "lat_min": query.latitude_min,
            "lat_max": query.latitude_max,
            "lon_min": query.longitude_min,
            "lon_max": query.longitude_max,
            "depth_min": query.depth_min,
            "depth_max": query.depth_max,
            "pressure_min": query.pressure_min,
            "pressure_max": query.pressure_max,
            "data_mode": query.data_mode,
            "platform_type": query.platform_type,
            "format": query.format,
        }
        dump = json.dumps(key_dict, sort_keys=True)
        return hashlib.sha256(dump.encode("utf-8")).hexdigest()

    def get_adapter_statuses(self) -> list[dict[str, Any]]:
        return [adapter.get_capabilities() for adapter in self._adapters.values()]


data_retrieval_service = DataRetrievalService()
