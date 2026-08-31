import { getProvider } from '@/integration';
import { adaptComparison, adaptHealth } from '@/integration/adapters';
import type { ModelComparison, ModelHealth } from '@/types/model';
import type { OceanVariable } from '@/types/ocean';
import type { Location } from '@/types/ocean';
import { useOceanStore } from '@/state/oceanStore';

export async function fetchModelComparison(
  location: Location,
  variable: OceanVariable,
  _depth: number
): Promise<ModelComparison> {
  const { selectedDate, selectedTime } = useOceanStore.getState();
  const provider = getProvider();
  const response = await provider.fetchComparison({
    location: {
      latitude: location.latitude,
      longitude: location.longitude,
      depth: _depth,
    },
    variable,
    depth: _depth,
    date: selectedDate,
    time: selectedTime,
  });

  if (response.status === 'error') {
    throw new Error(response.error || 'Failed to fetch comparison data');
  }

  const adapted = adaptComparison(response);
  if (!adapted) {
    throw new Error('No comparison data available');
  }

  return adapted;
}

export async function fetchModelHealth(): Promise<ModelHealth | null> {
  // Health comes from the comparison endpoint, which requires a location.
  // Use the current store location if available.
  const location = useOceanStore.getState().selectedLocation;
  if (!location) return null;

  const variable = useOceanStore.getState().selectedVariable;
  const depth = useOceanStore.getState().selectedDepth;

  const provider = getProvider();
  const response = await provider.fetchComparison({
    location: {
      latitude: location.latitude,
      longitude: location.longitude,
      depth,
    },
    variable,
    depth,
    date: useOceanStore.getState().selectedDate,
    time: useOceanStore.getState().selectedTime,
  });

  if (response.status === 'error') {
    throw new Error(response.error || 'Failed to fetch health data');
  }

  const adapted = adaptHealth(response);
  if (!adapted) return null;

  return adapted;
}
