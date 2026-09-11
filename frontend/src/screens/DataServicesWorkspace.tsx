import React, { useState } from 'react';
import { Database, FileText, Layers3, MapPin } from 'lucide-react';
import { DATA_SOURCES, type OceanDataSource } from '@/config/dataSources';
import { useLatestDataStream } from '@/hooks/useLatestDataStream';

const configuredSources = DATA_SOURCES.filter((source) => source.status === 'available');

const sourceRoles: Record<string, string> = {
  'glorys-argo-collocation': 'Precomputed GLORYS12V1 and Argo Delayed Mode matches used for Research comparison and validation.',
  'argo-dm': 'In-situ delayed-mode profile observations used as the observation side of the Research comparison.',
  'hycom-operational': 'Separate model-only source used by the operational exploration workspace; it is not used for Research comparisons.',
};

export const DataServicesWorkspace: React.FC = () => {
  const [selectedSource, setSelectedSource] = useState<OceanDataSource>(configuredSources[0]);
  const stream = useLatestDataStream();

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#060a12] font-sans text-slate-200">
      <header className="flex min-h-14 flex-wrap items-center gap-3 border-b border-slate-800 bg-[#09101c] px-4 py-3">
        <Database className="h-4 w-4 text-cyan-400" />
        <div>
          <h1 className="text-sm font-semibold text-slate-100">Data Services</h1>
          <p className="text-[11px] text-slate-500">Scientific data sources configured for OceanScope workspaces.</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-6xl space-y-4">
          <section className="border border-slate-800 bg-[#09101d] p-4 text-[12px]">
            <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-100">Latest data stream</h2><p className="mt-1 text-slate-400">One shared latest-available official-data stream; not a benchmark or simulated feed.</p></div><button type="button" onClick={() => void stream.refreshNow()} disabled={stream.status === 'loading'} className="border border-[#3F7F6A]/70 px-2 py-1 text-[#83b7a4] disabled:opacity-50">{stream.status === 'loading' ? 'Fetching…' : 'Refresh Now'}</button></div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="border border-[#3F7F6A]/50 bg-[#3F7F6A]/10 p-3"><div className="font-medium text-[#83b7a4]">● Argo GDAC · {stream.status === 'connected' ? 'Available' : stream.status === 'error' ? 'Error' : 'Waiting'}</div><div className="mt-1 text-slate-300">Profiles: {stream.observations.length} · Region: Bay of Bengal · Variables: Temperature, Salinity · Depth: 0–500 dbar</div><div className="mt-1 text-slate-400">Last checked: {stream.lastCheckedAt ? new Date(stream.lastCheckedAt).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC' : '—'}</div><div className="text-slate-400">Latest observation: {stream.latestObservationAt ? new Date(stream.latestObservationAt).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC' : '—'}</div>{stream.error && <div className="mt-1 text-rose-300">Last update failed: {stream.error}</div>}</div><div className="border border-amber-900/60 bg-amber-950/15 p-3"><div className="font-medium text-amber-200">Copernicus Marine Operational Model · Unavailable</div><div className="mt-1 text-slate-400">{stream.copernicus?.reason ?? 'No actual operational model subset is available.'}</div><div className="mt-1 text-slate-500">GLORYS12V1 remains the historical research benchmark, not live data.</div></div></div>
          </section>
          <section className="border border-slate-800 bg-[#09101d] p-4">
            <h2 className="text-sm font-semibold text-slate-100">Source registry</h2>
            <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-slate-400">
              These datasets are configured in the application source registry. This view describes provenance and supported use; it does not perform a live repository or ingestion check.
            </p>
          </section>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)]">
            <section className="space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Configured data sources</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {configuredSources.map((source) => {
                  const selected = source.id === selectedSource.id;
                  return (
                    <button
                      key={source.id}
                      type="button"
                      onClick={() => setSelectedSource(source)}
                      className={`border p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${selected ? 'border-cyan-700 bg-[#0c1929]' : 'border-slate-800 bg-[#09101d] hover:border-slate-700'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-100">{source.name}</h3>
                          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{sourceRoles[source.id] ?? 'Configured OceanScope data source.'}</p>
                        </div>
                        <span className="shrink-0 border border-slate-700 px-1.5 py-0.5 font-mono text-[9px] uppercase text-slate-400">Configured</span>
                      </div>
                      <div className="mt-3 border-t border-slate-800 pt-2 font-mono text-[10px] text-slate-500">
                        {source.institution ?? 'Institution not specified'} · {source.adapterType.toUpperCase()}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <aside className="h-fit border border-slate-800 bg-[#09101d]">
              <div className="border-b border-slate-800 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Selected source</p>
                <h2 className="mt-1 text-sm font-semibold text-slate-100">{selectedSource.name}</h2>
              </div>
              <div className="space-y-3 p-4 text-[12px]">
                <Detail icon={<Layers3 className="h-3.5 w-3.5" />} label="Role" value={sourceRoles[selectedSource.id] ?? 'Configured OceanScope data source.'} />
                <Detail icon={<FileText className="h-3.5 w-3.5" />} label="Variables" value={selectedSource.variables.join(', ') || 'No variables configured'} mono />
                <Detail icon={<MapPin className="h-3.5 w-3.5" />} label="Coverage" value={formatCoverage(selectedSource)} />
                <Detail label="Period" value={`${selectedSource.temporalCoverage.start} to ${selectedSource.temporalCoverage.end} (${selectedSource.temporalCoverage.resolution})`} mono />
                <Detail label="Vertical range" value={`${selectedSource.verticalCoverage.minPressure}–${selectedSource.verticalCoverage.maxPressure} dbar`} mono />
                <Detail label="Supported workspace services" value={selectedSource.supportedOperations.join(', ')} mono />
                {selectedSource.citation && <Detail label="Provenance" value={selectedSource.citation} />}
              </div>
            </aside>
          </div>

          <section className="border border-slate-800 bg-[#09101d] p-4">
            <h2 className="text-sm font-semibold text-slate-100">Access in OceanScope</h2>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
              The configured sources are accessed through the research and model workspaces. Research Mode uses GLORYS12V1 with Argo Delayed Mode in the Bay of Bengal comparison window; HYCOM remains separate for model exploration.
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              CSV and NetCDF export routes are not listed here as available services because they are not implemented by the current local backend.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

function Detail({ icon, label, value, mono = false }: { icon?: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return <div><div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] text-slate-500">{icon}{label}</div><div className={`mt-1 leading-relaxed text-slate-300 ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</div></div>;
}

function formatCoverage(source: OceanDataSource) {
  const { region, north, south, east, west } = source.spatialCoverage;
  return region ? `${region} (${south}–${north}° N, ${west}–${east}° E)` : `${south}–${north}° N, ${west}–${east}° E`;
}
