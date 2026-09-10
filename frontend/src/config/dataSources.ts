/**
 * Canonical Data Source Registry
 *
 * Defines all data sources, their capabilities, and their status.
 * The UI derives variable/source availability from this registry.
 *
 * Status levels:
 *   'available'  — actively loaded and functional
 *   'architectural' — adapter exists but no real dataset connected
 *   'unavailable' — not connected, no adapter yet
 */

export type DataSourceStatus = 'available' | 'architectural' | 'unavailable';
export type DataSourceClassification = 'observation' | 'model' | 'reanalysis' | 'model+observation';
export type SourceAdapterType = 'netcdf' | 'csv' | 'text' | 'api' | 'opendap';

export interface VariableCapability {
  id: string;
  displayName: string;
  unit: string;
  category: 'thermodynamic' | 'dynamic' | 'biogeochemical' | 'coordinate';
  description: string;
  /** Source variable name in the raw dataset */
  sourceName?: string;
  /** Whether this variable has observation counterparts */
  hasObservation: boolean;
  /** Valid range if known */
  validRange?: [number, number];
  /** Visualization modes supported */
  visualizationModes: Array<'profile' | 'map' | 'scatter' | '3d' | 'vector' | 'depthSlice' | 'timeseries'>;
}

export interface OceanDataSource {
  id: string;
  name: string;
  shortName: string;
  classification: DataSourceClassification;
  adapterType: SourceAdapterType;
  status: DataSourceStatus;
  /** Variables this source provides */
  variables: string[];
  /** Time coverage */
  temporalCoverage: {
    start: string;
    end: string;
    resolution: string;
    /** Actual available time steps (for sparse observations) */
    availableSteps?: string[];
  };
  /** Spatial coverage */
  spatialCoverage: {
    north: number;
    south: number;
    east: number;
    west: number;
    region?: string;
  };
  /** Vertical coverage */
  verticalCoverage: {
    minPressure: number;
    maxPressure: number;
    depthLevels?: number[];
  };
  /** Quality control metadata available */
  qualityControl: boolean;
  /** QC field names */
  qcFields?: string[];
  /** Source institution */
  institution?: string;
  /** Product ID / dataset identifier */
  productId?: string;
  /** Pipeline classification */
  pipeline: 'A' | 'B' | 'standalone';
  /** Supported operations */
  supportedOperations: Array<'comparison' | 'profile' | 'discrepancy' | 'diagnostics' | '3d' | 'grid' | 'export'>;
  /** Citation / reference */
  citation?: string;
}

// ── Registered Data Sources ──────────────────────────────────────────────────

export const DATA_SOURCES: OceanDataSource[] = [
  {
    id: 'glorys-argo-collocation',
    name: 'GLORYS12V1 × Argo Delayed Mode Collocation',
    shortName: 'GLORYS × Argo',
    classification: 'model+observation',
    adapterType: 'netcdf',
    status: 'available',
    variables: ['temperature', 'salinity', 'pressure'],
    temporalCoverage: {
      start: '2024-01-01',
      end: '2024-01-14',
      resolution: 'daily',
      availableSteps: [
        '2024-01-01', '2024-01-04', '2024-01-06', '2024-01-07',
        '2024-01-08', '2024-01-09', '2024-01-10', '2024-01-11', '2024-01-14',
      ],
    },
    spatialCoverage: {
      north: 15.52,
      south: 7.80,
      east: 90.26,
      west: 83.47,
      region: 'Bay of Bengal',
    },
    verticalCoverage: {
      minPressure: 0.5,
      maxPressure: 445.06,
    },
    qualityControl: false,
    institution: 'Mercator Ocean / CMEMS',
    productId: 'cmems_mod_glo_phy_my_0.083deg_P1D-m',
    pipeline: 'A',
    supportedOperations: ['comparison', 'profile', 'discrepancy', 'diagnostics', '3d', 'export'],
    citation: 'GLORYS12V1 Global Ocean Physics Reanalysis. CMEMS.',
  },
  {
    id: 'argo-dm',
    name: 'Argo Delayed Mode',
    shortName: 'Argo DM',
    classification: 'observation',
    adapterType: 'netcdf',
    status: 'available',
    variables: ['temperature', 'salinity', 'pressure'],
    temporalCoverage: {
      start: '2024-01-01',
      end: '2024-01-14',
      resolution: 'event-based',
    },
    spatialCoverage: {
      north: 15.52,
      south: 7.80,
      east: 90.26,
      west: 83.47,
      region: 'Bay of Bengal',
    },
    verticalCoverage: {
      minPressure: 0.0,
      maxPressure: 500.0,
    },
    qualityControl: true,
    qcFields: ['PRES_QC', 'TEMP_QC', 'PSAL_QC'],
    institution: 'GDAC / Argo',
    pipeline: 'A',
    supportedOperations: ['profile', 'export'],
    citation: 'Argo Delayed Mode. GDAC.',
  },
  {
    id: 'hycom-operational',
    name: 'INCOIS HYCOM 2.35 Operational',
    shortName: 'HYCOM',
    classification: 'model',
    adapterType: 'netcdf',
    status: 'available',
    variables: ['temperature', 'salinity', 'currents_u', 'currents_v'],
    temporalCoverage: {
      start: '2026-08-26',
      end: '2026-09-01',
      resolution: '6-hourly',
    },
    spatialCoverage: {
      north: 21.943,
      south: 5.063,
      east: 99.86,
      west: 78.02,
    },
    verticalCoverage: {
      minPressure: 0,
      maxPressure: 500,
      depthLevels: [0, 17.5, 52.5, 125, 275, 500],
    },
    qualityControl: false,
    institution: 'INCOIS',
    pipeline: 'B',
    supportedOperations: ['3d', 'grid', 'profile', 'export'],
  },
  {
    id: 'glider',
    name: 'Glider Observations',
    shortName: 'Glider',
    classification: 'observation',
    adapterType: 'netcdf',
    status: 'unavailable',
    variables: [],
    temporalCoverage: { start: '', end: '', resolution: '' },
    spatialCoverage: { north: 0, south: 0, east: 0, west: 0 },
    verticalCoverage: { minPressure: 0, maxPressure: 0 },
    qualityControl: false,
    pipeline: 'standalone',
    supportedOperations: [],
  },
  {
    id: 'ctd',
    name: 'CTD Observations',
    shortName: 'CTD',
    classification: 'observation',
    adapterType: 'netcdf',
    status: 'unavailable',
    variables: [],
    temporalCoverage: { start: '', end: '', resolution: '' },
    spatialCoverage: { north: 0, south: 0, east: 0, west: 0 },
    verticalCoverage: { minPressure: 0, maxPressure: 0 },
    qualityControl: false,
    pipeline: 'standalone',
    supportedOperations: [],
  },
  {
    id: 'bgc',
    name: 'Biogeochemical Observations',
    shortName: 'BGC',
    classification: 'observation',
    adapterType: 'netcdf',
    status: 'unavailable',
    variables: [],
    temporalCoverage: { start: '', end: '', resolution: '' },
    spatialCoverage: { north: 0, south: 0, east: 0, west: 0 },
    verticalCoverage: { minPressure: 0, maxPressure: 0 },
    qualityControl: false,
    pipeline: 'standalone',
    supportedOperations: [],
  },
  {
    id: 'mooring',
    name: 'Mooring Observations',
    shortName: 'Mooring',
    classification: 'observation',
    adapterType: 'netcdf',
    status: 'unavailable',
    variables: [],
    temporalCoverage: { start: '', end: '', resolution: '' },
    spatialCoverage: { north: 0, south: 0, east: 0, west: 0 },
    verticalCoverage: { minPressure: 0, maxPressure: 0 },
    qualityControl: false,
    pipeline: 'standalone',
    supportedOperations: [],
  },
];

// ── Variable Registry ────────────────────────────────────────────────────────

export const VARIABLE_REGISTRY: VariableCapability[] = [
  {
    id: 'temperature',
    displayName: 'Temperature',
    unit: '°C',
    category: 'thermodynamic',
    description: 'Sea water potential temperature at the selected depth.',
    sourceName: 'thetao',
    hasObservation: true,
    validRange: [-2, 35],
    visualizationModes: ['profile', 'map', 'scatter', '3d', 'depthSlice'],
  },
  {
    id: 'salinity',
    displayName: 'Salinity',
    unit: 'PSU',
    category: 'thermodynamic',
    description: 'Practical salinity at the selected depth.',
    sourceName: 'so',
    hasObservation: true,
    validRange: [20, 42],
    visualizationModes: ['profile', 'map', 'scatter', '3d', 'depthSlice'],
  },
  {
    id: 'pressure',
    displayName: 'Pressure',
    unit: 'dbar',
    category: 'coordinate',
    description: 'Vertical pressure coordinate corresponding to observation depth.',
    sourceName: 'pressure',
    hasObservation: true,
    validRange: [0, 1000],
    visualizationModes: ['profile'],
  },
  {
    id: 'currents_u',
    displayName: 'U Current',
    unit: 'm/s',
    category: 'dynamic',
    description: 'Eastward sea water velocity (model only).',
    sourceName: 'uo',
    hasObservation: false,
    validRange: [-3, 3],
    visualizationModes: ['map', '3d', 'depthSlice', 'vector'],
  },
  {
    id: 'currents_v',
    displayName: 'V Current',
    unit: 'm/s',
    category: 'dynamic',
    description: 'Northward sea water velocity (model only).',
    sourceName: 'vo',
    hasObservation: false,
    validRange: [-3, 3],
    visualizationModes: ['map', '3d', 'depthSlice', 'vector'],
  },
  {
    id: 'current_speed',
    displayName: 'Current Speed',
    unit: 'm/s',
    category: 'dynamic',
    description: 'Magnitude derived from model U/V current components.',
    sourceName: undefined,
    hasObservation: false,
    validRange: [0, 5],
    visualizationModes: ['map', '3d', 'depthSlice'],
  },
  {
    id: 'chlorophyll',
    displayName: 'Chlorophyll',
    unit: 'mg/m³',
    category: 'biogeochemical',
    description: 'Chlorophyll concentration (not currently available).',
    hasObservation: false,
    visualizationModes: [],
  },
];

// ── Helper Functions ─────────────────────────────────────────────────────────

/** Get all currently available data sources */
export function getAvailableSources(): OceanDataSource[] {
  return DATA_SOURCES.filter((s) => s.status === 'available');
}

/** Get variables available from a specific source */
export function getSourceVariables(sourceId: string): VariableCapability[] {
  const source = DATA_SOURCES.find((s) => s.id === sourceId);
  if (!source) return [];
  return VARIABLE_REGISTRY.filter((v) => source.variables.includes(v.id));
}

/** Get all variables available across all active sources */
export function getActiveVariables(): VariableCapability[] {
  const activeVarIds = new Set<string>();
  for (const source of getAvailableSources()) {
    for (const v of source.variables) activeVarIds.add(v);
  }
  return VARIABLE_REGISTRY.filter((v) => activeVarIds.has(v.id));
}

/** Check if a variable is available for comparison (has both model and observation) */
export function isComparisonVariable(variableId: string): boolean {
  const vr = VARIABLE_REGISTRY.find((v) => v.id === variableId);
  if (!vr || !vr.hasObservation) return false;
  return getAvailableSources().some(
    (s) => s.classification === 'model+observation' && s.variables.includes(variableId)
  );
}

/** Get the observation dates available for a specific variable */
export function getAvailableObservationDates(variableId: string): string[] {
  for (const source of getAvailableSources()) {
    if (source.classification === 'model+observation' && source.variables.includes(variableId)) {
      return source.temporalCoverage.availableSteps || [];
    }
  }
  return [];
}

/** Source status label */
export function sourceStatusLabel(status: DataSourceStatus): string {
  switch (status) {
    case 'available': return 'Available';
    case 'architectural': return 'Architecture Ready';
    case 'unavailable': return 'Not Connected';
  }
}
