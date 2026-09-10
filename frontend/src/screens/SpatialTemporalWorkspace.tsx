import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Compass, 
  Layers, 
  Play, 
  Pause, 
  RotateCcw, 
  Eye, 
  MapPin, 
  Info, 
  Globe,
  Radio,
  ChevronRight,
  Maximize2
} from 'lucide-react';
import { useOceanStore } from '@/state/oceanStore';
import { OceanGlobe } from '@/components/globe/OceanGlobe';
import { CoordinateMarker } from '@/components/globe/CoordinateMarker';
import { ObservationPoints } from '@/components/globe/ObservationPoints';
import { OBSERVATION_DATES, observationDateLabel } from '@/config/observationDates';
import { formatLatitude, formatLongitude, formatDepth } from '@/utils/coordinates';
import { variables } from '@/config/variables';

export const SpatialTemporalWorkspace: React.FC = () => {
  const navigate = useNavigate();
  const {
    selectedLocation,
    selectedDepth,
    setSelectedDepth,
    selectedVariable,
    setSelectedVariable,
    selectedDate,
    setSelectedDate,
    selectedObservationId,
    triggerFitAllObservations,
    stepTime,
    timeIndex,
  } = useOceanStore();

  const [isPlayingTime, setIsPlayingTime] = useState<boolean>(false);
  const [showFloats, setShowFloats] = useState<boolean>(true);

  // Time playback loop across OBSERVATION_DATES
  useEffect(() => {
    if (!isPlayingTime) return;
    const interval = setInterval(() => {
      const currentIndex = OBSERVATION_DATES.indexOf(selectedDate as any);
      const nextIndex = (currentIndex + 1) % OBSERVATION_DATES.length;
      setSelectedDate(OBSERVATION_DATES[nextIndex]);
    }, 2000);
    return () => clearInterval(interval);
  }, [isPlayingTime, selectedDate, setSelectedDate]);

  // Color map configuration for validated variables
  const layerLegends = {
    temperature: { name: 'Sea Potential Temp (°C)', min: '14.0°C', max: '29.5°C', gradient: 'from-blue-600 via-teal-400 via-amber-300 to-red-600' },
    salinity: { name: 'Practical Salinity (PSU)', min: '32.0 PSU', max: '35.5 PSU', gradient: 'from-emerald-700 via-cyan-400 to-indigo-700' },
  };

  const currentLegend = layerLegends[selectedVariable === 'salinity' ? 'salinity' : 'temperature'];

  // Parse platform and cycle from observation ID (argo_{platform}_{cycle})
  let platformLabel = '';
  let cycleLabel = '';
  if (selectedObservationId) {
    const parts = selectedObservationId.split('_');
    if (parts.length >= 3) {
      platformLabel = parts[1];
      cycleLabel = parts[2];
    }
  }

  const depthPresets = [0, 10, 50, 100, 200, 300, 500];

  return (
    <div className="flex-1 bg-[#060a12] text-slate-200 flex flex-col overflow-hidden select-none font-sans">
      {/* Top Workspace Command Bar */}
      <div className="h-12 bg-[#09101c] border-b border-slate-800 px-4 flex items-center justify-between z-10 text-xs font-mono">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-cyan-400">
            <Compass className="w-4 h-4" />
            <span className="font-bold tracking-wider text-slate-100">SPATIAL & TEMPORAL EXPLORATION</span>
            <span className="text-[10px] text-slate-500">[STE-01]</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center space-x-1.5 text-slate-400">
            <Globe className="w-3.5 h-3.5 text-slate-500" />
            <span>BAY OF BENGAL 4D BASIN (CESIUM ION)</span>
          </div>
        </div>

        {/* Layer Switcher Buttons: Validated OceanScope Variables */}
        <div className="flex items-center bg-slate-900 rounded p-0.5 border border-slate-800">
          <button
            id="btn-layer-temp"
            onClick={() => setSelectedVariable('temperature')}
            className={`px-3 py-1 rounded text-[11px] font-mono uppercase transition-colors cursor-pointer ${
              selectedVariable === 'temperature'
                ? 'bg-cyan-950 text-cyan-300 font-semibold border border-cyan-800/60'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Temperature (°C)
          </button>
          <button
            id="btn-layer-sal"
            onClick={() => setSelectedVariable('salinity')}
            className={`px-3 py-1 rounded text-[11px] font-mono uppercase transition-colors cursor-pointer ${
              selectedVariable === 'salinity'
                ? 'bg-cyan-950 text-cyan-300 font-semibold border border-cyan-800/60'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Salinity (PSU)
          </button>
        </div>

        {/* Right toggles */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowFloats(!showFloats)}
            className={`px-2.5 py-1 rounded text-[11px] border flex items-center space-x-1.5 transition-colors cursor-pointer ${
              showFloats ? 'bg-cyan-950/60 text-cyan-300 border-cyan-800/60' : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
          >
            <Radio className="w-3 h-3" />
            <span>Argo Markers</span>
          </button>

          <button
            onClick={triggerFitAllObservations}
            className="px-2.5 py-1 rounded text-[11px] bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 flex items-center space-x-1.5 transition-colors cursor-pointer"
            title="Fit camera to Bay of Bengal observation points"
          >
            <Maximize2 className="w-3 h-3 text-cyan-400" />
            <span>Fit Extent</span>
          </button>
        </div>
      </div>

      {/* Main Split: Central 3D Globe + Right Target Inspector Drawer */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Central Spatial Map Viewport: Cesium Container */}
        <div className="flex-1 flex flex-col relative bg-[#040810] overflow-hidden">
          {/* Cesium Globe Canvas */}
          <div className="relative flex-1 min-h-0 w-full h-full">
            <OceanGlobe />
            <CoordinateMarker />
            <ObservationPoints />

            {/* Bottom Floating Legend Bar */}
            <div className="absolute bottom-6 left-6 z-20 bg-[#09101d]/90 border border-slate-800 rounded px-4 py-2 text-xs font-mono shadow-xl backdrop-blur-md flex items-center space-x-4">
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">
                  {currentLegend.name}
                </div>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-[10px] text-slate-500">{currentLegend.min}</span>
                  <div className={`h-2 w-32 rounded bg-gradient-to-r ${currentLegend.gradient} border border-slate-700`} />
                  <span className="text-[10px] text-slate-500">{currentLegend.max}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Temporal Scrubber / Time Controls Bar (Mirrors OBSERVATION_DATES) */}
          <div className="min-h-14 bg-[#09101c] border-t border-slate-800 px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-xs z-20">
            <div className="flex items-center space-x-3">
              <button
                id="btn-time-play"
                onClick={() => setIsPlayingTime(!isPlayingTime)}
                className="w-8 h-8 rounded bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center transition-colors shadow cursor-pointer"
              >
                {isPlayingTime ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>
              <button
                onClick={() => setSelectedDate(OBSERVATION_DATES[0])}
                className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
                title="Reset Time"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <div className="text-slate-300">
                <span className="text-slate-500">OBSERVATION EPOCH:</span>{' '}
                <span className="text-cyan-400 font-bold tabular-nums">
                  {selectedDate} ({observationDateLabel(selectedDate)})
                </span>
              </div>
            </div>

            {/* Range Scrubber: 9 Observation Dates */}
            <div className="order-3 flex w-full min-w-0 items-center space-x-3 sm:order-none sm:flex-1 sm:max-w-md">
              <span className="text-[10px] text-slate-500">JAN 01</span>
              <input
                id="range-time-scrubber"
                type="range"
                min="0"
                max={OBSERVATION_DATES.length - 1}
                value={timeIndex >= 0 ? timeIndex : 0}
                onChange={(e) => {
                  const idx = parseInt(e.target.value, 10);
                  if (OBSERVATION_DATES[idx]) setSelectedDate(OBSERVATION_DATES[idx]);
                }}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <span className="text-[10px] text-slate-500">JAN 14</span>
            </div>

            <div className="flex min-w-[13rem] items-center gap-2 rounded-md border border-slate-800 bg-slate-950/30 px-2.5 py-1.5 text-[11px]">
              <span className="font-sans font-medium text-slate-300">Depth</span>
              <span className="text-[10px] text-slate-500">{depthPresets[0]} m</span>
              <input
                id="range-explore-depth"
                type="range"
                min={depthPresets[0]}
                max={depthPresets[depthPresets.length - 1]}
                step="1"
                value={selectedDepth}
                onChange={(e) => setSelectedDepth(Number(e.target.value))}
                className="min-w-0 flex-1 accent-cyan-400 transition-opacity hover:opacity-100 focus-visible:opacity-100"
                aria-label="Depth being viewed"
              />
              <span className="text-[10px] text-slate-500">{depthPresets[depthPresets.length - 1]} m</span>
              <output htmlFor="range-explore-depth" className="w-11 text-right font-mono font-semibold tabular-nums text-cyan-300">
                {selectedDepth} m
              </output>
            </div>

            <div className="hidden">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>GLORYS × ARGO DAILY</span>
            </div>
          </div>
        </div>

        {/* Right Station & Float Inspector Drawer */}
        <div className="w-80 bg-[#080e18] border-l border-slate-800 flex flex-col overflow-y-auto font-mono text-xs z-10">
          <div className="p-3.5 border-b border-slate-800 bg-[#09101d] flex items-center justify-between">
            <span className="font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span>Target Inspector</span>
            </span>
            <span className="text-[10px] text-slate-500">BAY OF BENGAL</span>
          </div>

          <div className="p-4 space-y-4">
            {/* Selected Observation Card */}
            {selectedObservationId ? (
              <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-cyan-400 font-bold">ARGO {platformLabel}</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-cyan-950 text-cyan-300 rounded border border-cyan-800/60">
                    CYCLE #{cycleLabel}
                  </span>
                </div>
                <div className="text-slate-300 text-[11px] font-sans font-medium">
                  Real Delayed Mode Profile
                </div>
                <div className="text-[11px] text-slate-400 space-y-1">
                  <div>Basin: <span className="text-slate-200">Bay of Bengal</span></div>
                  <div>Coords: <span className="text-cyan-400">
                    {selectedLocation ? `${formatLatitude(selectedLocation.latitude)}, ${formatLongitude(selectedLocation.longitude)}` : '—'}
                  </span></div>
                  <div>Selected Depth: <span className="text-slate-200">{formatDepth(selectedDepth)}</span></div>
                  <div>Date: <span className="text-amber-400">{selectedDate}</span></div>
                  <div>QC Flag: <span className="text-emerald-400">Passed (QC=1)</span></div>
                </div>

                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <button
                    id="btn-inspect-research"
                    onClick={() => navigate('/research')}
                    className="w-full py-1.5 px-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer font-sans font-medium"
                  >
                    <span>Inspect in Research 3D</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    id="btn-inspect-profile-lab"
                    onClick={() => navigate('/profile-lab')}
                    className="w-full py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <span>Analyze in Profile Lab</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/50 border border-slate-800/80 rounded-lg p-4 text-center text-slate-400 space-y-2">
                <MapPin className="w-6 h-6 text-slate-600 mx-auto" />
                <div className="text-xs font-medium text-slate-300">No Profile Selected</div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Click any cyan Argo marker on the globe to select a real hydrographic observation.
                  Arbitrary globe clicks are navigation only.
                </p>
              </div>
            )}

            {/* Collocation Dataset Summary */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-2 font-bold">
                Collocation Ground Truth
              </div>
              <div className="space-y-1.5 text-[11px] text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">Model:</span>
                  <span className="text-cyan-400">GLORYS12V1 (CMEMS)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Observation:</span>
                  <span className="text-teal-400">Argo Delayed Mode</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Convention:</span>
                  <span className="text-amber-400">GLORYS − Argo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Valid Depth:</span>
                  <span className="text-emerald-400">0–500 dbar</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
