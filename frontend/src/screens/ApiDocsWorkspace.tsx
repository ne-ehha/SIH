import React from 'react';
import { Code2, Database, GitBranch, Server } from 'lucide-react';

interface ApiService {
  method: 'GET' | 'POST';
  path: string;
  purpose: string;
  parameters: string;
  response: string;
}

const researchServices: ApiService[] = [
  { method: 'POST', path: '/api/v1/comparison', purpose: 'Returns the nearest collocated GLORYS12V1 and Argo comparison at a selected depth.', parameters: 'location, variable, depth, date, time', response: 'Model value, observation value, difference, source provenance' },
  { method: 'POST', path: '/api/v1/profile', purpose: 'Returns a vertical model-observation profile near the selected location.', parameters: 'location, variable, date, time', response: 'Profile levels, values, maximum depth, source provenance' },
  { method: 'POST', path: '/api/v1/observations', purpose: 'Lists real Argo observation stations for the requested research date and bounds.', parameters: 'date, optional bounds and region', response: 'Available observation stations and coverage metadata' },
  { method: 'POST', path: '/api/v1/discrepancy', purpose: 'Returns model-observation difference magnitudes for a research area.', parameters: 'bounds, variable, date, time', response: 'Difference points and summary statistics' },
  { method: 'POST', path: '/api/v1/research/visualization/3d', purpose: 'Returns real GLORYS12V1 × Argo collocation records for the Research 3D view.', parameters: 'location, variable, date, time', response: 'Collocated points and validation statistics' },
];

const supportingServices: ApiService[] = [
  { method: 'GET', path: '/api/v1/health', purpose: 'Reports local backend and dataset availability metadata.', parameters: 'None', response: 'Backend and dataset availability metadata' },
  { method: 'POST', path: '/api/v1/diagnostics', purpose: 'Runs the application diagnostic service for a comparison request.', parameters: 'Comparison selection', response: 'Diagnostic result and workflow identifier' },
  { method: 'GET', path: '/api/v1/diagnostics/{diag_id}/workflow', purpose: 'Returns the workflow associated with a diagnostic result.', parameters: 'Diagnostic identifier', response: 'Workflow steps and recommendations' },
  { method: 'POST', path: '/api/v1/visualization/3d', purpose: 'Returns the separate HYCOM model-only 3D visualization.', parameters: 'location, variable, date, time', response: 'Model depth slices and profile data' },
  { method: 'POST', path: '/api/v1/model/profile', purpose: 'Returns a HYCOM model-only vertical profile.', parameters: 'location, variable, date, time', response: 'Model profile data' },
  { method: 'POST', path: '/api/v1/model/grid', purpose: 'Returns a HYCOM model grid around the requested bounds and depth.', parameters: 'bounds, variable, date, time, depth', response: 'Grid values and grid metadata' },
];

export const ApiDocsWorkspace: React.FC = () => {
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#060a12] font-sans text-slate-200">
      <header className="flex min-h-14 flex-wrap items-center gap-3 border-b border-slate-800 bg-[#09101c] px-4 py-3">
        <Code2 className="h-4 w-4 text-cyan-400" />
        <div>
          <h1 className="text-sm font-semibold text-slate-100">API Documentation</h1>
          <p className="text-[11px] text-slate-500">The data and comparison services used by OceanScope workspaces.</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-6xl space-y-4">
          <section className="border border-slate-800 bg-[#09101d] p-4">
            <h2 className="text-sm font-semibold text-slate-100">How OceanScope uses the API</h2>
            <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-slate-400">
              OceanScope workspaces request scientific data through the application data provider. The backend returns configured model, observation, and collocation results for display, comparison, and validation.
            </p>
            <div className="mt-4 grid gap-2 text-center text-[11px] sm:grid-cols-5">
              <FlowStep icon={<Code2 className="h-4 w-4" />} label="OceanScope UI" />
              <FlowStep icon={<Server className="h-4 w-4" />} label="Data provider / API" />
              <FlowStep icon={<Database className="h-4 w-4" />} label="Configured datasets" />
              <FlowStep icon={<GitBranch className="h-4 w-4" />} label="Collocation / comparison" />
              <FlowStep icon={<Code2 className="h-4 w-4" />} label="Research workspaces" />
            </div>
          </section>

          <section className="border border-slate-800 bg-[#09101d]">
            <SectionHeading title="Research services" detail="Endpoints used to support the GLORYS12V1 × Argo Delayed Mode research workspaces." />
            <div className="divide-y divide-slate-800">{researchServices.map((service) => <ServiceRow key={service.path} service={service} />)}</div>
          </section>

          <section className="border border-slate-800 bg-[#09101d]">
            <SectionHeading title="Supporting services" detail="Implemented local metadata, diagnostics, and separate model-exploration services." />
            <div className="divide-y divide-slate-800">{supportingServices.map((service) => <ServiceRow key={service.path} service={service} />)}</div>
          </section>

          <section className="border border-slate-800 bg-[#09101d] p-4">
            <h2 className="text-sm font-semibold text-slate-100">Availability notes</h2>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
              This page lists routes implemented by the current backend. It does not display sample scientific responses, and it does not replace failed requests with simulated data. The backend OpenAPI schema and interactive documentation are available at <span className="font-mono text-slate-300">/openapi.json</span> and <span className="font-mono text-slate-300">/docs</span> when the backend is running.
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              CSV and NetCDF export URLs are intentionally omitted: <span className="font-mono">/api/v1/export/csv</span> and <span className="font-mono">/api/v1/export/netcdf</span> are not implemented by the current local backend.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

function FlowStep({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <div className="flex min-h-16 items-center justify-center gap-2 border border-slate-800 bg-[#060a12] px-2 text-slate-400"><span className="text-cyan-400">{icon}</span>{label}</div>;
}

function SectionHeading({ title, detail }: { title: string; detail: string }) {
  return <div className="border-b border-slate-800 px-4 py-3"><h2 className="text-sm font-semibold text-slate-100">{title}</h2><p className="mt-0.5 text-[11px] text-slate-500">{detail}</p></div>;
}

function ServiceRow({ service }: { service: ApiService }) {
  return <article className="grid gap-2 px-4 py-3 md:grid-cols-[9rem_minmax(0,1fr)_12rem] md:gap-4"><div className="flex items-start gap-2"><Method method={service.method} /><span className="break-all font-mono text-[11px] text-slate-200">{service.path}</span></div><p className="text-[12px] leading-relaxed text-slate-400">{service.purpose}</p><div className="space-y-1 text-[10px] leading-relaxed text-slate-500"><div><span className="uppercase tracking-[0.08em]">Input </span><span className="font-mono text-slate-400">{service.parameters}</span></div><div><span className="uppercase tracking-[0.08em]">Returns </span>{service.response}</div></div></article>;
}

function Method({ method }: { method: ApiService['method'] }) {
  return <span className={`shrink-0 border px-1.5 py-0.5 font-mono text-[9px] font-semibold ${method === 'GET' ? 'border-emerald-900 text-emerald-400' : 'border-cyan-900 text-cyan-400'}`}>{method}</span>;
}
