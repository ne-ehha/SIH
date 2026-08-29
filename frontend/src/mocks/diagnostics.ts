import type { DiagnosticResult, WorkflowStep, SolutionRecommendation } from '@/types/diagnostics';

export const mockDiagnosticResult: DiagnosticResult = {
  id: 'diag-001',
  possibleCause: 'Vertical Mixing Parameterization',
  confidence: 'medium',
  evidence: [
    'Subsurface temperature bias concentrated at 100-300m depth',
    'Surface temperature relatively accurate',
    'Persistent bias pattern across multiple time steps',
    'Similar bias observed in adjacent grid points',
  ],
  status: 'success',
  errorFingerprint: 'SUBSURFACE_WARM_BIAS_MIXING',
};

export const mockWorkflowSteps: WorkflowStep[] = [
  {
    id: 'step-1',
    title: 'Detect',
    description: 'High temperature bias detected',
    status: 'complete',
  },
  {
    id: 'step-2',
    title: 'Analyze',
    description: 'Pattern consistent across multiple days',
    status: 'complete',
  },
  {
    id: 'step-3',
    title: 'Diagnose',
    description: 'Possible causes identified',
    status: 'active',
  },
  {
    id: 'step-4',
    title: 'Solutions',
    description: 'Recommended experiments',
    status: 'inactive',
  },
  {
    id: 'step-5',
    title: 'Evaluate',
    description: 'Compare results',
    status: 'inactive',
  },
];

export const mockSolutions: SolutionRecommendation = {
  id: 'sol-001',
  recommendedTest: 'Alternative vertical mixing configuration (k-ω vs k-ε)',
  expectedOutcome: 'Check whether subsurface temperature error decreases while surface accuracy is maintained',
  caution: 'This diagnostic analysis does not establish causality. Results should be validated against multiple independent observations.',
  status: 'success',
};
