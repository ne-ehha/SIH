/**
 * INTEG1 Integration Layer — Provider Interface
 *
 * This is the contract that all data providers must implement.
 * The mock provider ships first; Ayan's backend provider will implement this same interface.
 *
 * To add a new provider:
 * 1. Create a class implementing OceanDataProvider
 * 2. Register it in src/integration/registry.ts
 * 3. Switch providers via setProvider() or env var
 */

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
  WorkflowResult,
  VisualizationRequest,
  Visualization3DResult,
  ResearchVisualization3DResult,
} from './types';

export interface OceanDataProvider {
  /** Human-readable name for this provider */
  readonly name: string;
  /** Whether this provider requires network access */
  readonly requiresNetwork: boolean;

  // ── Data fetch methods ─────────────────────────────────────────────────────

  /** Get model vs observation comparison at a specific point */
  fetchComparison(request: ComparisonRequest): Promise<ProviderResponse<ModelComparisonResult>>;

  /** Get vertical profile (model + observation across depths) */
  fetchVerticalProfile(request: ProfileRequest): Promise<ProviderResponse<VerticalProfileResult>>;

  /** Get discrepancy/error map data for a region */
  fetchDiscrepancy(request: DiscrepancyRequest): Promise<ProviderResponse<DiscrepancyResult>>;

  /** Get observation stations in a region */
  fetchObservations(request: ObservationRequest): Promise<ProviderResponse<ObservationResult>>;

  /** Run diagnostic analysis */
  fetchDiagnostics(request: DiagnosticRequest): Promise<ProviderResponse<DiagnosticResult>>;

  /** Get investigation workflow steps and recommendations */
  fetchWorkflow(diagnosticId: string): Promise<ProviderResponse<WorkflowResult>>;

  /** Get data formatted for 3D visualization (HYCOM Pipeline B) */
  fetchVisualization(request: VisualizationRequest): Promise<ProviderResponse<Visualization3DResult>>;

  /** Get Research 3D visualization of GLORYS × Argo collocated observations */
  fetchResearchVisualization(request: VisualizationRequest): Promise<ProviderResponse<ResearchVisualization3DResult>>;
}
