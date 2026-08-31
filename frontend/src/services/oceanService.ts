import { getProvider } from '@/integration';
import { adaptVerticalProfile } from '@/integration/adapters';
import type { VerticalProfilePoint } from '@/types/model';
import type { Location, OceanVariable } from '@/types/ocean';
import { useOceanStore } from '@/state/oceanStore';

export async function fetchVerticalProfile(
  location: Location,
  variable: OceanVariable
): Promise<VerticalProfilePoint[]> {
  const { selectedDate, selectedTime } = useOceanStore.getState();
  const provider = getProvider();
  const response = await provider.fetchVerticalProfile({
    location: {
      latitude: location.latitude,
      longitude: location.longitude,
    },
    variable,
    date: selectedDate,
    time: selectedTime,
  });

  if (response.status === 'error') {
    throw new Error(response.error || 'Failed to fetch profile data');
  }

  const adapted = adaptVerticalProfile(response);

  // Map ProfileDisplayPoint[] to VerticalProfilePoint[]
  // (adds depthLabel, removes extra fields the component doesn't need)
  return adapted.map((p) => ({
    depth: p.depth,
    modelValue: p.modelValue,
    observationValue: p.observationValue,
    comparisonModelValue: p.comparisonModelValue,
  }));
}
