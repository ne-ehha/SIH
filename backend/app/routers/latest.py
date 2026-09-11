"""User-triggered latest available Argo/Copernicus research-data endpoint."""

from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..latest_data import LatestDataError, fetch_latest_available, latest_data_service

router = APIRouter()


class LatestAvailableRequest(BaseModel):
    region: str = Field(default="bay-of-bengal")
    max_age_days: int = Field(default=30, ge=1, le=90)
    force_refresh: bool = False


@router.post("/research/latest")
def latest_available(request: LatestAvailableRequest):
    try:
        data = fetch_latest_available(request.region, request.max_age_days, request.force_refresh)
    except LatestDataError as exc:
        return {
            "status": "error",
            "error": {"code": exc.code, "message": exc.message},
            "metadata": {"timestamp": datetime.now(timezone.utc).isoformat(), "source": "api"},
        }
    return {
        "status": "success",
        "data": data,
        # Stream fields are exposed at the response boundary as well as under
        # data for clients that only need state/records, while preserving the
        # original data envelope used by the existing workstation.
        "stream": data["stream"],
        "observations": data["observations"],
        "provenance": data["provenance"],
        "metadata": {"timestamp": datetime.now(timezone.utc).isoformat(), "source": "api"},
    }


@router.get("/research/latest/status")
def latest_stream_status(region: str = "bay-of-bengal", max_age_days: int = 30):
    """Read cached stream state only; this endpoint never contacts GDAC."""
    return {"status": "success", "stream": latest_data_service.get_stream_status(region, max_age_days)}
