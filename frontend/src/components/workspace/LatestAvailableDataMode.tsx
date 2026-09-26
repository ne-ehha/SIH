import { useOceanStore } from '@/state/oceanStore';
import { useLatestDataStream } from '@/hooks/useLatestDataStream';

const displayTime = (value: string | null) => value ? `${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value))} UTC` : '—';

/** The shared stream stays explicitly separate from the historical benchmark. */
export function LatestAvailableDataMode() {
  const mode = useOceanStore((state) => state.researchDataMode);
  const setMode = useOceanStore((state) => state.setResearchDataMode);
  const canonicalMode = useOceanStore((state) => state.canonicalDataMode);
  const setCanonicalMode = useOceanStore((state) => state.setCanonicalDataMode);
  const stream = useLatestDataStream();
  const latest = stream.latestObservation;
  const isLoading = stream.status === 'loading';

  const handleSelectMode = (newMode: 'benchmark' | 'latest') => {
    setMode(newMode);
    setCanonicalMode(newMode === 'latest' ? 'LIVE_NRT' : 'HISTORICAL_RESEARCH');
  };

  return <section className="mx-2.5 mt-2.5 rounded-lg border border-slate-800 bg-[#09101d] px-3 py-2.5 text-xs">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Data mode:</span>
        <div className="flex rounded border border-slate-700 bg-slate-950 p-0.5 font-mono text-[11px]">
          <button
            type="button"
            onClick={() => handleSelectMode('benchmark')}
            className={`rounded px-2.5 py-1 transition-colors cursor-pointer ${
              canonicalMode === 'HISTORICAL_RESEARCH' ? 'bg-indigo-950 text-indigo-200 font-bold border border-indigo-800/80' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            HISTORICAL / RESEARCH
          </button>
          <button
            type="button"
            onClick={() => handleSelectMode('latest')}
            className={`rounded px-2.5 py-1 transition-colors cursor-pointer ${
              canonicalMode === 'LIVE_NRT' ? 'bg-emerald-950 text-emerald-200 font-bold border border-emerald-800/80' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            LIVE / NRT
          </button>
        </div>
      </div>
      {mode === 'latest' && (
        <button
          type="button"
          onClick={() => void stream.refreshNow()}
          disabled={isLoading}
          className="rounded border border-[#3F7F6A]/60 bg-[#3F7F6A]/15 px-3 py-1.5 font-medium text-[#83b7a4] transition-colors hover:bg-[#3F7F6A]/25 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          {isLoading ? 'Fetching\u2026' : 'Fetch Latest Data'}
        </button>
      )}
    </div>

    {mode === 'benchmark' ? (
      <div className="mt-2 rounded border border-indigo-900/60 bg-indigo-950/20 p-2 text-[11px] text-slate-300">
        <div className="flex items-center justify-between">
          <span className="font-medium text-indigo-300">● HISTORICAL_RESEARCH · GLORYS12V1 Reanalysis × In-situ Multi-Platform Benchmark</span>
          <span className="rounded bg-indigo-900/60 px-1.5 py-0.5 font-mono text-[9px] text-indigo-200">ARGO · GLIDER · CTD · BGC</span>
        </div>
        <p className="mt-1 text-slate-400">
          Bay of Bengal, 2024-01-01 through 2024-01-15, validated depth 0–500 m. Difference convention: GLORYS − Argo (positive indicates GLORYS is higher).
        </p>
      </div>
    ) : (
      <div className="mt-2 grid gap-2 text-[11px] md:grid-cols-2">
        <div className="rounded border border-[#3F7F6A]/60 bg-[#3F7F6A]/10 p-2 text-slate-300">
          <div className="font-medium text-[#83b7a4]">
            ● {stream.status === 'connected' ? 'AVAILABLE' : isLoading ? 'FETCHING' : stream.status === 'error' ? 'UNAVAILABLE' : 'WAITING'} · Latest Argo observations
          </div>
          <div>Source: Argo GDAC · Region: Bay of Bengal · Depth: 0–500 dbar</div>
          <div>Variables: Temperature · Salinity</div>
          <div>Latest observation: {displayTime(stream.latestObservationAt)}</div>
          <div>Last checked: {displayTime(stream.lastCheckedAt)}</div>
          <div>Profiles: {stream.observations.length} · New: {stream.newObservationCount}</div>
          {latest && (
            <div className="mt-1 text-[10px] text-slate-400">
              Latest: {latest.platform_id} / cycle {latest.cycle_number ?? '—'} · Observed {displayTime(latest.observation_time)} · Retrieved {displayTime(latest.provenance.retrieved_at)}
            </div>
          )}
          {stream.error && (
            <div className="mt-1 text-rose-300">Last update failed: {stream.error}. Previous valid profiles remain visible.</div>
          )}
        </div>
        {stream.copernicus?.available ? (
          <div className="rounded border border-teal-800/70 bg-teal-950/20 p-2 text-slate-300">
            <div className="flex items-center justify-between">
              <span className="font-medium text-teal-300">● CONNECTED · Copernicus Marine Operational Model</span>
              <span className="rounded bg-teal-900/60 px-1.5 py-0.5 font-mono text-[9px] text-teal-200">PHYSICS + BGC</span>
            </div>
            <div>Model valid at: {displayTime(stream.copernicus.collocation?.model_time ?? null)}</div>
            <div>Collocation offset: {stream.copernicus.collocation?.horizontal_distance_km ?? 0} km · {stream.copernicus.collocation?.temporal_offset_hours ?? 0} hrs</div>
            <div className="text-slate-400">
              Variables: θ, S, u, v, Speed, Direction{stream.copernicus.variables?.chl?.length ? ', Chl-a, O₂, NO₃' : ''}
              {stream.copernicus.surface_fields?.zos && ` · SSH: ${stream.copernicus.surface_fields.zos.value} m`}
              {stream.copernicus.surface_fields?.mlotst && ` · MLD: ${stream.copernicus.surface_fields.mlotst.value} m`}
            </div>
            {stream.copernicus.comparisons?.temperature && (
              <div className="mt-1 border-t border-teal-900/40 pt-1 text-[10px] text-teal-200">
                Temp Bias: {stream.copernicus.comparisons.temperature.mean_bias > 0 ? '+' : ''}{stream.copernicus.comparisons.temperature.mean_bias.toFixed(3)}°C · RMSE: {stream.copernicus.comparisons.temperature.rmse.toFixed(3)}°C ({stream.copernicus.comparisons.temperature.matched_levels_count} matched levels)
              </div>
            )}
          </div>
        ) : (
          <div className="rounded border border-amber-900/70 bg-amber-950/15 p-2 text-slate-300">
            <div className="font-medium text-amber-200">Copernicus Marine Operational Model · Initializing</div>
            <div>{stream.copernicus?.reason ?? 'Connecting to Copernicus Marine Service authenticated gateway\u2026'}</div>
            <div className="mt-1 text-slate-400">Authentic operational model data is retrieved server-side upon collocation.</div>
          </div>
        )}
      </div>
    )}
  </section>;
}
