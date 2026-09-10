import { useMemo, useState, useEffect } from 'react';
import { useOceanStore } from '@/state/oceanStore';
import { variables } from '@/config/variables';
import { OBSERVATION_DATES, observationDateLabel } from '@/config/observationDates';
import { COLOR_PALETTES } from '@/config/colorScales';
import type { OceanVariable } from '@/types/ocean';

export function Sidebar() {
  const {
    selectedVariable,
    setSelectedVariable,
    selectedDepth,
    setSelectedDepth,
    selectedDate,
    setSelectedDate,
    selectedObservationId,
    sidebarCollapsed,
    toggleSidebar,
    triggerFitAllObservations,
    colorScale,
    setColorScale,
    activeLayers,
    toggleLayer,
    setLayerOpacity,
    verticalExaggeration,
    setVerticalExaggeration,
    timeIndex,
    setTimeIndex,
    stepTime,
  } = useOceanStore();

  const [section, setSection] = useState<'data' | 'display' | 'layers'>('data');

  // Manual min/max validation: renderers also sanitize defensively, but the
  // user gets immediate feedback instead of a silently clamped range.
  const manualRangeError = useMemo(() => {
    if (colorScale.auto) return null;
    const { min, max } = colorScale;
    if (!Number.isFinite(min) || !Number.isFinite(max)) return 'Range values must be numbers.';
    if (min >= max) return 'Minimum must be less than maximum.';
    if (colorScale.logarithmic && (min <= 0 || max <= 0)) {
      return 'Log scale requires positive values.';
    }
    return null;
  }, [colorScale]);

  // Research Mode is temperature/salinity only: the collocation dataset
  // contains no U/V records. currents_* remain architecture-only.
  const visibleVariables = useMemo(
    () => variables.filter((v) => v.available && (v.id === 'temperature' || v.id === 'salinity' || v.id === selectedVariable)),
    [selectedVariable]
  );

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
  };

  if (sidebarCollapsed) {
    return (
      <aside className="flex h-full w-10 flex-col items-center border-r border-[var(--os-border)] bg-[var(--os-surface)] py-2">
        <button
          onClick={toggleSidebar}
          className="flex h-6 w-6 items-center justify-center rounded text-[var(--os-text-3)] transition hover:bg-[var(--os-surface-2)] hover:text-[var(--os-text-2)] mb-2"
          title="Expand control rail"
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
        {/* Context-aware labels, not cryptic single letters (SIH26067 E) */}
        <div className="flex flex-col items-center gap-2 mt-2">
          <button onClick={toggleSidebar} title="Variable" className="w-6 h-6 flex items-center justify-center rounded text-[9px] text-[var(--os-text-muted)] hover:bg-[var(--os-surface-2)] hover:text-[var(--os-text-2)]">
            {selectedVariable === 'temperature' ? 'T°' : selectedVariable === 'salinity' ? 'S' : selectedVariable === 'currents_u' ? 'U' : 'V'}
          </button>
          <button onClick={toggleSidebar} title="Depth" className="w-6 h-6 flex items-center justify-center rounded text-[9px] text-[var(--os-text-muted)] hover:bg-[var(--os-surface-2)] hover:text-[var(--os-text-2)]">
            {selectedDepth}
          </button>
          <button onClick={toggleSidebar} title="Date" className="w-6 h-6 flex items-center justify-center rounded text-[8px] text-[var(--os-text-muted)] hover:bg-[var(--os-surface-2)] hover:text-[var(--os-text-2)]">
            {selectedDate.split('-')[2]}
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-[190px] flex-col border-r border-[var(--os-border)] bg-[var(--os-surface)] overflow-y-auto select-none">
      {/* Collapse button */}
      <div className="flex items-center justify-end px-2 py-1.5">
        <button
          onClick={toggleSidebar}
          className="flex h-4 w-4 items-center justify-center rounded text-[var(--os-text-muted)] transition hover:bg-[var(--os-surface-2)] hover:text-[var(--os-text-3)]"
          title="Collapse"
        >
          <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      {/* ── Section tabs ── */}
      <div className="flex border-b border-[var(--os-border)]">
        {([
          ['data', 'Data'],
          ['display', 'Display'],
          ['layers', 'Layers'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className={`flex-1 py-1 text-[9px] font-semibold uppercase tracking-wider transition ${
              section === id
                ? 'text-[var(--os-text)] border-b border-[var(--os-accent)]'
                : 'text-[var(--os-text-muted)] hover:text-[var(--os-text-2)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ══ DATA SECTION ══ */}
      {section === 'data' && (
        <>
          {/* ── VARIABLE ── */}
          <div className="section-label">Variable</div>
          <div className="px-2 pb-0.5">
            {visibleVariables.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedVariable(v.id as OceanVariable)}
                className={`flex w-full items-center gap-2 px-2 py-1.5 text-[13px] transition ${
                  selectedVariable === v.id
                    ? 'text-[var(--os-accent)] border-l-2 border-[var(--os-accent)] bg-[rgba(6,182,212,0.08)]'
                    : 'text-[var(--os-text-2)] hover:text-[var(--os-text)] border-l-2 border-transparent'
                }`}
              >
                <span className={`h-2 w-2 rounded-sm shrink-0 ${
                  selectedVariable === v.id ? 'bg-[var(--os-accent)]' : 'bg-[var(--os-text-muted)]'
                }`} />
                <span className="flex-1 text-left font-medium">{v.label}</span>
                <span className="text-[11px] text-[var(--os-text-muted)] mono">{v.unit}</span>
              </button>
            ))}
            {/* Architecture-only variables: shown as unavailable, never fake */}
            {variables.filter((v) => !v.available).map((v) => (
              <div
                key={v.id}
                title={v.availabilityNote ?? 'Requires a real dataset that is not currently connected.'}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-[13px] opacity-45 cursor-not-allowed"
              >
                <span className="h-2 w-2 rounded-sm shrink-0 bg-[var(--os-text-muted)]" />
                <span className="flex-1 text-left text-[var(--os-text-3)]">{v.label}</span>
                <span className="text-[9px] uppercase tracking-wider text-[var(--os-text-muted)]">no data</span>
              </div>
            ))}
          </div>
          <div className="section-sep" />

          {/* ── TIME ── */}
          <div className="section-label">Time</div>
          <div className="px-2 pb-0.5">
            <div className="flex items-center gap-1 mb-1">
              <button
                onClick={() => stepTime(-1)}
                disabled={timeIndex <= 0}
                className="px-1.5 py-0.5 text-[11px] border border-[var(--os-border)] text-[var(--os-text-2)] hover:border-[var(--os-border-light)] disabled:opacity-30"
                title="Previous observation date"
              >
                ◀
              </button>
              <div className="flex-1 text-center mono text-[11px] text-[var(--os-text)]">
                {observationDateLabel(selectedDate)}
              </div>
              <button
                onClick={() => stepTime(1)}
                disabled={timeIndex >= OBSERVATION_DATES.length - 1}
                className="px-1.5 py-0.5 text-[11px] border border-[var(--os-border)] text-[var(--os-text-2)] hover:border-[var(--os-border-light)] disabled:opacity-30"
                title="Next observation date"
              >
                ▶
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {OBSERVATION_DATES.map((d, i) => {
                const day = d.split('-')[2];
                const isActive = d === selectedDate;
                return (
                  <button
                    key={d}
                    onClick={() => setTimeIndex(i)}
                    className="px-1.5 py-0.5 text-[11px] mono transition border"
                    style={{
                      background: isActive ? 'var(--os-accent)' : 'var(--os-bg)',
                      color: isActive ? '#fff' : 'var(--os-text-2)',
                      borderColor: isActive ? 'var(--os-accent)' : 'var(--os-border)',
                    }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[9px] text-[var(--os-text-muted)]">
              Observation dates only — no data exists on other days
            </p>
          </div>
          <div className="section-sep" />

          {/* ── DEPTH ── */}
          <div className="section-label">Depth</div>
          <div className="px-2 pb-1.5">
            <SidebarDepthInput value={selectedDepth} onChange={setSelectedDepth} />
          </div>
          <div className="section-sep" />

          {/* ── ACTIONS ── */}
          <div className="px-2 py-1">
            <button
              onClick={() => triggerFitAllObservations()}
              className="w-full rounded-sm border border-[var(--os-border)] bg-[var(--os-bg)] px-2 py-1.5 text-[11px] text-[var(--os-text-2)] transition hover:border-[var(--os-border-light)] hover:text-[var(--os-text)]"
            >
              Fit Observations
            </button>
          </div>
        </>
      )}

      {/* ══ DISPLAY SECTION ══ */}
      {section === 'display' && (
        <>
          {/* ── COLOR SCALE ── */}
          <div className="section-label">Color scale</div>
          <div className="px-2 pb-1.5 space-y-1.5">
            <select
              value={colorScale.paletteId}
              onChange={(e) => setColorScale({ paletteId: e.target.value })}
              className="w-full rounded-sm border border-[var(--os-border)] bg-[var(--os-bg)] px-2 py-1 text-[11px] text-[var(--os-text)] outline-none focus:border-[var(--os-accent)]"
              title="Color palette — changes the rendered value→color mapping"
            >
              {COLOR_PALETTES.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>

            <label className="flex items-center gap-2 text-[11px] text-[var(--os-text-2)] cursor-pointer">
              <input
                type="checkbox"
                checked={colorScale.auto}
                onChange={(e) => setColorScale({ auto: e.target.checked })}
              />
              Auto range from data
            </label>

            {!colorScale.auto && (
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={colorScale.min}
                    step="0.1"
                    onChange={(e) => setColorScale({ min: Number(e.target.value) })}
                    className="w-full rounded-sm border px-1.5 py-1 text-[11px] mono outline-none"
                    style={{
                      borderColor: manualRangeError ? 'var(--os-diff-neg)' : 'var(--os-border)',
                      background: 'var(--os-bg)',
                      color: 'var(--os-text)',
                    }}
                    title="Manual scale minimum"
                  />
                  <span className="text-[9px] text-[var(--os-text-muted)]">to</span>
                  <input
                    type="number"
                    value={colorScale.max}
                    step="0.1"
                    onChange={(e) => setColorScale({ max: Number(e.target.value) })}
                    className="w-full rounded-sm border px-1.5 py-1 text-[11px] mono outline-none"
                    style={{
                      borderColor: manualRangeError ? 'var(--os-diff-neg)' : 'var(--os-border)',
                      background: 'var(--os-bg)',
                      color: 'var(--os-text)',
                    }}
                    title="Manual scale maximum"
                  />
                </div>
                {manualRangeError && (
                  <p className="text-[9px]" style={{ color: 'var(--os-diff-neg)' }}>
                    {manualRangeError}
                  </p>
                )}
              </div>
            )}

            <div>
              <label
                className="flex items-center gap-2 text-[11px] text-[var(--os-text-2)] cursor-pointer"
                title="Maps positive values by order of magnitude. Requires positive data — signed fields keep linear scale."
              >
                <input
                  type="checkbox"
                  checked={colorScale.logarithmic}
                  onChange={(e) => setColorScale({ logarithmic: e.target.checked })}
                />
                Logarithmic scale
              </label>
              <p className="mt-0.5 text-[9px] leading-relaxed text-[var(--os-text-muted)]">
                Maps positive values by order of magnitude. Requires positive data —
                the difference field (GLORYS − Argo) stays linear.
              </p>
            </div>
          </div>
          <div className="section-sep" />

          {/* ── VERTICAL EXAGGERATION ── */}
          <div className="section-label">3D vertical exaggeration</div>
          <div className="px-2 pb-1.5">
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={1}
                max={5}
                step={0.5}
                value={verticalExaggeration}
                onChange={(e) => setVerticalExaggeration(Number(e.target.value))}
                className="flex-1"
              />
              <span className="mono text-[11px] w-8 text-right" style={{ color: 'var(--os-text-2)' }}>
                {verticalExaggeration.toFixed(1)}×
              </span>
            </div>
            <p className="mt-1 text-[9px] text-[var(--os-text-muted)]">
              Stretches the water column vertically — values unchanged
            </p>
          </div>
        </>
      )}

      {/* ══ LAYERS SECTION ══ */}
      {section === 'layers' && (
        <>
          <div className="section-label">Layers</div>
          <div className="px-2 pb-2 space-y-2">
            {activeLayers.map((layer) => (
              <div key={layer.id} className={layer.available === false ? 'opacity-45' : ''}>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={layer.enabled}
                    disabled={layer.available === false}
                    onChange={() => toggleLayer(layer.id)}
                    title={layer.available === false ? 'Dataset not connected' : 'Toggle layer visibility'}
                  />
                  <span
                    className={`flex-1 text-[12px] ${layer.available === false ? 'text-[var(--os-text-3)]' : 'text-[var(--os-text-2)]'}`}
                    title={layer.available === false ? 'Requires a real dataset that is not currently connected.' : undefined}
                  >
                    {layer.label}
                  </span>
                  {layer.available === false && (
                    <span className="text-[8px] uppercase tracking-wider text-[var(--os-text-muted)]">off</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 ml-5">
                  <span className="text-[9px] text-[var(--os-text-muted)]">opacity</span>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={layer.opacity}
                    disabled={layer.available === false || !layer.enabled}
                    onChange={(e) => setLayerOpacity(layer.id, Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="mono text-[9px] w-6 text-right" style={{ color: 'var(--os-text-3)' }}>
                    {Math.round(layer.opacity * 100)}%
                  </span>
                </div>
              </div>
            ))}
            <p className="text-[9px] text-[var(--os-text-muted)] leading-relaxed pt-1">
              Bathymetry and currents require real datasets (e.g. GEBCO, GLORYS U/V) that are
              not connected in this prototype. They are never simulated.
            </p>
          </div>
        </>
      )}

      <div className="section-sep" />

      {/* ── DATA PROVENANCE ── */}
      <div className="section-label">Data Provenance</div>
      <div className="px-2 pb-2">
        <ProvenanceRow label="Model" value="GLORYS12V1" />
        <ProvenanceRow label="Observation" value="Argo DM" />
        <ProvenanceRow label="Region" value="Bay of Bengal" />
        <ProvenanceRow label="Spatial" value="0.25° grid" />
        <ProvenanceRow label="Temporal" value="Daily nearest" />
        <ProvenanceRow label="Difference" value="GLORYS − Argo" />
        <ProvenanceRow label="Depth" value="0–500 m" />
      </div>

      {/* ── ACTIVE ── */}
      {selectedObservationId && (
        <>
          <div className="section-sep" />
          <div className="section-label">Active</div>
          <div className="px-2 pb-2">
            <div className="mono text-[11px] text-[var(--os-argo)] font-medium">
              {selectedObservationId.replace('argo_', '').replace('_', ' / ')}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}

function ProvenanceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[11px] py-0.5">
      <span className="text-[var(--os-text-muted)]">{label}</span>
      <span className="text-[var(--os-text-2)] mono">{value}</span>
    </div>
  );
}

/**
 * SidebarDepthInput — numeric input + range slider for depth.
 * Supports: typing, Ctrl+A, backspace, delete, Enter, spinner arrows, slider.
 * Valid range: 0–500 m.
 */
function SidebarDepthInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  const [isFocused, setIsFocused] = useState(false);

  // Sync external value changes into text when not focused
  useEffect(() => {
    if (!isFocused) setText(String(value));
  }, [value, isFocused]);

  const commitValue = () => {
    const num = parseFloat(text);
    if (isNaN(num)) {
      setText(String(value));
    } else {
      const clamped = Math.max(0, Math.min(500, Math.round(num)));
      setText(String(clamped));
      if (clamped !== value) onChange(clamped);
    }
    setIsFocused(false);
  };

  return (
    <>
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className="flex items-center flex-1 rounded border" style={{ borderColor: 'var(--os-border)', background: 'var(--os-bg)' }}>
          <input
            type="number"
            min={0}
            max={500}
            step={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={commitValue}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitValue();
              }
            }}
            className="mono text-[13px] font-medium w-full text-center bg-transparent outline-none"
            style={{ color: 'var(--os-text)' }}
          />
        </div>
        <span className="text-[12px] font-medium" style={{ color: 'var(--os-text-3)' }}>m</span>
      </div>
      <input
        type="range"
        min={0}
        max={500}
        step={1}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          setText(String(v));
          onChange(v);
        }}
        className="w-full"
      />
      <div className="flex justify-between text-[9px] mt-0.5" style={{ color: 'var(--os-text-muted)' }}>
        <span>0</span>
        <span>500</span>
      </div>
    </>
  );
}
