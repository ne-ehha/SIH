/**
 * INTEG1 Integration Layer — Diagnostics Data Adapter
 *
 * Normalizes diagnostic and workflow responses into shapes the
 * DiagnosticPanel, InvestigationWorkflow, and SolutionsPanel components consume.
 */

import type {
  DiagnosticResult,
  WorkflowResult,
  ProviderResponse,
  DiagnosticCause,
  DiagnosticStepStatus,
} from '../types';

// ── Shape expected by DiagnosticPanel ─────────────────────────────────────────

export interface DiagnosticDisplayData {
  id: string;
  possibleCause: string;
  confidence: 'low' | 'medium' | 'high';
  evidence: string[];
  status: DiagnosticStepStatus;
  errorFingerprint?: string;
  allCauses: DiagnosticCause[];
}

// ── Shape expected by InvestigationWorkflow ───────────────────────────────────

export interface WorkflowDisplayStep {
  id: string;
  title: string;
  description: string;
  status: DiagnosticStepStatus;
  icon?: string;
}

// ── Shape expected by SolutionsPanel ──────────────────────────────────────────

export interface SolutionDisplayData {
  id: string;
  recommendedTest: string;
  expectedOutcome: string;
  caution: string;
  status: DiagnosticStepStatus;
}

// ── Adapters ──────────────────────────────────────────────────────────────────

/**
 * Convert provider diagnostic response into display data.
 * Flattens the topCause into the legacy single-cause shape.
 */
export function adaptDiagnostic(
  response: ProviderResponse<DiagnosticResult>
): DiagnosticDisplayData | null {
  if (response.status !== 'success' || !response.data) return null;

  const { topCause } = response.data;
  return {
    id: response.data.id,
    possibleCause: topCause.name,
    confidence: topCause.confidence,
    evidence: topCause.evidence,
    status: response.data.status,
    errorFingerprint: response.data.errorFingerprint,
    allCauses: response.data.possibleCauses,
  };
}

/**
 * Convert provider workflow response into display steps.
 */
export function adaptWorkflowSteps(
  response: ProviderResponse<WorkflowResult>
): WorkflowDisplayStep[] {
  if (response.status !== 'success' || !response.data) return [];
  return response.data.steps;
}

/**
 * Convert provider workflow response into solution display data.
 */
export function adaptSolution(
  response: ProviderResponse<WorkflowResult>
): SolutionDisplayData | null {
  if (response.status !== 'success' || !response.data || !response.data.solution) return null;

  const { solution } = response.data;
  return {
    id: solution.id,
    recommendedTest: solution.recommendedTest,
    expectedOutcome: solution.expectedOutcome,
    caution: solution.caution,
    status: solution.status,
  };
}
