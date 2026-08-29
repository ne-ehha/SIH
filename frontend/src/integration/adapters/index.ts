/**
 * INTEG1 Integration Layer — Adapters Index
 *
 * Re-exports all adapter functions and their display types.
 */

export {
  adaptComparison,
  adaptHealth,
  adaptVerticalProfile,
  type ComparisonDisplayData,
  type HealthDisplayData,
  type ProfileDisplayPoint,
} from './comparisonAdapter';

export {
  adaptDiscrepancy,
  adaptDiscrepancyStats,
  type DiscrepancyDisplayPoint,
} from './discrepancyAdapter';

export {
  adaptObservations,
  adaptNearestObservation,
  type ObservationDisplayPoint,
  type NearestObservation,
} from './observationAdapter';

export {
  adaptDiagnostic,
  adaptWorkflowSteps,
  adaptSolution,
  type DiagnosticDisplayData,
  type WorkflowDisplayStep,
  type SolutionDisplayData,
} from './diagnosticsAdapter';

export {
  adaptSurfaceLayer,
  adaptDepthSlices,
  adaptProfileForChart,
  type SurfaceGridCell,
  type DepthSliceDisplay,
  type ProfileChartPoint,
} from './visualizationAdapter';
