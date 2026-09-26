import React from 'react';
import { Code2, Database, ExternalLink, GitBranch, Server, ShieldCheck } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface ApiService {
  method: 'GET' | 'POST';
  path: string;
  purpose: string;
  parameters: string;
  response: string;
}

const unifiedResearchServices: ApiService[] = [
  {
    method: 'GET',
    path: '/api/v1/research/data',
    purpose: 'Historical and date-specific multi-source research data retrieval across registered datasets.',
    parameters: 'dataset_id, variable, date, time, latitude_min/max, longitude_min/max, depth_min/max, format (records | profiles)',
    response: 'Normalized scientific records or vertical profile levels, result summary, and complete provenance metadata',
  },
  {
    method: 'POST',
    path: '/api/v1/research/data',
    purpose: 'Submit and retrieve research data using the supported structured research data request contract.',
    parameters: 'HistoricalDataRequest JSON payload (dataset_id, variable, spatial/temporal/depth bounds, format)',
    response: 'Normalized scientific records or vertical profile levels, query/result summary, and provenance metadata',
  },
  {
    method: 'GET',
    path: '/api/v1/research/registry',
    purpose: 'Central research dataset registry and source capability discovery.',
    parameters: 'Optional source filter, variable filter',
    response: 'Registered dataset definitions, product identities, spatial/temporal/depth bounds, and availability statuses',
  },
  {
    method: 'GET',
    path: '/api/v1/research/variables',
    purpose: 'Canonical ocean-variable registry including supported variables, CF standard names, and physical metadata/bounds.',
    parameters: 'None',
    response: 'Canonical variable catalog, CF standard names, physical valid ranges, units, and derivation expressions',
  },
  {
    method: 'GET',
    path: '/api/v1/research/adapters/status',
    purpose: 'Operational and authentication status of configured data-source adapters (Argo, GLORYS, Copernicus, HYCOM).',
    parameters: 'None',
    response: 'Source adapter status list, credential availability flags, and upstream connection capabilities',
  },
  {
    method: 'POST',
    path: '/api/v1/research/latest',
    purpose: 'On-demand retrieval of the latest available official Argo GDAC observations in the configured research region.',
    parameters: 'region (default: bay-of-bengal), max_age_days (1–90), force_refresh (boolean)',
    response: 'Official Argo GDAC observations with verified QC flags (1 & 2), observation timestamp, and stream status',
  },
  {
    method: 'GET',
    path: '/api/v1/research/latest/status',
    purpose: 'Cached status of the latest-observation stream, including refresh/retrieval state and last check timestamp.',
    parameters: 'region, max_age_days',
    response: 'Stream connection state, last check time, latest observation timestamp, and next refresh schedule',
  },
  {
    method: 'POST',
    path: '/api/v1/research/visualization/3d',
    purpose: 'Returns real GLORYS12V1 × Argo collocation records for the Research 3D water-column visualization.',
    parameters: 'location, variable, date, time',
    response: 'Collocated 3D point cloud, depth-matched pairs, difference statistics (GLORYS − Argo), and spatial bounds',
  },
  {
    method: 'GET',
    path: '/api/v1/research/platforms',
    purpose: 'Discovers verified ocean observation platforms (Argo profiling floats, gliders, shipboard CTD, BGC profilers).',
    parameters: 'None',
    response: 'Supported platforms metadata, supported variables, default data modes, and source descriptions',
  },
  {
    method: 'GET',
    path: '/api/v1/research/data-modes',
    purpose: 'Lists canonical data modes distinguishing LIVE_NRT from HISTORICAL_RESEARCH data feeds with provenance requirements.',
    parameters: 'None',
    response: 'Canonical data mode definitions, descriptions, and scientific provenance requirements',
  },
  {
    method: 'POST',
    path: '/api/v1/compatibility/validate',
    purpose: 'Scientific compatibility engine validating variable, unit, time, spatial, depth, QC, and data-mode matching.',
    parameters: 'CompatibilityCheckRequest JSON payload (observation & model coordinates, variable, units, QC, data modes)',
    response: 'Compatibility validation state, reason, spatial/temporal/depth offsets, and permission flag to proceed with comparison',
  },
  {
    method: 'POST',
    path: '/api/v1/analysis/variable-aware',
    purpose: 'Variable-aware statistical analysis producing specialized metrics (thermodynamic, current vectors, BGC transformations).',
    parameters: 'VariableAwareAnalysisRequest JSON payload (variable, pairs of observation & model values, u/v currents if applicable)',
    response: 'Variable-specific metrics: Bias, MAE, RMSE, current velocity & directional differences, logarithmic metrics for BGC',
  },
];

const benchmarkServices: ApiService[] = [
  {
    method: 'POST',
    path: '/api/v1/comparison',
    purpose: 'Returns the nearest collocated GLORYS12V1 reanalysis and Argo Delayed Mode comparison at a selected depth.',
    parameters: 'location (lat, lon), variable (temperature | salinity), depth (0–500 dbar), date, time',
    response: 'Model value, observation value, difference, health score, and source provenance',
  },
  {
    method: 'POST',
    path: '/api/v1/profile',
    purpose: 'Returns a vertical collocated model-observation profile near the selected location.',
    parameters: 'location, variable, date, time',
    response: 'Vertical profile levels (0–500 dbar), model values, observation values, and maximum depth',
  },
  {
    method: 'POST',
    path: '/api/v1/observations',
    purpose: 'Lists verified Argo Delayed Mode observation stations for the requested research date and bounding box.',
    parameters: 'date, optional bounds and region',
    response: 'Active observation stations, coordinates, timestamps, and observed surface parameters',
  },
  {
    method: 'POST',
    path: '/api/v1/discrepancy',
    purpose: 'Returns model-observation difference magnitudes for a research area.',
    parameters: 'bounds, variable, date, time',
    response: 'Spatial discrepancy points, mean error, max error, and RMS error statistics',
  },
];

const supportingServices: ApiService[] = [
  {
    method: 'GET',
    path: '/api/v1/health',
    purpose: 'Reports backend operational health, dataset readiness, and active pipeline statuses.',
    parameters: 'None',
    response: 'Backend health status, dataset inventories (HYCOM, Argo DM, GLORYS), and pipeline configurations',
  },
  {
    method: 'POST',
    path: '/api/v1/diagnostics',
    purpose: 'Runs the ocean model diagnostic service for a comparison query.',
    parameters: 'Comparison location, variable, depth, date, time',
    response: 'Error fingerprint, diagnostic causes, top cause, and workflow identifier',
  },
  {
    method: 'GET',
    path: '/api/v1/diagnostics/{diag_id}/workflow',
    purpose: 'Returns the scientific workflow associated with a diagnostic result.',
    parameters: 'Diagnostic identifier (path parameter)',
    response: 'Workflow steps and recommended test procedures',
  },
  {
    method: 'POST',
    path: '/api/v1/visualization/3d',
    purpose: 'Returns the separate HYCOM operational model 3D visualization (Pipeline B).',
    parameters: 'location, variable, date, time',
    response: 'Model depth slices, mean values, and vertical profile points',
  },
  {
    method: 'POST',
    path: '/api/v1/model/profile',
    purpose: 'Returns a HYCOM operational model vertical profile.',
    parameters: 'location, variable, date, time',
    response: 'Model profile points across fixed depth levels (0, 17.5, 52.5, 125, 275, 500 m)',
  },
  {
    method: 'POST',
    path: '/api/v1/model/grid',
    purpose: 'Returns a HYCOM operational model grid around the requested bounds and depth.',
    parameters: 'bounds, variable, date, time, depth',
    response: 'Model grid points, land mask points, and grid spacing info',
  },
];

export const ApiDocsWorkspace: React.FC = () => {
  const docsUrl = `${API_BASE_URL}/docs`;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#060a12] font-sans text-slate-200">
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-4 border-b border-slate-800 bg-[#09101c] px-6 py-3">
        <div className="flex items-center gap-3">
          <Code2 className="h-5 w-5 text-cyan-400" />
          <div>
            <h1 className="text-sm font-semibold text-slate-100">API Documentation</h1>
            <p className="text-[11px] text-slate-500">
              Scientific data retrieval, research benchmark, and operational model endpoints.
            </p>
          </div>
        </div>

        {/* Direct Interactive Swagger UI Action */}
        <a
          href={docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded border border-cyan-500/80 bg-cyan-950/40 px-3 py-1.5 text-[11px] font-semibold text-cyan-200 transition-colors hover:bg-cyan-900/60"
        >
          <span>Open Interactive Swagger Docs</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Architecture Summary Card */}
          <section className="border border-slate-800 bg-[#09101d] p-4">
            <h2 className="text-sm font-semibold text-slate-100">ViaDariya API Architecture</h2>
            <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-slate-400">
              ViaDariya services request verified scientific data through standardized backend adapters. The API enforces strict provenance, distinguishes observation times from ingestion timestamps, and applies level-by-level quality control flags without fabricating missing values.
            </p>
            <div className="mt-4 grid gap-2 text-center text-[11px] sm:grid-cols-5">
              <FlowStep icon={<Code2 className="h-4 w-4" />} label="ViaDariya UI" />
              <FlowStep icon={<Server className="h-4 w-4" />} label="Data Provider / API" />
              <FlowStep icon={<Database className="h-4 w-4" />} label="Source Adapters" />
              <FlowStep icon={<GitBranch className="h-4 w-4" />} label="QC & Normalization" />
              <FlowStep icon={<ShieldCheck className="h-4 w-4" />} label="Research Workspaces" />
            </div>
          </section>

          {/* Section 1: Unified Research Data Services (Phase 3) */}
          <section className="border border-slate-800 bg-[#09101d]">
            <SectionHeading
              title="Unified Research Data Services (Phase 3)"
              detail="Multi-source historical retrieval, official on-demand Argo GDAC streaming, dataset registry, and variable catalog."
            />
            <div className="divide-y divide-slate-800">
              {unifiedResearchServices.map((service, idx) => (
                <ServiceRow key={`${service.method}-${service.path}-${idx}`} service={service} />
              ))}
            </div>
          </section>

          {/* Section 2: GLORYS × Argo Benchmark Services */}
          <section className="border border-slate-800 bg-[#09101d]">
            <SectionHeading
              title="GLORYS12V1 × Argo Benchmark Services (Pipeline A)"
              detail="Precomputed point, profile, and discrepancy comparison matching GLORYS12V1 reanalysis with in-situ Argo Delayed Mode profiles (Jan 1–14 2024, Bay of Bengal, 0–500 dbar)."
            />
            <div className="divide-y divide-slate-800">
              {benchmarkServices.map((service, idx) => (
                <ServiceRow key={`${service.method}-${service.path}-${idx}`} service={service} />
              ))}
            </div>
          </section>

          {/* Section 3: Supporting & Model Exploration Services */}
          <section className="border border-slate-800 bg-[#09101d]">
            <SectionHeading
              title="Supporting & Operational Model Services (Pipeline B)"
              detail="Backend health diagnostics, automated diagnostic workflows, and INCOIS regional HYCOM 2.35 operational model output."
            />
            <div className="divide-y divide-slate-800">
              {supportingServices.map((service, idx) => (
                <ServiceRow key={`${service.method}-${service.path}-${idx}`} service={service} />
              ))}
            </div>
          </section>

          {/* Section 4: Scientific Credibility & Availability Notes */}
          <section className="border border-slate-800 bg-[#09101d] p-4 text-[12px]">
            <h2 className="text-sm font-semibold text-slate-100">Scientific Integrity & Upstream Semantics</h2>
            <div className="mt-3 space-y-2 text-slate-400">
              <p className="leading-relaxed">
                <span className="font-semibold text-slate-200">Latest Available vs. Observation Time:</span> Live observation streams query the official Argo GDAC synthetic profile index. The observation timestamp reflects the actual in-situ measurement by the profiling float, while the retrieval timestamp reflects when ViaDariya ingested the record. ViaDariya never misrepresents delayed in-situ data as instantaneous telemetry.
              </p>
              <p className="leading-relaxed">
                <span className="font-semibold text-slate-200">Copernicus Marine Operational Model Access:</span> Official Copernicus physical datasets (e.g. <span className="font-mono text-cyan-300">cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m</span>) are registered in the dataset catalog. When server credentials are not configured, endpoints report an honest <span className="font-mono text-amber-300">AUTHENTICATION_REQUIRED</span> state rather than falling back to simulated values or reanalysis substitutes.
              </p>
              <p className="leading-relaxed">
                <span className="font-semibold text-slate-200">Interactive OpenAPI Specification:</span> The complete machine-readable OpenAPI schema and interactive Swagger UI are served directly by the backend at <span className="font-mono text-cyan-300">/openapi.json</span> and <span className="font-mono text-cyan-300">/docs</span>.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

function FlowStep({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex min-h-16 items-center justify-center gap-2 border border-slate-800 bg-[#060a12] px-2 text-slate-400">
      <span className="text-cyan-400">{icon}</span>
      {label}
    </div>
  );
}

function SectionHeading({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="border-b border-slate-800 px-4 py-3">
      <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
      <p className="mt-0.5 text-[11px] text-slate-500">{detail}</p>
    </div>
  );
}

function ServiceRow({ service }: { service: ApiService }) {
  return (
    <article className="grid gap-2 px-4 py-3 md:grid-cols-[10rem_minmax(0,1fr)_14rem] md:gap-4">
      <div className="flex items-start gap-2">
        <Method method={service.method} />
        <span className="break-all font-mono text-[11px] text-slate-200">{service.path}</span>
      </div>
      <p className="text-[12px] leading-relaxed text-slate-400">{service.purpose}</p>
      <div className="space-y-1 text-[10px] leading-relaxed text-slate-500">
        <div>
          <span className="uppercase tracking-[0.08em] text-slate-400">Input </span>
          <span className="font-mono text-slate-400">{service.parameters}</span>
        </div>
        <div>
          <span className="uppercase tracking-[0.08em] text-slate-400">Returns </span>
          <span className="text-slate-300">{service.response}</span>
        </div>
      </div>
    </article>
  );
}

function Method({ method }: { method: ApiService['method'] }) {
  return (
    <span
      className={`shrink-0 border px-1.5 py-0.5 font-mono text-[9px] font-semibold ${
        method === 'GET'
          ? 'border-emerald-900 bg-emerald-950/40 text-emerald-400'
          : 'border-cyan-900 bg-cyan-950/40 text-cyan-400'
      }`}
    >
      {method}
    </span>
  );
}
