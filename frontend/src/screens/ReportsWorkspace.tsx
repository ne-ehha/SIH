import React from 'react';
import { Download, FileCode2, FileText } from 'lucide-react';
import { useOceanStore } from '@/state/oceanStore';
import { ResearchReport } from '@/components/reports/ResearchReport';

export const ReportsWorkspace: React.FC = () => {
  const { selectedDate, selectedDepth, selectedVariable } = useOceanStore();

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#060a12] font-sans text-slate-200">
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#09101c] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <FileText className="h-4 w-4 text-cyan-400" />
          <div>
            <h1 className="text-sm font-semibold text-slate-100">Research Reports</h1>
            <p className="text-[11px] text-slate-500">Scientific comparison evidence and validation results.</p>
          </div>
        </div>
        <div className="font-mono text-[11px] text-slate-400">{selectedVariable} · {selectedDate} · {selectedDepth} m</div>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
          <div className="min-w-0">
            <ResearchReport />
          </div>

          <aside className="h-fit border border-slate-800 bg-[#09101d] p-4">
            <h2 className="text-sm font-semibold text-slate-100">Scientific exports</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Download the available collocation exports from the active OceanScope data service.
            </p>
            <div className="mt-4 space-y-2">
              <a
                href="/api/v1/export/csv"
                download
                className="flex w-full items-center gap-2 border border-slate-700 bg-[#050912] px-3 py-2 text-left text-xs text-slate-200 transition-colors hover:border-cyan-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                <Download className="h-4 w-4 shrink-0 text-emerald-400" />
                <span><span className="block font-medium">Export CSV</span><span className="text-[10px] text-slate-500">Tabular collocation records</span></span>
              </a>
              <a
                href="/api/v1/export/netcdf"
                download
                className="flex w-full items-center gap-2 border border-slate-700 bg-[#050912] px-3 py-2 text-left text-xs text-slate-200 transition-colors hover:border-cyan-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                <FileCode2 className="h-4 w-4 shrink-0 text-cyan-400" />
                <span><span className="block font-medium">Export NetCDF</span><span className="text-[10px] text-slate-500">Scientific dataset download</span></span>
              </a>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};
