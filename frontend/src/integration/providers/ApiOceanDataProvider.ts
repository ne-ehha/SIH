/**
 * INTEG1 Integration Layer — Real API Ocean Data Provider
 *
 * Implements OceanDataProvider using the FastAPI backend at VITE_API_BASE_URL.
 * Replaces MockOceanDataProvider when the backend is running.
 *
 * Pipeline separation:
 *   Pipeline A (GLORYS×Argo, Jan 2024): comparison, profile, discrepancy, observations, diagnostics
 *   Pipeline B (HYCOM 2026): visualization/3d, model/profile
 *
 * Flow:
 *   Coordinates + variable + depth + date + time
 *     → ApiOceanDataProvider
 *       → POST/GET /api/v1/* endpoints
 *         → Normalized ProviderResponse<T>
 *           → Adapter hooks (normalize for UI components)
 *             → Tanmay's frontend components
 */

import type { OceanDataProvider } from '../provider';
import type {
  ProviderResponse,
  ComparisonRequest,
  ModelComparisonResult,
  ProfileRequest,
  VerticalProfileResult,
  DiscrepancyRequest,
  DiscrepancyResult,
  ObservationRequest,
  ObservationResult,
  DiagnosticRequest,
  DiagnosticResult,
  DiagnosticStepStatus,
  WorkflowResult,
  VisualizationRequest,
  Visualization3DResult,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

// ── Backend response wrappers ──────────────────────────────────────────────────

interface BackendSuccessResponse<T> {
  status: 'success';
  data: T;
  metadata?: {
    timestamp: string;
    source: string;
    requestId?: string;
  };
}

interface BackendErrorResponse {
  status: 'error';
  error: {
    code: string;
    message: string;
  };
}

type BackendResponse<T> = BackendSuccessResponse<T> | BackendErrorResponse;

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function apiPost<T>(endpoint: string, body: unknown): Promise<BackendResponse<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    return json as BackendResponse<T>;
  } catch (error) {
    return {
      status: 'error',
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Unable to connect to backend server.',
      },
    };
  }
}

async function apiGet<T>(endpoint: string): Promise<BackendResponse<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    const json = await response.json();
    return json as BackendResponse<T>;
  } catch (error) {
    return {
      status: 'error',
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Unable to connect to backend server.',
      },
    };
  }
}

// ── Backend → INTEG1 response adapter ─────────────────────────────────────────

function toProviderResponse<T>(backend: BackendResponse<T>): ProviderResponse<T> {
  if (backend.status === 'error') {
    return {
      status: 'error',
      data: null,
      error: backend.error.message,
      metadata: {
        timestamp: new Date().toISOString(),
        source: 'api',
      },
    };
  }
  return {
    status: 'success',
    data: backend.data,
    metadata: backend.metadata
      ? {
          timestamp: backend.metadata.timestamp,
          source: 'api',
          requestId: backend.metadata.requestId,
        }
      : { timestamp: new Date().toISOString(), source: 'api' },
  };
}

// ── Pipeline A valid dates ────────────────────────────────────────────────────

const PIPELINE_A_VALID_DATES = new Set([
  '2024-01-01',
  '2024-01-04',
  '2024-01-06',
  '2024-01-07',
  '2024-01-08',
  '2024-01-09',
  '2024-01-10',
  '2024-01-11',
  '2024-01-14',
]);

/**
 * Check if a date is valid for Pipeline A (GLORYS×Argo comparison).
 * If the date is outside Jan 1-14 2024, Pipeline A cannot provide comparison data.
 */
function isPipelineADate(date: string): boolean {
  return PIPELINE_A_VALID_DATES.has(date);
}

// ── Backend raw response types (subset matching actual API contract) ───────────

interface BackendComparisonData {
  point: {
    modelValue: number;
    observationValue: number;
    difference: number;
    unit: string;
    variable: string;
    depth: number;
    confidence: string;
    timestamp: string;
  };
  healthScore: number;
  healthStatus: string;
  healthSummary: string;
  sourceModel: string;
  sourceObservation: string;
}

interface BackendProfileData {
  points: Array<{
    depth: number;
    modelValue: number;
    observationValue?: number | null;
    unit: string;
  }>;
  variable: string;
  unit: string;
  maxDepth: number;
  sourceModel: string;
  sourceObservation?: string | null;
}

interface BackendDiscrepancyData {
  points: Array<{
    latitude: number;
    longitude: number;
    depth: number;
    errorMagnitude: number;
    variable: string;
  }>;
  stats: {
    meanError: number;
    maxError: number;
    rmsError: number;
    totalPoints: number;
  };
  sourceModel: string;
  sourceObservation: string;
}

interface BackendObservationData {
  stations: Array<{
    id: string;
    latitude: number;
    longitude: number;
    timestamp: string;
    depth: number;
    status: string;
    type: string;
    temperature?: number | null;
    salinity?: number | null;
  }>;
  totalActive: number;
  totalPending: number;
  region: string;
}

interface BackendDiagnosticData {
  id: string;
  errorFingerprint: string;
  possibleCauses: Array<{
    name: string;
    confidence: string;
    evidence: string[];
  }>;
  topCause: {
    name: string;
    confidence: string;
    evidence: string[];
  };
  status: string;
  sourceModel: string;
  sourceObservation: string;
  caution: string;
}

interface BackendWorkflowData {
  steps: Array<{
    id: string;
    title: string;
    description: string;
    status: string;
  }>;
  solution?: {
    id: string;
    recommendedTest: string;
    expectedOutcome: string;
    caution: string;
    status: string;
  } | null;
}

interface BackendVisualizationData {
  variable: string;
  unit: string;
  sourceModel: string;
  sourceObservation?: string | null;
  observationNote?: string | null;
  date: string;
  time: string;
  depthLevels: number[];
  depthSlices: Array<{
    depth: number;
    meanValue: number;
    unit: string;
    gridPoints: Array<{
      latitude: number;
      longitude: number;
      value?: number | null;
      unit: string;
    }>;
  }>;
  verticalProfile: Array<{
    depth: number;
    modelValue: number;
    observationValue?: number | null;
    unit: string;
  }>;
  surfaceLayer?: Array<{
    latitude: number;
    longitude: number;
    value?: number | null;
    unit: string;
  }>;
}

interface BackendModelGridData {
  variable: string;
  unit: string;
  gridPoints: Array<{
    latitude: number;
    longitude: number;
    value?: number | null;
    unit: string;
  }>;
}

// ── Provider implementation ───────────────────────────────────────────────────

export class ApiOceanDataProvider implements OceanDataProvider {
  readonly name = 'api';
  readonly requiresNetwork = true;

  // ── Pipeline A: Comparison ──────────────────────────────────────────────────

  async fetchComparison(req: ComparisonRequest): Promise<ProviderResponse<ModelComparisonResult>> {
    // Validate Pipeline A date
    if (!isPipelineADate(req.date)) {
      return {
        status: 'error',
        data: null,
        error: `Date ${req.date} is not available for model-observation comparison. Available dates: January 1-14, 2024 only (Pipeline A: GLORYS×Argo).`,
        metadata: { timestamp: new Date().toISOString(), source: 'api' },
      };
    }

    const backend = await apiPost<BackendComparisonData>('/api/v1/comparison', {
      location: {
        latitude: req.location.latitude,
        longitude: req.location.longitude,
        depth: req.depth,
      },
      variable: req.variable,
      depth: req.depth,
      date: req.date,
      time: req.time,
    });

    if (backend.status === 'error') {
      return toProviderResponse(backend);
    }

    // Map backend response to INTEG1 types
    const d = backend.data;
    const result: ModelComparisonResult = {
      point: {
        modelValue: d.point.modelValue,
        observationValue: d.point.observationValue,
        difference: d.point.difference,
        unit: d.point.unit,
        variable: d.point.variable as ModelComparisonResult['point']['variable'],
        depth: d.point.depth,
        confidence: d.point.confidence as ModelComparisonResult['point']['confidence'],
        timestamp: d.point.timestamp,
      },
      healthScore: d.healthScore,
      healthStatus: d.healthStatus as ModelComparisonResult['healthStatus'],
      healthSummary: d.healthSummary,
      sourceModel: d.sourceModel,
      sourceObservation: d.sourceObservation,
    };

    return {
      status: 'success',
      data: result,
      metadata: {
        timestamp: new Date().toISOString(),
        source: 'api',
      },
    };
  }

  // ── Pipeline A: Vertical Profile ───────────────────────────────────────────

  async fetchVerticalProfile(req: ProfileRequest): Promise<ProviderResponse<VerticalProfileResult>> {
    if (!isPipelineADate(req.date)) {
      return {
        status: 'error',
        data: null,
        error: `Date ${req.date} is not available for vertical profile comparison. Available dates: January 1-14, 2024 only (Pipeline A: GLORYS×Argo).`,
        metadata: { timestamp: new Date().toISOString(), source: 'api' },
      };
    }

    const backend = await apiPost<BackendProfileData>('/api/v1/profile', {
      location: {
        latitude: req.location.latitude,
        longitude: req.location.longitude,
      },
      variable: req.variable,
      date: req.date,
      time: req.time,
    });

    if (backend.status === 'error') {
      return toProviderResponse(backend);
    }

    const d = backend.data;
    const result: VerticalProfileResult = {
      points: d.points.map((p) => ({
        depth: p.depth,
        modelValue: p.modelValue,
        observationValue: p.observationValue ?? 0,
        unit: p.unit,
      })),
      variable: d.variable as VerticalProfileResult['variable'],
      unit: d.unit,
      maxDepth: d.maxDepth,
    };

    return {
      status: 'success',
      data: result,
      metadata: { timestamp: new Date().toISOString(), source: 'api' },
    };
  }

  // ── Pipeline A: Discrepancy ────────────────────────────────────────────────

  async fetchDiscrepancy(req: DiscrepancyRequest): Promise<ProviderResponse<DiscrepancyResult>> {
    if (!isPipelineADate(req.date)) {
      return {
        status: 'error',
        data: null,
        error: `Date ${req.date} is not available for discrepancy analysis. Available dates: January 1-14, 2024 only (Pipeline A: GLORYS×Argo).`,
        metadata: { timestamp: new Date().toISOString(), source: 'api' },
      };
    }

    const backend = await apiPost<BackendDiscrepancyData>('/api/v1/discrepancy', {
      region: req.region,
      bounds: req.bounds,
      variable: req.variable,
      date: req.date,
      time: req.time,
    });

    if (backend.status === 'error') {
      return toProviderResponse(backend);
    }

    const d = backend.data;
    const result: DiscrepancyResult = {
      points: d.points.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        depth: p.depth,
        errorMagnitude: p.errorMagnitude,
        variable: p.variable as DiscrepancyResult['points'][0]['variable'],
      })),
      stats: d.stats,
    };

    return {
      status: 'success',
      data: result,
      metadata: { timestamp: new Date().toISOString(), source: 'api' },
    };
  }

  // ── Pipeline A: Observations ───────────────────────────────────────────────

  async fetchObservations(req: ObservationRequest): Promise<ProviderResponse<ObservationResult>> {
    if (!isPipelineADate(req.date)) {
      return {
        status: 'error',
        data: null,
        error: `Date ${req.date} is not available for observations. Available dates: January 1-14, 2024 only (Pipeline A: GLORYS×Argo).`,
        metadata: { timestamp: new Date().toISOString(), source: 'api' },
      };
    }

    const backend = await apiPost<BackendObservationData>('/api/v1/observations', {
      region: req.region,
      bounds: req.bounds,
      date: req.date,
    });

    if (backend.status === 'error') {
      return toProviderResponse(backend);
    }

    const d = backend.data;
    const result: ObservationResult = {
      stations: d.stations.map((s) => ({
        id: s.id,
        latitude: s.latitude,
        longitude: s.longitude,
        timestamp: s.timestamp,
        depth: s.depth,
        status: s.status as ObservationResult['stations'][0]['status'],
        type: s.type as ObservationResult['stations'][0]['type'],
        temperature: s.temperature ?? undefined,
        salinity: s.salinity ?? undefined,
      })),
      totalActive: d.totalActive,
      totalPending: d.totalPending,
      region: d.region,
    };

    return {
      status: 'success',
      data: result,
      metadata: { timestamp: new Date().toISOString(), source: 'api' },
    };
  }

  // ── Pipeline A: Diagnostics ────────────────────────────────────────────────

  async fetchDiagnostics(req: DiagnosticRequest): Promise<ProviderResponse<DiagnosticResult>> {
    if (!isPipelineADate(req.date)) {
      return {
        status: 'error',
        data: null,
        error: `Date ${req.date} is not available for diagnostics. Available dates: January 1-14, 2024 only (Pipeline A: GLORYS×Argo).`,
        metadata: { timestamp: new Date().toISOString(), source: 'api' },
      };
    }

    const backend = await apiPost<BackendDiagnosticData>('/api/v1/diagnostics', {
      location: {
        latitude: req.location.latitude,
        longitude: req.location.longitude,
        depth: req.depth,
      },
      variable: req.variable,
      depth: req.depth,
      date: req.date,
      time: req.time,
    });

    if (backend.status === 'error') {
      return toProviderResponse(backend);
    }

    const d = backend.data;
    const result: DiagnosticResult = {
      id: d.id,
      errorFingerprint: d.errorFingerprint,
      possibleCauses: d.possibleCauses.map((c) => ({
        name: c.name,
        confidence: c.confidence as DiagnosticResult['possibleCauses'][0]['confidence'],
        evidence: c.evidence,
      })),
      topCause: {
        name: d.topCause.name,
        confidence: d.topCause.confidence as DiagnosticResult['topCause']['confidence'],
        evidence: d.topCause.evidence,
      },
      status: d.status as DiagnosticResult['status'],
    };

    return {
      status: 'success',
      data: result,
      metadata: { timestamp: new Date().toISOString(), source: 'api' },
    };
  }

  // ── Pipeline A: Workflow (GET /diagnostics/{id}/workflow) ──────────────────

  async fetchWorkflow(diagnosticId: string): Promise<ProviderResponse<WorkflowResult>> {
    const backend = await apiGet<BackendWorkflowData>(`/api/v1/diagnostics/${diagnosticId}/workflow`);

    if (backend.status === 'error') {
      return toProviderResponse(backend);
    }

    const d = backend.data;
    const result: WorkflowResult = {
      steps: d.steps.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        status: s.status as WorkflowResult['steps'][0]['status'],
      })),
      solution: d.solution
        ? {
            id: d.solution.id,
            recommendedTest: d.solution.recommendedTest,
            expectedOutcome: d.solution.expectedOutcome,
            caution: d.solution.caution,
            status: d.solution.status as DiagnosticStepStatus,
          }
        : null,
    };

    return {
      status: 'success',
      data: result,
      metadata: { timestamp: new Date().toISOString(), source: 'api' },
    };
  }

  // ── Pipeline B: 3D Visualization ───────────────────────────────────────────

  async fetchVisualization(req: VisualizationRequest): Promise<ProviderResponse<Visualization3DResult>> {
    const backend = await apiPost<BackendVisualizationData>('/api/v1/visualization/3d', {
      location: {
        latitude: req.location.latitude,
        longitude: req.location.longitude,
      },
      variable: req.variable,
      date: req.date,
      time: req.time,
    });

    if (backend.status === 'error') {
      return toProviderResponse(backend);
    }

    const d = backend.data;

    // The visualization endpoint may not include surfaceLayer.
    // Fetch it separately from /model/grid if needed.
    let surfaceLayer = d.surfaceLayer;
    if (!surfaceLayer || surfaceLayer.length === 0) {
      surfaceLayer = await this.fetchSurfaceLayer(req);
    }

    // Map backend visualization to INTEG1 Visualization3DResult
    const result: Visualization3DResult = {
      variable: d.variable as Visualization3DResult['variable'],
      unit: d.unit,
      surfaceLayer: (surfaceLayer || []).map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        value: p.value ?? 0,
        unit: p.unit,
      })),
      depthSlices: d.depthSlices.map((s) => ({
        depth: s.depth,
        meanValue: s.meanValue,
        unit: s.unit,
        gridPoints: s.gridPoints.map((gp) => ({
          latitude: gp.latitude,
          longitude: gp.longitude,
          value: gp.value ?? 0,
          unit: gp.unit,
        })),
      })),
      verticalProfile: d.verticalProfile.map((p) => ({
        depth: p.depth,
        modelValue: p.modelValue,
        observationValue: p.observationValue ?? 0,
        unit: p.unit,
      })),
    };

    return {
      status: 'success',
      data: result,
      metadata: { timestamp: new Date().toISOString(), source: 'api' },
    };
  }

  /**
   * Fetch the 8×8 surface grid from /model/grid to use as the surfaceLayer
   * for the 3D visualization.
   */
  private async fetchSurfaceLayer(req: VisualizationRequest): Promise<
    Array<{ latitude: number; longitude: number; value: number | null; unit: string }>
  > {
    // HYCOM depth level 0 for surface
    const backend = await apiPost<BackendModelGridData>('/api/v1/model/grid', {
      bounds: {
        north: req.location.latitude + 1.0,
        south: req.location.latitude - 1.0,
        east: req.location.longitude + 1.0,
        west: req.location.longitude - 1.0,
      },
      variable: req.variable,
      depth: 0,
      date: req.date,
      time: req.time,
    });

    if (backend.status === 'error') {
      return [];
    }

    return backend.data.gridPoints.map((gp) => ({
      latitude: gp.latitude,
      longitude: gp.longitude,
      value: gp.value ?? null,
      unit: gp.unit,
    }));
  }
}
