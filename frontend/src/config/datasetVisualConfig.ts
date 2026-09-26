/**
 * Centralized Dataset & Platform Visual Configuration (Phase 15).
 *
 * Enforces unified, consistent colors, badges, display names, and
 * scientifically matched reference models across:
 * - Spatial Map Markers & Station Lists
 * - 3D Water-Column Inspector Scene & Labels
 * - Depth Profile Comparison Charts & Legends
 * - Paired Value Tables & Evidence Panels
 * - Research Cruise Logs & Lineage Modals
 * - Scientific Demonstration Reports
 */

export interface DatasetVisualMeta {
  key: string;
  platformType: string;
  label: string;
  shortLabel: string;
  color: string;
  darkColor: string;
  hex: string;
  secondaryHex: string;
  badgeBgClass: string;
  badgeTextClass: string;
  badgeBorderClass: string;
  defaultReferenceModel: string;
  referenceModel?: string;
  primaryColor?: string;
  defaultReferenceDatasetId: string;
  typicalVariables: string[];
  typicalTemporalRange: string;
  description: string;
}

export const DATASET_VISUAL_CONFIG: Record<string, DatasetVisualMeta> = {
  ARGO: {
    key: 'ARGO',
    platformType: 'ARGO',
    label: 'Core Argo Profiling Float',
    shortLabel: 'Core Argo',
    color: '#06b6d4',       // Cyan 500
    darkColor: '#0891b2',   // Cyan 600
    hex: '#06b6d4',
    secondaryHex: '#0891b2',
    badgeBgClass: 'bg-cyan-950',
    badgeTextClass: 'text-cyan-300',
    badgeBorderClass: 'border-cyan-800/80',
    defaultReferenceModel: 'GLORYS12V1 Reanalysis',
    defaultReferenceDatasetId: 'glorys12v1-argo-collocation-bob',
    typicalVariables: ['temperature', 'salinity', 'pressure'],
    typicalTemporalRange: '2024-01-01 to 2024-01-15',
    description: 'Autonomous core CTD profiling floats operating on standard 10-day cycles measuring hydrographic physics.',
  },
  BGC: {
    key: 'BGC',
    platformType: 'BGC',
    label: 'BGC-Argo Profiling Float',
    shortLabel: 'BGC-Argo',
    color: '#10b981',       // Emerald 500
    darkColor: '#059669',   // Emerald 600
    hex: '#10b981',
    secondaryHex: '#059669',
    badgeBgClass: 'bg-emerald-950',
    badgeTextClass: 'text-emerald-300',
    badgeBorderClass: 'border-emerald-800/80',
    defaultReferenceModel: 'CMEMS Global BGC Analysis (PISCES)',
    defaultReferenceDatasetId: 'cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m',
    typicalVariables: ['temperature', 'salinity', 'chl', 'o2', 'no3'],
    typicalTemporalRange: '2024-01-03 to 2024-01-14',
    description: 'Biogeochemical profiling floats measuring chlorophyll-a, dissolved oxygen, nitrate, and physical properties.',
  },
  GLIDER: {
    key: 'GLIDER',
    platformType: 'GLIDER',
    label: 'Autonomous Ocean Glider',
    shortLabel: 'Ocean Glider',
    color: '#f59e0b',       // Amber 500
    darkColor: '#d97706',   // Amber 600
    hex: '#f59e0b',
    secondaryHex: '#d97706',
    badgeBgClass: 'bg-amber-950',
    badgeTextClass: 'text-amber-300',
    badgeBorderClass: 'border-amber-800/80',
    defaultReferenceModel: 'GLORYS12V1 Reanalysis',
    defaultReferenceDatasetId: 'glorys12v1-argo-collocation-bob',
    typicalVariables: ['temperature', 'salinity', 'chl'],
    typicalTemporalRange: '2024-01-05 to 2024-01-12',
    description: 'High-resolution sawtooth underwater glider mission measuring upper ocean hydrography and bio-optics (no ADCP currents).',
  },
  CTD: {
    key: 'CTD',
    platformType: 'CTD',
    label: 'Shipboard CTD Rosette Cast',
    shortLabel: 'Ship CTD',
    color: '#a855f7',       // Purple 500
    darkColor: '#7c3aed',   // Purple 600
    hex: '#a855f7',
    secondaryHex: '#7c3aed',
    badgeBgClass: 'bg-purple-950',
    badgeTextClass: 'text-purple-300',
    badgeBorderClass: 'border-purple-800/80',
    defaultReferenceModel: 'GLORYS12V1 Reanalysis',
    defaultReferenceDatasetId: 'glorys12v1-argo-collocation-bob',
    typicalVariables: ['temperature', 'salinity', 'o2', 'chl'],
    typicalTemporalRange: '2024-01-06 to 2024-01-08',
    description: 'Research cruise hydrographic rosette casts collecting high-precision depth-resolved physical and chemical observations.',
  },
  HYCOM: {
    key: 'HYCOM',
    platformType: 'HYCOM',
    label: 'INCOIS Regional HYCOM 2.35',
    shortLabel: 'HYCOM Model',
    color: '#3b82f6',       // Blue 500
    darkColor: '#2563eb',
    hex: '#3b82f6',
    secondaryHex: '#2563eb',
    badgeBgClass: 'bg-blue-950',
    badgeTextClass: 'text-blue-300',
    badgeBorderClass: 'border-blue-800/80',
    defaultReferenceModel: 'INCOIS Operational Forecast',
    defaultReferenceDatasetId: 'incois-hycom-2.35-operational',
    typicalVariables: ['currents', 'currents_u', 'currents_v', 'current_speed'],
    typicalTemporalRange: 'Operational Analysis & Forecast',
    description: 'Regional high-resolution ocean hydrodynamic model providing 3D current velocities (no synthetic observations substituted).',
  },
  GLORYS: {
    key: 'GLORYS',
    platformType: 'GLORYS',
    label: 'GLORYS12V1 Ocean Reanalysis',
    shortLabel: 'GLORYS Reanalysis',
    color: '#38bdf8',       // Sky Blue 400
    darkColor: '#0284c7',
    hex: '#38bdf8',
    secondaryHex: '#0284c7',
    badgeBgClass: 'bg-sky-950',
    badgeTextClass: 'text-sky-300',
    badgeBorderClass: 'border-sky-800/80',
    defaultReferenceModel: 'CMEMS Mercator Ocean Reanalysis',
    defaultReferenceDatasetId: 'glorys12v1-argo-collocation-bob',
    typicalVariables: ['temperature', 'salinity', 'pressure'],
    typicalTemporalRange: '2024-01-01 to 2024-01-15',
    description: 'Mercator Ocean global eddy-resolving 1/12° physical ocean reanalysis reference field.',
  },
  CMEMS_BGC: {
    key: 'CMEMS_BGC',
    platformType: 'CMEMS_BGC',
    label: 'Copernicus Global BGC Model (PISCES)',
    shortLabel: 'CMEMS BGC',
    color: '#ec4899',       // Pink 500
    darkColor: '#db2777',
    hex: '#ec4899',
    secondaryHex: '#db2777',
    badgeBgClass: 'bg-pink-950',
    badgeTextClass: 'text-pink-300',
    badgeBorderClass: 'border-pink-800/80',
    defaultReferenceModel: 'CMEMS Global BGC PISCES Model',
    defaultReferenceDatasetId: 'cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m',
    typicalVariables: ['chl', 'o2', 'no3'],
    typicalTemporalRange: '2024-01-01 to Present',
    description: 'Copernicus Marine global 1/4° biogeochemical analysis and forecast based on PISCES ecosystem modeling.',
  },
};

/** Resolve visual configuration for any platform or dataset identifier. */
function enrichVisualMeta(meta: any): DatasetVisualMeta {
  return {
    ...meta,
    primaryColor: meta.hex || meta.color,
    referenceModel: meta.defaultReferenceModel,
  };
}

export function getDatasetVisualConfig(platformOrDataset?: string | null): DatasetVisualMeta {
  if (!platformOrDataset) return enrichVisualMeta(DATASET_VISUAL_CONFIG.ARGO);
  const upper = platformOrDataset.toUpperCase();
  if (upper.includes('BGC')) return enrichVisualMeta(DATASET_VISUAL_CONFIG.BGC);
  if (upper.includes('GLIDER')) return enrichVisualMeta(DATASET_VISUAL_CONFIG.GLIDER);
  if (upper.includes('CTD')) return enrichVisualMeta(DATASET_VISUAL_CONFIG.CTD);
  if (upper.includes('HYCOM')) return enrichVisualMeta(DATASET_VISUAL_CONFIG.HYCOM);
  if (upper.includes('CMEMS') && (upper.includes('BGC') || upper.includes('PISCES'))) return enrichVisualMeta(DATASET_VISUAL_CONFIG.CMEMS_BGC);
  if (upper.includes('GLORYS')) return enrichVisualMeta(DATASET_VISUAL_CONFIG.GLORYS);
  return enrichVisualMeta(DATASET_VISUAL_CONFIG.ARGO);
}

export interface ScientificReferenceResolution {
  platform: string;
  variable: string;
  variableCategory: 'thermodynamic' | 'dynamic' | 'biogeochemical' | 'surface';
  modelKey: 'GLORYS' | 'CMEMS_BGC' | 'HYCOM' | 'COPERNICUS_NRT_PHY' | 'COPERNICUS_NRT_BGC';
  modelDatasetId: string;
  modelDisplayName: string;
  modelShortName: string;
  modelColor: string;
  observationColor: string;
  observationLabel: string;
  differenceConvention: string;
  isCompatible: boolean;
  rejectionReason?: string;
}

export function resolveScientificReference(
  platform?: string | null,
  variable?: string | null,
  dataMode?: string | null,
): ScientificReferenceResolution {
  const platKey = (platform || 'ARGO').toUpperCase();
  const varRaw = (variable || 'temperature').toLowerCase();

  const platMeta = getDatasetVisualConfig(platKey);
  const obsColor = platMeta.hex || platMeta.color || '#06b6d4';
  const obsLabel = platMeta.shortLabel || platMeta.label || 'Observation';

  // Variable categorization
  let category: 'thermodynamic' | 'dynamic' | 'biogeochemical' | 'surface' = 'thermodynamic';
  if (['chl', 'chlorophyll', 'o2', 'dissolved_oxygen', 'no3', 'nitrate'].includes(varRaw)) {
    category = 'biogeochemical';
  } else if (['uo', 'vo', 'wo', 'currents', 'currents_u', 'currents_v', 'current_speed', 'current_direction'].includes(varRaw)) {
    category = 'dynamic';
  } else if (['zos', 'mlotst'].includes(varRaw)) {
    category = 'surface';
  }

  const isLive = dataMode === 'LIVE_NRT' || dataMode === 'latest';

  if (category === 'thermodynamic') {
    // Temperature & Salinity ALWAYS compare against GLORYS (historical) or Copernicus PHY (live)
    if (isLive) {
      return {
        platform: platKey,
        variable: varRaw,
        variableCategory: category,
        modelKey: 'COPERNICUS_NRT_PHY',
        modelDatasetId: 'GLOBAL_ANALYSISFORECAST_PHY_001_024',
        modelDisplayName: 'Copernicus Marine Global Ocean Physics Analysis & Forecast (0.083°)',
        modelShortName: 'Copernicus PHY',
        modelColor: '#38bdf8',
        observationColor: obsColor,
        observationLabel: obsLabel,
        differenceConvention: 'Model − Observation',
        isCompatible: true,
      };
    }
    return {
      platform: platKey,
      variable: varRaw,
      variableCategory: category,
      modelKey: 'GLORYS',
      modelDatasetId: 'glorys12v1-argo-collocation-bob',
      modelDisplayName: 'GLORYS12V1 Global Ocean Physics Reanalysis',
      modelShortName: 'GLORYS12V1',
      modelColor: '#38bdf8',
      observationColor: obsColor,
      observationLabel: obsLabel,
      differenceConvention: 'Model − Observation',
      isCompatible: true,
    };
  }

  if (category === 'biogeochemical') {
    if (platKey === 'ARGO') {
      return {
        platform: platKey,
        variable: varRaw,
        variableCategory: category,
        modelKey: 'CMEMS_BGC',
        modelDatasetId: 'cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m',
        modelDisplayName: 'CMEMS Global Ocean Biogeochemistry Analysis/Forecast (PISCES)',
        modelShortName: 'CMEMS BGC PISCES',
        modelColor: '#ec4899',
        observationColor: obsColor,
        observationLabel: obsLabel,
        differenceConvention: 'Model − Observation',
        isCompatible: false,
        rejectionReason: 'Core Argo profiling floats measure physical hydrography only and do not carry biogeochemical sensors.',
      };
    }
    if (isLive) {
      return {
        platform: platKey,
        variable: varRaw,
        variableCategory: category,
        modelKey: 'COPERNICUS_NRT_BGC',
        modelDatasetId: 'GLOBAL_ANALYSISFORECAST_BGC_001_028',
        modelDisplayName: 'Copernicus Marine Global Ocean Biogeochemistry Forecast (0.25° PISCES)',
        modelShortName: 'Copernicus BGC',
        modelColor: '#ec4899',
        observationColor: obsColor,
        observationLabel: obsLabel,
        differenceConvention: 'Model − Observation',
        isCompatible: true,
      };
    }
    return {
      platform: platKey,
      variable: varRaw,
      variableCategory: category,
      modelKey: 'CMEMS_BGC',
      modelDatasetId: 'cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m',
      modelDisplayName: 'CMEMS Global Ocean Biogeochemistry Analysis/Forecast (PISCES)',
      modelShortName: 'CMEMS BGC PISCES',
      modelColor: '#ec4899',
      observationColor: obsColor,
      observationLabel: obsLabel,
      differenceConvention: 'Model − Observation',
      isCompatible: true,
    };
  }

  if (category === 'dynamic') {
    return {
      platform: platKey,
      variable: varRaw,
      variableCategory: category,
      modelKey: 'HYCOM',
      modelDatasetId: 'incois-hycom-2.35-operational',
      modelDisplayName: 'INCOIS Regional HYCOM 2.35 Operational Current Velocity',
      modelShortName: 'HYCOM',
      modelColor: '#818cf8',
      observationColor: obsColor,
      observationLabel: obsLabel,
      differenceConvention: 'Model − Observation',
      isCompatible: false,
      rejectionReason: `Observation platform '${platKey}' does not measure ocean current velocity vectors. Operational model currents shown independently.`,
    };
  }

  return {
    platform: platKey,
    variable: varRaw,
    variableCategory: 'surface',
    modelKey: 'COPERNICUS_NRT_PHY',
    modelDatasetId: 'GLOBAL_ANALYSISFORECAST_PHY_001_024',
    modelDisplayName: 'Copernicus Marine Global Ocean Physics Analysis & Forecast (0.083°)',
    modelShortName: 'Copernicus SURF',
    modelColor: '#38bdf8',
    observationColor: obsColor,
    observationLabel: obsLabel,
    differenceConvention: 'Model − Observation',
    isCompatible: true,
  };
}
