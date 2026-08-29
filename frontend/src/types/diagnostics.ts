export type DiagnosticStatus = 'inactive' | 'active' | 'complete' | 'loading';

export interface DiagnosticResult {
  id: string;
  possibleCause: string;
  confidence: 'low' | 'medium' | 'high';
  evidence: string[];
  status: DiagnosticStatus;
  errorFingerprint?: string;
}

export interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  status: DiagnosticStatus;
  icon?: string;
}

export interface SolutionRecommendation {
  id: string;
  recommendedTest: string;
  expectedOutcome: string;
  caution: string;
  status: DiagnosticStatus;
}

export interface DiscrepancyData {
  latitude: number;
  longitude: number;
  depth: number;
  errorMagnitude: number;
  variable: string;
}
