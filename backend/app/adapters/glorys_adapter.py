"""
GLORYS12V1 Reanalysis & Collocation source adapter.

Handles historical research benchmark retrieval from the verified collocation
dataset (Bay of Bengal, Jan 1–14 2024, 0–500 dbar).
Preserves difference convention: GLORYS - Argo (positive = GLORYS higher).
"""

from __future__ import annotations

from typing import Any, Optional
import numpy as np
import pandas as pd

from ..datasets import get_collocation, validate_coordinate
from ..models import (
    HistoricalDataRequest,
    HistoricalResultSummary,
    NormalizedDataRecord,
)
from ..registry import DatasetDefinition, VariableDefinition, resolve_canonical_variable
from .base import BaseSourceAdapter, RetrievalError, utc_now_iso


class GLORYSAdapter(BaseSourceAdapter):
    """Adapter for GLORYS12V1 Ocean Physics Reanalysis Collocation."""

    def __init__(self):
        super().__init__(
            source_id="glorys12v1",
            source_name="GLORYS12V1 Global Reanalysis (CMEMS)",
        )

    def retrieve(
        self,
        query: HistoricalDataRequest,
        dataset_def: DatasetDefinition,
        var_def: Optional[VariableDefinition],
    ) -> tuple[list[Any], HistoricalResultSummary, dict[str, Any]]:
        retrieved_at = utc_now_iso()
        ds = get_collocation()

        lats = ds["latitude"].values
        lons = ds["longitude"].values
        times = ds["time"].values
        pressures = ds["pressure"].values
        platforms = ds["platform_number"].values
        cycles = ds["cycle_number"].values

        mask = np.ones(len(lats), dtype=bool)

        # Spatial filter
        if query.latitude_min is not None:
            mask &= lats >= query.latitude_min
        if query.latitude_max is not None:
            mask &= lats <= query.latitude_max
        if query.longitude_min is not None:
            mask &= lons >= query.longitude_min
        if query.longitude_max is not None:
            mask &= lons <= query.longitude_max

        # Vertical filter
        p_min = query.pressure_min if query.pressure_min is not None else query.depth_min
        p_max = query.pressure_max if query.pressure_max is not None else query.depth_max
        if p_min is not None:
            mask &= pressures >= p_min
        if p_max is not None:
            mask &= pressures <= p_max

        # Temporal filter
        target_date = query.date or (query.start_datetime[:10] if query.start_datetime else None)
        if target_date:
            dates = pd.to_datetime(times).date
            target_d = pd.Timestamp(target_date).date()
            mask &= np.array([d == target_d for d in dates])
        elif query.start_datetime and query.end_datetime:
            dt_start = pd.Timestamp(query.start_datetime)
            dt_end = pd.Timestamp(query.end_datetime)
            dts = pd.to_datetime(times)
            mask &= (dts >= dt_start) & (dts <= dt_end)

        indices = np.where(mask)[0]

        if len(indices) == 0:
            summary = HistoricalResultSummary(
                status="no_data",
                total_records=0,
                data_status_note="No collocation records found matching the requested criteria.",
            )
            provenance = {
                "source": dataset_def.source_name,
                "dataset_id": dataset_def.dataset_id,
                "retrieved_at": retrieved_at,
                "method": "Collocation benchmark lookup",
                "citation": dataset_def.citation,
            }
            return [], summary, provenance

        target_var = var_def.id if var_def else "temperature"
        # Map canonical variable to collocation fields:
        # 'temperature'/'thetao' -> 'model_temperature', 'argo_temperature', 'temperature_error'
        # 'salinity'/'so' -> 'model_salinity', 'argo_salinity', 'salinity_error'
        base_var = "salinity" if target_var in ("salinity", "so") else "temperature"
        argo_field = f"argo_{base_var}"
        model_field = f"model_{base_var}"
        diff_field = f"{base_var}_error"
        unit = dataset_def.variable_units.get(target_var, "°C" if base_var == "temperature" else "PSU")

        model_vals = ds[model_field].values
        argo_vals = ds[argo_field].values
        diff_vals = ds[diff_field].values

        records: list[NormalizedDataRecord] = []
        for idx in indices:
            m_val = float(model_vals[idx])
            a_val = float(argo_vals[idx])
            d_val = float(diff_vals[idx])
            if np.isnan(m_val) or np.isnan(a_val):
                continue

            plat = str(platforms[idx]).strip().strip("'b").strip("'").strip()
            cyc = str(cycles[idx]).strip()
            iso_time = pd.Timestamp(times[idx]).tz_localize("UTC").isoformat().replace("+00:00", "Z")
            p_val = round(float(pressures[idx]), 2)

            records.append(
                NormalizedDataRecord(
                    source=dataset_def.source_id,
                    source_name=dataset_def.source_name,
                    product_id=dataset_def.product_id,
                    product_name=dataset_def.product_name,
                    dataset_id=dataset_def.dataset_id,
                    dataset_name=dataset_def.dataset_name,
                    variable=target_var,
                    variable_name=var_def.display_name if var_def else target_var,
                    units=unit,
                    observed_at=iso_time,
                    model_valid_at=iso_time,
                    retrieved_at=retrieved_at,
                    latitude=round(float(lats[idx]), 4),
                    longitude=round(float(lons[idx]), 4),
                    depth=p_val,
                    pressure=p_val,
                    value=round(m_val, 4),
                    model_value=round(m_val, 4),
                    observation_value=round(a_val, 4),
                    difference=round(d_val, 4),
                    qc_status={"collocation": "Verified", "argo_qc": "Delayed Mode 1/2", "difference_convention": "GLORYS - Argo"},
                    provenance={
                        "platform_number": plat,
                        "cycle_number": cyc,
                        "collocation_dataset": "glorys_argo_collocation_2024.nc",
                        "citation": dataset_def.citation,
                    },
                    temporal_resolution=dataset_def.temporal_coverage.resolution,
                    spatial_resolution="0.083° model collocated to float",
                    processing_level=dataset_def.processing_level,
                    availability_status="available",
                )
            )

        if not records:
            summary = HistoricalResultSummary(
                status="no_data",
                total_records=0,
                data_status_note="All records for the requested variable contained NaN/missing values.",
            )
            return [], summary, {"source": dataset_def.source_name, "retrieved_at": retrieved_at}

        p_vals = [r.pressure for r in records if r.pressure is not None]
        min_p = min(p_vals) if p_vals else 0.0
        max_p = max(p_vals) if p_vals else 0.0

        result_summary = HistoricalResultSummary(
            status="complete" if max_p >= 400.0 else "partial",
            total_records=len(records),
            returned_time_range={
                "start": min(r.observed_at for r in records if r.observed_at),
                "end": max(r.observed_at for r in records if r.observed_at),
            },
            returned_spatial_bounds={
                "south": min(r.latitude for r in records),
                "north": max(r.latitude for r in records),
                "west": min(r.longitude for r in records),
                "east": max(r.longitude for r in records),
            },
            returned_depth_range=[min_p, max_p],
            units=unit,
            qc_summary={
                "records_count": len(records),
                "mean_difference": round(float(np.mean([r.difference for r in records if r.difference is not None])), 4),
                "rms_difference": round(float(np.sqrt(np.mean([r.difference**2 for r in records if r.difference is not None]))), 4),
            },
        )

        provenance = {
            "source": dataset_def.source_name,
            "dataset_id": dataset_def.dataset_id,
            "product_id": dataset_def.product_id,
            "processing_level": dataset_def.processing_level,
            "difference_convention": "GLORYS - Argo",
            "retrieved_at": retrieved_at,
            "citation": dataset_def.citation,
        }

        return records, result_summary, provenance
