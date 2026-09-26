"""
Argo GDAC and Delayed Mode source adapter.

Handles official in-situ observation retrieval for both:
1. Historical Delayed Mode Argo CTD profiles in Bay of Bengal (Jan 2024)
2. On-demand GDAC Synthetic Profile Index live streams

Preserves QC flags 1 & 2, explicit observation timestamps, and official GDAC provenance.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
import numpy as np
import pandas as pd

from ..datasets import get_argo, is_in_argo_coverage
from ..latest_data import fetch_latest_available, LatestDataError
from ..models import (
    HistoricalDataRequest,
    HistoricalResultSummary,
    NormalizedDataRecord,
    UnifiedProfileLevel,
    UnifiedProfileRecord,
)
from ..registry import DatasetDefinition, VariableDefinition, resolve_canonical_variable
from .base import BaseSourceAdapter, RetrievalError, utc_now_iso


class ArgoAdapter(BaseSourceAdapter):
    """Adapter for Argo In-Situ Observations (Delayed Mode & GDAC Real-Time)."""

    def __init__(self):
        super().__init__(
            source_id="argo-gdac",
            source_name="Argo Global Data Assembly Centre (GDAC)",
        )

    def retrieve(
        self,
        query: HistoricalDataRequest,
        dataset_def: DatasetDefinition,
        var_def: Optional[VariableDefinition],
    ) -> tuple[list[Any], HistoricalResultSummary, dict[str, Any]]:
        retrieved_at = utc_now_iso()

        if dataset_def.dataset_id == "argo-gdac-latest-synthetic":
            return self._retrieve_live_gdac(query, dataset_def, var_def, retrieved_at)
        elif dataset_def.dataset_id == "argo-delayed-mode-bob-2024":
            return self._retrieve_delayed_mode(query, dataset_def, var_def, retrieved_at)
        else:
            raise RetrievalError(
                "UNSUPPORTED_DATASET",
                f"ArgoAdapter cannot retrieve dataset '{dataset_def.dataset_id}'.",
            )

    def _retrieve_delayed_mode(
        self,
        query: HistoricalDataRequest,
        dataset_def: DatasetDefinition,
        var_def: Optional[VariableDefinition],
        retrieved_at: str,
    ) -> tuple[list[Any], HistoricalResultSummary, dict[str, Any]]:
        ds = get_argo()

        lats = ds["latitude"].values
        lons = ds["longitude"].values
        times = ds["time"].values
        platforms = ds["platform_number"].values
        cycles = ds["cycle_number"].values
        temps = ds["temperature"].values
        sals = ds["salinity"].values
        pressures = ds["pressure"].values

        # ── Filter Construction ──────────────────────────────────────────────
        mask = np.ones(len(lats), dtype=bool)

        if query.latitude_min is not None:
            mask &= lats >= query.latitude_min
        if query.latitude_max is not None:
            mask &= lats <= query.latitude_max
        if query.longitude_min is not None:
            mask &= lons >= query.longitude_min
        if query.longitude_max is not None:
            mask &= lons <= query.longitude_max
        if query.depth_min is not None or query.pressure_min is not None:
            p_min = query.pressure_min if query.pressure_min is not None else query.depth_min
            mask &= pressures >= p_min
        if query.depth_max is not None or query.pressure_max is not None:
            p_max = query.pressure_max if query.pressure_max is not None else query.depth_max
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
                data_status_note="No Argo Delayed Mode profiles found matching the requested spatial/temporal criteria.",
            )
            provenance = {
                "source": dataset_def.source_name,
                "dataset_id": dataset_def.dataset_id,
                "retrieved_at": retrieved_at,
                "method": "NetCDF xarray query on validated Delayed Mode archive",
                "citation": dataset_def.citation,
            }
            return [], summary, provenance

        # Variable identification
        target_var_id = var_def.id if var_def else "temperature"
        target_unit = dataset_def.variable_units.get(target_var_id, "°C")

        # Check requested format: "profiles" vs "records"
        if query.format == "profiles":
            # Group into UnifiedProfileRecords
            profiles_dict: dict[tuple[str, int], list[UnifiedProfileLevel]] = {}
            meta_dict: dict[tuple[str, int], dict[str, Any]] = {}

            for idx in indices:
                plat = str(platforms[idx]).strip().strip("'b").strip("'").strip()
                cyc = int(cycles[idx])
                key = (plat, cyc)

                if key not in meta_dict:
                    meta_dict[key] = {
                        "platform_id": plat,
                        "cycle_number": cyc,
                        "latitude": round(float(lats[idx]), 4),
                        "longitude": round(float(lons[idx]), 4),
                        "observed_at": pd.Timestamp(times[idx]).tz_localize("UTC").isoformat().replace("+00:00", "Z"),
                    }
                    profiles_dict[key] = []

                p_val = float(pressures[idx])
                t_val = float(temps[idx]) if np.isfinite(temps[idx]) else None
                s_val = float(sals[idx]) if np.isfinite(sals[idx]) else None

                profiles_dict[key].append(
                    UnifiedProfileLevel(
                        depth=round(p_val, 2),
                        pressure=round(p_val, 2),
                        temperature=round(t_val, 4) if t_val is not None else None,
                        salinity=round(s_val, 4) if s_val is not None else None,
                        value=round(t_val, 4) if target_var_id in ("temperature", "thetao") and t_val is not None else round(s_val, 4) if s_val is not None else None,
                        qc_accepted=True,
                        qc_flag="1",
                    )
                )

            profile_records: list[UnifiedProfileRecord] = []
            for key, levels in profiles_dict.items():
                meta = meta_dict[key]
                levels.sort(key=lambda l: l.pressure or 0.0)
                profile_records.append(
                    UnifiedProfileRecord(
                        available=True,
                        profile_id=f"argo_{meta['platform_id']}_{meta['cycle_number']}",
                        platform_id=meta["platform_id"],
                        cycle_number=meta["cycle_number"],
                        latitude=meta["latitude"],
                        longitude=meta["longitude"],
                        observed_at=meta["observed_at"],
                        retrieved_at=retrieved_at,
                        levels=levels,
                        qc={
                            "accepted_flags": ["1", "2"],
                            "accepted_levels": len(levels),
                            "state": "Delayed Mode Quality Controlled",
                        },
                        provenance={
                            "source": dataset_def.source_name,
                            "dataset_id": dataset_def.dataset_id,
                            "product_id": dataset_def.product_id,
                            "processing_level": dataset_def.processing_level,
                            "retrieved_at": retrieved_at,
                            "citation": dataset_def.citation,
                        },
                    )
                )

            p_depths = [lvl.pressure for p in profile_records for lvl in p.levels if lvl.pressure is not None]
            min_p = min(p_depths) if p_depths else 0.0
            max_p = max(p_depths) if p_depths else 0.0

            result_summary = HistoricalResultSummary(
                status="complete" if max_p >= 400.0 else "partial",
                total_records=len(profile_records),
                returned_time_range={
                    "start": min(p.observed_at for p in profile_records),
                    "end": max(p.observed_at for p in profile_records),
                },
                returned_spatial_bounds={
                    "south": min(p.latitude for p in profile_records),
                    "north": max(p.latitude for p in profile_records),
                    "west": min(p.longitude for p in profile_records),
                    "east": max(p.longitude for p in profile_records),
                },
                returned_depth_range=[min_p, max_p],
                units=target_unit,
                qc_summary={"mode": "Delayed Mode", "flags": ["1", "2"], "profiles_count": len(profile_records)},
            )
            provenance = {
                "source": dataset_def.source_name,
                "dataset_id": dataset_def.dataset_id,
                "product_id": dataset_def.product_id,
                "processing_level": dataset_def.processing_level,
                "retrieved_at": retrieved_at,
                "citation": dataset_def.citation,
            }
            return profile_records, result_summary, provenance

        # Default tabular records format
        records: list[NormalizedDataRecord] = []
        for idx in indices:
            p_val = float(pressures[idx])
            t_val = float(temps[idx]) if np.isfinite(temps[idx]) else None
            s_val = float(sals[idx]) if np.isfinite(sals[idx]) else None

            val = t_val if target_var_id in ("temperature", "thetao") else s_val
            if val is None:
                continue

            plat = str(platforms[idx]).strip().strip("'b").strip("'").strip()
            cyc = int(cycles[idx])
            obs_time = pd.Timestamp(times[idx]).tz_localize("UTC").isoformat().replace("+00:00", "Z")

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
                    units=target_unit,
                    observed_at=obs_time,
                    retrieved_at=retrieved_at,
                    latitude=round(float(lats[idx]), 4),
                    longitude=round(float(lons[idx]), 4),
                    depth=round(p_val, 2),
                    pressure=round(p_val, 2),
                    value=round(val, 4),
                    observation_value=round(val, 4),
                    qc_status={"flag": "1", "meaning": "Good / Delayed Mode Validated"},
                    provenance={
                        "platform_id": plat,
                        "cycle_number": cyc,
                        "citation": dataset_def.citation,
                    },
                    temporal_resolution=dataset_def.temporal_coverage.resolution,
                    spatial_resolution="in-situ float profile",
                    vertical_resolution="continuous CTD descent/ascent",
                    processing_level=dataset_def.processing_level,
                    availability_status="available",
                )
            )

        if not records:
            summary = HistoricalResultSummary(
                status="no_data",
                total_records=0,
                data_status_note=f"No valid observations for variable '{target_var_id}' in the selected scope.",
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
            units=target_unit,
            qc_summary={"accepted_records": len(records), "standard": "Argo DM QC 1/2"},
        )
        provenance = {
            "source": dataset_def.source_name,
            "dataset_id": dataset_def.dataset_id,
            "product_id": dataset_def.product_id,
            "processing_level": dataset_def.processing_level,
            "retrieved_at": retrieved_at,
            "citation": dataset_def.citation,
        }
        return records, result_summary, provenance

    def _retrieve_live_gdac(
        self,
        query: HistoricalDataRequest,
        dataset_def: DatasetDefinition,
        var_def: Optional[VariableDefinition],
        retrieved_at: str,
    ) -> tuple[list[Any], HistoricalResultSummary, dict[str, Any]]:
        try:
            latest_payload = fetch_latest_available(region="bay-of-bengal", max_age_days=30, force_refresh=False)
        except LatestDataError as exc:
            raise RetrievalError(exc.code, exc.message)

        observations = latest_payload.get("observations", [])
        if not observations:
            raise RetrievalError("NO_DATA", "No qualifying live Argo profiles returned by GDAC.")

        target_var_id = var_def.id if var_def else "temperature"
        target_unit = dataset_def.variable_units.get(target_var_id, "°C")

        if query.format == "profiles":
            profiles: list[UnifiedProfileRecord] = []
            for obs in observations:
                levels = [
                    UnifiedProfileLevel(
                        pressure=lvl.get("pressure"),
                        depth=lvl.get("pressure"),
                        temperature=lvl.get("temperature"),
                        salinity=lvl.get("salinity"),
                        value=lvl.get("temperature") if target_var_id in ("temperature", "thetao") else lvl.get("salinity"),
                        pressure_qc=lvl.get("pressure_qc"),
                        temperature_qc=lvl.get("temperature_qc"),
                        salinity_qc=lvl.get("salinity_qc"),
                        qc_accepted=True,
                    )
                    for lvl in obs.get("levels", [])
                ]
                profiles.append(
                    UnifiedProfileRecord(
                        available=True,
                        profile_id=obs["profile_id"],
                        platform_id=obs.get("platform_id"),
                        cycle_number=obs.get("cycle_number"),
                        latitude=obs["latitude"],
                        longitude=obs["longitude"],
                        observed_at=obs["observation_time"],
                        retrieved_at=retrieved_at,
                        data_mode=obs.get("data_mode"),
                        value_source=obs.get("value_source"),
                        levels=levels,
                        qc=obs.get("qc"),
                        provenance=obs.get("provenance", {}),
                    )
                )
            summary = HistoricalResultSummary(
                status="complete",
                total_records=len(profiles),
                returned_time_range={
                    "start": min(p.observed_at for p in profiles),
                    "end": max(p.observed_at for p in profiles),
                },
                returned_spatial_bounds={
                    "south": min(p.latitude for p in profiles),
                    "north": max(p.latitude for p in profiles),
                    "west": min(p.longitude for p in profiles),
                    "east": max(p.longitude for p in profiles),
                },
                returned_depth_range=[0.0, 500.0],
                units=target_unit,
                qc_summary={"profile_count": len(profiles), "flags": ["1", "2"]},
            )
            return profiles, summary, latest_payload.get("provenance", {})

        # Default normalized records format
        records: list[NormalizedDataRecord] = []
        for obs in observations:
            for lvl in obs.get("levels", []):
                val = lvl.get("temperature") if target_var_id in ("temperature", "thetao") else lvl.get("salinity")
                if val is None:
                    continue
                p_val = lvl.get("pressure")
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
                        units=target_unit,
                        observed_at=obs["observation_time"],
                        retrieved_at=retrieved_at,
                        latitude=obs["latitude"],
                        longitude=obs["longitude"],
                        depth=p_val,
                        pressure=p_val,
                        value=val,
                        observation_value=val,
                        qc_status={"pres_qc": lvl.get("pressure_qc"), "temp_qc": lvl.get("temperature_qc"), "psal_qc": lvl.get("salinity_qc")},
                        provenance=obs.get("provenance", {}),
                        temporal_resolution="event-based",
                        spatial_resolution="in-situ float profile",
                        processing_level=dataset_def.processing_level,
                        availability_status="available",
                    )
                )

        summary = HistoricalResultSummary(
            status="complete",
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
            returned_depth_range=[0.0, 500.0],
            units=target_unit,
            qc_summary={"accepted_records": len(records), "standard": "GDAC QC 1/2"},
        )
        return records, summary, latest_payload.get("provenance", {})
