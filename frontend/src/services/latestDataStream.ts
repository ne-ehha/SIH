import { getSession } from '@/state/session';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const LATEST_ARGO_DENIM_GREEN = '#3F7F6A';

export interface LatestArgoLevel {
  pressure: number;
  temperature: number;
  salinity: number;
  pressure_qc: string;
  temperature_qc: string;
  salinity_qc: string;
}

export interface LatestArgoObservation {
  profile_id: string;
  platform_id: string;
  cycle_number: number | null;
  latitude: number;
  longitude: number;
  observation_time: string;
  levels: LatestArgoLevel[];
  data_mode: Record<string, string>;
  qc: { accepted_flags: string[]; accepted_levels: number; rejected_levels: number; state: string };
  provenance: { source: string; profile_url?: string; retrieved_at: string; depth_range: [number, number]; variables: string[] };
}

export interface LatestDataStreamState {
  status: 'idle' | 'loading' | 'connected' | 'error';
  observations: LatestArgoObservation[];
  latestObservation: LatestArgoObservation | null;
  lastCheckedAt: string | null;
  latestObservationAt: string | null;
  nextRefreshAt: string | null;
  newObservationCount: number;
  error: string | null;
  copernicus: { available: boolean; reason: string | null; provenance: { source: string; product_id: string } } | null;
}

interface StreamInfo {
  state: 'connected' | 'waiting' | 'error';
  last_checked_at: string | null;
  latest_observation_at: string | null;
  next_refresh_at: string | null;
  new_records: number;
}

/** The backend returns the same payload at both top-level and under data. */
interface LatestResponse {
  status: 'success' | 'error';
  data?: {
    stream?: StreamInfo;
    observations?: LatestArgoObservation[];
    argo?: LatestArgoObservation;
    copernicus?: LatestDataStreamState['copernicus'];
  };
  stream?: StreamInfo;
  observations?: LatestArgoObservation[];
  provenance?: { source: string; region: string; variables: string[]; depth_range: [number, number] };
  error?: { message: string };
}

let state: LatestDataStreamState = {
  status: 'idle', observations: [], latestObservation: null, lastCheckedAt: null,
  latestObservationAt: null, nextRefreshAt: null, newObservationCount: 0, error: null, copernicus: null,
};
let inFlight: Promise<void> | null = null;
let controller: AbortController | null = null;
let timer: number | null = null;
let consumers = 0;
const listeners = new Set<() => void>();

function emit() { listeners.forEach((listener) => listener()); }
function setState(next: Partial<LatestDataStreamState>) { state = { ...state, ...next }; emit(); }
function intervalMs() {
  const serverInterval = state.nextRefreshAt && state.lastCheckedAt
    ? new Date(state.nextRefreshAt).getTime() - new Date(state.lastCheckedAt).getTime() : 300_000;
  return Math.max(60_000, Number.isFinite(serverInterval) ? serverInterval : 300_000);
}

export function subscribeLatestDataStream(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function getLatestDataStreamState() { return state; }

/**
 * One deduplicated request for every workstation, service view, and globe layer.
 * Handles both the full data envelope (stream + observations under data) and
 * legacy responses that may only carry a single `argo` profile.
 */
export async function refreshLatestDataStream(manual = false): Promise<void> {
  if (inFlight) return inFlight;
  controller = new AbortController();
  setState({ status: 'loading', error: null }); // keep last valid observations visible
  inFlight = fetch(`${API_BASE_URL}/api/v1/research/latest`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
    body: JSON.stringify({ region: 'bay-of-bengal', max_age_days: 30, force_refresh: manual }),
  }).then(async (response) => {
    const raw = await response.json() as LatestResponse;
    if (!response.ok || raw.status !== 'success') {
      throw new Error(raw.error?.message || 'Latest data request failed.');
    }

    // Resolve observations: prefer data.observations, fall back to top-level, then wrap single argo.
    const observations: LatestArgoObservation[] =
      (raw.data?.observations && raw.data.observations.length > 0)
        ? raw.data.observations
        : (raw.observations && raw.observations.length > 0)
          ? raw.observations
          : raw.data?.argo
            ? [raw.data.argo]
            : [];

    // Resolve stream info: prefer data.stream, fall back to top-level.
    const stream: StreamInfo | undefined = raw.data?.stream ?? raw.stream;

    const connected = stream?.state === 'connected';
    setState({
      status: connected ? 'connected' : observations.length > 0 ? 'connected' : 'idle',
      observations,
      latestObservation: observations[0] ?? null,
      lastCheckedAt: stream?.last_checked_at ?? null,
      latestObservationAt: stream?.latest_observation_at ?? null,
      nextRefreshAt: stream?.next_refresh_at ?? null,
      newObservationCount: stream?.new_records ?? 0,
      error: null,
      copernicus: raw.data?.copernicus ?? null,
    });
  }).catch((error: unknown) => {
    if ((error as Error).name === 'AbortError') {
      // Request was cancelled (component unmount or explicit abort).
      // Reset to idle so the next consumer start can re-trigger cleanly.
      setState({ status: 'idle' });
    } else {
      setState({ status: 'error', error: error instanceof Error ? error.message : 'Unable to reach the OceanScope backend.' });
    }
  }).finally(() => { inFlight = null; controller = null; });
  return inFlight;
}

function schedule() {
  if (timer !== null || consumers === 0) return;
  timer = -1; // reserve the single scheduler while its first request is in flight
  const tick = async () => {
    await refreshLatestDataStream();
    if (consumers > 0) timer = window.setTimeout(tick, intervalMs());
    else timer = null;
  };
  void tick();
}

export function startLatestDataStream() { consumers += 1; schedule(); }
export function stopLatestDataStream() {
  consumers = Math.max(0, consumers - 1);
  if (consumers === 0 && timer !== null) { if (timer >= 0) window.clearTimeout(timer); timer = null; }
  if (consumers === 0 && controller) controller.abort();
}
