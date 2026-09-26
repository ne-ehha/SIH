import React from 'react';
import { Download, FileCode2, FileText } from 'lucide-react';
import { useOceanStore } from '@/state/oceanStore';
import { ResearchReport } from '@/components/reports/ResearchReport';
import { useResearchVisualization3D } from '@/integration';
import { exportProfileCSV, exportStatsCSV } from '@/utils/export';

export const ReportsWorkspace: React.FC = () => {
  const {
    selectedDate,
    selectedTime,
    selectedDepth,
    selectedVariable,
    selectedLocation,
    selectedObservationId,
  } = useOceanStore();

  const { points, selectedProfilePoints, stats, unit } = useResearchVisualization3D({
    latitude: selectedLocation?.latitude ?? null,
    longitude: selectedLocation?.longitude ?? null,
    variable: (selectedVariable === 'salinity' ? 'salinity' : 'temperature') as any,
    date: selectedDate,
    time: selectedTime,
    selectedObservationId,
    selectedDepth,
    enabled: true,
  });

  const handleExportCSV = () => {
    const dataToExport = selectedProfilePoints.length > 0 ? selectedProfilePoints : points;
    if (dataToExport.length > 0) {
      exportProfileCSV(dataToExport, selectedVariable, unit || '°C', `viadariya_${selectedVariable}_collocation_${selectedDate}.csv`);
    } else if (stats) {
      exportStatsCSV(stats, selectedVariable, unit || '°C');
    }
  };

  const handleExportJSON = () => {
    const dataToExport = selectedProfilePoints.length > 0 ? selectedProfilePoints : points;
    const exportPayload = {
      title: 'ViaDariya Scientific Collocation Report',
      model: 'GLORYS12V1',
      observation: 'Argo Delayed Mode',
      region: 'Bay of Bengal',
      period: 'January 2024',
      variable: selectedVariable,
      unit: unit || '°C',
      date: selectedDate,
      depth_window: '0-500 dbar',
      difference_convention: 'GLORYS - Argo',
      statistics: stats,
      records: dataToExport,
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `viadariya_${selectedVariable}_collocation_${selectedDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
              Download the verified collocation dataset directly with full scientific metadata.
            </p>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={handleExportCSV}
                className="flex w-full items-center gap-2 border border-slate-700 bg-[#050912] px-3 py-2 text-left text-xs text-slate-200 transition-colors hover:border-cyan-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 cursor-pointer"
              >
                <Download className="h-4 w-4 shrink-0 text-emerald-400" />
                <span><span className="block font-medium">Export CSV</span><span className="text-[10px] text-slate-500">Tabular collocation records</span></span>
              </button>
              <button
                type="button"
                onClick={handleExportJSON}
                className="flex w-full items-center gap-2 border border-slate-700 bg-[#050912] px-3 py-2 text-left text-xs text-slate-200 transition-colors hover:border-cyan-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 cursor-pointer"
              >
                <FileCode2 className="h-4 w-4 shrink-0 text-cyan-400" />
                <span><span className="block font-medium">Export Scientific JSON</span><span className="text-[10px] text-slate-500">Metadata & records package</span></span>
              </button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};
