/**
 * INTEG1 Integration Layer — Discrepancy Data Adapter
 *
 * Normalizes discrepancy responses into shapes the DiscrepancyMap component consumes.
 */

import type { DiscrepancyResult, ProviderResponse } from '../types';

// ── Shape expected by DiscrepancyMap ──────────────────────────────────────────

export interface DiscrepancyDisplayPoint {
  latitude: number;
  longitude: number;
  depth: number;
  errorMagnitude: number;
  variable: string;
}

// ── Adapter ───────────────────────────────────────────────────────────────────

/**
 * Convert provider discrepancy response into display points for the heatmap.
 */
export function adaptDiscrepancy(
  response: ProviderResponse<DiscrepancyResult>
): DiscrepancyDisplayPoint[] {
  if (response.status !== 'success' || !response.data) return [];

  return response.data.points.map((p) => ({
    latitude: p.latitude,
    longitude: p.longitude,
    depth: p.depth,
    errorMagnitude: p.errorMagnitude,
    variable: p.variable,
  }));
}

/**
 * Extract summary statistics for the discrepancy panel header.
 */
export function adaptDiscrepancyStats(
  response: ProviderResponse<DiscrepancyResult>
): { meanError: number; maxError: number; rmsError: number; totalPoints: number } | null {
  if (response.status !== 'success' || !response.data) return null;
  return response.data.stats;
}
