import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { OceanGlobe } from '@/components/globe/OceanGlobe';
import { CoordinateMarker } from '@/components/globe/CoordinateMarker';
import { ObservationPoints } from '@/components/globe/ObservationPoints';
import { SelectedLocationPanel } from '@/components/selection/SelectedLocationPanel';
import { DiscrepancyMap } from '@/components/discrepancy/DiscrepancyMap';
import { Ocean3DView } from '@/components/visualization/Ocean3DView';
import { Research3DView } from '@/components/visualization/Research3DView';
import { SolutionsPanel } from '@/components/diagnostics/SolutionsPanel';
import { useOceanStore } from '@/state/oceanStore';
import { ResearchReport } from '@/components/reports/ResearchReport';
import { ResearchWorkspace } from '@/components/workspace/ResearchWorkspace';
import { InvestigationContextStrip } from '@/components/layout/InvestigationContextStrip';

const HYCOM_DATE_START = '2026-08-26';
const HYCOM_DATE_END = '2026-09-01';

function App() {
  const { workspaceMode, isModelViewOpen, selectedDate, selectedObservationId } = useOceanStore();
  const isHycom = selectedDate >= HYCOM_DATE_START && selectedDate <= HYCOM_DATE_END;
  const hasSelection = selectedObservationId !== null;

  return (
    <DashboardLayout>
      <div className="flex h-full min-h-0 flex-col">
        <InvestigationContextStrip />

        <div className="flex min-h-0 flex-1">
          {/* Globe — DISCOVER */}
          {workspaceMode === 'globe' && (
            <div className="relative flex-1 min-h-0">
              <OceanGlobe />
              <CoordinateMarker />
              <ObservationPoints />
              <div className="absolute right-3 top-3 bottom-3 w-64 overflow-y-auto z-10 pointer-events-auto">
                <SelectedLocationPanel />
              </div>
            </div>
          )}

          {/* Research — INSPECT */}
          {workspaceMode === 'research' && (
            <div className="ws-settle flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-hidden">
                <ResearchWorkspace />
              </div>
            </div>
          )}

          {/* Analysis — COMPARE */}
          {workspaceMode === 'analysis' && (
            <div className="ws-settle flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto">
                {hasSelection ? (
                  <div className="p-3">
                    <DiscrepancyMap />
                  </div>
                ) : (
                  <EmptyWorkbench message="Select an Argo observation on the globe to compare regional model–observation differences." />
                )}
              </div>
            </div>
          )}

          {/* Solutions — RESPOND */}
          {workspaceMode === 'solutions' && (
            <div className="ws-settle flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto">
                {hasSelection ? (
                  <div className="p-3">
                    <SolutionsPanel />
                  </div>
                ) : (
                  <EmptyWorkbench message="Select an Argo observation on the globe to evaluate diagnostic evidence for this location." />
                )}
              </div>
            </div>
          )}

          {/* Report — COMMUNICATE */}
          {workspaceMode === 'report' && (
            <div className="ws-settle flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto">
                {hasSelection ? (
                  <div className="p-4">
                    <ResearchReport />
                  </div>
                ) : (
                  <EmptyWorkbench message="Select an Argo observation on the globe to generate a research report." />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {isModelViewOpen && isHycom && <Ocean3DView />}
      {isModelViewOpen && !isHycom && <Research3DView />}
    </DashboardLayout>
  );
}

function EmptyWorkbench({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <p className="text-[13px] text-[var(--os-text-2)] leading-relaxed">{message}</p>
      </div>
    </div>
  );
}

export default App;
