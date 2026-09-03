import { create } from 'zustand';
import type { Location, OceanVariable, ViewMode, LayerConfig } from '@/types/ocean';
import { defaultRegion } from '@/config/regions';
import { defaultVariable } from '@/config/variables';

interface OceanStore {
  // Selection state
  selectedLocation: Location | null;
  selectedDepth: number;
  selectedVariable: OceanVariable;
  selectedDate: string;
  selectedTime: string;
  selectedRegion: string;

  // View state
  activeView: ViewMode;
  selectedNav: string;
  isModelViewOpen: boolean;
  sidebarCollapsed: boolean;

  // Layer state
  activeLayers: LayerConfig[];

  // Observation state
  selectedObservationId: string | null;

  // API state
  apiStatus: 'idle' | 'loading' | 'success' | 'error';

  // Actions
  setSelectedLocation: (location: Location | null) => void;
  setSelectedDepth: (depth: number) => void;
  setSelectedVariable: (variable: OceanVariable) => void;
  setSelectedDate: (date: string) => void;
  setSelectedTime: (time: string) => void;
  setSelectedRegion: (region: string) => void;
  setActiveView: (view: ViewMode) => void;
  setSelectedNav: (nav: string) => void;
  setIsModelViewOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  toggleLayer: (layerId: string) => void;
  setSelectedObservationId: (id: string | null) => void;
  setApiStatus: (status: 'idle' | 'loading' | 'success' | 'error') => void;
  resetSelection: () => void;
}

const defaultLayers: LayerConfig[] = [
  { id: 'models', label: 'Models', enabled: true, category: 'models' },
  { id: 'observations', label: 'Observations', enabled: true, category: 'observations' },
  { id: 'discrepancies', label: 'Discrepancies', enabled: false, category: 'discrepancies' },
  { id: 'bathymetry', label: 'Bathymetry', enabled: false, category: 'bathymetry' },
  { id: 'currents', label: 'Currents', enabled: false, category: 'currents' },
];

export const useOceanStore = create<OceanStore>((set) => ({
  // Initial state
  selectedLocation: null,
  selectedDepth: 0,
  selectedVariable: defaultVariable.id,
  selectedDate: '2024-01-10',
  selectedTime: '12:00',
  selectedRegion: defaultRegion.id,
  activeView: 'explore',
  selectedNav: 'Explore',
  isModelViewOpen: false,
  sidebarCollapsed: false,
  activeLayers: defaultLayers,
  selectedObservationId: null,
  apiStatus: 'idle',

  // Actions
  setSelectedLocation: (location) => set({ selectedLocation: location }),
  setSelectedDepth: (depth) => set({ selectedDepth: depth }),
  setSelectedVariable: (variable) => set({ selectedVariable: variable }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setSelectedTime: (time) => set({ selectedTime: time }),
  setSelectedRegion: (region) => set({ selectedRegion: region }),
  setActiveView: (view) => set({ activeView: view }),
  setSelectedNav: (nav) => set({ selectedNav: nav }),
  setIsModelViewOpen: (open) => set({ isModelViewOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  toggleLayer: (layerId) =>
    set((state) => ({
      activeLayers: state.activeLayers.map((layer) =>
        layer.id === layerId ? { ...layer, enabled: !layer.enabled } : layer
      ),
    })),
  setSelectedObservationId: (id) => set({ selectedObservationId: id }),
  setApiStatus: (status) => set({ apiStatus: status }),
  resetSelection: () =>
    set({
      selectedLocation: null,
      selectedDepth: 0,
      selectedVariable: defaultVariable.id,
      selectedDate: '2024-01-10',
      selectedTime: '12:00',
      selectedRegion: defaultRegion.id,
      selectedObservationId: null,
      isModelViewOpen: false,
    }),
}));
