/**
 * INTEG1 Integration Layer — Comparison Data Adapter
 *
 * Normalizes provider comparison responses into shapes the existing
 * ModelObservationComparison and ModelHealthCard components consume.
 *
 * This decouples Tanmay's components from the raw provider contract —
 * if the backend changes response shapes, only adapters need updating.
 */

import type {
  ModelComparisonResult,
  VerticalProfileResult,
  ProviderResponse,
} from '../types';

// ── Shape expected by ModelObservationComparison ──────────────────────────────

export interface ComparisonDisplayData {
  modelValue: number;
  observationValue: number;
  difference: number;
  unit: string;
  variable: string;
  observationLatitude?: number;
  observationLongitude?: number;
  nearestDistance?: number;
  sourceModel?: string;
  sourceObservation?: string;
}

// ── Shape expected by ModelHealthCard ─────────────────────────────────────────

export interface HealthDisplayData {
  score: number;
  status: 'excellent' | 'good' | 'fair' | 'poor';
  summary: string;
}

// ── Shape expected by VerticalProfile (recharts) ──────────────────────────────

export interface ProfileDisplayPoint {
  depth: number;
  depthLabel: string;
  modelValue: number;
  observationValue: number;
  comparisonModelValue?: number;
}

// ── Adapter functions ─────────────────────────────────────────────────────────

/**
 * Convert a provider comparison result into the display shape
 * used by the ModelObservationComparison component.
 */
export function adaptComparison(
  response: ProviderResponse<ModelComparisonResult>
): ComparisonDisplayData | null {
  if (response.status !== 'success' || !response.data) return null;

  const { point } = response.data;
  return {
    modelValue: point.modelValue,
    observationValue: point.observationValue,
    difference: point.difference,
    unit: point.unit,
    variable: point.variable,
    observationLatitude: response.data.observationLatitude,
    observationLongitude: response.data.observationLongitude,
    nearestDistance: response.data.nearestDistance,
    sourceModel: response.data.sourceModel,
    sourceObservation: response.data.sourceObservation,
  };
}

/**
 * Convert a provider comparison result into the health display shape.
 */
export function adaptHealth(
  response: ProviderResponse<ModelComparisonResult>
): HealthDisplayData | null {
  if (response.status !== 'success' || !response.data) return null;

  const { healthScore, healthStatus, healthSummary } = response.data;
  return {
    score: healthScore,
    status: healthStatus,
    summary: healthSummary,
  };
}

/**
 * Convert a provider vertical profile result into the display shape
 * used by the VerticalProfile recharts component.
 */
export function adaptVerticalProfile(
  response: ProviderResponse<VerticalProfileResult>
): ProfileDisplayPoint[] {
  if (response.status !== 'success' || !response.data) return [];

  return response.data.points.map((p) => ({
    depth: p.depth,
    depthLabel: `${p.depth}m`,
    modelValue: p.modelValue,
    observationValue: p.observationValue,
    comparisonModelValue: p.altModelValue,
  }));
}
