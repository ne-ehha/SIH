import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { OceanGlobe } from '@/components/globe/OceanGlobe';
import { CoordinateMarker } from '@/components/globe/CoordinateMarker';
import { ObservationPoints } from '@/components/globe/ObservationPoints';
import { RegionView } from '@/components/globe/RegionView';
import { SelectedLocationPanel } from '@/components/selection/SelectedLocationPanel';
import { ModelObservationComparison } from '@/components/comparison/ModelObservationComparison';
import { VerticalProfile } from '@/components/comparison/VerticalProfile';
import { ModelHealthCard } from '@/components/comparison/ModelHealthCard';
import { DiscrepancyMap } from '@/components/discrepancy/DiscrepancyMap';
import { DiagnosticPanel } from '@/components/diagnostics/DiagnosticPanel';
import { InvestigationWorkflow } from '@/components/workflow/InvestigationWorkflow';
import { Ocean3DView } from '@/components/visualization/Ocean3DView';
import { Research3DView } from '@/components/visualization/Research3DView';
import { SolutionsPanel } from '@/components/diagnostics/SolutionsPanel';
import { useOceanStore } from '@/state/oceanStore';
import { ResearchReport } from '@/components/reports/ResearchReport';

// HYCOM operational date range
const HYCOM_DATE_START = '2026-08-26';
const HYCOM_DATE_END = '2026-09-01';

function App() {
  const { activeView, isModelViewOpen, selectedDate } = useOceanStore();
  const isHycom = selectedDate >= HYCOM_DATE_START && selectedDate <= HYCOM_DATE_END;

  // Pipeline A views: comparison/profile/discrepancy/diagnostics use GLORYS×Argo (Jan 2024)
  const isPipelineAView = activeView === 'compare' || activeView === 'discrepancies' || activeView === 'diagnostics' || activeView === 'solutions' || activeView === 'reports';

  return (
    <DashboardLayout>
      <div className="flex h-full">
        {/* Main globe area */}
        <div className="relative flex-1">
          <OceanGlobe />
          <CoordinateMarker />
          <ObservationPoints />
          <RegionView />

          {/* Right panel overlay on globe */}
          <div className="absolute right-4 top-4 bottom-4 w-72 space-y-4 overflow-y-auto z-10">
            <SelectedLocationPanel />
            {isPipelineAView && <ModelHealthCard />}
          </div>
        </div>

        {/* Bottom panel */}
        <div className="absolute bottom-0 left-0 right-0 z-10 max-h-[40vh] overflow-y-auto border-t border-slate-800 bg-[#0a0e1a]/95 backdrop-blur-md">
          <div className="p-4">
            {/* View-specific content */}
            {activeView === 'explore' && (
              <div className="rounded-xl border border-slate-700/50 bg-[#0d1224]/90 p-4">
                <h3 className="text-sm font-semibold text-white">Research Mode — GLORYS × Argo</h3>
                <p className="mt-2 text-xs text-slate-400">
                  Model-observation comparison using GLORYS12V1 and Argo Delayed Mode collocated observations.
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Select a location and date (Jan 2024) to compare model output with real Argo observations.
                </p>
              </div>
            )}

            {activeView === 'compare' && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ModelObservationComparison />
                <VerticalProfile />
              </div>
            )}

            {activeView === 'discrepancies' && <DiscrepancyMap />}

            {activeView === 'diagnostics' && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <DiagnosticPanel />
                <InvestigationWorkflow />
              </div>
            )}

            {activeView === 'solutions' && <SolutionsPanel />}

            {activeView === 'reports' && <ResearchReport />}


          </div>
        </div>
      </div>

      {/* 3D Visualization Modal — routes to correct pipeline */}
      {isModelViewOpen && isHycom && <Ocean3DView />}
      {isModelViewOpen && !isHycom && <Research3DView />}
    </DashboardLayout>
  );
}

export default App;
