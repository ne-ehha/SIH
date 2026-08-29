import type { ModelComparison, VerticalProfilePoint } from '@/types/model';
import type { ModelHealth } from '@/types/model';

export const mockModelComparison: ModelComparison = {
  modelValue: 26.0,
  observationValue: 27.1,
  difference: -1.1,
  unit: '°C',
  variable: 'Sea Surface Temperature',
};

export const mockVerticalProfile: VerticalProfilePoint[] = [
  { depth: 0, modelValue: 27.5, observationValue: 28.1 },
  { depth: 10, modelValue: 27.2, observationValue: 27.8 },
  { depth: 25, modelValue: 26.8, observationValue: 27.2 },
  { depth: 50, modelValue: 25.1, observationValue: 25.8 },
  { depth: 75, modelValue: 23.5, observationValue: 24.2 },
  { depth: 100, modelValue: 21.0, observationValue: 21.8 },
  { depth: 150, modelValue: 17.5, observationValue: 18.1 },
  { depth: 200, modelValue: 14.2, observationValue: 14.8 },
  { depth: 300, modelValue: 10.5, observationValue: 11.0 },
  { depth: 400, modelValue: 8.2, observationValue: 8.5 },
  { depth: 500, modelValue: 6.1, observationValue: 6.3 },
  { depth: 750, modelValue: 4.2, observationValue: 4.1 },
  { depth: 1000, modelValue: 2.8, observationValue: 2.7 },
];

export const mockModelHealth: ModelHealth = {
  score: 76,
  status: 'good',
  summary: 'Some subsurface bias detected in temperature profiles',
};

export const mockDiscrepancyData = [
  { latitude: 14.5, longitude: 88.5, depth: 100, errorMagnitude: 1.5, variable: 'temperature' },
  { latitude: 15.0, longitude: 89.0, depth: 150, errorMagnitude: 2.1, variable: 'temperature' },
  { latitude: 13.8, longitude: 87.2, depth: 200, errorMagnitude: -1.8, variable: 'temperature' },
  { latitude: 16.2, longitude: 90.5, depth: 75, errorMagnitude: 0.9, variable: 'salinity' },
  { latitude: 12.0, longitude: 86.0, depth: 300, errorMagnitude: -2.3, variable: 'temperature' },
  { latitude: 17.5, longitude: 91.0, depth: 50, errorMagnitude: 1.2, variable: 'salinity' },
  { latitude: 11.5, longitude: 84.5, depth: 500, errorMagnitude: -0.7, variable: 'temperature' },
  { latitude: 19.0, longitude: 88.0, depth: 125, errorMagnitude: 1.8, variable: 'temperature' },
  { latitude: 10.0, longitude: 89.5, depth: 250, errorMagnitude: -1.4, variable: 'salinity' },
  { latitude: 15.5, longitude: 86.8, depth: 100, errorMagnitude: 0.6, variable: 'temperature' },
];
