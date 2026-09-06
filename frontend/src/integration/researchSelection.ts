import type { Research3DPoint } from './types';

/** Maximum dbar distance allowed when mapping a UI depth to a real record. */
export const RESEARCH_NEAREST_MATCH_TOLERANCE = 50;

/**
 * Returns an existing collocated record nearest to the requested depth.
 * No value is created or interpolated when no real record is sufficiently close.
 */
export function findNearestResearchMeasurement(
  profilePoints: Research3DPoint[],
  selectedDepth: number,
): Research3DPoint | null {
  if (profilePoints.length === 0) return null;

  let nearest = profilePoints[0];
  let nearestDistance = Math.abs(nearest.pressure - selectedDepth);

  for (const point of profilePoints) {
    const distance = Math.abs(point.pressure - selectedDepth);
    if (distance < nearestDistance) {
      nearest = point;
      nearestDistance = distance;
    }
  }

  return nearestDistance <= RESEARCH_NEAREST_MATCH_TOLERANCE ? nearest : null;
}
