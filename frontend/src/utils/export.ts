/**
 * Scientific data export utilities.
 * Exports real API data as CSV files with scientific metadata.
 */

import type { Research3DPoint } from '@/integration';

/**
 * Export collocation profile data as CSV.
 * Includes real scientific metadata in the header.
 */
export function exportProfileCSV(
  points: Research3DPoint[],
  variable: string,
  unit: string,
  filename?: string,
): void {
  if (points.length === 0) return;

  const headers = [
    'latitude',
    'longitude',
    'pressure_dbar',
    `argo_${variable}_${unit}`,
    `glorys_${variable}_${unit}`,
    `difference_${unit}`,
    'timestamp',
    'platform_number',
    'cycle_number',
  ];

  const rows = points.map((p) => [
    p.latitude.toFixed(4),
    p.longitude.toFixed(4),
    p.pressure.toFixed(2),
    p.argoValue.toFixed(4),
    p.glorysValue.toFixed(4),
    p.difference.toFixed(4),
    p.timestamp,
    p.platformNumber,
    p.cycleNumber,
  ]);

  const csvContent = [
    '# OceanScope Scientific Data Export',
    `# Variable: ${variable} (${unit})`,
    '# Model: GLORYS12V1',
    '# Observation: Argo Delayed Mode',
    '# Region: Bay of Bengal',
    '# Period: January 2024',
    '# Difference: GLORYS - Argo',
    '# Collocation: 0.25° grid, daily nearest-neighbour',
    '# Exported from OceanScope',
    '',
    headers.join(','),
    ...rows.map((r) => r.join(',')),
  ].join('\n');

  downloadFile(csvContent, filename || `oceanscope_${variable}_profile.csv`, 'text/csv');
}

/**
 * Export comparison summary statistics as CSV.
 */
export function exportComparisonCSV(
  measurement: Research3DPoint,
  variable: string,
  unit: string,
): void {
  const headers = [
    'metric',
    'value',
    'unit',
  ];

  const rows = [
    ['platform', measurement.platformNumber, ''],
    ['cycle', measurement.cycleNumber, ''],
    ['latitude', measurement.latitude.toFixed(4), 'degrees'],
    ['longitude', measurement.longitude.toFixed(4), 'degrees'],
    ['pressure', measurement.pressure.toFixed(2), 'dbar'],
    [`argo_${variable}`, measurement.argoValue.toFixed(4), unit],
    [`glorys_${variable}`, measurement.glorysValue.toFixed(4), unit],
    ['difference', measurement.difference.toFixed(4), unit],
    ['timestamp', measurement.timestamp, ''],
    ['model', 'GLORYS12V1', ''],
    ['observation', 'Argo Delayed Mode', ''],
    ['difference_convention', 'GLORYS - Argo', ''],
  ];

  const csvContent = [
    '# OceanScope Comparison Export',
    `# Variable: ${variable}`,
    '# Exported from OceanScope',
    '',
    headers.join(','),
    ...rows.map((r) => r.join(',')),
  ].join('\n');

  downloadFile(csvContent, `oceanscope_${variable}_comparison.csv`, 'text/csv');
}

/**
 * Export research statistics as CSV.
 */
export function exportStatsCSV(
  stats: {
    totalPoints: number;
    argoMean: number;
    glorysMean: number;
    meanDifference: number;
    rmsDifference: number;
    maxDifference: number;
    depthRange: [number, number];
  },
  variable: string,
  unit: string,
): void {
  const headers = ['metric', 'value', 'unit'];

  const rows = [
    ['total_points', String(stats.totalPoints), ''],
    ['argo_mean', stats.argoMean.toFixed(4), unit],
    ['glorys_mean', stats.glorysMean.toFixed(4), unit],
    ['mean_difference', stats.meanDifference.toFixed(4), unit],
    ['rms_difference', stats.rmsDifference.toFixed(4), unit],
    ['max_absolute_difference', stats.maxDifference.toFixed(4), unit],
    ['depth_min', stats.depthRange[0].toFixed(2), 'dbar'],
    ['depth_max', stats.depthRange[1].toFixed(2), 'dbar'],
    ['model', 'GLORYS12V1', ''],
    ['observation', 'Argo Delayed Mode', ''],
    ['variable', variable, ''],
    ['difference_convention', 'GLORYS - Argo', ''],
  ];

  const csvContent = [
    '# OceanScope Research Statistics Export',
    `# Variable: ${variable}`,
    '# Exported from OceanScope',
    '',
    headers.join(','),
    ...rows.map((r) => r.join(',')),
  ].join('\n');

  downloadFile(csvContent, `oceanscope_${variable}_stats.csv`, 'text/csv');
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
