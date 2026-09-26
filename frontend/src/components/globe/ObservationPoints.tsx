import { useState, useEffect, useMemo } from 'react';
import { useOceanStore } from '@/state/oceanStore';
import { fetchDatasetProfiles, type DatasetProfileSummary } from '@/services/observationDiscoveryService';
import { getDatasetVisualConfig, DATASET_VISUAL_CONFIG } from '@/config/datasetVisualConfig';
import { formatLatitude, formatLongitude } from '@/utils/coordinates';

export function ObservationPoints() {
  const {
    selectedObservationId,
    selectedDate,
    selectedPlatform,
    setSelectedPlatform,
    selectResearchObservation,
    triggerFitAllObservations,
    setAvailableDates,
    setDatasetTemporalRange,
  } = useOceanStore();

  const [allProfiles, setAllProfiles] = useState<DatasetProfileSummary[]>([]);
  const [temporalRange, setTemporalRange] = useState<{ start: string; end: string }>({ start: '2024-01-01', end: '2024-01-15' });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchDatasetProfiles(selectedPlatform, 'HISTORICAL_RESEARCH')
      .then((res) => {
        const raw = res.profiles || [];
        setAllProfiles(raw);
        console.log(`[DEPLOYED DATA] platform=${selectedPlatform} profilesReturned=${res.total_profiles ?? raw.length} profilesAfterNormalization=${raw.length} profilesAfterPlatformFilter=${raw.length}`);
        if (res.temporal_range) {
          setTemporalRange(res.temporal_range);
          setDatasetTemporalRange(res.temporal_range);
        }
        if (res.available_dates && res.available_dates.length > 0) {
          setAvailableDates(res.available_dates);
        }
      })
      .catch((err) => {
        setAllProfiles([]);
        setError(err instanceof Error ? err.message : 'Backend unavailable');
      })
      .finally(() => setLoading(false));
  }, [selectedPlatform, setAvailableDates, setDatasetTemporalRange]);

  const profiles = useMemo(() => {
    return allProfiles;
  }, [allProfiles]);

  const handleProfileClick = (p: DatasetProfileSummary) => {
    selectResearchObservation({
      id: p.profile_id,
      location: { latitude: p.latitude, longitude: p.longitude },
      date: p.observation_time.substring(0, 10),
    });
  };

  const activeVisual = getDatasetVisualConfig(selectedPlatform === 'ALL' ? 'ARGO' : selectedPlatform);

  return (
    <div className="absolute left-3 top-3 z-10 pointer-events-auto font-mono">
      <div className="w-[230px] max-h-[calc(100vh-100px)] overflow-y-auto rounded-lg shadow-2xl border border-slate-800 bg-[#070d18]/95 backdrop-blur-md">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-[#040812]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: activeVisual.hex }} />
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-200">
              IN-SITU STATIONS
            </span>
          </div>
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-cyan-300">
            {profiles.length}
          </span>
        </div>

        {/* Platform selection pills */}
        <div className="flex flex-wrap gap-1 p-1.5 border-b border-slate-800 bg-[#060a12] text-[9px]">
          {(['ALL', 'ARGO', 'GLIDER', 'CTD', 'BGC'] as const).map((platKey) => {
            const isSelected = selectedPlatform === platKey;
            const meta = platKey === 'ALL' ? { hex: '#06b6d4', shortLabel: 'ALL' } : getDatasetVisualConfig(platKey);
            return (
              <button
                key={platKey}
                type="button"
                id={`btn-map-plat-${platKey.toLowerCase()}`}
                onClick={() => setSelectedPlatform(platKey)}
                className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-1 ${
                  isSelected
                    ? 'bg-slate-800 text-white font-bold border border-slate-600 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.hex }} />
                <span>{platKey}</span>
              </button>
            );
          })}
        </div>

        {/* Dataset metadata & temporal extent banner */}
        <div className="px-2.5 py-1.5 border-b border-slate-800/80 bg-[#03060c] text-[9px] text-slate-400 space-y-0.5">
          <div className="flex justify-between items-center">
            <span className="text-slate-500 uppercase">Coverage Range:</span>
            <span className="text-cyan-300 font-bold">{temporalRange.start} → {temporalRange.end}</span>
          </div>
          <div className="flex justify-between items-center text-[8px] text-slate-500">
            <span>Active Dataset:</span>
            <span className="truncate max-w-[120px] text-slate-300">{selectedPlatform === 'ALL' ? 'Multi-Platform In-Situ' : activeVisual.label}</span>
          </div>
        </div>

        {/* Fit button */}
        <div className="p-1.5 border-b border-slate-800 bg-[#050912]">
          <button
            type="button"
            onClick={() => triggerFitAllObservations()}
            className="w-full py-1 text-[10px] rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>Fit Active Extent ({profiles.length})</span>
          </button>
        </div>

        {/* Real Stations List */}
        <div className="p-1.5">
          <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-800/60 text-[9px] text-slate-500 uppercase tracking-wider">
            <span>REAL IN-SITU PROFILES</span>
            <span>{loading ? 'LOADING...' : `${profiles.length} LOCATIONS`}</span>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1">
            {profiles.length > 0 ? (
              profiles.map((p) => {
                const isSelected = selectedObservationId === p.profile_id;
                const visual = getDatasetVisualConfig(p.platform_type);
                return (
                  <button
                    key={p.profile_id}
                    type="button"
                    onClick={() => handleProfileClick(p)}
                    className={`flex flex-col w-full text-left p-1.5 rounded transition cursor-pointer border ${
                      isSelected
                        ? 'bg-cyan-950/80 border-cyan-700 text-cyan-200'
                        : 'bg-slate-900/50 hover:bg-slate-850 border-slate-800/80 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: visual.hex }} />
                        <span className="font-bold truncate">
                          {p.platform_type} {p.platform_id}
                        </span>
                      </div>
                      <span className={`text-[8px] font-bold px-1 rounded border ${visual.badgeBgClass} ${visual.badgeTextClass} ${visual.badgeBorderClass}`}>
                        {p.platform_type}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[9px] text-slate-400 mt-0.5">
                      <span>{formatLatitude(p.latitude)} {formatLongitude(p.longitude)}</span>
                      <span className="text-[8px] text-slate-500">{p.observation_time.substring(0, 10)}</span>
                    </div>

                    <div className="flex items-center justify-between text-[8px] text-slate-500 mt-0.5">
                      <span>Depth: 0–{Math.round(p.max_depth)} m</span>
                      <span className="text-teal-400/90">{p.variables.slice(0, 3).join(', ')}</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-4 text-center text-slate-500 text-[10px] px-2">
                {loading
                  ? 'Searching real station profiles...'
                  : error
                  ? <span className="text-rose-400 font-bold">API ERROR: {error}</span>
                  : 'No in-situ stations found for this platform filter.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
