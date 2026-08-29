import { useState } from 'react';
import { useOceanStore } from '@/state/oceanStore';
import { DepthControl } from './DepthControl';
import { LayerControls } from './LayerControls';
import { VariableControls } from './VariableControls';

export function Ocean3DView() {
  const { selectedLocation, isModelViewOpen, setIsModelViewOpen } = useOceanStore();
  const [activeLayer, setActiveLayer] = useState<'surface' | 'depth' | 'profile'>('surface');

  if (!isModelViewOpen || !selectedLocation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="mx-4 flex h-[90vh] w-full max-w-6xl flex-col rounded-2xl border border-slate-700/50 bg-[#0a0e1a] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">3D Ocean Visualization</h2>
            <p className="text-xs text-slate-500">
              {selectedLocation.latitude.toFixed(2)}° {selectedLocation.latitude >= 0 ? 'N' : 'S'},{' '}
              {selectedLocation.longitude.toFixed(2)}° {selectedLocation.longitude >= 0 ? 'E' : 'W'}
            </p>
          </div>
          <button
            onClick={() => setIsModelViewOpen(false)}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Controls sidebar */}
          <div className="w-64 border-r border-slate-800 p-4 overflow-y-auto">
            <DepthControl />
            <div className="mt-4">
              <VariableControls />
            </div>
            <div className="mt-4">
              <LayerControls />
            </div>
          </div>

          {/* Main visualization area */}
          <div className="flex-1 relative overflow-hidden">
            {/* Layer tabs */}
            <div className="absolute left-4 top-4 z-10 flex gap-2">
              {(['surface', 'depth', 'profile'] as const).map((layer) => (
                <button
                  key={layer}
                  onClick={() => setActiveLayer(layer)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                    activeLayer === layer
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-800/80 text-slate-400 hover:text-white'
                  }`}
                >
                  {layer === 'surface' ? 'Surface Layer' : layer === 'depth' ? 'Depth Slices' : 'Vertical Profile'}
                </button>
              ))}
            </div>

            {/* Visualization canvas */}
            <div className="h-full w-full bg-gradient-to-b from-[#0d1b3e] to-[#0a0e1a]">
              {activeLayer === 'surface' && <SurfaceLayerViz />}
              {activeLayer === 'depth' && <DepthSliceViz />}
              {activeLayer === 'profile' && <ProfileViz />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SurfaceLayerViz() {
  // Mock surface visualization with CSS
  return (
    <div className="flex h-full items-center justify-center">
      <div className="relative">
        {/* Grid visualization */}
        <div className="grid grid-cols-12 gap-px">
          {Array.from({ length: 96 }).map((_, i) => {
            const temp = 20 + Math.sin(i * 0.3) * 5 + Math.cos(i * 0.2) * 3;
            const hue = ((temp - 15) / 20) * 240;
            return (
              <div
                key={i}
                className="h-8 w-8 transition-colors duration-300 hover:ring-2 hover:ring-white/30"
                style={{
                  backgroundColor: `hsl(${240 - hue}, 80%, ${30 + (temp - 20) * 2}%)`,
                }}
                title={`Temp: ${temp.toFixed(1)}°C`}
              />
            );
          })}
        </div>
        <p className="mt-3 text-center text-[10px] text-slate-500">
          Surface Temperature Distribution — Mock Data
        </p>
      </div>
    </div>
  );
}

function DepthSliceViz() {
  const depths = [0, 50, 100, 200, 500, 1000];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8">
      <h3 className="text-sm font-medium text-slate-300">Depth Slices</h3>
      <div className="flex flex-col gap-2 w-full max-w-md">
        {depths.map((depth) => {
          const temp = 28 - depth * 0.02;
          const hue = ((temp - 2) / 26) * 240;
          return (
            <div key={depth} className="flex items-center gap-3">
              <span className="w-16 text-right text-[10px] text-slate-500">{depth}m</span>
              <div className="flex-1 h-6 rounded bg-gradient-to-r from-blue-900/50 to-blue-600/30 relative overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded"
                  style={{
                    width: `${(temp / 30) * 100}%`,
                    background: `hsl(${240 - hue}, 70%, 40%)`,
                  }}
                />
              </div>
              <span className="w-12 text-[10px] text-slate-400">{temp.toFixed(1)}°C</span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-slate-500">Mock depth slice data</p>
    </div>
  );
}

function ProfileViz() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-3 h-48 w-64 rounded border border-slate-700/50 bg-slate-900/50 p-4">
          {/* Mock profile chart */}
          <svg viewBox="0 0 200 160" className="h-full w-full">
            {/* Depth axis */}
            <line x1="30" y1="10" x2="30" y2="150" stroke="#334155" strokeWidth="1" />
            {/* Value axis */}
            <line x1="30" y1="150" x2="190" y2="150" stroke="#334155" strokeWidth="1" />
            {/* Model line */}
            <polyline
              points="50,10 80,30 110,50 140,80 170,110 180,140"
              fill="none"
              stroke="#06b6d4"
              strokeWidth="2"
            />
            {/* Observation line */}
            <polyline
              points="55,10 85,30 115,55 145,85 165,115 175,140"
              fill="none"
              stroke="#a855f7"
              strokeWidth="2"
              strokeDasharray="4 2"
            />
            {/* Legend */}
            <line x1="40" y1="158" x2="60" y2="158" stroke="#06b6d4" strokeWidth="2" />
            <text x="65" y="162" fill="#94a3b8" fontSize="8">Model</text>
            <line x1="100" y1="158" x2="120" y2="158" stroke="#a855f7" strokeWidth="2" strokeDasharray="4 2" />
            <text x="125" y="162" fill="#94a3b8" fontSize="8">Obs</text>
          </svg>
        </div>
        <p className="text-[10px] text-slate-500">Mock vertical profile — Backend data pending</p>
      </div>
    </div>
  );
}
