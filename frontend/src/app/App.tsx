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
import { SolutionsPanel } from '@/components/diagnostics/SolutionsPanel';
import { useOceanStore } from '@/state/oceanStore';

function App() {
  const { activeView, isModelViewOpen } = useOceanStore();

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
            <ModelHealthCard />
          </div>
        </div>

        {/* Bottom panel */}
        <div className="absolute bottom-0 left-0 right-0 z-10 max-h-[40vh] overflow-y-auto border-t border-slate-800 bg-[#0a0e1a]/95 backdrop-blur-md">
          <div className="p-4">
            {/* View-specific content */}
            {activeView === 'explore' && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ModelObservationComparison />
                <VerticalProfile />
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

            {activeView === 'reports' && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ModelHealthCard />
                <div className="rounded-xl border border-slate-700/50 bg-[#0d1224]/90 p-4">
                  <h3 className="text-sm font-semibold text-white">Reports</h3>
                  <p className="mt-2 text-xs text-slate-400">
                    Report generation will be available after backend integration.
                  </p>
                </div>
              </div>
            )}

            {/* Workflow always visible */}
            <div className="mt-4">
              <InvestigationWorkflow />
            </div>
          </div>
        </div>
      </div>

      {/* 3D Model View Modal */}
      {isModelViewOpen && <Ocean3DView />}
    </DashboardLayout>
  );
}

export default App;
