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
    setSelectedLocation,
    clearSelectedObservation,
    setWorkspaceMode,
    triggerFitAllObservations,
  } = useOceanStore();
  const [observations, setObservations] = useState<ObservationPoint[]>([]);

  useEffect(() => {
    fetchObservations(selectedRegion)
      .then(setObservations)
      .catch(() => setObservations([]));
  }, [selectedRegion, selectedDate]);

  const handleObsClick = (obs: ObservationPoint) => {
    selectResearchObservation({
      id: obs.id,
      location: { latitude: obs.latitude, longitude: obs.longitude },
      date: obs.timestamp.substring(0, 10),
    });
    setWorkspaceMode('research');
  };

  return (
    <div className="absolute left-3 top-3 z-10 pointer-events-auto">
      <div className="w-[190px] max-h-[calc(100vh-100px)] overflow-y-auto bg-[var(--os-surface)] border border-[var(--os-border)]">
        {/* Header */}
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[var(--os-border)]">
          <span className="text-[12px] font-semibold tracking-wide uppercase text-[var(--os-text-3)]">Argo Profiles</span>
          <span className="text-[12px] mono text-[var(--os-text-3)]">{observations.length + RESEARCH_DATA_COVERAGE.length}</span>
        </div>

        {/* Fit button */}
        <div className="px-2 py-1.5 border-b border-[var(--os-border)]">
          <button
            onClick={() => triggerFitAllObservations()}
            className="w-full rounded-sm border border-[var(--os-border)] bg-[var(--os-bg)] px-2 py-1.5 text-[11px] text-[var(--os-text-2)] transition hover:border-[var(--os-border-light)] hover:text-[var(--os-text)]"
          >
            Fit Observations
          </button>
        </div>

        {/* Stations */}
        {observations.length > 0 && (
          <div className="border-b border-[var(--os-border)]">
            <div className="px-2.5 py-1">
              <span className="text-[13px] font-semibold uppercase tracking-wider text-[var(--os-text-3)]">Stations ({observations.length})</span>
            </div>
            <div className="px-2.5 pb-1.5">
              {observations.map((obs) => {
                const isSelected = selectedObservationId === obs.id;
                return (
                  <button
                    key={obs.id}
                    onClick={() => handleObsClick(obs)}
                    className={`flex w-full items-center gap-2 py-0.5 text-[13px] transition ${
                      isSelected
                        ? 'text-[var(--os-selected)] font-medium'
                        : 'text-[var(--os-text-2)] hover:text-[var(--os-text)]'
                    }`}
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
            <span className="text-[13px] font-semibold uppercase tracking-wider text-[var(--os-text-3)]">Coverage ({RESEARCH_DATA_COVERAGE.length})</span>
          </div>
          <div className="px-2.5 pb-1.5 max-h-36 overflow-y-auto">
            {RESEARCH_DATA_COVERAGE.map((cov, i) => (
              <div
                key={i}
                className="flex items-center gap-2 py-px text-[12px] text-[var(--os-text-muted)]"
              >
                <span className="h-1.5 w-1.5 rounded-sm bg-[var(--os-text-muted)] shrink-0" />
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
