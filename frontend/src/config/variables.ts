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
    id: 'currents',
    label: 'Currents (Velocity & Flow)',
    unit: 'm/s',
    colorScale: ['#7b3294', '#c2a5cf', '#f7f7f7', '#a6dba0', '#008837'],
    available: true,
    availabilityNote: 'Operational current vectors computed from eastward (uo) and northward (vo) velocities with derived speed magnitude and flow heading.',
  },
  {
    id: 'chl',
    label: 'Chlorophyll-a',
    unit: 'mg/m³',
    colorScale: ['#00441b', '#238b45', '#66c2a4', '#ccece6', '#f7fcfd'],
    available: true,
    availabilityNote: 'Biogeochemical mass concentration (depth-resolved model or surface-only satellite L4 observation).',
  },
  {
    id: 'currents_u',
    label: 'Currents (U - Eastward)',
    unit: 'm/s',
    colorScale: ['#d73027', '#ffffbf', '#4575b4'],
    available: true,
    availabilityNote: 'Zonal (eastward) current velocity component.',
  },
  {
    id: 'currents_v',
    label: 'Currents (V - Northward)',
    unit: 'm/s',
    colorScale: ['#d73027', '#ffffbf', '#4575b4'],
    available: true,
    availabilityNote: 'Meridional (northward) current velocity component.',
  },
  {
    id: 'o2',
    label: 'Dissolved Oxygen',
    unit: 'mmol/m³',
    colorScale: ['#08519c', '#3182bd', '#6baed6', '#bdd7e7', '#eff3ff'],
    available: true,
    availabilityNote: 'Biogeochemical dissolved molecular oxygen concentration.',
  },
  {
    id: 'no3',
    label: 'Nitrate',
    unit: 'mmol/m³',
    colorScale: ['#8c2d04', '#d94801', '#f16913', '#fd8d3c', '#feedde'],
    available: true,
    availabilityNote: 'Biogeochemical nutrient concentration.',
  },
];

export const defaultVariable = variables[0];
