/**
 * INTEG1 Integration Layer — Type Contracts
 *
 * These are the normalized data shapes the frontend consumes.
 * The mock provider generates them; the real backend provider will return the same shapes.
 * Ayan's backend must conform to these contracts to plug in seamlessly.
 */

// ── Shared primitives ──────────────────────────────────────────────────────────

export interface Coordinates {
  latitude: number;
  longitude: number;
  depth?: number;
}

export interface TimeRange {
  date: string; // ISO date string YYYY-MM-DD
  time: string; // HH:mm
}

export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export type OceanVariable = 'temperature' | 'salinity' | 'currents_u' | 'currents_v';

// ── Provider response wrapper ──────────────────────────────────────────────────

export type ProviderStatus = 'idle' | 'loading' | 'success' | 'error' | 'empty';

export interface ProviderResponse<T> {
  status: ProviderStatus;
  data: T | null;
  error?: string;
  metadata?: {
    timestamp: string; // when the response was generated
    source: string; // 'mock' | 'api' | 'cache'
    requestId?: string;
  };
}

// ── Model-vs-Observation comparison ────────────────────────────────────────────

export interface ModelObservationDataPoint {
  modelValue: number;
  observationValue: number;
  difference: number;
  unit: string;
  variable: OceanVariable;
  depth: number;
  confidence: 'low' | 'medium' | 'high';
  timestamp: string;
}

export interface ModelComparisonResult {
  /** Single point comparison at the selected depth */
  point: ModelObservationDataPoint;
  /** Actual latitude of the matched observation (may differ from requested click) */
  observationLatitude?: number;
  /** Actual longitude of the matched observation (may differ from requested click) */
  observationLongitude?: number;
  /** Great-circle distance from requested point to matched observation in km */
  nearestDistance?: number;
  /** Health score 0-100 */
  healthScore: number;
  healthStatus: 'excellent' | 'good' | 'fair' | 'poor';
  healthSummary: string;
  /** Metadata about which model and observation dataset were compared */
  sourceModel: string;
  sourceObservation: string;
}

// ── Vertical profile ───────────────────────────────────────────────────────────

export interface VerticalProfilePoint {
  depth: number;
  modelValue: number;
  observationValue: number;
  /** Optional second model for comparison (e.g., different physics) */
  altModelValue?: number;
  unit: string;
}

export interface VerticalProfileResult {
  points: VerticalProfilePoint[];
  variable: OceanVariable;
  unit: string;
  /** Max depth available for this variable at this location */
  maxDepth: number;
  /** Actual latitude of the matched observation */
  observationLatitude?: number;
  /** Actual longitude of the matched observation */
  observationLongitude?: number;
  /** Great-circle distance from requested point to matched observation in km */
  nearestDistance?: number;
}

// ── Discrepancy / error map ────────────────────────────────────────────────────

export interface DiscrepancyPoint {
  latitude: number;
  longitude: number;
  depth: number;
  errorMagnitude: number;
  variable: OceanVariable;
}

export interface DiscrepancyResult {
  points: DiscrepancyPoint[];
  /** Summary stats for the region */
  stats: {
    meanError: number;
    maxError: number;
    rmsError: number;
    totalPoints: number;
  };
}

// ── Observations ───────────────────────────────────────────────────────────────

export type ObservationType = 'argo' | 'glider' | 'mooring' | 'ship';
export type ObservationStatus = 'active' | 'inactive' | 'pending';

export interface ObservationStation {
  id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  depth: number;
  status: ObservationStatus;
  type: ObservationType;
  temperature?: number;
  salinity?: number;
  /** Nearest distance from a given point (km), populated on request */
  distanceKm?: number;
}

export interface ObservationResult {
  stations: ObservationStation[];
  totalActive: number;
  totalPending: number;
  region: string;
}

// ── Diagnostics ────────────────────────────────────────────────────────────────

export type DiagnosticStepStatus = 'inactive' | 'active' | 'complete' | 'loading';

export interface DiagnosticCause {
  name: string;
  confidence: 'low' | 'medium' | 'high';
  evidence: string[];
}

export interface DiagnosticResult {
  id: string;
  errorFingerprint: string;
  possibleCauses: DiagnosticCause[];
  /** The top-ranked cause */
  topCause: DiagnosticCause;
  status: DiagnosticStepStatus;
}

// ── Workflow ───────────────────────────────────────────────────────────────────

export interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  status: DiagnosticStepStatus;
}

export interface SolutionRecommendation {
  id: string;
  recommendedTest: string;
  expectedOutcome: string;
  caution: string;
  status: DiagnosticStepStatus;
}

export interface WorkflowResult {
  steps: WorkflowStep[];
  solution: SolutionRecommendation | null;
}

// ── 3D Visualization data ──────────────────────────────────────────────────────

export interface SurfaceGridPoint {
  latitude: number;
  longitude: number;
  value: number;
  unit: string;
}

export interface DepthSliceData {
  depth: number;
  meanValue: number;
  unit: string;
  /** Grid of values for this depth layer */
  gridPoints: SurfaceGridPoint[];
}

export interface Visualization3DResult {
  variable: OceanVariable;
  unit: string;
  surfaceLayer: SurfaceGridPoint[];
  depthSlices: DepthSliceData[];
  verticalProfile: VerticalProfilePoint[];
}

// ── Provider request parameters ────────────────────────────────────────────────

export interface ComparisonRequest {
  location: Coordinates;
  variable: OceanVariable;
  depth: number;
  date: string;
  time: string;
}

export interface ProfileRequest {
  location: Coordinates;
  variable: OceanVariable;
  date: string;
  time: string;
}

export interface DiscrepancyRequest {
  region: string;
  bounds: Bounds;
  variable: OceanVariable;
  date: string;
  time: string;
}

export interface ObservationRequest {
  region: string;
  bounds?: Bounds;
  date: string;
}

export interface DiagnosticRequest {
  location: Coordinates;
  variable: OceanVariable;
  depth: number;
  date: string;
  time: string;
}

export interface VisualizationRequest {
  location: Coordinates;
  variable: OceanVariable;
  date: string;
  time: string;
}

// ── Research 3D Visualization (GLORYS × Argo collocation) ───────────────────

export interface Research3DPoint {
  latitude: number;
  longitude: number;
  pressure: number;
  argoValue: number;
  glorysValue: number;
  difference: number;
  timestamp: string;
  platformNumber: string;
  cycleNumber: string;
}

export interface Research3DStats {
  totalPoints: number;
  argoMean: number;
  glorysMean: number;
  meanDifference: number;
  rmsDifference: number;
  maxDifference: number;
  depthRange: [number, number];
  spatialBounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export interface ResearchVisualization3DResult {
  variable: OceanVariable;
  unit: string;
  date: string;
  time: string;
  sourceModel: string;
  sourceObservation: string;
  points: Research3DPoint[];
  stats: Research3DStats;
}
