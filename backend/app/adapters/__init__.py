"""Source adapters module for OceanScope scientific data retrieval."""

from .base import BaseSourceAdapter, RetrievalError, utc_now_iso
from .argo_adapter import ArgoAdapter
from .copernicus_adapter import CopernicusAdapter
from .glorys_adapter import GLORYSAdapter
from .hycom_adapter import HYCOMAdapter
from .observation_adapters import GliderAdapter, CTDAdapter, BGCAdapter

__all__ = [
    "BaseSourceAdapter",
    "RetrievalError",
    "utc_now_iso",
    "ArgoAdapter",
    "CopernicusAdapter",
    "GLORYSAdapter",
    "HYCOMAdapter",
    "GliderAdapter",
    "CTDAdapter",
    "BGCAdapter",
]
