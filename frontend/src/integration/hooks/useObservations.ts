/**
 * INTEG1 Integration Layer — useObservations Hook
 *
 * Fetches observation stations in a region and adapts them for the
 * ObservationPoints overlay and nearest-observation lookups.
 *
 * Flow:
 *   Region + bounds + date
 *     → getProvider().fetchObservations()
 *       → adaptObservations() + adaptNearestObservation()
 *         → { stations, totalActive, totalPending, nearestObservation, loading, error, refetch }
 */

import { useState, useEffect, useCallback } from 'react';
import { getProvider } from '../registry';
import { adaptObservations, adaptNearestObservation, type ObservationDisplayPoint, type NearestObservation } from '../adapters';
import type { Bounds } from '../types';
import { regions } from '@/config/regions';

interface UseObservationsParams {
  regionId: string;
  selectedLat?: number | null;
  selectedLng?: number | null;
  date: string;
}

interface UseObservationsResult {
  stations: ObservationDisplayPoint[];
  totalActive: number;
  totalPending: number;
  nearestObservation: NearestObservation | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useObservations({
  regionId,
  selectedLat,
  selectedLng,
  date,
}: UseObservationsParams): UseObservationsResult {
  const [stations, setStations] = useState<ObservationDisplayPoint[]>([]);
  const [totalActive, setTotalActive] = useState(0);
  const [totalPending, setTotalPending] = useState(0);
  const [nearestObservation, setNearestObservation] = useState<NearestObservation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const region = regions.find((r) => r.id === regionId);
    if (!region) {
      setError('Invalid region');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const provider = getProvider();
      const response = await provider.fetchObservations({
        region: regionId,
        bounds: region.bounds,
        date,
      });

      if (response.status === 'error') {
        setError(response.error || 'Failed to fetch observations');
      } else if (response.data) {
        const obsPoints = adaptObservations(response);
        setStations(obsPoints);
        setTotalActive(response.data.totalActive);
        setTotalPending(response.data.totalPending);

        // Find nearest observation if a location is selected
        if (selectedLat !== null && selectedLng !== null && selectedLat !== undefined && selectedLng !== undefined) {
          const nearest = adaptNearestObservation(
            response.data.stations,
            selectedLat,
            selectedLng
          );
          setNearestObservation(nearest);
        } else {
          setNearestObservation(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }, [regionId, selectedLat, selectedLng, date]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { stations, totalActive, totalPending, nearestObservation, loading, error, refetch: fetchData };
}
