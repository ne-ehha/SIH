/**
 * INTEG1 Integration Layer — Visualization Data Adapter
 *
 * Normalizes 3D visualization responses into shapes the Ocean3DView
 * component's SurfaceLayerViz, DepthSliceViz, and ProfileViz consume.
 */

import type { Visualization3DResult, ProviderResponse, VerticalProfilePoint } from '../types';

// ── Shape expected by SurfaceLayerViz ─────────────────────────────────────────

export interface SurfaceGridCell {
  latitude: number;
  longitude: number;
  value: number;
  unit: string;
}

// ── Shape expected by DepthSliceViz ───────────────────────────────────────────

export interface DepthSliceDisplay {
  depth: number;
  meanValue: number;
  unit: string;
  percentage: number; // normalized 0-100 for bar width
}

// ── Shape expected by ProfileViz (SVG chart) ─────────────────────────────────

export interface ProfileChartPoint {
  depth: number;
  modelValue: number;
  observationValue: number;
}

// ── Adapters ──────────────────────────────────────────────────────────────────

/**
 * Extract surface grid cells for the heatmap visualization.
 */
export function adaptSurfaceLayer(
  response: ProviderResponse<Visualization3DResult>
): SurfaceGridCell[] {
  if (response.status !== 'success' || !response.data) return [];
  return response.data.surfaceLayer;
}

/**
 * Extract depth slices with normalized percentages for bar chart rendering.
 */
export function adaptDepthSlices(
  response: ProviderResponse<Visualization3DResult>
): DepthSliceDisplay[] {
  if (response.status !== 'success' || !response.data) return [];

  const slices = response.data.depthSlices;
  const maxVal = Math.max(...slices.map((s) => s.meanValue));

  return slices.map((s) => ({
    depth: s.depth,
    meanValue: s.meanValue,
    unit: s.unit,
    percentage: maxVal > 0 ? (s.meanValue / maxVal) * 100 : 0,
  }));
}

/**
 * Extract vertical profile data for the SVG chart.
 */
export function adaptProfileForChart(
  response: ProviderResponse<Visualization3DResult>
): ProfileChartPoint[] {
  if (response.status !== 'success' || !response.data) return [];
  return response.data.verticalProfile;
}
