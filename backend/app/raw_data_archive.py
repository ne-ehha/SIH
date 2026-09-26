"""
Raw Scientific Data Archival Service for OceanScope.

Provides structured local archival of retrieved raw / subset NetCDF files,
API responses, metadata, and retrieval manifests under:
backend/data/raw/<provider>/<dataset>/<date>/
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

def _find_raw_archive_dir() -> Path:
    candidates = [
        Path(__file__).resolve().parent.parent / "data" / "raw",
        PROJECT_ROOT / "backend" / "data" / "raw",
        PROJECT_ROOT / "data" / "raw",
        Path.cwd() / "backend" / "data" / "raw",
        Path.cwd() / "data" / "raw",
    ]
    for c in candidates:
        if c.exists():
            return c
    return candidates[0]

RAW_ARCHIVE_DIR = _find_raw_archive_dir()


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class RawDataArchiveService:
    """Manages raw dataset and metadata archival for provenance audits."""

    def __init__(self, base_dir: Optional[Path] = None):
        self.base_dir = base_dir or RAW_ARCHIVE_DIR

    def archive_retrieval(
        self,
        provider: str,
        dataset_id: str,
        date_str: str,
        raw_bytes: Optional[bytes] = None,
        file_extension: str = ".nc",
        metadata: Optional[dict[str, Any]] = None,
        provenance: Optional[dict[str, Any]] = None,
    ) -> dict[str, str]:
        """
        Store exact raw payload, metadata, provenance, and manifest.
        Returns paths of created archive files.
        """
        safe_provider = provider.lower().replace(" ", "_").replace("/", "_")
        safe_dataset = dataset_id.replace(" ", "_").replace("/", "_")
        target_dir = self.base_dir / safe_provider / safe_dataset / date_str
        target_dir.mkdir(parents=True, exist_ok=True)

        now_ts = utc_now_iso()
        timestamp_prefix = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        created_files: dict[str, str] = {}

        # 1. Raw file archive (if bytes provided)
        if raw_bytes:
            raw_filename = f"raw_{timestamp_prefix}{file_extension}"
            raw_path = target_dir / raw_filename
            with open(raw_path, "wb") as fh:
                fh.write(raw_bytes)
            created_files["raw_file"] = str(raw_path)

        # 2. Metadata JSON
        if metadata:
            meta_filename = f"metadata_{timestamp_prefix}.json"
            meta_path = target_dir / meta_filename
            with open(meta_path, "w", encoding="utf-8") as fh:
                json.dump(metadata, fh, indent=2, default=str)
            created_files["metadata_file"] = str(meta_path)

        # 3. Provenance JSON
        if provenance:
            prov_filename = f"provenance_{timestamp_prefix}.json"
            prov_path = target_dir / prov_filename
            with open(prov_path, "w", encoding="utf-8") as fh:
                json.dump(provenance, fh, indent=2, default=str)
            created_files["provenance_file"] = str(prov_path)

        # 4. Manifest
        manifest = {
            "archive_timestamp": now_ts,
            "provider": provider,
            "dataset_id": dataset_id,
            "date": date_str,
            "files": created_files,
            "status": "archived",
        }
        manifest_path = target_dir / f"manifest_{timestamp_prefix}.json"
        with open(manifest_path, "w", encoding="utf-8") as fh:
            json.dump(manifest, fh, indent=2, default=str)
        created_files["manifest_file"] = str(manifest_path)

        return created_files

    def list_archived_datasets(self) -> list[dict[str, Any]]:
        """List all archived providers and datasets."""
        if not self.base_dir.exists():
            return []
        results = []
        for provider_dir in self.base_dir.iterdir():
            if provider_dir.is_dir():
                for dataset_dir in provider_dir.iterdir():
                    if dataset_dir.is_dir():
                        dates = [d.name for d in dataset_dir.iterdir() if d.is_dir()]
                        results.append({
                            "provider": provider_dir.name,
                            "dataset_id": dataset_dir.name,
                            "archived_dates": dates,
                        })
        return results


# Singleton instance
raw_data_archive = RawDataArchiveService()
