import type { VariableConfig } from '@/types/ocean';

export const variables: VariableConfig[] = [
  {
    id: 'temperature',
    label: 'Temperature',
    unit: '°C',
    colorScale: ['#0000ff', '#00ffff', '#ffff00', '#ff0000'],
  },
  {
    id: 'salinity',
    label: 'Salinity',
    unit: 'PSU',
    colorScale: ['#f7fbff', '#6baed6', '#08306b'],
  },
  {
    id: 'currents_u',
    label: 'Currents (U)',
    unit: 'm/s',
    colorScale: ['#d73027', '#ffffbf', '#4575b4'],
  },
  {
    id: 'currents_v',
    label: 'Currents (V)',
    unit: 'm/s',
    colorScale: ['#d73027', '#ffffbf', '#4575b4'],
  },
];

export const defaultVariable = variables[0];
