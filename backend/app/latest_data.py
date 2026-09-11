"""Official, on-demand latest-data ingestion for the OceanScope research mode.

This module deliberately has no fallback to the Jan. 2024 benchmark.  The
benchmark remains a separate, reproducible GLORYS12V1 × Argo-DM workflow.
"""

from __future__ import annotations

import csv
import gzip
import io
import os
import tempfile
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Any

import numpy as np
import requests
from netCDF4 import Dataset as NetCDFDataset, chartostring, num2date


ARGO_GDAC_BASE_URL = "https://data-argo.ifremer.fr"
ARGO_INDEX_URL = f"{ARGO_GDAC_BASE_URL}/argo_synthetic-profile_index.txt.gz"
COPERNICUS_PRODUCT_ID = "GLOBAL_ANALYSISFORECAST_PHY_001_024"
COPERNICUS_TEMPERATURE_DATASET = "cmems_mod_glo_phy-theto_anfc_0.083deg_P1D-m"
COPERNICUS_SALINITY_DATASET = "cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m"

# This is intentionally independent from the benchmark's sparse collocation
# coverage.  It is the configured research-region selection for current data.
REGIONS = {
    "bay-of-bengal": {"south": 5.0, "north": 22.0, "west": 80.0, "east": 95.0},
}

def _refresh_interval() -> timedelta:
    """Configured, bounded upstream polling interval (five minutes by default)."""
    try:
        seconds = int(os.environ.get("LATEST_DATA_REFRESH_SECONDS", "300"))
    except ValueError:
        seconds = 300
    return timedelta(seconds=max(60, seconds))


def _maximum_profiles() -> int:
    """Bound per-refresh GDAC profile downloads without inventing a subset."""
    try:
        return max(1, min(int(os.environ.get("LATEST_DATA_MAX_PROFILES", "24")), 50))
    except ValueError:
        return 24


_cache: dict[str, dict[str, Any]] = {}
_cache_lock = Lock()


class LatestDataError(Exception):
    """An expected, honest upstream or validation failure."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True)
class IndexProfile:
    path: str
    observed_at: datetime
    latitude: float
    longitude: float
    parameter_modes: str
    updated_at: str


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _netcdf_datetime(value: Any) -> datetime:
    """Convert datetime or cftime values while retaining their source time."""
    return datetime(
        value.year, value.month, value.day, value.hour, value.minute, value.second,
        getattr(value, "microsecond", 0), tzinfo=timezone.utc,
    )


def _text(value: Any) -> str:
    """Decode Argo NetCDF char/string scalars without guessing their values."""
    if isinstance(value, bytes):
        return value.decode("ascii", "ignore").strip().replace("\x00", "")
    if isinstance(value, str):
        return value.strip().replace("\x00", "")
    array = np.asarray(value)
    if array.ndim == 0:
        return _text(array.item())
    parts = [_text(item) for item in array.ravel()]
    return "".join(parts).strip().replace("\x00", "")


def _qc_is_accepted(value: Any) -> bool:
    # Argo QF 1 = good, 2 = probably good.  We do not convert 3/4/5/8/9
    # to usable values, and do not infer quality from a greylist.
    return _text(value) in {"1", "2"}


def _finite(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if np.isfinite(number) and abs(number) < 1e30 else None


def _index_profiles(region: str, max_age_days: int) -> list[IndexProfile]:
    bounds = REGIONS.get(region)
    if not bounds:
        raise LatestDataError("UNSUPPORTED_REGION", "Latest Available currently supports the configured Bay of Bengal research region.")

    url = os.environ.get("ARGO_GDAC_INDEX_URL", ARGO_INDEX_URL)
    try:
        response = requests.get(
            url,
            stream=True,
            timeout=(10, 55),
            headers={"User-Agent": "OceanScope/1.0 official-data-ingestion"},
        )
        response.raise_for_status()
    except requests.Timeout as exc:
        raise LatestDataError("UPSTREAM_TIMEOUT", "Argo GDAC index request timed out.") from exc
    except requests.RequestException as exc:
        raise LatestDataError("ARGO_UNAVAILABLE", "Argo GDAC index could not be reached.") from exc

    cutoff = _now().replace(tzinfo=None) - timedelta(days=max_age_days)
    candidates: list[IndexProfile] = []
    try:
        response.raw.decode_content = False
        with gzip.GzipFile(fileobj=response.raw, mode="rb") as compressed:
            text = io.TextIOWrapper(compressed, encoding="utf-8")
            reader = csv.DictReader(line for line in text if not line.startswith("#"))
            for row in reader:
                try:
                    observed_at = datetime.strptime(row["date"], "%Y%m%d%H%M%S")
                    latitude = float(row["latitude"])
                    longitude = float(row["longitude"])
                except (KeyError, TypeError, ValueError):
                    continue
                parameters = row.get("parameters", "")
                if (
                    observed_at >= cutoff
                    and bounds["south"] <= latitude <= bounds["north"]
                    and bounds["west"] <= longitude <= bounds["east"]
                    and all(parameter in parameters for parameter in ("PRES", "TEMP", "PSAL"))
                ):
                    candidates.append(
                        IndexProfile(
                            path=row["file"],
                            observed_at=observed_at.replace(tzinfo=timezone.utc),
                            latitude=latitude,
                            longitude=longitude,
                            parameter_modes=row.get("parameter_data_mode", ""),
                            updated_at=row.get("date_update", ""),
                        )
                    )
    except (OSError, csv.Error) as exc:
        raise LatestDataError("INVALID_UPSTREAM_RESPONSE", "Argo GDAC returned an unreadable profile index.") from exc
    finally:
        response.close()

    return sorted(candidates, key=lambda item: item.observed_at, reverse=True)


def _profile_url(index_profile: IndexProfile) -> str:
    # Index entries are relative to the GDAC dac directory, e.g.
    # aoml/1902367/profiles/SR1902367_058.nc.
    return f"{os.environ.get('ARGO_GDAC_BASE_URL', ARGO_GDAC_BASE_URL).rstrip('/')}/dac/{index_profile.path.lstrip('/')}"


def _parameter_modes(raw: NetCDFDataset, profile_index: int) -> dict[str, str]:
    """Read DATA_MODE for core profiles or PARAMETER_DATA_MODE for BGC files."""
    # Use netCDF4 here because it preserves the V3 character-array dimensions
    # (xarray's decoded object-array representation differs by backend).
    if "DATA_MODE" in raw.variables:
        mode = _text(raw.variables["DATA_MODE"][profile_index]).upper()
        return {name: mode for name in ("PRES", "TEMP", "PSAL")}
    if "PARAMETER_DATA_MODE" not in raw.variables:
        return {}
    parameter_name = "PARAMETER" if "PARAMETER" in raw.variables else "STATION_PARAMETERS"
    if parameter_name not in raw.variables:
        return {}
    # V3 BGC files may include an extra calibration dimension, so flatten
    # only the parameter-name/mode vectors after selecting the profile.
    parameters = np.asarray(chartostring(raw.variables[parameter_name][:])[profile_index]).ravel()
    modes = np.asarray(raw.variables["PARAMETER_DATA_MODE"][:][profile_index]).ravel()
    return {
        _text(parameter).upper(): _text(mode).upper()
        for parameter, mode in zip(parameters, modes)
        if _text(parameter)
    }


def _values_for_parameter(dataset: NetCDFDataset, profile_index: int, parameter: str, mode: str) -> tuple[np.ndarray, np.ndarray, str]:
    """Choose adjusted fields only when their mode and QC make them valid."""
    raw_values = np.asarray(dataset.variables[parameter][profile_index])
    raw_qc = np.asarray(dataset.variables[f"{parameter}_QC"][profile_index]) if f"{parameter}_QC" in dataset.variables else np.array([""])
    adjusted_name = f"{parameter}_ADJUSTED"
    adjusted_qc_name = f"{parameter}_ADJUSTED_QC"
    if mode in {"A", "D"} and adjusted_name in dataset.variables and adjusted_qc_name in dataset.variables:
        adjusted_values = np.asarray(dataset.variables[adjusted_name][profile_index])
        adjusted_qc = np.asarray(dataset.variables[adjusted_qc_name][profile_index])
        if any(_finite(value) is not None and _qc_is_accepted(qc) for value, qc in zip(adjusted_values, adjusted_qc)):
            return adjusted_values, adjusted_qc, "adjusted"
    return raw_values, raw_qc, "raw"


def _normalize_profile(index_profile: IndexProfile, retrieved_at: datetime) -> dict[str, Any]:
    url = _profile_url(index_profile)
    try:
        response = requests.get(url, timeout=(10, 55), headers={"User-Agent": "OceanScope/1.0 official-data-ingestion"})
        response.raise_for_status()
    except requests.Timeout as exc:
        raise LatestDataError("UPSTREAM_TIMEOUT", "Argo GDAC profile request timed out.") from exc
    except requests.RequestException as exc:
        raise LatestDataError("ARGO_UNAVAILABLE", "Argo GDAC profile could not be retrieved.") from exc

    temporary_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".nc", delete=False) as temporary:
            temporary.write(response.content)
            temporary_path = temporary.name
        with NetCDFDataset(temporary_path) as dataset:
            profile_count = len(dataset.dimensions.get("N_PROF", [0])) or 1
            # The downloaded item normally has one profile.  If it has more,
            # choose the one nearest the index record time, not a fabricated one.
            if "JULD" in dataset.variables and profile_count > 1:
                time_values = np.asarray(dataset.variables["JULD"][:], dtype=float)
                target = index_profile.observed_at.replace(tzinfo=None)
                decoded = num2date(time_values, dataset.variables["JULD"].units, getattr(dataset.variables["JULD"], "calendar", "standard"))
                profile_index = int(np.argmin([abs((_netcdf_datetime(value).replace(tzinfo=None) - target).total_seconds()) for value in decoded]))
            else:
                profile_index = 0

            modes = _parameter_modes(dataset, profile_index)
            if not modes:
                # Core-file mode is also present in the index.  It is used only
                # as a mode indicator; all value-level QC still comes from file.
                modes = {name: index_profile.parameter_modes[:1].upper() for name in ("PRES", "TEMP", "PSAL")}
            pressure, pressure_qc, pressure_source = _values_for_parameter(dataset, profile_index, "PRES", modes.get("PRES", "R"))
            temperature, temperature_qc, temperature_source = _values_for_parameter(dataset, profile_index, "TEMP", modes.get("TEMP", "R"))
            salinity, salinity_qc, salinity_source = _values_for_parameter(dataset, profile_index, "PSAL", modes.get("PSAL", "R"))

            records: list[dict[str, Any]] = []
            rejected = 0
            for values in zip(pressure, pressure_qc, temperature, temperature_qc, salinity, salinity_qc):
                pres, pres_qc, temp, temp_qc, psal, psal_qc = values
                pressure_value, temperature_value, salinity_value = _finite(pres), _finite(temp), _finite(psal)
                if (
                    pressure_value is None
                    or temperature_value is None
                    or salinity_value is None
                    or not 0 <= pressure_value <= 500
                    or not all(_qc_is_accepted(qc) for qc in (pres_qc, temp_qc, psal_qc))
                ):
                    rejected += 1
                    continue
                records.append({
                    "pressure": round(pressure_value, 3),
                    "temperature": round(temperature_value, 5),
                    "salinity": round(salinity_value, 5),
                    "pressure_qc": _text(pres_qc),
                    "temperature_qc": _text(temp_qc),
                    "salinity_qc": _text(psal_qc),
                })

            if not records:
                raise LatestDataError("QC_REJECTED_PROFILE", "The latest Argo profile has no TEMP/PSAL/PRES levels passing QC 1 or 2 in 0–500 dbar.")

            if "JULD" in dataset.variables:
                juld = dataset.variables["JULD"]
                observed_value = num2date(juld[profile_index], juld.units, getattr(juld, "calendar", "standard"))
                observed_at = _iso(_netcdf_datetime(observed_value))
            else:
                observed_at = _iso(index_profile.observed_at)
            latitude = _finite(dataset.variables["LATITUDE"][profile_index]) if "LATITUDE" in dataset.variables else index_profile.latitude
            longitude = _finite(dataset.variables["LONGITUDE"][profile_index]) if "LONGITUDE" in dataset.variables else index_profile.longitude
            platform = _text(dataset.variables["PLATFORM_NUMBER"][profile_index]) if "PLATFORM_NUMBER" in dataset.variables else ""
            cycle = _finite(dataset.variables["CYCLE_NUMBER"][profile_index]) if "CYCLE_NUMBER" in dataset.variables else None

            return {
                "available": True,
                "profile_id": index_profile.path.rsplit("/", 1)[-1].removesuffix(".nc"),
                "platform_id": platform,
                "cycle_number": int(cycle) if cycle is not None and cycle.is_integer() else cycle,
                "latitude": latitude,
                "longitude": longitude,
                "observation_time": observed_at,
                "data_mode": {name.lower(): modes.get(name, "unknown") for name in ("PRES", "TEMP", "PSAL")},
                "value_source": {"pressure": pressure_source, "temperature": temperature_source, "salinity": salinity_source},
                "levels": records,
                "qc": {
                    "accepted_flags": ["1", "2"],
                    "accepted_levels": len(records),
                    "rejected_levels": rejected,
                    "state": "per-level PRES/TEMP/PSAL QC applied",
                },
                "provenance": {
                    "source": "Argo GDAC",
                    "source_type": "observation",
                    "mode": "real-time or adjusted per parameter DATA_MODE",
                    "profile_url": url,
                    "index_url": os.environ.get("ARGO_GDAC_INDEX_URL", ARGO_INDEX_URL),
                    "index_updated_at": index_profile.updated_at or None,
                    "retrieved_at": _iso(retrieved_at),
                    "observation_time": observed_at,
                    "latitude": latitude,
                    "longitude": longitude,
                    "depth_range": [0, 500],
                    "variables": ["PRES", "TEMP", "PSAL"],
                },
            }
    except LatestDataError:
        raise
    except Exception as exc:
        raise LatestDataError("INVALID_UPSTREAM_RESPONSE", "Argo GDAC profile could not be parsed as a valid NetCDF profile.") from exc
    finally:
        response.close()
        if temporary_path:
            try:
                os.unlink(temporary_path)
            except OSError:
                pass


def _copernicus_status(retrieved_at: datetime) -> dict[str, Any]:
    """Report operational-model readiness without ever inventing model data."""
    username = os.environ.get("COPERNICUSMARINE_SERVICE_USERNAME")
    password = os.environ.get("COPERNICUSMARINE_SERVICE_PASSWORD")
    try:
        import copernicusmarine  # type: ignore # Installed only in configured deployments.
        toolbox_installed = bool(copernicusmarine)
    except ImportError:
        toolbox_installed = False

    reason = None
    if not username or not password:
        reason = "Model credentials unavailable. Set server-only COPERNICUSMARINE_SERVICE_USERNAME and COPERNICUSMARINE_SERVICE_PASSWORD."
    elif not toolbox_installed:
        reason = "The official Copernicus Marine Toolbox is not installed on this backend."
    else:
        reason = "Operational subset retrieval is not enabled until the deployment validates its Copernicus credentials."
    return {
        "available": False,
        "reason": reason,
        "provenance": {
            "source": "Copernicus Marine",
            "source_type": "operational_model",
            "product_id": COPERNICUS_PRODUCT_ID,
            "datasets": {
                "temperature": COPERNICUS_TEMPERATURE_DATASET,
                "salinity": COPERNICUS_SALINITY_DATASET,
            },
            "depth_range": [0, 500],
            "retrieved_at": _iso(retrieved_at),
        },
    }


class LatestDataService:
    """Single source of truth for latest-available official data.

    It deliberately owns caching and refresh serialization so all UI consumers
    see the same normalized Argo records and a manual refresh cannot fan out
    into concurrent GDAC scans.  It is an observation-source boundary; a real
    model source can be added beside Argo later without changing this contract.
    """

    def fetch_latest(self, region: str = "bay-of-bengal", max_age_days: int = 30) -> dict[str, Any]:
        return self.refresh_latest(region, max_age_days, force=False)

    def get_cached_latest(self, region: str = "bay-of-bengal", max_age_days: int = 30) -> dict[str, Any] | None:
        with _cache_lock:
            cached = _cache.get(f"{region}:{max_age_days}")
            return cached["result"] if cached else None

    def get_stream_status(self, region: str = "bay-of-bengal", max_age_days: int = 30) -> dict[str, Any]:
        cached = self.get_cached_latest(region, max_age_days)
        if cached:
            return cached["stream"]
        return {"state": "waiting", "source": "Argo GDAC", "last_checked_at": None,
                "latest_observation_at": None, "next_refresh_at": None, "new_records": 0}

    def refresh_latest(self, region: str = "bay-of-bengal", max_age_days: int = 30, force: bool = False) -> dict[str, Any]:
        max_age_days = max(1, min(max_age_days, 90))
        cache_key = f"{region}:{max_age_days}"
        interval = _refresh_interval()
        # Keep this lock across the check/fetch cycle: GDAC scans are expensive
        # and a second frontend consumer must reuse the same in-flight result.
        with _cache_lock:
            now = _now()
            cached = _cache.get(cache_key)
            if not force and cached and now - cached["checked_at"] < interval:
                result = cached["result"]
                result["cache"] = {"hit": True, "cached_at": _iso(cached["checked_at"]), "ttl_seconds": int(interval.total_seconds())}
                return result

            previous_ids = set(cached["profile_ids"]) if cached else set()
            profiles = _index_profiles(region, max_age_days)
            if not profiles:
                raise LatestDataError("NO_RECENT_ARGO_PROFILE", f"No Argo GDAC profile with PRES/TEMP/PSAL was found in the configured region during the last {max_age_days} days.")

            observations: list[dict[str, Any]] = []
            # Every candidate remains an official record.  Invalid/QC-rejected
            # profiles are excluded rather than repaired or replaced.
            for candidate in profiles[:_maximum_profiles()]:
                try:
                    observations.append(_normalize_profile(candidate, now))
                except LatestDataError:
                    continue
            if not observations:
                raise LatestDataError("QC_REJECTED_PROFILE", "No qualifying Argo GDAC profile contained TEMP/PSAL/PRES levels passing QC 1 or 2 in 0–500 dbar.")

            observations.sort(key=lambda item: item["observation_time"], reverse=True)
            profile_ids = {item["profile_id"] for item in observations}
            newest = observations[0]
            result = {
                "mode": "latest_available",
                "region": region,
                "retrieved_at": _iso(now),
                "stream": {
                    "state": "connected",
                    "source": "Argo GDAC",
                    "last_checked_at": _iso(now),
                    "latest_observation_at": newest["observation_time"],
                    "next_refresh_at": _iso(now + interval),
                    "new_records": len(profile_ids - previous_ids) if cached else len(profile_ids),
                    "refresh_interval_seconds": int(interval.total_seconds()),
                },
                "observations": observations,
                # Compatibility aliases retain the first verified profile for
                # current callers while new consumers use observations[].
                "argo": newest,
                "copernicus": _copernicus_status(now),
                "provenance": {"source": "Argo GDAC", "region": region, "variables": ["TEMP", "PSAL"], "depth_range": [0, 500]},
                "cache": {"hit": False, "cached_at": _iso(now), "ttl_seconds": int(interval.total_seconds())},
            }
            _cache[cache_key] = {"checked_at": now, "profile_ids": profile_ids, "result": result}
            return result


latest_data_service = LatestDataService()


def fetch_latest_available(region: str = "bay-of-bengal", max_age_days: int = 30, force_refresh: bool = False) -> dict[str, Any]:
    """Backward-compatible entry point for the reusable latest-data service."""
    return latest_data_service.refresh_latest(region, max_age_days, force_refresh)
