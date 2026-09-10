import React from 'react';
import { Database, HardDrive, MapPin, Cpu, Compass } from 'lucide-react';
import { useOceanStore } from '@/state/oceanStore';

export const FooterStatusBar: React.FC = () => {
  const { selectedLocation, selectedDepth, selectedObservationId } = useOceanStore();

  const coords = selectedLocation 
    ? { lat: selectedLocation.latitude, lon: selectedLocation.longitude } 
    : { lat: 12.000, lon: 86.000 };

  const activeTargetId = selectedObservationId 
    ? selectedObservationId.replace('argo_', 'ARGO ').toUpperCase() 
    : 'BOB-COLLECTION';

  const formatCoord = (val: number, isLat: boolean) => {
    const abs = Math.abs(val);
    const deg = Math.floor(abs);
    const min = ((abs - deg) * 60).toFixed(2);
    const dir = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
    return `${deg}°${min}'${dir}`;
  };

  return (
    <footer className="h-7 bg-[#070c14] border-t border-slate-800 px-3 flex items-center justify-between text-[11px] font-mono text-slate-400 select-none z-40">
      {/* Left: Spatial Coordinates and Hydrographic Depth */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-1.5 text-slate-300">
          <MapPin className="w-3 h-3 text-cyan-400" />
          <span className="text-slate-500">POS:</span>
          <span className="tabular-nums font-medium text-cyan-300">
            {formatCoord(coords.lat, true)}, {formatCoord(coords.lon, false)}
          </span>
        </div>

        <div className="flex items-center space-x-1.5">
          <span className="text-slate-500">DEPTH:</span>
          <span className="tabular-nums text-slate-200">{selectedDepth.toLocaleString()} dbar</span>
          <span className="text-[10px] text-slate-500">(~{(selectedDepth * 0.992).toFixed(0)}m)</span>
        </div>

        <div className="hidden md:flex items-center space-x-1.5">
          <span className="text-slate-500">TARGET:</span>
          <span className="text-emerald-400 bg-emerald-950/60 px-1 py-0.2 rounded border border-emerald-900/40">
            {activeTargetId}
          </span>
        </div>
      </div>

      {/* Center: Oceanographic Reference Grid & Research Window */}
      <div className="hidden lg:flex items-center space-x-3 text-slate-400">
        <div className="flex items-center space-x-1">
          <Compass className="w-3 h-3 text-slate-500" />
          <span>DATUM: WGS84 (EPSG:4326)</span>
        </div>
        <span className="text-slate-700">|</span>
        <span>REGION: BAY OF BENGAL</span>
        <span className="text-slate-700">|</span>
        <span>WINDOW: 0–500m VALIDATED</span>
      </div>

      {/* Right: NetCDF-4 Parser, Cache Memory, Ready Status */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-1.5">
          <Database className="w-3 h-3 text-cyan-400" />
          <span className="text-slate-500">NetCDF-4/CF-1.8:</span>
          <span className="text-emerald-400">SYNCD</span>
        </div>

        <div className="hidden sm:flex items-center space-x-1.5">
          <HardDrive className="w-3 h-3 text-slate-500" />
          <span className="text-slate-500">MEM:</span>
          <span className="text-slate-300 tabular-nums">1.42 GB / 8.00 GB</span>
        </div>

        <div className="flex items-center space-x-1">
          <Cpu className="w-3 h-3 text-emerald-400 animate-pulse" />
          <span className="text-emerald-400 font-semibold">100% READY</span>
        </div>
      </div>
    </footer>
  );
};
