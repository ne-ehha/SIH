/**
 * INTEG1 Integration Layer — useModelComparison Hook
 *
 * Fetches model vs observation comparison data and adapts it for the
 * ModelObservationComparison and ModelHealthCard components.
 *
 * Flow:
 *   Coordinates + variable + depth (from zustand store)
 *     → getProvider().fetchComparison()
 *       → adaptComparison() / adaptHealth()
 *         → { comparison, health, loading, error, refetch }
 */

import { useState, useEffect, useCallback } from 'react';
import { getProvider } from '../registry';
import { adaptComparison, adaptHealth, type ComparisonDisplayData, type HealthDisplayData } from '../adapters';
import type { OceanVariable } from '../types';

interface UseModelComparisonParams {
  latitude: number | null;
  longitude: number | null;
  variable: OceanVariable;
  depth: number;
  date: string;
  time: string;
}

interface UseModelComparisonResult {
  comparison: ComparisonDisplayData | null;
  health: HealthDisplayData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useModelComparison({
  latitude,
  longitude,
  variable,
  depth,
  date,
  time,
}: UseModelComparisonParams): UseModelComparisonResult {
  const [comparison, setComparison] = useState<ComparisonDisplayData | null>(null);
  const [health, setHealth] = useState<HealthDisplayData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (latitude === null || longitude === null) {
      setComparison(null);
      setHealth(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const provider = getProvider();
      const response = await provider.fetchComparison({
        location: { latitude, longitude, depth },
        variable,
        depth,
        date,
        time,
      });

      if (response.status === 'error') {
        setError(response.error || 'Failed to fetch comparison data');
      } else {
        setComparison(adaptComparison(response));
        setHealth(adaptHealth(response));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }, [latitude, longitude, variable, depth, date, time]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { comparison, health, loading, error, refetch: fetchData };
}
