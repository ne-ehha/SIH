/**
 * INTEG1 Integration Layer — Public API
 *
 * This is the single entry point for components to access the integration layer.
 *
 * Usage in components:
 *   import { useModelComparison, getProvider, setProvider } from '@/integration';
 *
 * Architecture:
 *   ┌─────────────────────────────────────────────────┐
 *   │           Tanmay's Frontend Components           │
 *   └─────────────────┬───────────────────────────────┘
 *                     │ import { useModelComparison }
 *   ┌─────────────────▼───────────────────────────────┐
 *   │              Integration Hooks                   │
 *   │  useModelComparison, useVerticalProfile,         │
 *   │  useDiscrepancy, useObservations,                │
 *   │  useDiagnostics, useVisualization3D              │
 *   └─────────────────┬───────────────────────────────┘
 *                     │ getProvider().fetchComparison()
 *   ┌─────────────────▼───────────────────────────────┐
 *   │           Adapter Layer (adapters/)               │
 *   │  adaptComparison, adaptVerticalProfile, etc.     │
 *   └─────────────────┬───────────────────────────────┘
 *                     │
 *   ┌─────────────────▼───────────────────────────────┐
 *   │              Provider Registry                    │
 *   │  ┌──────────┐  ┌──────────┐                      │
 *   │  │   Mock   │  │   API    │  (Ayan implements)  │
 *   │  └──────────┘  └──────────┘                      │
 *   └─────────────────────────────────────────────────┘
 *
 * To switch from mock to real backend:
 *   1. Ayan creates a class implementing OceanDataProvider
 *   2. Register it: registerProvider('api', new ApiOceanDataProvider())
 *   3. Switch: setProvider('api')
 */

// ── Provider management ─────────────────────────────────────────────────────
export { getProvider, setProvider, getActiveProviderKey, registerProvider, getRegisteredProviders } from './registry';

// ── Integration hooks (what components consume) ─────────────────────────────
export { useModelComparison } from './hooks/useModelComparison';
export { useVerticalProfile } from './hooks/useVerticalProfile';
export { useDiscrepancy } from './hooks/useDiscrepancy';
export { useObservations } from './hooks/useObservations';
export { useDiagnostics } from './hooks/useDiagnostics';
export { useVisualization3D } from './hooks/useVisualization3D';

// ── Types for components that need raw data shapes ──────────────────────────
export type {
  // Comparison
  ComparisonDisplayData,
  HealthDisplayData,
  ProfileDisplayPoint,
  // Discrepancy
  DiscrepancyDisplayPoint,
  // Observations
  ObservationDisplayPoint,
  NearestObservation,
  // Diagnostics
  DiagnosticDisplayData,
  WorkflowDisplayStep,
  SolutionDisplayData,
  // 3D Visualization
  SurfaceGridCell,
  DepthSliceDisplay,
  ProfileChartPoint,
} from './adapters';

export type {
  // Provider response types
  ProviderResponse,
  ProviderStatus,
  OceanVariable,
  Coordinates,
  Bounds,
  // Raw provider types (for advanced usage / future extensions)
  ModelComparisonResult,
  VerticalProfileResult,
  DiscrepancyResult,
  ObservationResult,
  DiagnosticResult,
  WorkflowResult,
  Visualization3DResult,
  ComparisonRequest,
  ProfileRequest,
  DiscrepancyRequest,
  ObservationRequest,
  DiagnosticRequest,
  VisualizationRequest,
} from './types';

// ── Provider interface (for Ayan to implement) ──────────────────────────────
export type { OceanDataProvider } from './provider';
