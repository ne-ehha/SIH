"""
INCOIS HYCOM Operational Regional Model source adapter.

Handles operational exploration retrieval (Pipeline B) from the verified
regional NetCDF (RSMC_hycom_20260827.nc).
Variables: temperature, salinity, currents_u, currents_v.
"""

from __future__ import annotations

from typing import Any, Optional
import numpy as np
import pandas as pd

from ..datasets import (
    get_hycom,
    is_in_hycom_coverage,
    find_nearest_hycom_indices,
    HYCOM_DEPTH_LEVELS,
    HYCOM_VAR_MAP,
)
from ..models import (
    HistoricalDataRequest,
    HistoricalResultSummary,
    NormalizedDataRecord,
)
from ..registry import DatasetDefinition, VariableDefinition, resolve_canonical_variable
from .base import BaseSourceAdapter, RetrievalError, utc_now_iso


class HYCOMAdapter(BaseSourceAdapter):
    """Adapter for INCOIS Regional HYCOM 2.35 Model Output."""

    def __init__(self):
        super().__init__(
            source_id="incois-hycom",
            source_name="Indian National Centre for Ocean Information Services (INCOIS)",
        )

    def retrieve(
        self,
        query: HistoricalDataRequest,
        dataset_def: DatasetDefinition,
        var_def: Optional[VariableDefinition],
    ) -> tuple[list[Any], HistoricalResultSummary, dict[str, Any]]:
        retrieved_at = utc_now_iso()
        ds = get_hycom()

        lats = ds["LAT"].values
        lons = ds["LON"].values
        times = ds["TIME"].values
        depth_levels = np.array(HYCOM_DEPTH_LEVELS)

        # Canonical variable mapping
        target_var_id = var_def.id if var_def else "temperature"
        is_derived_current = target_var_id in ("current_speed", "current_direction")

        if is_derived_current:
            nc_var_name = "DERIVED_CURRENT"
        else:
            nc_var_name = HYCOM_VAR_MAP.get(target_var_id)
            if not nc_var_name:
                # Check if alias was used
                canonical = resolve_canonical_variable(target_var_id)
                if canonical:
                    nc_var_name = HYCOM_VAR_MAP.get(canonical.id)
            if not nc_var_name:
                raise RetrievalError(
                    "UNSUPPORTED_VARIABLE",
                    f"Variable '{target_var_id}' is not available in HYCOM operational output. Available: {list(HYCOM_VAR_MAP.keys()) + ['current_speed', 'current_direction']}",
                )

        unit = dataset_def.variable_units.get(target_var_id, "°C" if "temp" in target_var_id else "PSU" if "sal" in target_var_id else "degrees" if "direction" in target_var_id else "m/s")

        # Time selection
        requested_dt = None
        if query.date and query.time:
            requested_dt = np.datetime64(f"{query.date}T{query.time}:00")
        elif query.date:
            requested_dt = np.datetime64(f"{query.date}T00:00:00")
        elif query.start_datetime:
            requested_dt = np.datetime64(query.start_datetime[:19])
        else:
            requested_dt = times[0]

        # Nearest time index
        time_diffs = np.abs(times - requested_dt)
        time_idx = int(np.argmin(time_diffs))
        selected_time = times[time_idx]
        iso_time = pd.Timestamp(selected_time).tz_localize("UTC").isoformat().replace("+00:00", "Z")

        # Depth filtering
        depth_min = query.depth_min if query.depth_min is not None else 0.0
        depth_max = query.depth_max if query.depth_max is not None else 500.0
        depth_indices = [
            i for i, d in enumerate(depth_levels)
            if depth_min <= d <= depth_max
        ]
        if not depth_indices:
            depth_indices = [int(np.argmin(np.abs(depth_levels - depth_min)))]

        # Spatial slice / point query
        lat_min = query.latitude_min if query.latitude_min is not None else float(np.min(lats))
        lat_max = query.latitude_max if query.latitude_max is not None else float(np.max(lats))
        lon_min = query.longitude_min if query.longitude_min is not None else float(np.min(lons))
        lon_max = query.longitude_max if query.longitude_max is not None else float(np.max(lons))

        lat_indices = np.where((lats >= lat_min) & (lats <= lat_max))[0]
        lon_indices = np.where((lons >= lon_min) & (lons <= lon_max))[0]

        if len(lat_indices) == 0 or len(lon_indices) == 0:
            summary = HistoricalResultSummary(
                status="no_data",
                total_records=0,
                data_status_note="Requested bounding box is outside HYCOM coverage.",
            )
            return [], summary, {"source": dataset_def.source_name, "retrieved_at": retrieved_at}

        # Stride large domains to prevent overwhelming the client
        lat_stride = max(1, len(lat_indices) // 16)
        lon_stride = max(1, len(lon_indices) // 16)
        lat_subset = lat_indices[::lat_stride]
        lon_subset = lon_indices[::lon_stride]

        if is_derived_current:
            u_cube = ds["UVEL"].values[time_idx]
            v_cube = ds["VVEL"].values[time_idx]
            var_cube = None
        else:
            var_cube = ds[nc_var_name].values[time_idx]
            u_cube = None
            v_cube = None

        records: list[NormalizedDataRecord] = []
        for d_idx in depth_indices:
            depth_val = float(depth_levels[d_idx])
            for i in lat_subset:
                lat_val = round(float(lats[i]), 4)
                for j in lon_subset:
                    lon_val = round(float(lons[j]), 4)
                    if is_derived_current:
                        u_val = float(u_cube[d_idx, i, j])
                        v_val = float(v_cube[d_idx, i, j])
                        if np.isnan(u_val) or np.isnan(v_val) or abs(u_val) > 1e20 or abs(v_val) > 1e20:
                            continue
                        if target_var_id == "current_speed":
                            val = float(np.sqrt(u_val**2 + v_val**2))
                        else:  # current_direction
                            val = float((np.arctan2(u_val, v_val) * 180.0 / np.pi) % 360.0)
                    else:
                        val = float(var_cube[d_idx, i, j])
                        if np.isnan(val) or abs(val) > 1e20:
                            continue  # Skip land / fill values

                    records.append(
                        NormalizedDataRecord(
                            source=dataset_def.source_id,
                            source_name=dataset_def.source_name,
                            product_id=dataset_def.product_id,
                            product_name=dataset_def.product_name,
                            dataset_id=dataset_def.dataset_id,
                            dataset_name=dataset_def.dataset_name,
                            variable=target_var_id,
                            variable_name=var_def.display_name if var_def else target_var_id,
                            units=unit,
                            model_valid_at=iso_time,
                            retrieved_at=retrieved_at,
                            latitude=lat_val,
                            longitude=lon_val,
                            depth=depth_val,
                            pressure=depth_val,
                            value=round(val, 4),
                            model_value=round(val, 4),
                            temporal_resolution=dataset_def.temporal_coverage.resolution,
                            spatial_resolution="0.24°",
                            vertical_resolution="HYCOM fixed layers (0-500m)",
                            processing_level=dataset_def.processing_level,
                            availability_status="available",
                        )
                    )

        if not records:
            summary = HistoricalResultSummary(
                status="no_data",
                total_records=0,
                data_status_note="All points in the requested region are land points or missing values.",
            )
            return [], summary, {"source": dataset_def.source_name, "retrieved_at": retrieved_at}

        result_summary = HistoricalResultSummary(
            status="complete",
            total_records=len(records),
            returned_time_range={"start": iso_time, "end": iso_time},
            returned_spatial_bounds={
                "south": min(r.latitude for r in records),
                "north": max(r.latitude for r in records),
                "west": min(r.longitude for r in records),
                "east": max(r.longitude for r in records),
            },
            returned_depth_range=[min(r.depth for r in records if r.depth is not None), max(r.depth for r in records if r.depth is not None)],
            units=unit,
        )

        provenance = {
            "source": dataset_def.source_name,
            "dataset_id": dataset_def.dataset_id,
            "product_id": dataset_def.product_id,
            "model_valid_at": iso_time,
            "retrieved_at": retrieved_at,
            "citation": dataset_def.citation,
        }

        return records, result_summary, provenance
