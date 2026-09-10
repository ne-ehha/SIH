import { useState, useEffect } from 'react';
import { useOceanStore } from '@/state/oceanStore';
import { fetchObservations } from '@/services/observationService';
import { RESEARCH_DATA_COVERAGE } from '@/config/researchDataCoverage';
import { formatLatitude, formatLongitude } from '@/utils/coordinates';
import type { ObservationPoint } from '@/types/observation';

export function ObservationPoints() {
  const {
    selectedObservationId,
    selectedRegion,
    selectedDate,
    selectResearchObservation,
    triggerFitAllObservations,
  } = useOceanStore();
  const [observations, setObservations] = useState<ObservationPoint[]>([]);

  useEffect(() => {
    fetchObservations(selectedRegion)
      .then(setObservations)
      .catch(() => setObservations([]));
  }, [selectedRegion, selectedDate]);

  const handleObsClick = (obs: ObservationPoint) => {
    // Select the observation and show it in the panel.
    // Do NOT auto-navigate to Research — user must explicitly choose Inspect.
    selectResearchObservation({
      id: obs.id,
      location: { latitude: obs.latitude, longitude: obs.longitude },
      date: obs.timestamp.substring(0, 10),
    });
  };

  return (
    <div className="absolute left-3 top-3 z-10 pointer-events-auto">
      <div className="w-[190px] max-h-[calc(100vh-100px)] overflow-y-auto" style={{ background: 'var(--os-surface)', border: '1px solid var(--os-border)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-2.5 py-1.5" style={{ borderBottom: '1px solid var(--os-border)' }}>
          <span className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: 'var(--os-text-3)' }}>Argo Profiles</span>
          <span className="text-[11px] mono" style={{ color: 'var(--os-text-muted)' }}>{observations.length + RESEARCH_DATA_COVERAGE.length}</span>
        </div>

        {/* Fit button */}
        <div className="px-2 py-1.5" style={{ borderBottom: '1px solid var(--os-border)' }}>
          <button
            onClick={() => triggerFitAllObservations()}
            className="w-full px-2 py-1.5 text-[11px] transition"
            style={{
              border: '1px solid var(--os-border)',
              background: 'var(--os-bg)',
              color: 'var(--os-text-2)',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.borderColor = 'var(--os-border-light)';
              (e.target as HTMLElement).style.color = 'var(--os-text)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.borderColor = 'var(--os-border)';
              (e.target as HTMLElement).style.color = 'var(--os-text-2)';
            }}
          >
            Fit Observations
          </button>
        </div>

        {/* Stations */}
        {observations.length > 0 && (
          <div style={{ borderBottom: '1px solid var(--os-border)' }}>
            <div className="px-2.5 py-1">
              <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--os-text-3)' }}>Stations ({observations.length})</span>
            </div>
            <div className="px-2.5 pb-1.5">
              {observations.map((obs) => {
                const isSelected = selectedObservationId === obs.id;
                return (
                  <button
                    key={obs.id}
                    onClick={() => handleObsClick(obs)}
                    className="flex w-full items-center gap-2 py-0.5 text-[12px] transition"
                    style={{
                      color: isSelected ? 'var(--os-selected)' : 'var(--os-text-2)',
                      fontWeight: isSelected ? 500 : 400,
                    }}
                  >
                    <span
                      className="h-2 w-2 rounded-sm shrink-0"
                      style={{
                        background: isSelected ? 'var(--os-selected)' : 'var(--os-argo)',
                      }}
                    />
                    <span className="mono truncate">
                      {obs.id.replace('argo_', '').replace('_', ' / ')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Coverage Sites */}
        <div>
          <div className="px-2.5 py-1">
            <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--os-text-3)' }}>Coverage ({RESEARCH_DATA_COVERAGE.length})</span>
          </div>
          <div className="px-2.5 pb-1.5 max-h-36 overflow-y-auto">
            {RESEARCH_DATA_COVERAGE.map((cov, i) => (
              <div
                key={i}
                className="flex items-center gap-2 py-px text-[11px]"
                style={{ color: 'var(--os-text-muted)' }}
              >
                <span className="h-1.5 w-1.5 rounded-sm shrink-0" style={{ background: 'var(--os-text-muted)' }} />
                <span className="mono">
                  {formatLatitude(cov.latitude)} {formatLongitude(cov.longitude)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
