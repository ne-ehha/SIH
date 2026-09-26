"""
Pydantic models for API request/response schemas.
Matches the finalized API contract v2.0.
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal, Any
from datetime import datetime, timezone


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


OceanVariable = Literal[
    "temperature",
    "salinity",
    "currents",
    "currents_u",
    "currents_v",
    "thetao",
    "so",
    "uo",
    "vo",
    "wo",
    "zos",
    "mlotst",
    "current_speed",
    "current_direction",
    "chlorophyll",
    "chl",
    "dissolved_oxygen",
    "o2",
    "nitrate",
    "no3",
]
ComparisonVariable = Literal["temperature", "salinity", "thetao", "so", "currents", "chl", "chlorophyll", "o2", "no3"]

CanonicalDataMode = Literal["LIVE_NRT", "HISTORICAL_RESEARCH"]
ObservationPlatformType = Literal["ARGO", "GLIDER", "CTD", "BGC"]
VerticalCoverageType = Literal["depth_resolved", "surface_only"]

CompatibilityState = Literal[
    "VALID",
    "MODEL_COMPARISON_AVAILABLE",
    "OBSERVATION_AVAILABLE_MODEL_UNAVAILABLE",
    "MODEL_AVAILABLE_OBSERVATION_UNAVAILABLE",
    "INCOMPATIBLE_VARIABLE",
    "INCOMPATIBLE_UNITS",
    "INCOMPATIBLE_DATA",
    "INVALID_QC",
    "QC_REJECTED",
    "OUTSIDE_MODEL_DOMAIN",
    "TEMPORAL_MISMATCH",
    "SPATIAL_MISMATCH",
    "DEPTH_MISMATCH",
    "NO_MODEL_DATA",
    "NO_OBSERVATION",
    "OUT_OF_BOUNDS",
    "NO_COMPATIBLE_REFERENCE",
]


# ── Request models ───────────────────────────────────────────────────────────

class ComparisonRequest(BaseModel):
    location: Coordinates
    variable: OceanVariable
    depth: float = Field(..., ge=0, le=500)
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    time: str = Field(..., pattern=r"^\d{2}:\d{2}$")


class ProfileRequest(BaseModel):
    location: Coordinates
    variable: OceanVariable
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    time: str = Field(..., pattern=r"^\d{2}:\d{2}$")


class DiscrepancyRequest(BaseModel):
    region: str
    bounds: Bounds
    variable: OceanVariable
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    time: str = Field(..., pattern=r"^\d{2}:\d{2}$")


class ObservationRequest(BaseModel):
    region: str
    bounds: Optional[Bounds] = None
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")


class DiagnosticRequest(BaseModel):
    location: Coordinates
    variable: OceanVariable
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


# ── Unified Ocean Data Contract (Phase 3) ───────────────────────────────────

class NormalizedDataRecord(BaseModel):
    """
    Unified scientific ocean data record representing observations, model output,
    or reanalysis collocations in a normalized, source-traceable format.
    """
    source: str
    source_name: str
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    dataset_id: str
    dataset_name: str
    variable: str
    variable_name: str
    units: str
    data_mode: Optional[CanonicalDataMode] = None
    platform_type: Optional[ObservationPlatformType] = None
    vertical_coverage_type: Optional[VerticalCoverageType] = None
    observed_at: Optional[str] = None
    model_valid_at: Optional[str] = None
    retrieved_at: str
    latitude: float
    longitude: float
    depth: Optional[float] = None
    pressure: Optional[float] = None
    value: Optional[float] = None
    model_value: Optional[float] = None
    observation_value: Optional[float] = None
    difference: Optional[float] = None
    qc_status: Optional[Any] = None
    provenance: dict[str, Any] = Field(default_factory=dict)
    temporal_resolution: Optional[str] = None
    spatial_resolution: Optional[str] = None
    vertical_resolution: Optional[str] = None
    processing_level: Optional[str] = None
    availability_status: str = "available"


class UnifiedProfileLevel(BaseModel):
    """Individual depth/pressure level within a vertical profile."""
    depth: Optional[float] = None
    pressure: Optional[float] = None
    temperature: Optional[float] = None
    salinity: Optional[float] = None
    value: Optional[float] = None
    pressure_qc: Optional[str] = None
    temperature_qc: Optional[str] = None
    salinity_qc: Optional[str] = None
    qc_flag: Optional[str] = None
    qc_accepted: Optional[bool] = None


class UnifiedProfileRecord(BaseModel):
    """Normalized vertical ocean profile record (e.g., in-situ Argo CTD, Glider, BGC)."""
    available: bool = True
    profile_id: str
    platform_id: Optional[str] = None
    platform_type: Optional[ObservationPlatformType] = "ARGO"
    cycle_number: Optional[int] = None
    latitude: float
    longitude: float
    observed_at: str
    retrieved_at: str
    data_mode: Optional[Any] = None
    value_source: Optional[dict[str, str]] = None
    levels: list[UnifiedProfileLevel]
    qc: Optional[dict[str, Any]] = None
    provenance: dict[str, Any]


# ── Phase 10A Canonical Observation Contract ─────────────────────────────────

CanonicalQCStatus = Literal["GOOD", "PROBABLY_GOOD", "BAD", "UNKNOWN"]
ObservationDiscoveryStatus = Literal[
    "OBSERVATION_AVAILABLE",
    "OBSERVATION_UNAVAILABLE",
    "AUTHENTICATION_REQUIRED",
    "SOURCE_UNAVAILABLE",
    "UPSTREAM_ERROR",
    "INVALID_QUERY",
    "INVALID_QC",
    "OUTSIDE_SEARCH_RADIUS",
    "TEMPORAL_MISMATCH",
]


class CanonicalObservationPoint(BaseModel):
    """
    Standardized, source-traceable individual ocean observation data point.
    Preserves raw vs adjusted parameters, authentic QC flags, and depth normalization.
    """
    observation_id: str
    platform_type: ObservationPlatformType
    platform_id: str
    cycle_number: Optional[int] = None
    data_mode: CanonicalDataMode
    observation_timestamp: str
    latitude: float
    longitude: float
    depth: float = Field(..., description="Depth in meters, normalized from pressure")
    original_depth: Optional[float] = None
    pressure: Optional[float] = Field(None, description="Hydrostatic pressure in dbar")
    variable: str
    canonical_variable: str
    value: Optional[float] = None
    unit: str
    qc_flag: str
    qc_status: CanonicalQCStatus
    qc_accepted: bool
    source: str
    source_dataset: str
    processing_level: str = "raw"  # raw, adjusted, delayed_mode
    parameter_code: str
    sensor_available: bool = True
    is_adjusted: bool = False
    observation_age_hours: Optional[float] = None
    dac: Optional[str] = None
    profile_direction: Optional[str] = "A"  # A = Ascending, D = Descending
    institution: Optional[str] = None
    deployment_id: Optional[str] = None
    file_reference: Optional[str] = None
    source_url: Optional[str] = None


class CanonicalProfileObservation(BaseModel):
    """
    Complete canonical ocean profile containing all measured parameters,
    QC summaries, and dynamic variable discovery.
    """
    profile_id: str
    platform_type: ObservationPlatformType
    platform_id: str
    cycle_number: Optional[int] = None
    data_mode: CanonicalDataMode
    observation_timestamp: str
    latitude: float
    longitude: float
    available_variables: list[str] = Field(default_factory=list)
    levels: list[dict[str, Any]] = Field(default_factory=list)
    observations_by_variable: dict[str, list[CanonicalObservationPoint]] = Field(default_factory=dict)
    qc_summary: dict[str, Any] = Field(default_factory=dict)
    provenance: dict[str, Any] = Field(default_factory=dict)
    dac: Optional[str] = None
    institution: Optional[str] = None
    file_reference: Optional[str] = None
    source_url: Optional[str] = None


class ObservationDiscoveryQuery(BaseModel):
    """Query parameters for real in-situ observation discovery."""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    start_datetime: Optional[str] = None
    end_datetime: Optional[str] = None
    target_datetime: Optional[str] = None
    platform: Optional[ObservationPlatformType] = None
    variable: Optional[str] = None
    radius_km: float = Field(default=300.0, ge=1.0, le=2000.0)
    max_temporal_hours: float = Field(default=720.0, ge=1.0, le=8760.0)
    profile_id: Optional[str] = None
    data_mode: Optional[CanonicalDataMode] = None


class ObservationDiscoveryResponse(BaseModel):
    """Authoritative response structure for observation discovery."""
    status: ObservationDiscoveryStatus
    query: ObservationDiscoveryQuery
    selected_profile: Optional[CanonicalProfileObservation] = None
    available_variables: list[str] = Field(default_factory=list)
    observations: list[CanonicalObservationPoint] = Field(default_factory=list)
    candidate_profiles_count: int = 0
    matching: Optional[dict[str, Any]] = None
    provenance: dict[str, Any] = Field(default_factory=dict)
    metadata: ResponseMetadata


# ── Phase 5 Compatibility Engine Models ─────────────────────────────────────

class CompatibilityCheckRequest(BaseModel):
    observation_source: str
    observation_platform: ObservationPlatformType
    observation_variable: str
    observation_time: str
    observation_latitude: float = Field(..., ge=-90, le=90)
    observation_longitude: float = Field(..., ge=-180, le=180)
    observation_depth: Optional[float] = Field(None, ge=0, le=6000)
    observation_qc_accepted: bool = True
    model_source: str
    model_dataset_id: str
    model_variable: str
    model_time: Optional[str] = None
    model_latitude: Optional[float] = Field(None, ge=-90, le=90)
    model_longitude: Optional[float] = Field(None, ge=-180, le=180)
    model_depth: Optional[float] = Field(None, ge=0, le=6000)
    data_mode: CanonicalDataMode = "HISTORICAL_RESEARCH"


class CompatibilityCheckResponse(BaseModel):
    state: CompatibilityState
    is_compatible: bool
    reasons: list[str]
    checks: dict[str, bool]
    spatial_offset_km: Optional[float] = None
    temporal_offset_hours: Optional[float] = None
    depth_offset_m: Optional[float] = None
    units: Optional[str] = None
    variable: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ── Phase 5 Variable-Aware Analysis Models ──────────────────────────────────

class VariableAwareAnalysisRequest(BaseModel):
    variable: OceanVariable
    observation_values: list[float]
    model_values: list[float]
    depth_levels: Optional[list[float]] = None
    observation_qc_flags: Optional[list[str]] = None
    u_obs: Optional[list[float]] = None
    v_obs: Optional[list[float]] = None
    u_model: Optional[list[float]] = None
    v_model: Optional[list[float]] = None


class VariableAwareAnalysisResponse(BaseModel):
    variable: str
    canonical_name: str
    units: str
    matched_points: int
    mean_bias: Optional[float] = None
    mae: Optional[float] = None
    rmse: Optional[float] = None
    max_absolute_error: Optional[float] = None
    correlation: Optional[float] = None
    currents_metrics: Optional[dict[str, Any]] = None
    depth_profile_analysis: Optional[list[dict[str, Any]]] = None
    notes: list[str] = Field(default_factory=list)


# ── Phase 14 Authoritative Scientific Collocation Engine Models ─────────────

class MatchedProfileLevelRecord(BaseModel):
    depth_m: float
    pressure_dbar: Optional[float] = None
    observation_value: Optional[float] = None
    model_value: Optional[float] = None
    difference: Optional[float] = None
    spatial_offset_km: float = 0.0
    temporal_offset_hours: float = 0.0
    depth_offset_m: float = 0.0
    interpolation_method: str = "exact"
    qc_flag: str = "1"
    status: Literal["VALID", "NO_MODEL_DATA", "QC_REJECTED", "OUT_OF_BOUNDS"] = "VALID"


class ScientificCollocationEvaluationRequest(BaseModel):
    variable: str
    unit: Optional[str] = None
    observation_profile: Optional[dict[str, Any]] = None
    model_levels: list[dict[str, float]] = Field(default_factory=list)
    model_surface_field: Optional[dict[str, Any]] = None
    model_time: Optional[str] = None
    model_location: Optional[list[float]] = None
    model_dataset_id: Optional[str] = None
    model_source_name: Optional[str] = None
    spatial_tolerance_km: float = 40.0
    temporal_tolerance_hours: float = 36.0
    depth_tolerance_m: float = 15.0
    data_mode: CanonicalDataMode = "HISTORICAL_RESEARCH"


class ScientificCollocationEvaluationResponse(BaseModel):
    variable: str
    canonical_name: str
    unit: str
    state: CompatibilityState
    state_description: str
    is_comparison_valid: bool
    observation_metadata: dict[str, Any] = Field(default_factory=dict)
    reference_metadata: dict[str, Any] = Field(default_factory=dict)
    spatial_offset_km: Optional[float] = None
    temporal_offset_hours: Optional[float] = None
    depth_overlap_range: Optional[list[float]] = None
    spatial_tolerance_km: float
    temporal_tolerance_hours: float
    depth_tolerance_m: float
    matched_levels: list[MatchedProfileLevelRecord] = Field(default_factory=list)
    valid_matched_count: int = 0
    bias: Optional[float] = None
    mae: Optional[float] = None
    rmse: Optional[float] = None
    max_abs_diff: Optional[float] = None
    correlation: Optional[float] = None
    difference_convention: str = "Model − Observation"
    provenance: dict[str, Any] = Field(default_factory=dict)
    metadata: ResponseMetadata


class HistoricalDataRequest(BaseModel):
    """Structured query for historical/date-specific scientific dataset retrieval."""
    source: Optional[str] = None
    dataset_id: str = Field(..., description="Registered dataset ID from DATASET_REGISTRY")
    variable: Optional[str] = Field(None, description="Scientific variable (e.g. thetao, so, temperature, salinity, currents, currents_u, currents_v, chl)")
    data_mode: Optional[CanonicalDataMode] = None
    platform_type: Optional[ObservationPlatformType] = None
    start_datetime: Optional[str] = Field(None, description="ISO 8601 or YYYY-MM-DD start datetime")
    end_datetime: Optional[str] = Field(None, description="ISO 8601 or YYYY-MM-DD end datetime")
    date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="Specific observation/model date YYYY-MM-DD")
    time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$", description="Specific observation/model time HH:MM")
    latitude_min: Optional[float] = Field(None, ge=-90, le=90)
    latitude_max: Optional[float] = Field(None, ge=-90, le=90)
    longitude_min: Optional[float] = Field(None, ge=-180, le=180)
    longitude_max: Optional[float] = Field(None, ge=-180, le=180)
    depth_min: Optional[float] = Field(None, ge=0, le=6000)
    depth_max: Optional[float] = Field(None, ge=0, le=6000)
    pressure_min: Optional[float] = Field(None, ge=0, le=6000)
    pressure_max: Optional[float] = Field(None, ge=0, le=6000)
    temporal_resolution: Optional[str] = None
    format: Optional[Literal["records", "profiles", "collocation", "grid"]] = "records"


class HistoricalQuerySummary(BaseModel):
    source: Optional[str] = None
    dataset_id: str
    dataset_name: str
    data_mode: Optional[CanonicalDataMode] = None
    platform_type: Optional[ObservationPlatformType] = None
    variable: Optional[str] = None
    variable_name: Optional[str] = None
    units: Optional[str] = None
    requested_time: dict[str, Any]
    requested_region: dict[str, Any]
    requested_depth: dict[str, Any]


class HistoricalResultSummary(BaseModel):
    status: Literal["complete", "partial", "no_data", "access_required"]
    total_records: int
    data_mode: Optional[CanonicalDataMode] = None
    platform_type: Optional[ObservationPlatformType] = None
    returned_time_range: Optional[dict[str, str]] = None
    returned_spatial_bounds: Optional[dict[str, float]] = None
    returned_depth_range: Optional[list[float]] = None
    units: Optional[str] = None
    qc_summary: Optional[dict[str, Any]] = None
    data_status_note: Optional[str] = None


class HistoricalDataResponse(BaseModel):
    status: Literal["success", "partial", "no_data", "error"]
    mode: Literal["historical"] = "historical"
    data_mode: Optional[CanonicalDataMode] = None
    query_summary: HistoricalQuerySummary
    result_summary: HistoricalResultSummary
    data: list[Any]
    provenance: dict[str, Any]
    cache: Optional[dict[str, Any]] = None
    metadata: ResponseMetadata


# ── Phase 12 Ingestion & Lineage Models ──────────────────────────────────────

class IngestionPipelineStep(BaseModel):
    step_number: int
    step_name: str
    status: Literal["passed", "transformed", "filtered", "rejected", "skipped"]
    details: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class DataLineageRecord(BaseModel):
    source_provider: str
    dataset_id: str
    product_id: Optional[str] = None
    source_url: Optional[str] = None
    file_id: Optional[str] = None
    retrieval_timestamp: str
    processing_timestamp: str
    processing_steps: list[IngestionPipelineStep] = Field(default_factory=list)
    original_variable: str
    canonical_variable: str
    original_units: str
    canonical_units: str
    qc_policy: str
    spatial_bounds: Optional[dict[str, float]] = None
    temporal_bounds: Optional[dict[str, str]] = None
    depth_bounds: Optional[dict[str, float]] = None


# ── Phase 15 Dataset-Adaptive Exploration Models ────────────────────────────

class DatasetProfileSummary(BaseModel):
    profile_id: str
    platform_id: str
    platform_type: str
    cycle_number: Optional[int] = None
    latitude: float
    longitude: float
    observation_time: str
    variables: list[str] = Field(default_factory=list)
    min_depth: float
    max_depth: float
    levels_count: int
    qc_status: str = "GOOD"
    source: str
    source_dataset: str
    file_path: Optional[str] = None
    file_size_bytes: Optional[int] = None
    sha256: Optional[str] = None
    institution: Optional[str] = None
    processing_level: Optional[str] = None


class DatasetProfilesResponse(BaseModel):
    platform: str
    dataset_id: str
    dataset_name: str
    total_profiles: int
    temporal_range: dict[str, str]
    spatial_bounds: dict[str, float]
    depth_range: dict[str, float]
    available_variables: list[str] = Field(default_factory=list)
    available_dates: list[str] = Field(default_factory=list)
    profiles: list[DatasetProfileSummary] = Field(default_factory=list)
    metadata: ResponseMetadata

