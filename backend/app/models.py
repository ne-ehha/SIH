"""
Pydantic models for API request/response schemas.
Matches the finalized API contract v2.0.
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


# ── Shared types ─────────────────────────────────────────────────────────────

class Coordinates(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    depth: Optional[float] = Field(None, ge=0, le=500)


class Bounds(BaseModel):
    north: float
    south: float
    east: float
    west: float


OceanVariable = Literal["temperature", "salinity", "currents_u", "currents_v"]
ComparisonVariable = Literal["temperature", "salinity"]


# ── Request models ───────────────────────────────────────────────────────────

class ComparisonRequest(BaseModel):
    location: Coordinates
    variable: ComparisonVariable
    depth: float = Field(..., ge=0, le=500)
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    time: str = Field(..., pattern=r"^\d{2}:\d{2}$")


class ProfileRequest(BaseModel):
    location: Coordinates
    variable: ComparisonVariable
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    time: str = Field(..., pattern=r"^\d{2}:\d{2}$")


class DiscrepancyRequest(BaseModel):
    region: str
    bounds: Bounds
    variable: ComparisonVariable
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    time: str = Field(..., pattern=r"^\d{2}:\d{2}$")


class ObservationRequest(BaseModel):
    region: str
    bounds: Optional[Bounds] = None
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")


class DiagnosticRequest(BaseModel):
    location: Coordinates
    variable: ComparisonVariable
    depth: float = Field(..., ge=0, le=500)
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    time: str = Field(..., pattern=r"^\d{2}:\d{2}$")


class VisualizationRequest(BaseModel):
    location: Coordinates
    variable: OceanVariable
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    time: str = Field(..., pattern=r"^\d{2}:\d{2}$")


class ModelProfileRequest(BaseModel):
    location: Coordinates
    variable: OceanVariable
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    time: str = Field(..., pattern=r"^\d{2}:\d{2}$")


class ModelGridRequest(BaseModel):
    bounds: Bounds
    variable: OceanVariable
    depth: float = Field(..., ge=0, le=500)
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    time: str = Field(..., pattern=r"^\d{2}:\d{2}$")


# ── Response data models ─────────────────────────────────────────────────────

class ModelObservationPoint(BaseModel):
    modelValue: float
    observationValue: float
    difference: float
    unit: str
    variable: str
    depth: float
    confidence: str
    timestamp: str


class ComparisonData(BaseModel):
    point: ModelObservationPoint
    healthScore: int
    healthStatus: str
    healthSummary: str
    sourceModel: str
    sourceObservation: str


class ProfilePoint(BaseModel):
    depth: float
    modelValue: float
    observationValue: Optional[float] = None
    unit: str


class ProfileData(BaseModel):
    points: list[ProfilePoint]
    variable: str
    unit: str
    maxDepth: float
    sourceModel: str
    sourceObservation: Optional[str] = None
    temporalCoverage: Optional[str] = None
    observationNote: Optional[str] = None


class DiscrepancyPoint(BaseModel):
    latitude: float
    longitude: float
    depth: float
    errorMagnitude: float
    variable: str


class DiscrepancyStats(BaseModel):
    meanError: float
    maxError: float
    rmsError: float
    totalPoints: int


class DiscrepancyData(BaseModel):
    points: list[DiscrepancyPoint]
    stats: DiscrepancyStats
    sourceModel: str
    sourceObservation: str
    temporalCoverage: Optional[str] = None


class ObservationStation(BaseModel):
    id: str
    latitude: float
    longitude: float
    timestamp: str
    depth: float
    status: str
    type: str
    temperature: Optional[float] = None
    salinity: Optional[float] = None


class ObservationData(BaseModel):
    stations: list[ObservationStation]
    totalActive: int
    totalPending: int
    region: str
    temporalCoverage: Optional[str] = None
    spatialCoverage: Optional[dict] = None


class DiagnosticCause(BaseModel):
    name: str
    confidence: str
    evidence: list[str]


class DiagnosticData(BaseModel):
    id: str
    errorFingerprint: str
    possibleCauses: list[DiagnosticCause]
    topCause: DiagnosticCause
    status: str
    sourceModel: str
    sourceObservation: str
    caution: str


class WorkflowStep(BaseModel):
    id: str
    title: str
    description: str
    status: str


class SolutionRecommendation(BaseModel):
    id: str
    recommendedTest: str
    expectedOutcome: str
    caution: str
    status: str


class WorkflowData(BaseModel):
    steps: list[WorkflowStep]
    solution: Optional[SolutionRecommendation] = None


class SurfaceGridPoint(BaseModel):
    latitude: float
    longitude: float
    value: Optional[float] = None
    unit: str


class DepthSliceData(BaseModel):
    depth: float
    meanValue: float
    unit: str
    gridPoints: list[SurfaceGridPoint]


class VizProfilePoint(BaseModel):
    depth: float
    modelValue: float
    observationValue: Optional[float] = None
    unit: str


class VisualizationData(BaseModel):
    variable: str
    unit: str
    sourceModel: str
    sourceObservation: Optional[str] = None
    observationNote: Optional[str] = None
    date: str
    time: str
    depthLevels: list[float]
    depthSlices: list[DepthSliceData]
    verticalProfile: list[VizProfilePoint]


class ModelProfileData(BaseModel):
    points: list[VizProfilePoint]
    variable: str
    unit: str
    maxDepth: float
    sourceModel: str
    sourceObservation: Optional[str] = None
    observationNote: Optional[str] = None


class GridInfo(BaseModel):
    latMin: float
    latMax: float
    lonMin: float
    lonMax: float
    latSpacing: float
    lonSpacing: float
    totalPoints: int
    validPoints: int
    landPoints: int


class ModelGridData(BaseModel):
    variable: str
    unit: str
    depth: float
    date: str
    time: str
    sourceModel: str
    gridPoints: list[SurfaceGridPoint]
    gridInfo: GridInfo


# ── Error response ───────────────────────────────────────────────────────────

class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    status: str = "error"
    error: ErrorDetail


# ── Success response ─────────────────────────────────────────────────────────

class ResponseMetadata(BaseModel):
    timestamp: str
    source: str = "api"
    requestId: Optional[str] = None
