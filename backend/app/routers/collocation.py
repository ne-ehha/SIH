"""
Authoritative Scientific Collocation Router (Phase 14).
Provides endpoints for rigorous observation-to-model/reference collocation evaluation.
"""

from fastapi import APIRouter
from ..models import (
    ScientificCollocationEvaluationRequest,
    ScientificCollocationEvaluationResponse,
    CompatibilityCheckRequest,
    CompatibilityCheckResponse,
)
from ..compatibility_engine import (
    CompatibilityEngine,
    evaluate_scientific_collocation,
)

router = APIRouter()


@router.post("/evaluate", response_model=ScientificCollocationEvaluationResponse)
def evaluate_collocation_endpoint(req: ScientificCollocationEvaluationRequest):
    """
    Execute authoritative multi-platform scientific collocation evaluation.
    Verifies spatial, temporal, depth overlap, physical variable, and QC compatibility.
    """
    return evaluate_scientific_collocation(req)


@router.post("/compatibility", response_model=CompatibilityCheckResponse)
def evaluate_compatibility_endpoint(req: CompatibilityCheckRequest):
    """
    Evaluate multi-parameter compatibility rules between observation and model datasets.
    """
    return CompatibilityEngine.evaluate_compatibility(req)
