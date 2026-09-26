"""
Base source adapter interface for OceanScope.

All source-specific retrieval implementations (Argo, Copernicus, GLORYS, HYCOM,
future BGC/Glider/CTD) inherit from BaseSourceAdapter and implement standard retrieval,
validation, normalization, and provenance extraction.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Optional

from ..models import HistoricalDataRequest, HistoricalResultSummary
from ..registry import DatasetDefinition, VariableDefinition, resolve_canonical_variable


class RetrievalError(Exception):
    """Structured, source-traceable retrieval or validation error."""

    def __init__(self, code: str, message: str, details: Optional[dict[str, Any]] = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or {}


def utc_now_iso() -> str:
    """Current UTC timestamp with explicit 'Z' timezone."""
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class BaseSourceAdapter(ABC):
    """Abstract base class for scientific ocean data retrieval adapters."""

    def __init__(self, source_id: str, source_name: str):
        self.source_id = source_id
        self.source_name = source_name

    @abstractmethod
    def retrieve(
        self,
        query: HistoricalDataRequest,
        dataset_def: DatasetDefinition,
        var_def: Optional[VariableDefinition],
    ) -> tuple[list[Any], HistoricalResultSummary, dict[str, Any]]:
        """
        Execute retrieval for a dataset and variable.
        Returns:
            (normalized_records, result_summary, provenance_dict)
        """
        pass

    def get_capabilities(self) -> dict[str, Any]:
        """Return adapter capability and authentication status metadata."""
        return {
            "source_id": self.source_id,
            "source_name": self.source_name,
            "adapter_class": self.__class__.__name__,
            "status": "active",
        }
