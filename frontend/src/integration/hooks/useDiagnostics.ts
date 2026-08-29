/**
 * INTEG1 Integration Layer — useDiagnostics Hook
 *
 * Fetches diagnostic analysis and investigation workflow data, adapting them
 * for the DiagnosticPanel, InvestigationWorkflow, and SolutionsPanel components.
 *
 * Flow:
 *   Coordinates + variable + depth + date + time
 *     → getProvider().fetchDiagnostics() + fetchWorkflow()
 *       → adaptDiagnostic() + adaptWorkflowSteps() + adaptSolution()
 *         → { diagnostic, workflowSteps, solution, loading, error, refetch }
 */

import { useState, useEffect, useCallback } from 'react';
import { getProvider } from '../registry';
import {
  adaptDiagnostic,
  adaptWorkflowSteps,
  adaptSolution,
  type DiagnosticDisplayData,
  type WorkflowDisplayStep,
  type SolutionDisplayData,
} from '../adapters';
import type { OceanVariable } from '../types';

interface UseDiagnosticsParams {
  latitude: number | null;
  longitude: number | null;
  variable: OceanVariable;
  depth: number;
  date: string;
  time: string;
}

interface UseDiagnosticsResult {
  diagnostic: DiagnosticDisplayData | null;
  workflowSteps: WorkflowDisplayStep[];
  solution: SolutionDisplayData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDiagnostics({
  latitude,
  longitude,
  variable,
  depth,
  date,
  time,
}: UseDiagnosticsParams): UseDiagnosticsResult {
  const [diagnostic, setDiagnostic] = useState<DiagnosticDisplayData | null>(null);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowDisplayStep[]>([]);
  const [solution, setSolution] = useState<SolutionDisplayData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (latitude === null || longitude === null) {
      setDiagnostic(null);
      setWorkflowSteps([]);
      setSolution(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const provider = getProvider();

      // Fetch diagnostics first to get the diagnostic ID
      const diagResponse = await provider.fetchDiagnostics({
        location: { latitude, longitude, depth },
        variable,
        depth,
        date,
        time,
      });

      if (diagResponse.status === 'error') {
        setError(diagResponse.error || 'Failed to run diagnostics');
        return;
      }

      setDiagnostic(adaptDiagnostic(diagResponse));

      // Fetch workflow using the diagnostic ID
      const diagId = diagResponse.data?.id || 'unknown';
      const workflowResponse = await provider.fetchWorkflow(diagId);

      if (workflowResponse.status === 'error') {
        setError(workflowResponse.error || 'Failed to fetch workflow');
        return;
      }

      setWorkflowSteps(adaptWorkflowSteps(workflowResponse));
      setSolution(adaptSolution(workflowResponse));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }, [latitude, longitude, variable, depth, date, time]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { diagnostic, workflowSteps, solution, loading, error, refetch: fetchData };
}
