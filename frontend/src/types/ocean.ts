export interface Location {
  latitude: number;
  longitude: number;
}

export type OceanVariable = 'temperature' | 'salinity' | 'currents_u' | 'currents_v';

export type ViewMode = 'explore' | 'compare' | 'discrepancies' | 'diagnostics' | 'solutions' | 'reports';

export interface LayerConfig {
  id: string;
  label: string;
  enabled: boolean;
  category: 'models' | 'observations' | 'discrepancies' | 'bathymetry' | 'currents';
}

export interface RegionConfig {
  id: string;
  name: string;
  center: Location;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  defaultZoom: number;
}

export interface VariableConfig {
  id: OceanVariable;
  label: string;
  unit: string;
  colorScale: string[];
}
