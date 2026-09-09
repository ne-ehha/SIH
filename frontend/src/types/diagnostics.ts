export type DiagnosticStatus = 'inactive' | 'active' | 'complete' | 'loading';

export interface DiagnosticCauseItem {
  name: string;
  confidence: 'low' | 'medium' | 'high';
  evidence: string[];
}

export interface DiagnosticResult {
  id: string;
  possibleCause: string;
  confidence: 'low' | 'medium' | 'high';
  evidence: string[];
  status: DiagnosticStatus;
  errorFingerprint?: string;
  /** All candidate causes returned by the diagnostics API (when available). */
  allCauses?: DiagnosticCauseItem[];
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
