/**
 * INTEG1 Integration Layer — Observation Data Adapter
 *
 * Normalizes observation responses into shapes the ObservationPoints component consumes.
 */

import type { ObservationResult, ObservationStation, ProviderResponse } from '../types';

// ── Shape expected by ObservationPoints overlay ───────────────────────────────

export interface ObservationDisplayPoint {
  id: string;
  latitude: number;
  longitude: number;
  depth: number;
  status: 'active' | 'inactive' | 'pending';
  type: string;
  label: string;
}

// ── Shape expected by SelectedLocationPanel (nearest observation) ──────────────

export interface NearestObservation {
  id: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  type: string;
  temperature?: number;
  salinity?: number;
}

// ── Adapters ──────────────────────────────────────────────────────────────────

/**
 * Convert provider observation response into display points for the globe overlay.
 * Only returns active stations for the sidebar list.
 */
export function adaptObservations(
  response: ProviderResponse<ObservationResult>
): ObservationDisplayPoint[] {
  if (response.status !== 'success' || !response.data) return [];

  return response.data.stations.map((s) => ({
    id: s.id,
    latitude: s.latitude,
    longitude: s.longitude,
    depth: s.depth,
    status: s.status,
    type: s.type,
    label: `${s.id} (${s.type})`,
  }));
}

/**
 * Find the nearest observation station to a given coordinate.
 */
export function adaptNearestObservation(
  stations: ObservationStation[],
  targetLat: number,
  targetLng: number
): NearestObservation | null {
  if (stations.length === 0) return null;

  let nearest = stations[0];
  let minDist = Infinity;

  for (const station of stations) {
    const dLat = station.latitude - targetLat;
    const dLng = station.longitude - targetLng;
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    if (dist < minDist) {
      minDist = dist;
      nearest = station;
    }
  }

  // Approximate distance in km (1 degree ≈ 111 km at equator)
  const distKm = minDist * 111;

  return {
    id: nearest.id,
    latitude: nearest.latitude,
    longitude: nearest.longitude,
    distanceKm: +distKm.toFixed(1),
    type: nearest.type,
    temperature: nearest.temperature,
    salinity: nearest.salinity,
  };
}
