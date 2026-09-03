/**
 * Research Data Coverage Locations
 *
 * The 25 unique Argo profile locations from the GLORYS×Argo collocation dataset.
 * Each location has multiple depth-level observations across Jan 1–14, 2024.
 *
 * These are the REAL observation points where actual data exists.
 * Click any marker on the globe to zoom in and see the collocated observations.
 */

export interface DataCoveragePoint {
  latitude: number;
  longitude: number;
  /** Number of approximate unique depth levels per profile */
  depthLevels: number;
}

export const RESEARCH_DATA_COVERAGE: DataCoveragePoint[] = [
  { latitude: 7.80, longitude: 88.28, depthLevels: 45 },
  { latitude: 7.85, longitude: 88.05, depthLevels: 42 },
  { latitude: 8.25, longitude: 89.27, depthLevels: 48 },
  { latitude: 8.38, longitude: 85.86, depthLevels: 40 },
  { latitude: 8.62, longitude: 89.65, depthLevels: 50 },
  { latitude: 8.72, longitude: 85.31, depthLevels: 38 },
  { latitude: 9.48, longitude: 89.75, depthLevels: 46 },
  { latitude: 10.76, longitude: 83.92, depthLevels: 44 },
  { latitude: 10.84, longitude: 83.86, depthLevels: 47 },
  { latitude: 10.94, longitude: 83.47, depthLevels: 43 },
  { latitude: 11.27, longitude: 83.72, depthLevels: 41 },
  { latitude: 12.07, longitude: 89.45, depthLevels: 49 },
  { latitude: 12.22, longitude: 87.40, depthLevels: 52 },
  { latitude: 12.65, longitude: 84.76, depthLevels: 45 },
  { latitude: 12.79, longitude: 84.08, depthLevels: 44 },
  { latitude: 13.07, longitude: 89.98, depthLevels: 46 },
  { latitude: 13.32, longitude: 86.82, depthLevels: 48 },
  { latitude: 13.52, longitude: 85.72, depthLevels: 47 },
  { latitude: 13.65, longitude: 87.59, depthLevels: 45 },
  { latitude: 13.91, longitude: 90.26, depthLevels: 43 },
  { latitude: 14.06, longitude: 90.03, depthLevels: 44 },
  { latitude: 14.08, longitude: 89.27, depthLevels: 46 },
  { latitude: 14.45, longitude: 86.63, depthLevels: 42 },
  { latitude: 15.27, longitude: 89.04, depthLevels: 48 },
  { latitude: 15.52, longitude: 89.01, depthLevels: 45 },
];
