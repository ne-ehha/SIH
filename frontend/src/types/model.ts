export interface ModelDataPoint {
  latitude: number;
  longitude: number;
  depth: number;
  value: number;
  variable: string;
  timestamp: string;
  modelName: string;
}

export interface ModelComparison {
  modelValue: number;
  observationValue: number;
  difference: number;
  unit: string;
  variable: string;
}

export interface VerticalProfilePoint {
  depth: number;
  modelValue: number;
  observationValue: number;
  comparisonModelValue?: number;
}

export interface ModelHealth {
  score: number;
  status: 'excellent' | 'good' | 'fair' | 'poor';
  summary: string;
}
