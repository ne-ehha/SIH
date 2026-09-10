export interface Location {
  latitude: number;
  longitude: number;
}

export type OceanVariable = 'temperature' | 'salinity' | 'currents_u' | 'currents_v';

export type ViewMode = 'explore' | 'compare' | 'discrepancies' | 'diagnostics' | 'solutions' | 'reports';

export type WorkspaceMode = 'overview' | 'globe' | 'research' | 'analysis' | 'solutions' | 'report';

export interface LayerConfig {
  id: string;
  label: string;
  enabled: boolean;
  category: 'models' | 'observations' | 'discrepancies' | 'depthSlice' | 'bathymetry' | 'currents';
  /** Layer opacity 0–1 (real rendering control) */
  opacity: number;
  /** True when the layer's data source is actually connected */
  available?: boolean;
}

/** Color scale configuration — drives real value→color mapping. */
export interface ColorScaleConfig {
  /** Palette id from COLOR_PALETTES */
  paletteId: string;
  /** Auto-compute range from data instead of manual min/max */
  auto: boolean;
  /** Manual scale minimum (when auto = false) */
  min: number;
  /** Manual scale maximum (when auto = false) */
  max: number;
  /** Logarithmic value→color mapping (requires positive range) */
  logarithmic: boolean;
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
  /** True when a real dataset for this variable is connected */
  available: boolean;
  /** Short note when the variable is not currently available */
  availabilityNote?: string;
}
