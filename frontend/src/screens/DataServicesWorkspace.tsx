import React, { useState } from 'react';
import { Database, FileText, Layers3, MapPin, Radio, History, Bookmark } from 'lucide-react';
import { DATA_SOURCES, type OceanDataSource } from '@/config/dataSources';
import { useLatestDataStream } from '@/hooks/useLatestDataStream';
import { HistoricalDataWorkspace } from '@/components/workspace/HistoricalDataWorkspace';

const configuredSources = DATA_SOURCES.filter((source) => source.status === 'available');

const sourceRoles: Record<string, string> = {
  'glorys-argo-collocation': 'Precomputed GLORYS12V1 and Argo Delayed Mode matches used for Research comparison and validation.',
  'argo-dm': 'In-situ delayed-mode profile observations used as the observation side of the Research comparison.',
  'hycom-operational': 'Separate model-only source used by the operational exploration workspace; it is not used for Research comparisons.',
};

export const DataServicesWorkspace: React.FC = () => {
  const [activeMode, setActiveMode] = useState<'historical' | 'latest' | 'registry'>('historical');
  const [selectedSource, setSelectedSource] = useState<OceanDataSource>(configuredSources[0]);
  const stream = useLatestDataStream();

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#060a12] font-sans text-slate-200">
      {/* Header */}
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-4 border-b border-slate-800 bg-[#09101c] px-6 py-3">
        <div className="flex items-center gap-3">
          <Database className="h-5 w-5 text-cyan-400" />
          <div>
            <h1 className="text-sm font-semibold text-slate-100">Data Services Workspace</h1>
            <p className="text-[11px] text-slate-500">Unified scientific data retrieval, official live streams, and authoritative registry.</p>
          </div>
        </div>

        {/* Mode Navigation Tabs */}
        <div className="flex rounded border border-slate-800 bg-[#060a12] p-0.5">
          <button
            type="button"
            onClick={() => setActiveMode('historical')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition-colors ${
              activeMode === 'historical'
                ? 'bg-cyan-950/80 text-cyan-200 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="h-3.5 w-3.5 text-cyan-400" />
            Historical / Date-Specific
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('latest')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition-colors ${
              activeMode === 'latest'
                ? 'bg-cyan-950/80 text-cyan-200 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="h-3.5 w-3.5 text-emerald-400" />
            Latest Available Stream
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('registry')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition-colors ${
              activeMode === 'registry'
                ? 'bg-cyan-950/80 text-cyan-200 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bookmark className="h-3.5 w-3.5 text-blue-400" />
            Source Registry
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-6xl">
          {activeMode === 'historical' && <HistoricalDataWorkspace />}

          {activeMode === 'latest' && (
            <div className="space-y-4">
              <section className="border border-slate-800 bg-[#09101d] p-4 text-[12px]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-100">Latest Available Data Stream</h2>
                    <p className="mt-1 text-slate-400">Shared latest-available official-data stream; on-demand GDAC index querying.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void stream.refreshNow()}
                    disabled={stream.status === 'loading'}
                    className="border border-[#3F7F6A]/70 bg-[#3F7F6A]/20 px-3 py-1.5 text-[12px] font-medium text-[#83b7a4] hover:bg-[#3F7F6A]/30 disabled:opacity-50"
                  >
                    {stream.status === 'loading' ? 'Fetching…' : 'Refresh Now'}
                  </button>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="border border-[#3F7F6A]/50 bg-[#3F7F6A]/10 p-3.5">
                    <div className="font-semibold text-[#83b7a4]">
                      ● Argo GDAC · {stream.status === 'connected' ? 'Available' : stream.status === 'error' ? 'Error' : 'Waiting'}
                    </div>
                    <div className="mt-1 text-slate-300">
                      Profiles: {stream.observations.length} · Region: Bay of Bengal · Variables: Temperature, Salinity · Depth: 0–500 dbar
                    </div>
                    <div className="mt-2 text-[11px] text-slate-400">
                      Last checked: {stream.lastCheckedAt ? new Date(stream.lastCheckedAt).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC' : '—'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Latest observation: {stream.latestObservationAt ? new Date(stream.latestObservationAt).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC' : '—'}
                    </div>
                    {stream.error && <div className="mt-2 text-rose-300">Last update failed: {stream.error}</div>}
                  </div>
                  <div className="border border-amber-900/60 bg-amber-950/15 p-3.5">
                    <div className="font-semibold text-amber-200">Copernicus Marine Operational Model · Access Required</div>
                    <div className="mt-1 text-slate-400">{stream.copernicus?.reason ?? 'No operational model credentials configured.'}</div>
                    <div className="mt-2 text-[11px] text-slate-500">GLORYS12V1 remains the historical research benchmark reanalysis.</div>
                  </div>
                </div>
              </section>

              {/* Profiles listing in latest stream */}
              {stream.observations.length > 0 && (
                <section className="border border-slate-800 bg-[#09101d] p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Latest Retrieved In-Situ Profiles ({stream.observations.length})
                  </h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {stream.observations.slice(0, 6).map((obs, idx) => (
                      <div key={idx} className="border border-slate-800 bg-[#060a12] p-3 text-[11px]">
                        <div className="font-mono font-semibold text-cyan-300">{obs.profile_id}</div>
                        <div className="mt-1 text-slate-400">
                          {obs.latitude.toFixed(3)}° N, {obs.longitude.toFixed(3)}° E
                        </div>
                        <div className="text-slate-400">Observed: {new Date(obs.observation_time).toLocaleDateString('en-GB', { timeZone: 'UTC' })}</div>
                        <div className="mt-2 text-[10px] font-mono text-emerald-400">
                          {obs.levels?.length || 0} valid levels (0–500 dbar)
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {activeMode === 'registry' && (
            <div className="space-y-4">
              <section className="border border-slate-800 bg-[#09101d] p-4">
                <h2 className="text-sm font-semibold text-slate-100">Dataset & Source Registry</h2>
                <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-slate-400">
                  These datasets are configured in the application source registry. This view describes provenance, product identities, and supported use.
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
                          className={`border p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                            selected ? 'border-cyan-700 bg-[#0c1929]' : 'border-slate-800 bg-[#09101d] hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-sm font-semibold text-slate-100">{source.name}</h3>
                              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{sourceRoles[source.id] ?? 'Configured ViaDariya data source.'}</p>
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
                    <Detail icon={<Layers3 className="h-3.5 w-3.5" />} label="Role" value={sourceRoles[selectedSource.id] ?? 'Configured ViaDariya data source.'} />
                    <Detail icon={<FileText className="h-3.5 w-3.5" />} label="Variables" value={selectedSource.variables.join(', ') || 'No variables configured'} mono />
                    <Detail icon={<MapPin className="h-3.5 w-3.5" />} label="Coverage" value={formatCoverage(selectedSource)} />
                    <Detail label="Period" value={`${selectedSource.temporalCoverage.start} to ${selectedSource.temporalCoverage.end} (${selectedSource.temporalCoverage.resolution})`} mono />
                    <Detail label="Vertical range" value={`${selectedSource.verticalCoverage.minPressure}–${selectedSource.verticalCoverage.maxPressure} dbar`} mono />
                    <Detail label="Supported workspace services" value={selectedSource.supportedOperations.join(', ')} mono />
                    {selectedSource.citation && <Detail label="Provenance" value={selectedSource.citation} />}
                  </div>
                </aside>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

function Detail({ icon, label, value, mono = false }: { icon?: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] text-slate-500">
        {icon}
        {label}
      </div>
      <div className={`mt-1 leading-relaxed text-slate-300 ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</div>
    </div>
  );
}

function formatCoverage(source: OceanDataSource) {
  const { region, north, south, east, west } = source.spatialCoverage;
  return region ? `${region} (${south}–${north}° N, ${west}–${east}° E)` : `${south}–${north}° N, ${west}–${east}° E`;
}
