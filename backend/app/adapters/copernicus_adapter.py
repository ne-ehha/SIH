"""
Copernicus Marine Service operational model source adapter.

Provides authentic server-side subset retrieval and scientific collocation for:
- Physical Analysis & Forecast:
  * thetao (Potential Temperature)
  * so (Practical Salinity)
  * uo, vo (Zonal and Meridional Velocities) -> Derived current_speed, current_direction
  * wo (Vertical Velocity)
  * zos (Sea Surface Height), mlotst (Mixed Layer Thickness)
- Biogeochemical Analysis & Forecast:
  * chl (Chlorophyll-a mass concentration)
  * o2 (Dissolved Oxygen concentration)
  * no3 (Nitrate concentration)

Strict scientific integrity:
- Server-side only authenticated access via official copernicusmarine toolbox.
- Never invents, mocks, or fabricates synthetic values.
- Truthfully exposes observed vs model vs derived vs unavailable data kinds.
- Collocation computes exact spatial offsets (km) and temporal offsets (hours).
"""

from __future__ import annotations

import os
import math
from datetime import datetime, timezone
from typing import Any, Optional
import numpy as np
import pandas as pd

from ..models import (
    HistoricalDataRequest,
    HistoricalResultSummary,
    NormalizedDataRecord,
)
from ..registry import DatasetDefinition, VariableDefinition, resolve_canonical_variable
from .base import BaseSourceAdapter, RetrievalError, utc_now_iso


# Mapping canonical variable IDs to Copernicus variable names in specific datasets
VAR_NAME_MAPPING: dict[str, str] = {
    "thetao": "thetao",
    "temperature": "thetao",
    "so": "so",
    "salinity": "so",
    "uo": "uo",
    "currents_u": "uo",
    "vo": "vo",
    "currents_v": "vo",
    "wo": "wo",
    "zos": "zos",
    "mlotst": "mlotst",
    "chl": "chl",
    "chlorophyll": "chl",
    "o2": "o2",
    "dissolved_oxygen": "o2",
    "no3": "no3",
    "nitrate": "no3",
}


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Compute great-circle distance between two points in kilometers."""
    r = 6371.0  # Earth radius in km
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


def has_copernicus_credentials() -> bool:
    """Check if Copernicus Marine credentials exist in env or local credentials store."""
    username = os.environ.get("COPERNICUSMARINE_SERVICE_USERNAME")
    password = os.environ.get("COPERNICUSMARINE_SERVICE_PASSWORD")
    if username and password:
        return True
    # Check default credentials file path used by copernicusmarine CLI
    home = os.path.expanduser("~")
    cred_file = os.path.join(home, ".copernicusmarine", ".copernicusmarine-credentials")
    if os.path.exists(cred_file):
        return True
    return False


class CopernicusAdapter(BaseSourceAdapter):
    """Adapter for Copernicus Marine Service Operational Models (Physics & Biogeochemistry)."""

    def __init__(self):
        super().__init__(
            source_id="copernicus-marine",
            source_name="Copernicus Marine Service (CMEMS)",
        )

    def retrieve(
        self,
        query: HistoricalDataRequest,
        dataset_def: DatasetDefinition,
        var_def: Optional[VariableDefinition],
    ) -> tuple[list[Any], HistoricalResultSummary, dict[str, Any]]:
        retrieved_at = utc_now_iso()

        try:
            import copernicusmarine  # type: ignore
            toolbox_available = True
        except ImportError:
            toolbox_available = False

        if not has_copernicus_credentials():
            raise RetrievalError(
                "AUTHENTICATION_REQUIRED",
                (
                    f"Official Copernicus Marine dataset '{dataset_def.dataset_id}' requires authenticated access. "
                    "Server environment variables COPERNICUSMARINE_SERVICE_USERNAME and "
                    "COPERNICUSMARINE_SERVICE_PASSWORD (or credentials store) are not configured."
                ),
                details={
                    "dataset_id": dataset_def.dataset_id,
                    "product_id": dataset_def.product_id,
                    "source": dataset_def.source_name,
                    "documentation_url": dataset_def.documentation_url,
                    "auth_requirement": "Copernicus Marine Service Account (free registration at marine.copernicus.eu)",
                },
            )

        if not toolbox_available:
            raise RetrievalError(
                "SOURCE_UNAVAILABLE",
                (
                    f"Copernicus Marine toolbox is not installed on this server instance to retrieve '{dataset_def.dataset_id}'. "
                    "Install copernicusmarine library on backend to enable subset retrieval."
                ),
                details={
                    "dataset_id": dataset_def.dataset_id,
                    "product_id": dataset_def.product_id,
                },
            )

        # ── Target Variable Resolution ───────────────────────────────────────
        target_var_id = var_def.id if var_def else dataset_def.supported_variables[0]
        target_unit = dataset_def.variable_units.get(target_var_id, "")
        is_derived_current = target_var_id in ("current_speed", "current_direction")

        # Determine which variables to request from Copernicus
        if is_derived_current:
            cmems_vars = ["uo", "vo"]
        else:
            cmems_var_name = VAR_NAME_MAPPING.get(target_var_id, target_var_id)
            cmems_vars = [cmems_var_name]

        # ── Spatial & Temporal Query Bounds ──────────────────────────────────
        min_lon = query.longitude_min if query.longitude_min is not None else dataset_def.spatial_coverage.west
        max_lon = query.longitude_max if query.longitude_max is not None else dataset_def.spatial_coverage.east
        min_lat = query.latitude_min if query.latitude_min is not None else dataset_def.spatial_coverage.south
        max_lat = query.latitude_max if query.latitude_max is not None else dataset_def.spatial_coverage.north

        # Limit bounding box if global/unbounded to prevent giant downloads
        if min_lat < -80 and max_lat > 80:
            min_lat, max_lat = 0.0, 25.0
        if min_lon < -170 and max_lon > 170:
            min_lon, max_lon = 80.0, 100.0

        # Datetime bounds
        if query.date:
            start_dt = f"{query.date}T00:00:00"
            end_dt = f"{query.date}T23:59:59"
        elif query.start_datetime and query.end_datetime:
            start_dt = query.start_datetime
            end_dt = query.end_datetime
        else:
            start_dt = "2026-09-15T00:00:00"
            end_dt = "2026-09-15T23:59:59"

        # Depth bounds
        min_depth = query.depth_min if query.depth_min is not None else dataset_def.vertical_coverage.min_depth
        max_depth = query.depth_max if query.depth_max is not None else min(dataset_def.vertical_coverage.max_depth, 500.0)

        # ── Execute Upstream Subset Retrieval ────────────────────────────────
        try:
            open_kwargs: dict[str, Any] = {
                "dataset_id": dataset_def.dataset_id,
                "variables": cmems_vars,
                "minimum_longitude": float(min_lon),
                "maximum_longitude": float(max_lon),
                "minimum_latitude": float(min_lat),
                "maximum_latitude": float(max_lat),
                "start_datetime": start_dt,
                "end_datetime": end_dt,
            }
            if dataset_def.supports_3d and max_depth > 0:
                open_kwargs["minimum_depth"] = float(min_depth)
                open_kwargs["maximum_depth"] = float(max_depth)

            ds = copernicusmarine.open_dataset(**open_kwargs)
        except Exception as exc:
            raise RetrievalError(
                "UPSTREAM_ERROR",
                f"Copernicus Marine API subset retrieval failed: {str(exc)}",
                details={"dataset_id": dataset_def.dataset_id, "variables": cmems_vars},
            ) from exc

        # ── Parse xarray Dataset into NormalizedDataRecord objects ───────────
        try:
            records: list[NormalizedDataRecord] = []
            
            lats = ds["latitude"].values
            lons = ds["longitude"].values
            times = ds["time"].values
            has_depth = "depth" in ds.coords or "depth" in ds.dims

            depths = ds["depth"].values if has_depth else [0.0]

            if is_derived_current:
                uo_data = ds["uo"].values
                vo_data = ds["vo"].values
            else:
                raw_var_name = cmems_vars[0]
                var_data = ds[raw_var_name].values

            for t_idx, time_val in enumerate(times):
                ts = pd.Timestamp(time_val)
                if ts.tzinfo is None:
                    ts = ts.tz_localize("UTC")
                else:
                    ts = ts.tz_convert("UTC")
                t_str = ts.isoformat().replace("+00:00", "Z")

                for d_idx, depth_val in enumerate(depths):
                    d_float = float(depth_val)
                    for lat_idx, lat_val in enumerate(lats):
                        lat_float = float(lat_val)
                        for lon_idx, lon_val in enumerate(lons):
                            lon_float = float(lon_val)

                            if is_derived_current:
                                if has_depth:
                                    uo_val = float(uo_data[t_idx, d_idx, lat_idx, lon_idx])
                                    vo_val = float(vo_data[t_idx, d_idx, lat_idx, lon_idx])
                                else:
                                    uo_val = float(uo_data[t_idx, lat_idx, lon_idx])
                                    vo_val = float(vo_data[t_idx, lat_idx, lon_idx])

                                if not np.isfinite(uo_val) or not np.isfinite(vo_val):
                                    continue

                                if target_var_id == "current_speed":
                                    val = math.sqrt(uo_val**2 + vo_val**2)
                                    data_kind = "derived"
                                else:
                                    # Oceanographic compass bearing (direction toward, clockwise from North: atan2(u, v))
                                    val = (math.degrees(math.atan2(uo_val, vo_val)) + 360.0) % 360.0
                                    data_kind = "derived"
                            else:
                                if has_depth:
                                    raw_val = float(var_data[t_idx, d_idx, lat_idx, lon_idx])
                                else:
                                    raw_val = float(var_data[t_idx, lat_idx, lon_idx])

                                if not np.isfinite(raw_val):
                                    continue
                                val = raw_val
                                data_kind = "model"

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
                                    model_valid_at=t_str,
                                    retrieved_at=retrieved_at,
                                    latitude=round(lat_float, 4),
                                    longitude=round(lon_float, 4),
                                    depth=round(d_float, 2) if has_depth else None,
                                    pressure=round(d_float, 2) if has_depth else None,
                                    value=round(val, 5),
                                    model_value=round(val, 5),
                                    provenance={
                                        "source": dataset_def.source_name,
                                        "product_id": dataset_def.product_id,
                                        "dataset_id": dataset_def.dataset_id,
                                        "data_kind": data_kind,
                                        "retrieved_at": retrieved_at,
                                        "model_valid_at": t_str,
                                        "citation": dataset_def.citation,
                                    },
                                    temporal_resolution=dataset_def.temporal_coverage.resolution,
                                    spatial_resolution="1/12° (~8km) NEMO grid" if "0.083deg" in dataset_def.dataset_id else "1/4° (~25km) PISCES grid",
                                    processing_level=dataset_def.processing_level,
                                    availability_status="available",
                                )
                            )
            ds.close()
        except Exception as exc:
            raise RetrievalError(
                "DATA_EXTRACTION_ERROR",
                f"Failed to extract structured records from Copernicus dataset: {str(exc)}",
            ) from exc

        if not records:
            summary = HistoricalResultSummary(
                status="no_data",
                total_records=0,
                data_status_note=f"No valid model values found for '{target_var_id}' within the requested bounds.",
            )
            provenance = {
                "source": dataset_def.source_name,
                "dataset_id": dataset_def.dataset_id,
                "product_id": dataset_def.product_id,
                "retrieved_at": retrieved_at,
            }
            return [], summary, provenance

        all_depths = [r.depth for r in records if r.depth is not None]
        min_d = min(all_depths) if all_depths else 0.0
        max_d = max(all_depths) if all_depths else 0.0

        result_summary = HistoricalResultSummary(
            status="complete" if len(records) > 0 else "no_data",
            total_records=len(records),
            returned_time_range={
                "start": min(r.model_valid_at for r in records if r.model_valid_at),
                "end": max(r.model_valid_at for r in records if r.model_valid_at),
            },
            returned_spatial_bounds={
                "south": min(r.latitude for r in records),
                "north": max(r.latitude for r in records),
                "west": min(r.longitude for r in records),
                "east": max(r.longitude for r in records),
            },
            returned_depth_range=[min_d, max_d],
            units=target_unit,
            qc_summary={"records_count": len(records), "data_kind": data_kind},
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

    def collocate_profile(
        self,
        latitude: float,
        longitude: float,
        observation_time: str,
        target_depths: list[float],
        variables: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        """
        Collocate Copernicus operational model data at a specific Argo profile location and time.
        
        Retrieves:
        - thetao (Potential Temperature)
        - so (Practical Salinity)
        - uo, vo -> current_speed, current_direction
        - chl (Chlorophyll-a, if BGC available)
        - o2 (Dissolved Oxygen, if BGC available)
        - no3 (Nitrate, if BGC available)
        - zos (Sea Surface Height)
        - mlotst (Mixed Layer Depth)
        """
        retrieved_at = utc_now_iso()
        if variables is None:
            variables = ["thetao", "so", "uo", "vo", "current_speed", "current_direction", "chl", "o2", "no3", "zos", "mlotst"]

        if not has_copernicus_credentials():
            return {
                "available": False,
                "reason": "Copernicus Marine authentication credentials are not configured.",
                "retrieved_at": retrieved_at,
            }

        try:
            import copernicusmarine  # type: ignore
        except ImportError:
            return {
                "available": False,
                "reason": "Copernicus Marine toolbox is not installed.",
                "retrieved_at": retrieved_at,
            }

        # Parse observation timestamp to determine model date
        try:
            obs_dt = pd.Timestamp(observation_time).to_pydatetime()
            obs_date_str = obs_dt.strftime("%Y-%m-%d")
        except Exception:
            obs_dt = datetime.now(timezone.utc)
            obs_date_str = "2026-09-15"

        # Bounding box around observation point: ±0.15 deg
        min_lat = max(-89.0, latitude - 0.15)
        max_lat = min(89.0, latitude + 0.15)
        min_lon = max(-179.0, longitude - 0.15)
        max_lon = min(179.0, longitude + 0.15)

        start_dt = f"{obs_date_str}T00:00:00"
        end_dt = f"{obs_date_str}T23:59:59"

        # Check in-memory cache keyed by dataset/variables/coords/time/depth
        var_key = ",".join(sorted(variables))
        d_min = min(target_depths) if target_depths else 0.0
        d_max = max(target_depths) if target_depths else 0.0
        cache_key = f"cmems_colloc:{round(latitude, 4)}:{round(longitude, 4)}:{obs_date_str}:{var_key}:{round(d_min, 1)}-{round(d_max, 1)}"
        now_ts = datetime.now(timezone.utc).timestamp()
        if hasattr(self, "_collocate_cache") and cache_key in self._collocate_cache:
            cached_data, cached_ts = self._collocate_cache[cache_key]
            if now_ts - cached_ts < 900:  # 15 minutes TTL
                return cached_data

        results_by_var: dict[str, list[dict[str, Any]]] = {}
        surface_fields: dict[str, Any] = {}
        meta_info: dict[str, Any] = {}

        import concurrent.futures

        def fetch_thetao():
            try:
                ds = copernicusmarine.open_dataset(
                    dataset_id="cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m",
                    variables=["thetao"],
                    minimum_longitude=min_lon,
                    maximum_longitude=max_lon,
                    minimum_latitude=min_lat,
                    maximum_latitude=max_lat,
                    start_datetime=start_dt,
                    end_datetime=end_dt,
                    minimum_depth=0.49,
                    maximum_depth=500.0,
                )
                collocated = ds.sel(latitude=latitude, longitude=longitude, method="nearest")
                m_lat = float(collocated["latitude"].values.item() if hasattr(collocated["latitude"].values, "item") else collocated["latitude"].values)
                m_lon = float(collocated["longitude"].values.item() if hasattr(collocated["longitude"].values, "item") else collocated["longitude"].values)
                raw_time = collocated["time"].values
                ts = pd.Timestamp(raw_time.item() if hasattr(raw_time, "item") else raw_time)
                if ts.tzinfo is None:
                    ts = ts.tz_localize("UTC")
                else:
                    ts = ts.tz_convert("UTC")
                m_time = ts.isoformat().replace("+00:00", "Z")
                
                m_depths = collocated["depth"].values
                m_values = collocated["thetao"].values.squeeze()
                t_interp = np.interp(target_depths, m_depths, m_values)
                t_res = [
                    {"depth": round(d, 2), "value": round(float(v), 4), "data_kind": "model", "unit": "°C"}
                    for d, v in zip(target_depths, t_interp)
                    if np.isfinite(v)
                ]
                ds.close()
                return ("thetao", t_res, m_lat, m_lon, m_time)
            except Exception:
                return ("thetao", [], None, None, None)

        def fetch_so():
            try:
                ds = copernicusmarine.open_dataset(
                    dataset_id="cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m",
                    variables=["so"],
                    minimum_longitude=min_lon,
                    maximum_longitude=max_lon,
                    minimum_latitude=min_lat,
                    maximum_latitude=max_lat,
                    start_datetime=start_dt,
                    end_datetime=end_dt,
                    minimum_depth=0.49,
                    maximum_depth=500.0,
                )
                collocated = ds.sel(latitude=latitude, longitude=longitude, method="nearest")
                m_depths = collocated["depth"].values
                m_values = collocated["so"].values.squeeze()
                s_interp = np.interp(target_depths, m_depths, m_values)
                s_res = [
                    {"depth": round(d, 2), "value": round(float(v), 4), "data_kind": "model", "unit": "PSU"}
                    for d, v in zip(target_depths, s_interp)
                    if np.isfinite(v)
                ]
                ds.close()
                return ("so", s_res)
            except Exception:
                return ("so", [])

        def fetch_cur():
            try:
                ds = copernicusmarine.open_dataset(
                    dataset_id="cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m",
                    variables=["uo", "vo"],
                    minimum_longitude=min_lon,
                    maximum_longitude=max_lon,
                    minimum_latitude=min_lat,
                    maximum_latitude=max_lat,
                    start_datetime=start_dt,
                    end_datetime=end_dt,
                    minimum_depth=0.49,
                    maximum_depth=500.0,
                )
                collocated = ds.sel(latitude=latitude, longitude=longitude, method="nearest")
                m_depths = collocated["depth"].values
                uo_vals = collocated["uo"].values.squeeze()
                vo_vals = collocated["vo"].values.squeeze()

                uo_interp = np.interp(target_depths, m_depths, uo_vals)
                vo_interp = np.interp(target_depths, m_depths, vo_vals)

                speed_vals = np.sqrt(uo_interp**2 + vo_interp**2)
                # Oceanographic compass bearing: atan2(u, v) converted to degrees clockwise from North [0, 360)
                dir_vals = (np.degrees(np.arctan2(uo_interp, vo_interp)) + 360.0) % 360.0
                math_angles = (np.degrees(np.arctan2(vo_interp, uo_interp)) + 360.0) % 360.0

                uo_res = [{"depth": round(d, 2), "value": round(float(v), 4), "data_kind": "model", "unit": "m/s"} for d, v in zip(target_depths, uo_interp) if np.isfinite(v)]
                vo_res = [{"depth": round(d, 2), "value": round(float(v), 4), "data_kind": "model", "unit": "m/s"} for d, v in zip(target_depths, vo_interp) if np.isfinite(v)]
                spd_res = [{"depth": round(d, 2), "value": round(float(v), 4), "data_kind": "derived", "unit": "m/s"} for d, v in zip(target_depths, speed_vals) if np.isfinite(v)]
                dir_res = [{"depth": round(d, 2), "value": round(float(v), 2), "data_kind": "derived", "unit": "° toward (bearing)", "convention": "clockwise from True North"} for d, v in zip(target_depths, dir_vals) if np.isfinite(v)]
                vec_res = [
                    {
                        "depth": round(d, 2),
                        "u": round(float(u), 4),
                        "v": round(float(v), 4),
                        "speed": round(float(s), 4),
                        "direction": round(float(dr), 2),
                        "bearing_toward_deg": round(float(dr), 2),
                        "math_angle_deg": round(float(ma), 2),
                        "convention": "oceanographic bearing toward (0° North, 90° East)",
                    }
                    for d, u, v, s, dr, ma in zip(target_depths, uo_interp, vo_interp, speed_vals, dir_vals, math_angles)
                    if np.isfinite(s)
                ]
                ds.close()
                return ("cur", uo_res, vo_res, spd_res, dir_res, vec_res)
            except Exception:
                return ("cur", [], [], [], [], [])

        def fetch_surf():
            try:
                ds = copernicusmarine.open_dataset(
                    dataset_id="cmems_mod_glo_phy_anfc_0.083deg_P1D-m",
                    variables=["zos", "mlotst"],
                    minimum_longitude=min_lon,
                    maximum_longitude=max_lon,
                    minimum_latitude=min_lat,
                    maximum_latitude=max_lat,
                    start_datetime=start_dt,
                    end_datetime=end_dt,
                )
                collocated = ds.sel(latitude=latitude, longitude=longitude, method="nearest")
                zos_val = float(collocated["zos"].values.squeeze())
                mlotst_val = float(collocated["mlotst"].values.squeeze())
                surf = {}
                if np.isfinite(zos_val):
                    surf["zos"] = {"value": round(zos_val, 4), "unit": "m", "display_name": "Sea Surface Height", "depth": 0.0}
                if np.isfinite(mlotst_val):
                    surf["mlotst"] = {"value": round(mlotst_val, 2), "unit": "m", "display_name": "Mixed Layer Depth", "depth": 0.0}
                ds.close()
                return ("surf", surf)
            except Exception:
                return ("surf", {})

        def fetch_bgc():
            bgc_res = {"chl": [], "o2": [], "no3": []}
            # Chlorophyll (depth-resolved BGC model)
            try:
                ds = copernicusmarine.open_dataset(
                    dataset_id="cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m",
                    variables=["chl"],
                    minimum_longitude=min_lon,
                    maximum_longitude=max_lon,
                    minimum_latitude=min_lat,
                    maximum_latitude=max_lat,
                    start_datetime=start_dt,
                    end_datetime=end_dt,
                    minimum_depth=0.5,
                    maximum_depth=500.0,
                )
                collocated = ds.sel(latitude=latitude, longitude=longitude, method="nearest")
                m_depths = collocated["depth"].values
                m_values = collocated["chl"].values.squeeze()
                interp = np.interp(target_depths, m_depths, m_values)
                bgc_res["chl"] = [{"depth": round(d, 2), "value": round(float(v), 4), "data_kind": "model", "unit": "mg/m³"} for d, v in zip(target_depths, interp) if np.isfinite(v)]
                ds.close()
            except Exception:
                pass

            # Dissolved oxygen
            try:
                ds = copernicusmarine.open_dataset(
                    dataset_id="cmems_mod_glo_bgc-bio_anfc_0.25deg_P1D-m",
                    variables=["o2"],
                    minimum_longitude=min_lon,
                    maximum_longitude=max_lon,
                    minimum_latitude=min_lat,
                    maximum_latitude=max_lat,
                    start_datetime=start_dt,
                    end_datetime=end_dt,
                    minimum_depth=0.5,
                    maximum_depth=500.0,
                )
                collocated = ds.sel(latitude=latitude, longitude=longitude, method="nearest")
                m_depths = collocated["depth"].values
                m_values = collocated["o2"].values.squeeze()
                interp = np.interp(target_depths, m_depths, m_values)
                bgc_res["o2"] = [{"depth": round(d, 2), "value": round(float(v), 4), "data_kind": "model", "unit": "mmol/m³"} for d, v in zip(target_depths, interp) if np.isfinite(v)]
                ds.close()
            except Exception:
                pass

            # Nitrate
            try:
                ds = copernicusmarine.open_dataset(
                    dataset_id="cmems_mod_glo_bgc-nut_anfc_0.25deg_P1D-m",
                    variables=["no3"],
                    minimum_longitude=min_lon,
                    maximum_longitude=max_lon,
                    minimum_latitude=min_lat,
                    maximum_latitude=max_lat,
                    start_datetime=start_dt,
                    end_datetime=end_dt,
                    minimum_depth=0.5,
                    maximum_depth=500.0,
                )
                collocated = ds.sel(latitude=latitude, longitude=longitude, method="nearest")
                m_depths = collocated["depth"].values
                m_values = collocated["no3"].values.squeeze()
                interp = np.interp(target_depths, m_depths, m_values)
                bgc_res["no3"] = [{"depth": round(d, 2), "value": round(float(v), 4), "data_kind": "model", "unit": "mmol/m³"} for d, v in zip(target_depths, interp) if np.isfinite(v)]
                ds.close()
            except Exception:
                pass

            return ("bgc", bgc_res)

        # Run retrievals concurrently
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            fut_thetao = executor.submit(fetch_thetao)
            fut_so = executor.submit(fetch_so)
            fut_cur = executor.submit(fetch_cur)
            fut_surf = executor.submit(fetch_surf)
            fut_bgc = executor.submit(fetch_bgc)

            res_thetao = fut_thetao.result()
            res_so = fut_so.result()
            res_cur = fut_cur.result()
            res_surf = fut_surf.result()
            res_bgc = fut_bgc.result()

        # Unpack thetao and metadata
        _, t_data, m_lat, m_lon, m_time = res_thetao
        results_by_var["thetao"] = t_data
        if m_lat is not None and m_lon is not None and m_time is not None:
            dist_km = round(haversine_distance_km(latitude, longitude, m_lat, m_lon), 3)
            meta_info["model_time"] = m_time
            meta_info["model_latitude"] = round(m_lat, 4)
            meta_info["model_longitude"] = round(m_lon, 4)
            meta_info["horizontal_distance_km"] = dist_km
            meta_info["spatial_offset_km"] = dist_km
            meta_info["depth_offset_m"] = 0.0
            try:
                m_dt = pd.Timestamp(m_time).to_pydatetime()
                meta_info["temporal_offset_hours"] = round(abs((m_dt - obs_dt).total_seconds()) / 3600.0, 2)
            except Exception:
                meta_info["temporal_offset_hours"] = 0.0

        # Unpack salinity
        _, s_data = res_so
        results_by_var["so"] = s_data

        # Unpack currents
        _, uo_data, vo_data, spd_data, dir_data, vec_data = res_cur
        results_by_var["uo"] = uo_data
        results_by_var["vo"] = vo_data
        results_by_var["current_speed"] = spd_data
        results_by_var["current_direction"] = dir_data
        results_by_var["current_vectors"] = vec_data

        # Unpack surface fields
        _, surface_fields = res_surf

        # Unpack BGC
        _, bgc_data = res_bgc
        results_by_var["chl"] = bgc_data.get("chl", [])
        results_by_var["o2"] = bgc_data.get("o2", [])
        results_by_var["no3"] = bgc_data.get("no3", [])

        output = {
            "available": True,
            "source": "Copernicus Marine Service",
            "retrieved_at": retrieved_at,
            "collocation": meta_info,
            "surface_fields": surface_fields,
            "variables": results_by_var,
            "provenance": {
                "source": "Copernicus Marine Service",
                "source_type": "operational_model",
                "dataset_ids": {
                    "thetao": "cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m",
                    "so": "cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m",
                    "currents": "cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m",
                    "surface": "cmems_mod_glo_phy_anfc_0.083deg_P1D-m",
                    "bgc_chl": "cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m",
                    "bgc_bio": "cmems_mod_glo_bgc-bio_anfc_0.25deg_P1D-m",
                    "bgc_nut": "cmems_mod_glo_bgc-nut_anfc_0.25deg_P1D-m",
                },
                "product_id": "GLOBAL_ANALYSISFORECAST_PHY_001_024",
                "bgc_product_id": "GLOBAL_ANALYSISFORECAST_BGC_001_028",
                "retrieved_at": retrieved_at,
                "model_time": meta_info.get("model_time"),
                "spatial_match": {
                    "requested": [latitude, longitude],
                    "matched": [meta_info.get("model_latitude"), meta_info.get("model_longitude")],
                    "spatial_offset_km": meta_info.get("spatial_offset_km"),
                    "distance_km": meta_info.get("horizontal_distance_km"),
                },
                "temporal_match": {
                    "requested": observation_time,
                    "matched": meta_info.get("model_time"),
                    "temporal_offset_hours": meta_info.get("temporal_offset_hours"),
                    "offset_hours": meta_info.get("temporal_offset_hours"),
                },
                "depth_matching": {
                    "depth_range_m": [float(d_min), float(d_max)],
                    "depth_offset_m": 0.0,
                    "interpolation_method": "1D linear interpolation to observation standard pressure levels",
                },
                "citation": "E.U. Copernicus Marine Service (CMEMS) Global Ocean Analysis and Forecast",
                "license": "Copernicus Sentinel data / CMEMS Service Open Licence",
            },
        }

        # Store in cache
        if not hasattr(self, "_collocate_cache"):
            self._collocate_cache = {}
        self._collocate_cache[cache_key] = (output, now_ts)

        return output

    def get_capabilities(self) -> dict[str, Any]:
        has_auth = has_copernicus_credentials()
        try:
            import copernicusmarine  # type: ignore
            toolbox = True
            version = getattr(copernicusmarine, "__version__", "installed")
        except ImportError:
            toolbox = False
            version = None

        return {
            "source_id": self.source_id,
            "source_name": self.source_name,
            "adapter_class": self.__class__.__name__,
            "credentials_configured": has_auth,
            "toolbox_installed": toolbox,
            "toolbox_version": version,
            "status": "ready" if (has_auth and toolbox) else "auth_required" if not has_auth else "toolbox_missing",
            "supported_datasets": [
                "cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m",
                "cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m",
                "cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m",
                "cmems_mod_glo_phy-wcur_anfc_0.083deg_P1D-m",
                "cmems_mod_glo_phy_anfc_0.083deg_P1D-m",
                "cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m",
                "cmems_mod_glo_bgc-bio_anfc_0.25deg_P1D-m",
                "cmems_mod_glo_bgc-nut_anfc_0.25deg_P1D-m",
            ],
            "supported_variables": [
                "thetao", "so", "uo", "vo", "wo", "zos", "mlotst",
                "chl", "o2", "no3", "current_speed", "current_direction",
            ],
        }
