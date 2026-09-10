import React from 'react';
import { MapPin } from 'lucide-react';
import { OBSERVATION_DATES } from '@/config/observationDates';
import { RESEARCH_DATA_COVERAGE, type DataCoveragePoint } from '@/config/researchDataCoverage';
import { useWorkspaceTransition } from '@/components/layout/WorkspaceTransition';
import { useOceanStore } from '@/state/oceanStore';
import { OceanScopeLogo } from '@/components/common/OceanScopeBrand';

const PRIMARY_WORKSPACES = [
  ['spatial', '/explore', 'Explore', 'Inspect ocean fields across space, time, variable, and depth.'],
  ['workstation', '/research', 'Research', 'Compare GLORYS12V1 with collocated Argo observations through the water column.'],
  ['profile-lab', '/profile-lab', 'Profile Lab', 'Examine selected vertical profiles and model-observation differences.'],
  ['analysis', '/analysis', 'Analysis', 'Review discrepancies, depth coverage, and validation findings.'],
  ['diagnostics', '/diagnostics', 'Diagnostics', 'Review validation checks for the active research context.'],
  ['investigation', '/solutions', 'Solutions & Investigation', 'Review evidence, assess explanations, and document researcher findings.'],
] as const;

const SUPPORTING_WORKSPACES = [
  ['reports', '/reports', 'Research Reports', 'Scientific summaries and available exports.'],
  ['data-services', '/data-services', 'Data Services', 'Configured datasets, provenance, and scope.'],
  ['api-docs', '/api-docs', 'API Documentation', 'Data and comparison services used by OceanScope.'],
] as const;

function WorkspaceLink({ workspace, index, onOpen, supporting = false }: { workspace: readonly string[]; index: number; onOpen: (path: string, title: string) => void; supporting?: boolean }) {
  const [id, path, title, description] = workspace;
  return (
    <button
      id={`card-pathway-${id}`}
      type="button"
      onClick={() => onOpen(path, title)}
      className={`launch-workspace group w-full border-l-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${supporting ? 'launch-workspace-supporting' : ''}`}
      style={{ '--launch-offset': `${supporting ? (index % 2) * 18 : [0, 28, 54, 32, 60, 14][index]}px` } as React.CSSProperties}
    >
      <span className="launch-workspace-index">{String(index + 1).padStart(2, '0')}</span>
      <span className="block">
        <span className="block text-[16px] font-semibold tracking-[-0.01em] text-slate-100 transition-colors duration-200 group-hover:text-cyan-100">{title}</span>
        <span className="mt-1 block max-w-xl text-[13px] leading-5 text-slate-400">{description}</span>
      </span>
      <span className="launch-workspace-arrow" aria-hidden="true">Open</span>
    </button>
  );
}

export const LaunchpadScreen: React.FC = () => {
  const { openWorkspace } = useWorkspaceTransition();
  const selectResearchObservation = useOceanStore((state) => state.selectResearchObservation);

  const handleSelectCoveragePoint = (point: DataCoveragePoint, index: number) => {
    selectResearchObservation({ id: `argo_station_${index + 1}`, location: { latitude: point.latitude, longitude: point.longitude }, date: OBSERVATION_DATES[0] });
    openWorkspace('/research', 'Research');
  };

  return (
    <main className="launchpad-page min-w-0 flex-1 overflow-y-auto text-slate-100">
      <div className="launchpad-shell mx-auto w-full max-w-6xl px-5 py-9 sm:px-8 sm:py-12">
        <header className="max-w-2xl">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">Ocean data and model validation</p>
          <OceanScopeLogo variant="full" className="h-auto w-64 sm:w-72" />
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/75">Chaos to Clarity</p>
          <p className="mt-4 text-[15px] leading-7 text-slate-400">A research workspace for exploring Bay of Bengal ocean data, comparing GLORYS12V1 with Argo Delayed Mode, and documenting the resulting evidence.</p>
        </header>

        <section className="mt-12 max-w-4xl" aria-labelledby="workspace-heading">
          <div className="mb-5 flex items-baseline justify-between gap-4 border-b border-slate-800/90 pb-3">
            <div><h2 id="workspace-heading" className="text-base font-semibold text-slate-200">Research workflow</h2><p className="mt-1 text-[12px] text-slate-500">Move through the investigation in the order that fits your question.</p></div>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-slate-600 sm:block">Six workspaces</span>
          </div>
          <div className="space-y-2">{PRIMARY_WORKSPACES.map((workspace, index) => <WorkspaceLink key={workspace[0]} workspace={workspace} index={index} onOpen={openWorkspace} />)}</div>
        </section>

        <section className="mt-10 max-w-4xl border-t border-slate-800/90 pt-6" aria-labelledby="supporting-heading">
          <h2 id="supporting-heading" className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-500">Supporting reference</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-3">{SUPPORTING_WORKSPACES.map((workspace, index) => <WorkspaceLink key={workspace[0]} workspace={workspace} index={index} onOpen={openWorkspace} supporting />)}</div>
        </section>

        <section className="launchpad-context mt-10 max-w-4xl" aria-labelledby="research-context-heading">
          <div><h2 id="research-context-heading" className="text-base font-semibold text-slate-200">Research context</h2><p className="mt-1 text-[13px] leading-6 text-slate-400">GLORYS12V1 × Argo Delayed Mode · Bay of Bengal · 1–15 January 2024 · validated 0–500 m.</p></div>
          <div className="mt-4 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-4">{RESEARCH_DATA_COVERAGE.slice(0, 4).map((point, index) => <button key={`${point.latitude}-${point.longitude}`} type="button" onClick={() => handleSelectCoveragePoint(point, index)} className="group flex items-center gap-2 px-2 py-2 text-left text-sm text-slate-400 transition hover:bg-cyan-950/30 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"><MapPin className="h-3.5 w-3.5 shrink-0 text-cyan-400/80" aria-hidden="true" /><span className="font-mono text-[11px] tabular-nums">{point.latitude.toFixed(2)}°N, {point.longitude.toFixed(2)}°E</span></button>)}</div>
        </section>
      </div>
    </main>
  );
};
