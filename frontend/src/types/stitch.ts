export type ScreenType = 
  | 'login'
  | 'launchpad'
  | 'spatial'
  | 'workstation'
  | 'profile-lab'
  | 'analysis'
  | 'diagnostics'
  | 'investigation'
  | 'reports'
  | 'data-services'
  | 'api-docs';

export interface UserProfile {
  identifier: string;
  displayName: string;
  role: string;
}

export interface ArgoFloat {
  wmoId: string;
  platformType: 'Apex' | 'Navis' | 'Provor' | 'Solo-II';
  basin: string;
  lat: number;
  lon: number;
  lastTransmission: string;
  cycleNumber: number;
  maxDepthDbar: number;
  status: 'Active' | 'Surfacing' | 'Drifting' | 'Serviced';
  batteryVolts: number;
  internalVacuumInHg: number;
  qcStatus: 'Passed (QC=1)' | 'Suspect (QC=2)' | 'Warning (QC=3)';
  sensors: string[];
}

export interface CTDMeasurement {
  depth: number; // dbar
  temperature: number; // °C (ITS-90)
  salinity: number; // PSU (PSS-78)
  dissolvedOxygen?: number; // µmol/kg
  chlorophyll?: number; // mg/m³
  soundVelocity?: number; // m/s
  qcFlag: 1 | 2 | 3 | 4;
}

export interface CTDStation {
  stationId: string;
  cruiseName: string;
  basin: string;
  lat: number;
  lon: number;
  castDate: string;
  bottomDepthMeters: number;
  operator: string;
  measurements: CTDMeasurement[];
  thermoclineDepth: number;
  haloclineDepth: number;
  mixedLayerDepth: number;
  chlorophyllMaxDepth?: number;
}

export interface OceanTransect {
  id: string;
  name: string;
  basin: string;
  startCoords: string;
  endCoords: string;
  stationsCount: number;
  lengthKm: number;
  dateCollected: string;
  program: string;
}

export interface AnomalyIncident {
  id: string;
  title: string;
  category: 'Marine Heatwave' | 'Hypoxic Dead Zone' | 'Mesoscale Eddy' | 'Salinity Anomaly' | 'Upwelling Disturbance';
  severity: 'Moderate' | 'Strong' | 'Severe' | 'Extreme';
  basin: string;
  coordinates: string;
  anomalyDelta: string;
  detectionDate: string;
  status: 'Under Investigation' | 'Confirmed' | 'Dissipating';
  description: string;
  impactScore: number;
}

export interface DataFeed {
  id: string;
  name: string;
  provider: string;
  protocol: 'ERDDAP' | 'OPeNDAP' | 'WMO-GTS' | 'Argo GDAC' | 'Copernicus CMEMS';
  status: 'Connected' | 'Syncing' | 'Degraded';
  recordsCount: string;
  latencyMs: number;
  lastSyncUTC: string;
  bandwidthMbps: number;
}
