/**
 * INTEG1 Integration Layer — useVerticalProfile Hook
 *
 * Fetches vertical profile data (temperature/salinity across depths)
 * and adapts it for the VerticalProfile recharts component.
 *
 * Flow:
 *   Coordinates + variable + date + time
 *     → getProvider().fetchVerticalProfile()
 *       → adaptVerticalProfile()
 *         → { profileData, loading, error, refetch }
 */

import { useState, useEffect, useCallback } from 'react';
import { getProvider } from '../registry';
import { adaptVerticalProfile, type ProfileDisplayPoint } from '../adapters';
import type { OceanVariable } from '../types';

interface UseVerticalProfileParams {
  latitude: number | null;
  longitude: number | null;
  variable: OceanVariable;
  date: string;
  time: string;
}

interface UseVerticalProfileResult {
  profileData: ProfileDisplayPoint[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useVerticalProfile({
  latitude,
  longitude,
  variable,
  date,
  time,
}: UseVerticalProfileParams): UseVerticalProfileResult {
  const [profileData, setProfileData] = useState<ProfileDisplayPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (latitude === null || longitude === null) {
      setProfileData([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const provider = getProvider();
      const response = await provider.fetchVerticalProfile({
        location: { latitude, longitude },
        variable,
        date,
        time,
      });

      if (response.status === 'error') {
        setError(response.error || 'Failed to fetch profile data');
      } else {
        setProfileData(adaptVerticalProfile(response));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }, [latitude, longitude, variable, date, time]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { profileData, loading, error, refetch: fetchData };
}
