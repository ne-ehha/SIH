import React from 'react';
import { 
  Activity, 
  Layers, 
  BarChart3, 
  TrendingUp, 
  CheckCircle2, 
  Database
} from 'lucide-react';
import { useOceanStore } from '@/state/oceanStore';
import { DiscrepancyMap } from '@/components/discrepancy/DiscrepancyMap';
import { DatasetFindings } from '@/components/diagnostics/DatasetFindings';

export const AnalysisWorkspace: React.FC = () => {
  const { selectedVariable, selectedDepth, selectedDate, selectedObservationId } = useOceanStore();

  return (
    <div className="flex-1 bg-[#060a12] text-slate-200 flex flex-col overflow-hidden select-none font-sans">
      {/* Top Workspace Header */}
      <div className="h-12 bg-[#09101c] border-b border-slate-800 px-4 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-emerald-400">
            <Activity className="w-4 h-4" />
            <span className="font-bold tracking-wider text-slate-100">OCEAN DYNAMICS & ANALYSIS</span>
            <span className="text-[10px] text-slate-500">[ANL-04]</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center space-x-2 text-slate-400">
            <span>DATASET:</span>
            <span className="text-cyan-300 font-bold">GLORYS12V1 × Argo Delayed Mode (0–500 dbar)</span>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono">
          <span className="flex items-center space-x-1 px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>1,220 COLLOCATED RECORDS VERIFIED</span>
          </span>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {/* Dataset-Level Verified Findings */}
        <DatasetFindings />

        {/* Regional Discrepancy Map */}
        <DiscrepancyMap />
      </div>
    </div>
  );
};
