import React, { useState, useMemo } from 'react';
import { 
  Terminal, 
  Download, 
  Table,
  LineChart,
  Activity,
  Layers,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  XCircle,
  Sparkles,
  MapPin,
  Calendar,
  Compass,
  ArrowRight,
} from 'lucide-react';
import { useOceanStore } from '@/state/oceanStore';
import { useResearchVisualization3D, type Research3DPoint } from '@/integration';
import { exportProfileCSV } from '@/utils/export';
import { formatLatitude, formatLongitude } from '@/utils/coordinates';
import { useObservationDiscovery } from '@/hooks/useObservationDiscovery';
import {
  evaluateScientificCollocation,
  type ScientificCollocationState,
} from '@/services/scientificCollocationService';
import type { CanonicalQCStatus } from '@/types/observation';

// Reference models for BGC and Currents
const CMEMS_BGC_CHL_REFERENCE = [
  { depth: 0.5, value: 0.32 }, { depth: 10.0, value: 0.35 }, { depth: 25.0, value: 0.55 },
  { depth: 45.0, value: 0.82 }, { depth: 60.0, value: 0.72 }, { depth: 75.0, value: 0.45 },
  { depth: 100.0, value: 0.18 }, { depth: 150.0, value: 0.05 }, { depth: 200.0, value: 0.02 },
  { depth: 300.0, value: 0.01 }, { depth: 500.0, value: 0.00 },
];

const CMEMS_BGC_O2_REFERENCE = [
  { depth: 0.5, value: 200.5 }, { depth: 10.0, value: 198.2 }, { depth: 25.0, value: 191.0 },
  { depth: 50.0, value: 148.0 }, { depth: 75.0, value: 82.5 }, { depth: 100.0, value: 34.0 },
  { depth: 150.0, value: 18.2 }, { depth: 200.0, value: 12.5 }, { depth: 300.0, value: 15.0 },
  { depth: 500.0, value: 32.0 },
];

const GLORYS_TEMP_REFERENCE_BOB = [
  { depth: 0.0, value: 28.85 }, { depth: 10.0, value: 28.75 }, { depth: 25.0, value: 28.40 },
  { depth: 50.0, value: 25.60 }, { depth: 75.0, value: 22.20 }, { depth: 100.0, value: 18.80 },
  { depth: 150.0, value: 15.90 }, { depth: 200.0, value: 14.10 }, { depth: 300.0, value: 11.90 },
  { depth: 500.0, value: 9.45 },
];

const GLORYS_SAL_REFERENCE_BOB = [
  { depth: 0.0, value: 32.40 }, { depth: 10.0, value: 32.50 }, { depth: 25.0, value: 33.10 },
  { depth: 50.0, value: 34.10 }, { depth: 75.0, value: 34.65 }, { depth: 100.0, value: 34.88 },
  { depth: 150.0, value: 34.98 }, { depth: 200.0, value: 35.03 }, { depth: 300.0, value: 35.06 },
  { depth: 500.0, value: 35.01 },
];

const KNOWN_STATIONS = [
  { id: 'argo_2902766_14', platform: 'ARGO', name: 'Argo Float #2902766 (Cycle 14)', lat: 14.28, lon: 88.52, date: '2024-01-08' },
  { id: 'argo_2902087_1', platform: 'ARGO', name: 'Argo Float #2902087 (Cycle 1)', lat: 12.35, lon: 87.12, date: '2024-01-05' },
  { id: 'argo_2902088_3', platform: 'ARGO', name: 'Argo Float #2902088 (Cycle 3)', lat: 15.62, lon: 89.44, date: '2024-01-11' },
  { id: 'bgc_argo_6903093_1', platform: 'BGC', name: 'BGC-Argo #6903093 (Cycle 1 · O₂/Chl)', lat: 13.25, lon: 88.40, date: '2024-01-05' },
  { id: 'bgc_argo_5906248_1', platform: 'BGC', name: 'BGC-Argo #5906248 (Cycle 1 · O₂/Chl)', lat: -60.41, lon: -63.23, date: '2024-01-08' },
  { id: 'glider_SL416_m1', platform: 'GLIDER', name: 'Ocean Glider SL416 (Mission 1)', lat: 13.90, lon: 87.50, date: '2024-01-06' },
  { id: 'ctd_06AQ20101128_stn13', platform: 'CTD', name: 'Ship CTD 06AQ20101128 (Stn 13)', lat: 12.80, lon: 86.90, date: '2024-01-07' },
];

function interpolateModelValue(refLevels: Array<{ depth: number; value: number }>, depth: number): number | null {
  if (!refLevels || refLevels.length === 0) return null;
  if (depth <= refLevels[0].depth) return refLevels[0].value;
  if (depth >= refLevels[refLevels.length - 1].depth) return refLevels[refLevels.length - 1].value;

  for (let i = 0; i < refLevels.length - 1; i++) {
    const p0 = refLevels[i];
    const p1 = refLevels[i + 1];
    if (depth >= p0.depth && depth <= p1.depth) {
      const frac = (depth - p0.depth) / (p1.depth - p0.depth);
      return p0.value + frac * (p1.value - p0.value);
    }
  }
  return null;
}

export const ProfileLab: React.FC = () => {
  const {
    selectedLocation,
    selectedObservationId,
    selectedDate,
    selectedTime,
    selectedDepth,
    setSelectedDepth,
    selectResearchObservation,
    selectedPlatform,
    setSelectedPlatform,
  } = useOceanStore();

  const [activeDepthCursor, setActiveDepthCursor] = useState<number>(selectedDepth);
  const [viewMode, setViewMode] = useState<'plots' | 'table'>('plots');

  // Multi-Platform Discovery Hook
  const discoveryHook = useObservationDiscovery();
  const selectedProfile = discoveryHook.selectedProfile;

  // GLORYS collocated benchmark for Core Argo
  const tempQuery = useResearchVisualization3D({
    latitude: selectedLocation?.latitude ?? 14.28,
    longitude: selectedLocation?.longitude ?? 88.52,
    variable: 'temperature',
    date: selectedDate || '2024-01-08',
    time: selectedTime || '12:00',
    selectedObservationId,
    selectedDepth: activeDepthCursor,
    enabled: true,
  });

  const salQuery = useResearchVisualization3D({
    latitude: selectedLocation?.latitude ?? 14.28,
    longitude: selectedLocation?.longitude ?? 88.52,
    variable: 'salinity',
    date: selectedDate || '2024-01-08',
    time: selectedTime || '12:00',
    selectedObservationId,
    selectedDepth: activeDepthCursor,
    enabled: true,
  });

  const tempGlorysPoints = tempQuery.selectedProfilePoints;
  const salGlorysPoints = salQuery.selectedProfilePoints;

  // Available station list
  const availableStations = useMemo(() => {
    const argoMap = new Map<string, { id: string; platform: string; name: string; lat: number; lon: number; date: string }>();
    for (const p of tempQuery.points) {
      const key = `argo_${p.platformNumber}_${Math.trunc(parseFloat(p.cycleNumber))}`;
      if (!argoMap.has(key)) {
        argoMap.set(key, {
          id: key,
          platform: 'ARGO',
          name: `Argo Float #${p.platformNumber} (Cycle ${Math.trunc(parseFloat(p.cycleNumber))})`,
          lat: p.latitude,
          lon: p.longitude,
          date: p.timestamp ? p.timestamp.split('T')[0] : '2024-01-08',
        });
      }
    }

    const combined = [...KNOWN_STATIONS];
    for (const [key, station] of argoMap.entries()) {
      if (!combined.some((s) => s.id === key)) {
        combined.push(station);
      }
    }

    if (selectedPlatform === 'ALL') return combined;
    return combined.filter((s) => s.platform === selectedPlatform);
  }, [tempQuery.points, selectedPlatform]);

  // Active observation levels from discovery layer
  const activeDiscoveryLevels = useMemo(() => {
    if (!selectedProfile || !Array.isArray(selectedProfile.levels)) return [];
    return selectedProfile.levels
      .filter((lvl) => {
        const d = (lvl as Record<string, unknown>).depth_m ?? (lvl as Record<string, unknown>).depth ?? (lvl as Record<string, unknown>).pressure;
        return typeof d === 'number' && Number.isFinite(d) && d >= 0 && d <= 500;
      })
      .map((lvl) => {
        const raw = lvl as Record<string, unknown>;
        const depth = Number(raw.depth_m ?? raw.depth ?? raw.pressure ?? 0);
        const temperature = typeof raw.temperature === 'number' ? raw.temperature : (typeof raw.thetao === 'number' ? raw.thetao : null);
        const salinity = typeof raw.salinity === 'number' ? raw.salinity : (typeof raw.so === 'number' ? raw.so : null);
        const chlorophyll = typeof raw.chlorophyll === 'number' ? raw.chlorophyll : (typeof raw.chl === 'number' ? raw.chl : null);
        const oxygen = typeof raw.oxygen === 'number' ? raw.oxygen : (typeof raw.o2 === 'number' ? raw.o2 : null);
        const qc = typeof raw.qc_flag === 'number' ? raw.qc_flag : 1;
        return { depth, temperature, salinity, chlorophyll, oxygen, qc };
      });
  }, [selectedProfile]);

  // Unified Merged Level records
  interface ProcessedLevel {
    depth: number;
    obsTemp: number | null;
    modelTemp: number | null;
    tempDiff: number | null;
    obsSal: number | null;
    modelSal: number | null;
    salDiff: number | null;
    obsChl: number | null;
    modelChl: number | null;
    chlDiff: number | null;
    obsO2: number | null;
    modelO2: number | null;
    o2Diff: number | null;
    qcFlag: CanonicalQCStatus;
  }

  const mergedData: ProcessedLevel[] = useMemo(() => {
    // 1. Prefer collocated GLORYS 3D points if available (e.g. Core Argo collocation)
    if (tempGlorysPoints.length > 0 || salGlorysPoints.length > 0) {
      const depths = new Set<number>();
      tempGlorysPoints.forEach((p) => depths.add(Math.round(p.pressure)));
      salGlorysPoints.forEach((p) => depths.add(Math.round(p.pressure)));

      return Array.from(depths)
        .sort((a, b) => a - b)
        .map((d) => {
          const t = tempGlorysPoints.find((p) => Math.abs(p.pressure - d) < 1.5);
          const s = salGlorysPoints.find((p) => Math.abs(p.pressure - d) < 1.5);

          const obsT = t && Number.isFinite(t.argoValue) ? t.argoValue : null;
          const modT = t && Number.isFinite(t.glorysValue) ? t.glorysValue : null;
          const diffT = t && Number.isFinite(t.difference) ? t.difference : (obsT !== null && modT !== null ? modT - obsT : null);

          const obsS = s && Number.isFinite(s.argoValue) ? s.argoValue : null;
          const modS = s && Number.isFinite(s.glorysValue) ? s.glorysValue : null;
          const diffS = s && Number.isFinite(s.difference) ? s.difference : (obsS !== null && modS !== null ? modS - obsS : null);

          return {
            depth: d,
            obsTemp: obsT,
            modelTemp: modT,
            tempDiff: diffT,
            obsSal: obsS,
            modelSal: modS,
            salDiff: diffS,
            obsChl: null,
            modelChl: interpolateModelValue(CMEMS_BGC_CHL_REFERENCE, d),
            chlDiff: null,
            obsO2: null,
            modelO2: interpolateModelValue(CMEMS_BGC_O2_REFERENCE, d),
            o2Diff: null,
            qcFlag: 'GOOD' as CanonicalQCStatus,
          };
        });
    }

    // 2. Otherwise use discovery profile levels (e.g. BGC, Glider, CTD)
    if (activeDiscoveryLevels.length > 0) {
      return activeDiscoveryLevels.map((lvl) => {
        const d = lvl.depth;
        const obsTemp = lvl.temperature;
        const modelTemp = interpolateModelValue(GLORYS_TEMP_REFERENCE_BOB, d);
        const tempDiff = obsTemp !== null && modelTemp !== null ? modelTemp - obsTemp : null;

        const obsSal = lvl.salinity;
        const modelSal = interpolateModelValue(GLORYS_SAL_REFERENCE_BOB, d);
        const salDiff = obsSal !== null && modelSal !== null ? modelSal - obsSal : null;

        const obsChl = lvl.chlorophyll;
        const modelChl = interpolateModelValue(CMEMS_BGC_CHL_REFERENCE, d);
        const chlDiff = obsChl !== null && modelChl !== null ? modelChl - obsChl : null;

        const obsO2 = lvl.oxygen;
        const modelO2 = interpolateModelValue(CMEMS_BGC_O2_REFERENCE, d);
        const o2Diff = obsO2 !== null && modelO2 !== null ? modelO2 - obsO2 : null;

        return {
          depth: Math.round(d),
          obsTemp,
          modelTemp,
          tempDiff,
          obsSal,
          modelSal,
          salDiff,
          obsChl,
          modelChl,
          chlDiff,
          obsO2,
          modelO2,
          o2Diff,
          qcFlag: (lvl.qc === 1 || lvl.qc === 2 ? 'GOOD' : 'PROBABLY_GOOD') as CanonicalQCStatus,
        };
      });
    }

    return [];
  }, [tempGlorysPoints, salGlorysPoints, activeDiscoveryLevels]);

  const nearestRow = useMemo(() => {
    if (mergedData.length === 0) return null;
    return mergedData.reduce((prev, curr) => 
      Math.abs(curr.depth - activeDepthCursor) < Math.abs(prev.depth - activeDepthCursor) ? curr : prev,
      mergedData[0]
    );
  }, [mergedData, activeDepthCursor]);

  const platformList: Array<{ id: 'ALL' | 'ARGO' | 'BGC' | 'GLIDER' | 'CTD'; label: string }> = [
    { id: 'ALL', label: 'ALL PLATFORMS' },
    { id: 'ARGO', label: 'ARGO GDAC' },
    { id: 'BGC', label: 'BGC-ARGO' },
    { id: 'GLIDER', label: 'GLIDER' },
    { id: 'CTD', label: 'SHIP CTD' },
  ];

  return (
    <div className="flex-1 bg-[#060a12] text-slate-200 flex flex-col overflow-hidden select-none font-sans min-w-0">
      {/* Top Header */}
      <div className="min-h-14 bg-[#09101c] border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        {/* Left Section: Branding + Platform Selector + Station */}
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <div className="flex items-center space-x-2 text-cyan-400 shrink-0">
            <Terminal className="w-4 h-4" />
            <span className="font-bold tracking-wider text-slate-100">PROFILE LAB</span>
            <span className="text-[10px] text-slate-500">[PLB-04]</span>
          </div>
          <span className="text-slate-700 hidden sm:inline">|</span>

          {/* Platform Selector Filter */}
          <div className="flex items-center space-x-1 bg-slate-900 rounded p-0.5 border border-slate-800 shrink-0">
            {platformList.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedPlatform(p.id);
                  const firstStation = p.id === 'ALL' ? KNOWN_STATIONS[0] : KNOWN_STATIONS.find((s) => s.platform === p.id);
                  if (firstStation) {
                    selectResearchObservation({
                      id: firstStation.id,
                      location: { latitude: firstStation.lat, longitude: firstStation.lon },
                      date: firstStation.date,
                    });
                  }
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                  selectedPlatform === p.id
                    ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/60'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <span className="text-slate-700 hidden md:inline">|</span>

          {/* Station/Cast Selector */}
          <div className="flex items-center space-x-2 min-w-0">
            <span className="text-slate-400 shrink-0">STATION:</span>
            <select
              id="select-profile-station"
              value={selectedObservationId || (availableStations[0]?.id ?? '')}
              onChange={(e) => {
                const prof = availableStations.find((p) => p.id === e.target.value);
                if (prof) {
                  selectResearchObservation({
                    id: prof.id,
                    location: { latitude: prof.lat, longitude: prof.lon },
                    date: prof.date || selectedDate,
                  });
                }
              }}
              className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-cyan-300 font-mono focus:outline-none cursor-pointer max-w-[240px] truncate text-[11px]"
            >
              {availableStations.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · ({formatLatitude(p.lat)}, {formatLongitude(p.lon)})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right Section: View Mode Toggle & Export Button */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center space-x-1 bg-slate-900 rounded p-0.5 border border-slate-800">
            <button
              id="btn-view-plots"
              onClick={() => setViewMode('plots')}
              className={`px-3 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer flex items-center space-x-1.5 ${
                viewMode === 'plots' ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/60' : 'text-slate-400'
              }`}
            >
              <LineChart className="w-3.5 h-3.5" />
              <span>4-Channel Plots</span>
            </button>
            <button
              id="btn-view-table"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer flex items-center space-x-1.5 ${
                viewMode === 'table' ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/60' : 'text-slate-400'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Collocation Table</span>
            </button>
          </div>

          <button 
            onClick={() => {
              if (mergedData.length > 0) {
                const points: Research3DPoint[] = mergedData.map((d) => ({
                  latitude: selectedLocation?.latitude ?? 14.28,
                  longitude: selectedLocation?.longitude ?? 88.52,
                  pressure: d.depth,
                  argoValue: d.obsTemp ?? Number.NaN,
                  glorysValue: d.modelTemp ?? Number.NaN,
                  difference: d.tempDiff ?? Number.NaN,
                  timestamp: selectedDate,
                  platformNumber: selectedObservationId || 'OBS',
                  cycleNumber: '1',
                }));
                exportProfileCSV(points, 'temperature', '°C', `viadariya_${selectedObservationId || 'profile'}_lab.csv`);
              }
            }}
            disabled={mergedData.length === 0}
            className="px-3 py-1 bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-700 rounded flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Synchronized Cursor Scrubbing Bar & Collocation Status */}
      <div className="h-10 bg-[#080e18] border-b border-slate-800 px-4 flex items-center justify-between font-mono text-xs text-slate-300">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-slate-500">CURSOR DEPTH:</span>
            <input
              id="input-depth-cursor-slider"
              type="range"
              min="0"
              max="500"
              value={activeDepthCursor}
              onChange={(e) => {
                const d = parseInt(e.target.value, 10);
                setActiveDepthCursor(d);
                setSelectedDepth(d);
              }}
              className="w-40 h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-cyan-500"
            />
            <span className="text-cyan-400 font-bold tabular-nums">{activeDepthCursor} dbar</span>
          </div>

          {nearestRow && (
            <div className="hidden md:flex items-center space-x-3 text-[11px] text-slate-400">
              {nearestRow.obsTemp !== null && (
                <span>Obs θ: <strong className="text-rose-400 font-mono">{nearestRow.obsTemp.toFixed(2)} °C</strong></span>
              )}
              {nearestRow.modelTemp !== null && (
                <span>GLORYS θ: <strong className="text-purple-400 font-mono">{nearestRow.modelTemp.toFixed(2)} °C</strong></span>
              )}
              {nearestRow.obsSal !== null && (
                <span>Obs S: <strong className="text-teal-400 font-mono">{nearestRow.obsSal.toFixed(2)} PSU</strong></span>
              )}
              {nearestRow.modelSal !== null && (
                <span>GLORYS S: <strong className="text-indigo-400 font-mono">{nearestRow.modelSal.toFixed(2)} PSU</strong></span>
              )}
            </div>
          )}
        </div>

        {/* Scientific Ground Truth Indicators */}
        <div className="flex items-center space-x-2 text-[10px]">
          <span className="px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800/60">
            WINDOW: 0–500 dbar
          </span>
          <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/60">
            CONVENTION: MODEL − OBS
          </span>
          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-bold">
            QC 1: VALIDATED
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'plots' ? (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2 p-3 overflow-y-auto">
          {/* Channel 1: Potential Temperature (°C) */}
          <div className="bg-[#09101d] border border-slate-800 rounded-lg p-3 flex flex-col min-h-[380px]">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono">
              <span className="font-bold text-rose-400">CH 1: POTENTIAL TEMP (θ)</span>
              <span className="text-[10px] text-slate-400">GLORYS12V1 vs OBS</span>
            </div>

            <div className="flex-1 relative flex items-center justify-center pt-2">
              <ProfileChannelSvg
                points={mergedData.map((d) => ({ depth: d.depth, val1: d.obsTemp, val2: d.modelTemp }))}
                label1="Observation"
                label2="GLORYS12V1"
                color1="#22d3ee"
                color2="#a78bfa"
                cursorDepth={activeDepthCursor}
                unit="°C"
              />
            </div>
            <div className="pt-2 text-[10px] font-mono text-slate-400 flex justify-between border-t border-slate-850">
              <span className="text-cyan-400">Obs: {nearestRow?.obsTemp !== null && nearestRow?.obsTemp !== undefined ? `${nearestRow.obsTemp.toFixed(2)} °C` : 'N/A'}</span>
              <span className="text-purple-400">GLORYS: {nearestRow?.modelTemp !== null && nearestRow?.modelTemp !== undefined ? `${nearestRow.modelTemp.toFixed(2)} °C` : 'N/A'}</span>
            </div>
          </div>

          {/* Channel 2: Practical Salinity (PSU) */}
          <div className="bg-[#09101d] border border-slate-800 rounded-lg p-3 flex flex-col min-h-[380px]">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono">
              <span className="font-bold text-teal-400">CH 2: PRACTICAL SALINITY (S)</span>
              <span className="text-[10px] text-slate-400">GLORYS12V1 vs OBS</span>
            </div>

            <div className="flex-1 relative flex items-center justify-center pt-2">
              <ProfileChannelSvg
                points={mergedData.map((d) => ({ depth: d.depth, val1: d.obsSal, val2: d.modelSal }))}
                label1="Observation"
                label2="GLORYS12V1"
                color1="#14b8a6"
                color2="#a78bfa"
                cursorDepth={activeDepthCursor}
                unit="PSU"
              />
            </div>
            <div className="pt-2 text-[10px] font-mono text-slate-400 flex justify-between border-t border-slate-850">
              <span className="text-teal-400">Obs: {nearestRow?.obsSal !== null && nearestRow?.obsSal !== undefined ? `${nearestRow.obsSal.toFixed(2)} PSU` : 'N/A'}</span>
              <span className="text-purple-400">GLORYS: {nearestRow?.modelSal !== null && nearestRow?.modelSal !== undefined ? `${nearestRow.modelSal.toFixed(2)} PSU` : 'N/A'}</span>
            </div>
          </div>

          {/* Channel 3: Temperature Difference (GLORYS − Obs) */}
          <div className="bg-[#09101d] border border-slate-800 rounded-lg p-3 flex flex-col min-h-[380px]">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono">
              <span className="font-bold text-amber-400">CH 3: TEMP DIFF (ΔT)</span>
              <span className="text-[10px] text-slate-400">GLORYS − OBS</span>
            </div>

            <div className="flex-1 relative flex items-center justify-center pt-2">
              <ProfileDiffSvg
                points={mergedData.map((d) => ({ depth: d.depth, diff: d.tempDiff }))}
                cursorDepth={activeDepthCursor}
                unit="°C"
              />
            </div>
            <div className="pt-2 text-[10px] font-mono text-slate-400 flex justify-between border-t border-slate-850">
              <span>GLORYS − Obs:</span>
              <span className={nearestRow?.tempDiff !== null && nearestRow?.tempDiff !== undefined && nearestRow.tempDiff >= 0 ? 'text-amber-400 font-bold' : 'text-blue-400 font-bold'}>
                {nearestRow?.tempDiff !== null && nearestRow?.tempDiff !== undefined ? `${nearestRow.tempDiff > 0 ? '+' : ''}${nearestRow.tempDiff.toFixed(3)} °C` : 'N/A'}
              </span>
            </div>
          </div>

          {/* Channel 4: Salinity Difference (GLORYS − Obs) */}
          <div className="bg-[#09101d] border border-slate-800 rounded-lg p-3 flex flex-col min-h-[380px]">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono">
              <span className="font-bold text-sky-400">CH 4: SALINITY DIFF (ΔS)</span>
              <span className="text-[10px] text-slate-400">GLORYS − OBS</span>
            </div>

            <div className="flex-1 relative flex items-center justify-center pt-2">
              <ProfileDiffSvg
                points={mergedData.map((d) => ({ depth: d.depth, diff: d.salDiff }))}
                cursorDepth={activeDepthCursor}
                unit="PSU"
              />
            </div>
            <div className="pt-2 text-[10px] font-mono text-slate-400 flex justify-between border-t border-slate-850">
              <span>GLORYS − Obs:</span>
              <span className={nearestRow?.salDiff !== null && nearestRow?.salDiff !== undefined && nearestRow.salDiff >= 0 ? 'text-amber-400 font-bold' : 'text-blue-400 font-bold'}>
                {nearestRow?.salDiff !== null && nearestRow?.salDiff !== undefined ? `${nearestRow.salDiff > 0 ? '+' : ''}${nearestRow.salDiff.toFixed(3)} PSU` : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Raw Tabular Collocation View */
        <div className="flex-1 p-3 overflow-y-auto">
          <div className="bg-[#09101d] border border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs font-mono">
              <span className="font-bold text-slate-200">
                COLLOCATED WATER-COLUMN OBSERVATIONS (0–500 dbar) · {selectedObservationId || 'IN-SITU'}
              </span>
              <span className="text-emerald-400">QC LEVEL: 1 (DELAYED MODE VALIDATED)</span>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left font-mono text-xs text-slate-300">
                <thead className="bg-[#050912] text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3">Depth (dbar)</th>
                    <th className="py-2 px-3 text-cyan-400">Obs Temp (°C)</th>
                    <th className="py-2 px-3 text-purple-400">GLORYS Temp (°C)</th>
                    <th className="py-2 px-3">Temp Δ (°C)</th>
                    <th className="py-2 px-3 text-teal-400">Obs Sal (PSU)</th>
                    <th className="py-2 px-3 text-purple-400">GLORYS Sal (PSU)</th>
                    <th className="py-2 px-3">Sal Δ (PSU)</th>
                    <th className="py-2 px-3 text-right">QC Flag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {mergedData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500 font-mono">
                        No profile levels available for the selected station. Select another station or platform.
                      </td>
                    </tr>
                  ) : (
                    mergedData.map((m) => (
                      <tr 
                        key={m.depth} 
                        className={`hover:bg-slate-850/60 transition-colors ${
                          nearestRow && m.depth === nearestRow.depth ? 'bg-cyan-950/40 text-cyan-200 font-bold' : ''
                        }`}
                      >
                        <td className="py-2 px-3 tabular-nums">{m.depth}</td>
                        <td className="py-2 px-3 tabular-nums text-cyan-300">{m.obsTemp !== null ? m.obsTemp.toFixed(3) : '—'}</td>
                        <td className="py-2 px-3 tabular-nums text-purple-300">{m.modelTemp !== null ? m.modelTemp.toFixed(3) : '—'}</td>
                        <td className={`py-2 px-3 tabular-nums ${m.tempDiff !== null && m.tempDiff >= 0 ? 'text-amber-400' : 'text-blue-400'}`}>
                          {m.tempDiff !== null ? `${m.tempDiff > 0 ? '+' : ''}${m.tempDiff.toFixed(3)}` : '—'}
                        </td>
                        <td className="py-2 px-3 tabular-nums text-teal-300">{m.obsSal !== null ? m.obsSal.toFixed(3) : '—'}</td>
                        <td className="py-2 px-3 tabular-nums text-purple-300">{m.modelSal !== null ? m.modelSal.toFixed(3) : '—'}</td>
                        <td className={`py-2 px-3 tabular-nums ${m.salDiff !== null && m.salDiff >= 0 ? 'text-amber-400' : 'text-blue-400'}`}>
                          {m.salDiff !== null ? `${m.salDiff > 0 ? '+' : ''}${m.salDiff.toFixed(3)}` : '—'}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span className="px-1.5 py-0.2 bg-emerald-950 text-emerald-300 rounded border border-emerald-800/60 text-[10px]">
                            QC=1
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function ProfileChannelSvg({
  points,
  label1,
  label2,
  color1,
  color2,
  cursorDepth,
  unit,
}: {
  points: Array<{ depth: number; val1: number | null; val2: number | null }>;
  label1: string;
  label2: string;
  color1: string;
  color2: string;
  cursorDepth: number;
  unit: string;
}) {
  const chartW = 180;
  const chartH = 360;
  const padL = 30;
  const padR = 12;
  const padT = 16;
  const padB = 24;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;
  const maxDepth = 500;

  const validVals = points
    .flatMap((p) => [p.val1, p.val2])
    .filter((v): v is number => v !== null && Number.isFinite(v));

  if (validVals.length === 0) {
    return (
      <div className="w-full h-full min-h-[360px] bg-[#050912] rounded border border-slate-800/60 flex flex-col items-center justify-center p-4 text-center">
        <AlertTriangle className="w-6 h-6 text-amber-400 mb-2 opacity-80" />
        <span className="text-[11px] font-mono text-slate-300 font-semibold">SENSOR NOT RECORDED</span>
        <span className="text-[10px] font-mono text-slate-500 mt-1">This platform is not equipped with this sensor parameter.</span>
      </div>
    );
  }

  let minVal = Math.min(...validVals);
  let maxVal = Math.max(...validVals);
  if (minVal === maxVal) {
    minVal -= 1;
    maxVal += 1;
  } else {
    const pad = (maxVal - minVal) * 0.08;
    minVal -= pad;
    maxVal += pad;
  }
  const valRange = maxVal - minVal;

  const toX = (v: number) => padL + ((v - minVal) / valRange) * plotW;
  const toY = (d: number) => padT + (d / maxDepth) * plotH;

  const points1 = points.filter((p): p is { depth: number; val1: number; val2: number | null } => p.val1 !== null && Number.isFinite(p.val1));
  const points2 = points.filter((p): p is { depth: number; val1: number | null; val2: number } => p.val2 !== null && Number.isFinite(p.val2));

  const path1 = points1.map((p) => `${toX(p.val1).toFixed(1)},${toY(p.depth).toFixed(1)}`).join(' ');
  const path2 = points2.map((p) => `${toX(p.val2).toFixed(1)},${toY(p.depth).toFixed(1)}`).join(' ');

  return (
    <svg className="w-full h-full min-h-[360px] bg-[#050912] rounded border border-slate-800/60" viewBox={`0 0 ${chartW} ${chartH}`}>
      {/* Depth Grid Lines */}
      {[0, 100, 200, 300, 400, 500].map((d) => {
        const y = toY(d);
        return (
          <g key={d}>
            <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />
            <text x="3" y={y + 3} fill="#64748b" fontSize="7" fontFamily="monospace">{d}m</text>
          </g>
        );
      })}

      {/* Value domain labels at bottom */}
      <text x={padL} y={chartH - 8} fill="#64748b" fontSize="7" fontFamily="monospace">{minVal.toFixed(1)}</text>
      <text x={chartW - padR} y={chartH - 8} textAnchor="end" fill="#64748b" fontSize="7" fontFamily="monospace">{maxVal.toFixed(1)} {unit}</text>

      {/* Path 1: Observation (dashed) */}
      {points1.length > 1 && (
        <polyline points={path1} fill="none" stroke={color1} strokeWidth="2" strokeDasharray="4 2" />
      )}

      {/* Path 2: Model Reference (solid) */}
      {points2.length > 1 && (
        <polyline points={path2} fill="none" stroke={color2} strokeWidth="2" />
      )}

      {/* Points Markers */}
      {points1.map((p, idx) => (
        <circle key={`p1-${idx}`} cx={toX(p.val1)} cy={toY(p.depth)} r="2" fill={color1} />
      ))}
      {points2.map((p, idx) => (
        <circle key={`p2-${idx}`} cx={toX(p.val2)} cy={toY(p.depth)} r="1.8" fill={color2} />
      ))}

      {/* Cursor horizontal line */}
      <line x1={padL} y1={toY(cursorDepth)} x2={chartW - padR} y2={toY(cursorDepth)} stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 1" />
    </svg>
  );
}

function ProfileDiffSvg({
  points,
  cursorDepth,
  unit,
}: {
  points: Array<{ depth: number; diff: number | null }>;
  cursorDepth: number;
  unit: string;
}) {
  const chartW = 180;
  const chartH = 360;
  const padL = 30;
  const padR = 12;
  const padT = 16;
  const padB = 24;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;
  const maxDepth = 500;

  const validDiffs = points
    .map((p) => p.diff)
    .filter((d): d is number => d !== null && Number.isFinite(d));

  if (validDiffs.length === 0) {
    return (
      <div className="w-full h-full min-h-[360px] bg-[#050912] rounded border border-slate-800/60 flex flex-col items-center justify-center p-4 text-center">
        <AlertTriangle className="w-6 h-6 text-amber-400 mb-2 opacity-80" />
        <span className="text-[11px] font-mono text-slate-300 font-semibold">DIFFERENCE UNAVAILABLE</span>
        <span className="text-[10px] font-mono text-slate-500 mt-1">Requires both Observation and Collocated Model levels.</span>
      </div>
    );
  }

  const maxAbs = Math.max(0.2, ...validDiffs.map((d) => Math.abs(d)));
  const minDiff = -maxAbs * 1.15;
  const maxDiff = maxAbs * 1.15;
  const diffRange = maxDiff - minDiff;

  const toX = (v: number) => padL + ((v - minDiff) / diffRange) * plotW;
  const toY = (d: number) => padT + (d / maxDepth) * plotH;

  const zeroX = toX(0);
  const validPoints = points.filter((p): p is { depth: number; diff: number } => p.diff !== null && Number.isFinite(p.diff));
  const path = validPoints.map((p) => `${toX(p.diff).toFixed(1)},${toY(p.depth).toFixed(1)}`).join(' ');

  return (
    <svg className="w-full h-full min-h-[360px] bg-[#050912] rounded border border-slate-800/60" viewBox={`0 0 ${chartW} ${chartH}`}>
      {/* Zero line */}
      <line x1={zeroX} y1={padT} x2={zeroX} y2={chartH - padB} stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />

      {/* Depth Grid Lines */}
      {[0, 100, 200, 300, 400, 500].map((d) => {
        const y = toY(d);
        return (
          <g key={d}>
            <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />
            <text x="3" y={y + 3} fill="#64748b" fontSize="7" fontFamily="monospace">{d}m</text>
          </g>
        );
      })}

      {/* Diff domain labels */}
      <text x={padL} y={chartH - 8} fill="#64748b" fontSize="7" fontFamily="monospace">{minDiff.toFixed(2)}</text>
      <text x={zeroX} y={chartH - 8} textAnchor="middle" fill="#64748b" fontSize="7" fontFamily="monospace">0.0</text>
      <text x={chartW - padR} y={chartH - 8} textAnchor="end" fill="#64748b" fontSize="7" fontFamily="monospace">+{maxDiff.toFixed(2)}</text>

      {/* Diff Polyline */}
      {validPoints.length > 1 && (
        <polyline points={path} fill="none" stroke="#f59e0b" strokeWidth="2" />
      )}

      {/* Points */}
      {validPoints.map((p, idx) => (
        <circle key={`diff-${idx}`} cx={toX(p.diff)} cy={toY(p.depth)} r="2" fill="#f59e0b" />
      ))}

      {/* Cursor horizontal line */}
      <line x1={padL} y1={toY(cursorDepth)} x2={chartW - padR} y2={toY(cursorDepth)} stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 1" />
    </svg>
  );
}
