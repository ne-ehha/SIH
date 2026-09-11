import { useOceanStore } from '@/state/oceanStore';
import { useLatestDataStream } from '@/hooks/useLatestDataStream';

const displayTime = (value: string | null) => value ? `${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value))} UTC` : '—';

/** The shared stream stays explicitly separate from the historical benchmark. */
export function LatestAvailableDataMode() {
  const mode = useOceanStore((state) => state.researchDataMode);
  const setMode = useOceanStore((state) => state.setResearchDataMode);
  const stream = useLatestDataStream();
  const latest = stream.latestObservation;
  const isLoading = stream.status === 'loading';

  return <section className="mx-2.5 mt-2.5 rounded-lg border border-slate-800 bg-[#09101d] px-3 py-2.5 text-xs">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Data mode</span>
        <div className="flex rounded border border-slate-700 bg-slate-950 p-0.5">
          <button type="button" onClick={() => setMode('benchmark')} className={`rounded px-2 py-1 ${mode === 'benchmark' ? 'bg-teal-950 text-teal-200' : 'text-slate-400'}`}>Benchmark</button>
          <button type="button" onClick={() => setMode('latest')} className={`rounded px-2 py-1 ${mode === 'latest' ? 'bg-teal-950 text-teal-200' : 'text-slate-400'}`}>Latest Available</button>
        </div>
      </div>
      {mode === 'latest' && (
        <button
          type="button"
          onClick={() => void stream.refreshNow()}
          disabled={isLoading}
          className="rounded border border-[#3F7F6A]/60 bg-[#3F7F6A]/15 px-3 py-1.5 font-medium text-[#83b7a4] transition-colors hover:bg-[#3F7F6A]/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? 'Fetching\u2026' : 'Fetch Latest Data'}
        </button>
      )}
    </div>

    {mode === 'benchmark' ? (
      <p className="mt-2 text-[11px] text-slate-400">GLORYS12V1 × Argo Delayed Mode benchmark — Bay of Bengal, 2024-01-01 through 2024-01-15, 0–500 m. Difference: GLORYS − Argo.</p>
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
        <div className="rounded border border-amber-900/70 bg-amber-950/15 p-2 text-slate-300">
          <div className="font-medium text-amber-200">Copernicus Marine Operational Model · Unavailable</div>
          <div>{stream.copernicus?.reason ?? 'No operational model subset has been retrieved.'}</div>
          <div className="mt-1 text-slate-400">No model comparison is rendered for Latest Available until actual model data exists.</div>
        </div>
      </div>
    )}
  </section>;
}
