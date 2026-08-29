import type { Location, OceanVariable } from '@/types/ocean';
import { mockVerticalProfile } from '@/mocks/comparison';
import type { VerticalProfilePoint } from '@/types/model';

export async function fetchVerticalProfile(
  _location: Location,
  _variable: OceanVariable
): Promise<VerticalProfilePoint[]> {
  // Mock response - replace with apiGet when backend is ready
  return mockVerticalProfile;
}
