import type { RegionConfig } from '@/types/ocean';

export const regions: RegionConfig[] = [
  {
    id: 'bay-of-bengal',
    name: 'Bay of Bengal',
    center: { latitude: 15.0, longitude: 88.0 },
    bounds: { north: 22.0, south: 5.0, east: 95.0, west: 80.0 },
    defaultZoom: 5000000,
  },
  {
    id: 'arabian-sea',
    name: 'Arabian Sea',
    center: { latitude: 15.0, longitude: 65.0 },
    bounds: { north: 24.0, south: 5.0, east: 73.0, west: 55.0 },
    defaultZoom: 5000000,
  },
  {
    id: 'indian-ocean',
    name: 'Indian Ocean',
    center: { latitude: -10.0, longitude: 70.0 },
    bounds: { north: 20.0, south: -40.0, east: 120.0, west: 30.0 },
    defaultZoom: 15000000,
  },
  {
    id: 'pacific-ocean',
    name: 'Pacific Ocean',
    center: { latitude: 0.0, longitude: -160.0 },
    bounds: { north: 60.0, south: -60.0, east: 120.0, west: -120.0 },
    defaultZoom: 20000000,
  },
  {
    id: 'atlantic-ocean',
    name: 'Atlantic Ocean',
    center: { latitude: 0.0, longitude: -30.0 },
    bounds: { north: 60.0, south: -60.0, east: 0.0, west: -60.0 },
    defaultZoom: 20000000,
  },
  {
    id: 'southern-ocean',
    name: 'Southern Ocean',
    center: { latitude: -65.0, longitude: 0.0 },
    bounds: { north: -55.0, south: -90.0, east: 180.0, west: -180.0 },
    defaultZoom: 15000000,
  },
  {
    id: 'arctic-ocean',
    name: 'Arctic Ocean',
    center: { latitude: 80.0, longitude: 0.0 },
    bounds: { north: 90.0, south: 65.0, east: 180.0, west: -180.0 },
    defaultZoom: 10000000,
  },
];

export const defaultRegion = regions[0]; // Bay of Bengal
