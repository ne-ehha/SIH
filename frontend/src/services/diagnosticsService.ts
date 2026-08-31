import { getProvider } from '@/integration';
import { adaptDiagnostic, adaptWorkflowSteps, adaptSolution } from '@/integration/adapters';
import type { DiagnosticResult, WorkflowStep, SolutionRecommendation } from '@/types/diagnostics';
import type { OceanVariable } from '@/types/ocean';
import type { Location } from '@/types/ocean';
import { useOceanStore } from '@/state/oceanStore';

// Cache the last diagnostic ID for workflow lookups
let lastDiagnosticId: string | null = null;

export async function runDiagnostics(
  location: Location,
  variable: OceanVariable,
  depth: number
): Promise<DiagnosticResult> {
  const { selectedDate, selectedTime } = useOceanStore.getState();
  const provider = getProvider();
  const response = await provider.fetchDiagnostics({
    location: {
      latitude: location.latitude,
      longitude: location.longitude,
      depth,
    },
    variable,
    depth,
    date: selectedDate,
    time: selectedTime,
  });

  if (response.status === 'error') {
    throw new Error(response.error || 'Failed to run diagnostics');
  }

  const adapted = adaptDiagnostic(response);
  if (!adapted) {
    throw new Error('No diagnostic result available');
  }

  // Cache the diagnostic ID for workflow lookups
  if (response.data?.id) {
    lastDiagnosticId = response.data.id;
  }

  return adapted;
}

export async function getWorkflowSteps(
  diagnosticId?: string
): Promise<WorkflowStep[]> {
  const id = diagnosticId || lastDiagnosticId;
  if (!id) {
    throw new Error('No diagnostic ID available. Run diagnostics first.');
  }

  const provider = getProvider();
  const response = await provider.fetchWorkflow(id);

  if (response.status === 'error') {
    throw new Error(response.error || 'Failed to fetch workflow steps');
  }

  return adaptWorkflowSteps(response);
}

export async function getRecommendations(
  diagnosticId?: string
): Promise<SolutionRecommendation | null> {
  const id = diagnosticId || lastDiagnosticId;
  if (!id) {
    throw new Error('No diagnostic ID available. Run diagnostics first.');
  }

  const provider = getProvider();
  const response = await provider.fetchWorkflow(id);

  if (response.status === 'error') {
    throw new Error(response.error || 'Failed to fetch recommendations');
  }

  return adaptSolution(response);
}
