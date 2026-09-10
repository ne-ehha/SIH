import type { VariableConfig } from '@/types/ocean';

/**
 * Variable registry (display layer).
 *
 * `available` reflects whether a REAL dataset for the variable is connected.
 * currents_u/v remain architecture-only: the collocation dataset contains no
 * GLORYS U/V fields, so they are shown as unavailable — never simulated.
 */
export const variables: VariableConfig[] = [
  {
    id: 'temperature',
    label: 'Temperature',
    unit: '°C',
    colorScale: ['#0000ff', '#00ffff', '#ffff00', '#ff0000'],
    available: true,
  },
  {
    id: 'salinity',
    label: 'Salinity',
    unit: 'PSU',
    colorScale: ['#f7fbff', '#6baed6', '#08306b'],
    available: true,
  },
  {
    id: 'currents_u',
    label: 'Currents (U)',
    unit: 'm/s',
    colorScale: ['#d73027', '#ffffbf', '#4575b4'],
    available: false,
    availabilityNote:
      'Eastward velocity requires the GLORYS U/V model fields, which are not in the current collocation dataset. No values are shown rather than fabricating currents.',
  },
  {
    id: 'currents_v',
    label: 'Currents (V)',
    unit: 'm/s',
    colorScale: ['#d73027', '#ffffbf', '#4575b4'],
    available: false,
    availabilityNote:
      'Northward velocity requires the GLORYS U/V model fields, which are not in the current collocation dataset. No values are shown rather than fabricating currents.',
  },
];

export const defaultVariable = variables[0];
