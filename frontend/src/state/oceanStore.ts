import { create } from 'zustand';
import type { Location, OceanVariable, ViewMode, WorkspaceMode, LayerConfig, ColorScaleConfig } from '@/types/ocean';
import { defaultRegion } from '@/config/regions';
import { defaultVariable } from '@/config/variables';
import { OBSERVATION_DATES } from '@/config/observationDates';

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
  workspaceMode: WorkspaceMode;
  selectedNav: string;
  isModelViewOpen: boolean;
  sidebarCollapsed: boolean;

  // Layer state (visibility + opacity are real rendering controls)
  activeLayers: LayerConfig[];

  // Color scale state (palette/min/max/log drive real value→color mapping)
  colorScale: ColorScaleConfig;

  // Vertical exaggeration for the Research 3D water column (1–5×)
  verticalExaggeration: number;

  // Time navigation: index into the canonical observation date list
  timeIndex: number;

  // Observation state
  selectedObservationId: string | null;
  researchDataMode: 'benchmark' | 'latest';

  // API state
  apiStatus: 'idle' | 'loading' | 'success' | 'error';

  // Globe camera triggers
  fitAllObservationsTrigger: number;

  // Actions
  setSelectedLocation: (location: Location | null) => void;
  setSelectedDepth: (depth: number) => void;
  setSelectedVariable: (variable: OceanVariable) => void;
  setSelectedDate: (date: string) => void;
  setSelectedTime: (time: string) => void;
  setSelectedRegion: (region: string) => void;
  setActiveView: (view: ViewMode) => void;
  setWorkspaceMode: (mode: WorkspaceMode) => void;
  /** Sync workspaceMode from the current route path (router → store, no navigation). */
  syncWorkspaceModeFromPath: (path: string) => void;
  setSelectedNav: (nav: string) => void;
  setIsModelViewOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  toggleLayer: (layerId: string) => void;
  setLayerOpacity: (layerId: string, opacity: number) => void;
  setColorScale: (config: Partial<ColorScaleConfig>) => void;
  setVerticalExaggeration: (value: number) => void;
  setTimeIndex: (index: number) => void;
  stepTime: (delta: number) => void;
  setSelectedObservationId: (id: string | null) => void;
  setResearchDataMode: (mode: 'benchmark' | 'latest') => void;
  selectResearchObservation: (selection: { id: string; location: Location; date: string }) => void;
  clearSelectedObservation: () => void;
  setApiStatus: (status: 'idle' | 'loading' | 'success' | 'error') => void;
  triggerFitAllObservations: () => void;
  resetSelection: () => void;
}

const defaultLayers: LayerConfig[] = [
  // Argo observations — real markers/profiles from the collocation dataset.
  { id: 'observations', label: 'Argo Observations', enabled: true, category: 'observations', opacity: 1, available: true },
  // GLORYS12V1 model — collocated model values at real profile positions.
  { id: 'models', label: 'GLORYS Model', enabled: true, category: 'models', opacity: 0.8, available: true },
  // Discrepancies — GLORYS − Argo at real collocation points (never a full field).
  { id: 'discrepancies', label: 'Discrepancies (GLORYS − Argo)', enabled: false, category: 'discrepancies', opacity: 0.85, available: true },
  // Depth slice — horizontal cut of the currently rendered field.
  { id: 'depthSlice', label: 'Depth Slice', enabled: true, category: 'depthSlice', opacity: 0.6, available: true },
  // Unavailable sources stay visible-but-disabled: honest about what is NOT connected.
  { id: 'bathymetry', label: 'Bathymetry (GEBCO — not connected)', enabled: false, category: 'bathymetry', opacity: 0.6, available: false },
  { id: 'currents', label: 'Currents (U/V — not connected)', enabled: false, category: 'currents', opacity: 0.8, available: false },
];

// ── Route ↔ workspace-mode synchronization ────────────────────────────────────
// Platform routes map 1:1 to the legacy workspace modes so that existing
// store-driven navigation (setWorkspaceMode) and URL navigation stay in sync.

const MODE_TO_PATH: Record<WorkspaceMode, string> = {
  overview: '/',
  globe: '/explore',
  research: '/research',
  analysis: '/analysis',
  solutions: '/solutions',
  report: '/reports',
};

const PATH_TO_MODE: Record<string, WorkspaceMode> = Object.fromEntries(
  Object.entries(MODE_TO_PATH).map(([mode, path]) => [path, mode as WorkspaceMode]),
);

let navigateRef: ((to: string) => void) | null = null;

/** Register the router navigate function once, from the router bootstrap. */
export function registerNavigator(navigate: (to: string) => void) {
  navigateRef = navigate;
}

export const useOceanStore = create<OceanStore>((set) => ({
  // Initial state
  selectedLocation: null,
  selectedDepth: 0,
  selectedVariable: defaultVariable.id,
  selectedDate: '2024-01-10',
  selectedTime: '12:00',
  selectedRegion: defaultRegion.id,
  activeView: 'explore',
  workspaceMode: 'overview',
  selectedNav: 'Explore',
  isModelViewOpen: false,
  sidebarCollapsed: false,
  activeLayers: defaultLayers,
  colorScale: {
    paletteId: 'diverging-bwr',
    auto: true,
    min: 0,
    max: 1,
    logarithmic: false,
  },
  verticalExaggeration: 1,
  timeIndex: 5, // '2024-01-10' within OBSERVATION_DATES
  selectedObservationId: null,
  researchDataMode: 'benchmark',
  apiStatus: 'idle',
  fitAllObservationsTrigger: 0,

  // Actions
  setSelectedLocation: (location) => set({ selectedLocation: location }),
  setSelectedDepth: (depth) => set({ selectedDepth: depth }),
  setSelectedVariable: (variable) => set({ selectedVariable: variable }),
  // A manually chosen date cannot safely retain a marker's profile identity.
  setSelectedDate: (date) => set((state) => ({
    selectedDate: date,
    selectedObservationId: null,
    timeIndex: Math.max(0, OBSERVATION_DATES.indexOf(date)),
  })),
  setSelectedTime: (time) => set({ selectedTime: time }),
  setSelectedRegion: (region) => set({ selectedRegion: region }),
  setActiveView: (view) => set({ activeView: view }),
  setWorkspaceMode: (mode) => {
    set({ workspaceMode: mode });
    // Keep the URL synchronized with store-driven navigation.
    navigateRef?.(MODE_TO_PATH[mode]);
  },
  syncWorkspaceModeFromPath: (path) => {
    const mode = PATH_TO_MODE[path];
    if (mode) set({ workspaceMode: mode });
  },
  setSelectedNav: (nav) => set({ selectedNav: nav }),
  setIsModelViewOpen: (open) => set({ isModelViewOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  toggleLayer: (layerId) =>
    set((state) => ({
      activeLayers: state.activeLayers.map((layer) =>
        layer.id === layerId && layer.available !== false
          ? { ...layer, enabled: !layer.enabled }
          : layer
      ),
    })),
  // Layer opacity is a real control: consumers apply it when rendering.
  setLayerOpacity: (layerId, opacity) =>
    set((state) => ({
      activeLayers: state.activeLayers.map((layer) =>
        layer.id === layerId ? { ...layer, opacity } : layer
      ),
    })),
  setColorScale: (config) => set((state) => ({ colorScale: { ...state.colorScale, ...config } })),
  setVerticalExaggeration: (value) =>
    set({ verticalExaggeration: Math.max(1, Math.min(5, value)) }),
  setTimeIndex: (index) => {
    const clamped = Math.max(0, Math.min(OBSERVATION_DATES.length - 1, index));
    set({
      timeIndex: clamped,
      selectedDate: OBSERVATION_DATES[clamped],
      // Changing time invalidates the retained profile identity.
      selectedObservationId: null,
    });
  },
  stepTime: (delta) => {
    set((state) => {
      const next = Math.max(0, Math.min(OBSERVATION_DATES.length - 1, state.timeIndex + delta));
      if (next === state.timeIndex) return state;
      return {
        timeIndex: next,
        selectedDate: OBSERVATION_DATES[next],
        selectedObservationId: null,
      };
    });
  },
  setSelectedObservationId: (id) => set({ selectedObservationId: id }),
  setResearchDataMode: (mode) => set({ researchDataMode: mode }),
  // Keep marker identity, location, and observation date atomic for Research Mode.
  selectResearchObservation: ({ id, location, date }) => set((state) => ({
    selectedObservationId: id,
    selectedLocation: location,
    selectedDate: date,
    timeIndex: Math.max(0, OBSERVATION_DATES.indexOf(date)),
  })),
  clearSelectedObservation: () => set({ selectedObservationId: null }),
  setApiStatus: (status) => set({ apiStatus: status }),
  triggerFitAllObservations: () => set((state) => ({ fitAllObservationsTrigger: state.fitAllObservationsTrigger + 1 })),
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
