import type { Location } from '@/types/ocean';
import type { ObservationPoint } from '@/types/observation';
import { mockObservations } from '@/mocks/observations';

export async function fetchObservations(
  _region: string,
  _bounds?: { north: number; south: number; east: number; west: number }
): Promise<ObservationPoint[]> {
  // Mock response - replace with apiGet when backend is ready
  return mockObservations;
}

export async function fetchObservationById(
  id: string
): Promise<ObservationPoint | null> {
  // Mock response - replace with apiGet when backend is ready
  return mockObservations.find((o) => o.id === id) || null;
}

export async function fetchNearestObservation(
  _location: Location
): Promise<ObservationPoint | null> {
  // Mock response - replace with apiGet when backend is ready
  return mockObservations[0] || null;
}
