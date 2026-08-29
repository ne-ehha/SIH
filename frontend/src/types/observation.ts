export interface ObservationPoint {
  id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  depth: number;
  status: 'active' | 'inactive' | 'pending';
  type: 'argo' | 'glider' | 'mooring' | 'ship';
  temperature?: number;
  salinity?: number;
}
