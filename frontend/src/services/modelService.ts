import type { Location, OceanVariable } from '@/types/ocean';
import { mockModelComparison, mockModelHealth } from '@/mocks/comparison';
import type { ModelComparison, ModelHealth } from '@/types/model';

export async function fetchModelComparison(
  _location: Location,
  _variable: OceanVariable,
  _depth: number
): Promise<ModelComparison> {
  // Mock response - replace with apiGet when backend is ready
  return mockModelComparison;
}

export async function fetchModelHealth(): Promise<ModelHealth> {
  // Mock response - replace with apiGet when backend is ready
  return mockModelHealth;
}
