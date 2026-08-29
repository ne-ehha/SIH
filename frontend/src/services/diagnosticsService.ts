import type { Location, OceanVariable } from '@/types/ocean';
import { mockDiagnosticResult, mockWorkflowSteps, mockSolutions } from '@/mocks/diagnostics';
import type { DiagnosticResult, WorkflowStep, SolutionRecommendation } from '@/types/diagnostics';

export async function runDiagnostics(
  _location: Location,
  _variable: OceanVariable,
  _depth: number
): Promise<DiagnosticResult> {
  // Mock response - replace with apiPost when backend is ready
  return mockDiagnosticResult;
}

export async function getWorkflowSteps(
  _diagnosticId: string
): Promise<WorkflowStep[]> {
  // Mock response - replace with apiGet when backend is ready
  return mockWorkflowSteps;
}

export async function getRecommendations(
  _diagnosticId: string
): Promise<SolutionRecommendation> {
  // Mock response - replace with apiGet when backend is ready
  return mockSolutions;
}
