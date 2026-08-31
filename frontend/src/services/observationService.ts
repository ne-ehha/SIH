import { getProvider } from '@/integration';
import { adaptObservations } from '@/integration/adapters';
import type { ObservationPoint } from '@/types/observation';
import type { Location } from '@/types/ocean';
import { useOceanStore } from '@/state/oceanStore';

export async function fetchObservations(
  _region: string,
  _bounds?: { north: number; south: number; east: number; west: number }
): Promise<ObservationPoint[]> {
  const { selectedDate } = useOceanStore.getState();
  const provider = getProvider();
  const response = await provider.fetchObservations({
    region: _region,
    bounds: _bounds,
    date: selectedDate,
  });

  if (response.status === 'error') {
    throw new Error(response.error || 'Failed to fetch observations');
  }

  if (!response.data) return [];

  // Map from INTEG1 ObservationDisplayPoint to legacy ObservationPoint
  return response.data.stations.map((s) => ({
    id: s.id,
    latitude: s.latitude,
    longitude: s.longitude,
    timestamp: s.timestamp,
    depth: s.depth,
    status: s.status,
    type: s.type,
    temperature: s.temperature,
    salinity: s.salinity,
  }));
}

export async function fetchObservationById(
  id: string
): Promise<ObservationPoint | null> {
  const provider = getProvider();
  const response = await provider.fetchObservations({
    region: 'bay-of-bengal',
    date: useOceanStore.getState().selectedDate,
  });

  if (response.status !== 'success' || !response.data) return null;

  const station = response.data.stations.find((s) => s.id === id);
  if (!station) return null;

  return {
    id: station.id,
    latitude: station.latitude,
    longitude: station.longitude,
    timestamp: station.timestamp,
    depth: station.depth,
    status: station.status,
    type: station.type,
    temperature: station.temperature,
    salinity: station.salinity,
  };
}

export async function fetchNearestObservation(
  _location: Location
): Promise<ObservationPoint | null> {
  const provider = getProvider();
  const response = await provider.fetchObservations({
    region: 'bay-of-bengal',
    date: useOceanStore.getState().selectedDate,
  });

  if (response.status !== 'success' || !response.data || response.data.stations.length === 0) {
    return null;
  }

  // Find nearest by distance
  const { adaptNearestObservation } = await import('@/integration/adapters');
  const nearest = adaptNearestObservation(
    response.data.stations,
    _location.latitude,
    _location.longitude
  );

  if (!nearest) return null;

  return {
    id: nearest.id,
    latitude: nearest.latitude,
    longitude: nearest.longitude,
    timestamp: '',
    depth: 0,
    status: 'active',
    type: nearest.type as ObservationPoint['type'],
    temperature: nearest.temperature,
    salinity: nearest.salinity,
  };
}
