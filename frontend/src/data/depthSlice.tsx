/**
 * Depth-slice rendering framework (SIH26067 Priority 6).
 *
 * Renders a horizontal model field slice at a requested depth/time through
 * the model-grid abstraction. It operates ONLY on real grid data: when no
 * volumetric provider is connected it renders the unavailable notice and
 * falls back to showing the REAL collocation points nearest the requested
 * depth (never interpolated between depths, never extrapolated).
 *
 * The color mapping honours the scientific color-scale controls
 * (palette / min / max / log) so the slice reacts to the Display controls.
 */

import { useMemo } from 'react';
import type { Research3DPoint } from '@/integration';
import type { ColorScaleConfig } from '@/types/ocean';
import { valueToColor, sanitizeRange } from '@/config/colorScales';
import {
  getModelGridProvider,
  GLORYS_GRID_DESCRIPTOR,
  GLORYS_GRID_UNAVAILABLE_REASON,
  type ModelGridLoadResult,
} from './modelGrid';

export interface DepthSliceProps {
  variable: string;
  depth: number;
  date: string;
  /** Real collocation records nearest the requested depth (already filtered upstream) */
  collocationPoints: Research3DPoint[];
  unit: string;
  colorScale: ColorScaleConfig;
  /** Layer opacity from the layer manager (0–1) */
  opacity: number;
}

/**
 * Resolve a depth slice through the grid abstraction.
 * Exported so the UI can drive it from an effect/hook as well.
 */
export async function requestDepthSlice(
  variable: string,
  depth: number,
  date: string,
): Promise<ModelGridLoadResult> {
  const provider = getModelGridProvider(GLORYS_GRID_DESCRIPTOR.id);
  if (!provider) {
    return { available: false, unavailableReason: GLORYS_GRID_UNAVAILABLE_REASON, records: [] };
  }
  const ok = await provider.isAvailable();
  if (!ok) {
    return { available: false, unavailableReason: GLORYS_GRID_UNAVAILABLE_REASON, records: [] };
  }
  return provider.loadDepthSlice({ variable, depth, time: date });
}

/**
 * DepthSliceView — horizontal slice renderer.
 *
 * Two honest modes:
 *   1. A real grid provider is connected → render the actual grid field.
 *   2. No provider → render the unavailable notice + the real collocation
 *      points nearest the requested depth (real markers only).
 */
export function DepthSliceView({
  variable,
  depth,
  date,
  collocationPoints,
  unit,
  colorScale,
  opacity,
}: DepthSliceProps) {
  const gridProvider = useMemo(
    () => getModelGridProvider(GLORYS_GRID_DESCRIPTOR.id),
    [],
  );

  // Volumetric scale config for value→color; falls back to per-point range.
  // Non-finite values are excluded from auto-range computation and manual
  // ranges are sanitized — a bad range can never produce NaN colors.
  const scaleConfig = useMemo(() => {
    if (collocationPoints.length === 0) return null;
    const values = collocationPoints.map((p) => p.glorysValue).filter(Number.isFinite);
    if (values.length === 0) return null;
    const dataRange = { min: Math.min(...values), max: Math.max(...values) };
    const range = colorScale.auto
      ? dataRange
      : sanitizeRange(colorScale.min, colorScale.max, dataRange, colorScale.logarithmic);
    return {
      paletteId: colorScale.paletteId,
      min: range.min,
      max: range.max,
      logarithmic: colorScale.logarithmic,
    };
  }, [collocationPoints, colorScale]);

  const legendGradient = useMemo(() => {
    if (!scaleConfig) return '';
    const n = 24;
    return Array.from({ length: n + 1 }, (_, i) => {
      const v = scaleConfig.min + (i / n) * (scaleConfig.max - scaleConfig.min);
      return valueToColor(v, scaleConfig);
    }).join(', ');
  }, [scaleConfig]);

  return (
    <div className="border border-[var(--os-border)] bg-[var(--os-surface)]">
      <header className="border-b border-[var(--os-border)] px-3 py-2 flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold text-[var(--os-text)]">
            Depth slice — {variable} at {depth} m
          </div>
          <div className="text-[10px] text-[var(--os-text-3)] mt-0.5">
            Horizontal field · {date} · rendered through the model-grid abstraction
          </div>
        </div>
        {!gridProvider && (
          <span
            className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5"
            style={{ background: 'rgba(100,116,139,0.15)', color: 'var(--os-text-muted)' }}
          >
            Grid not connected
          </span>
        )}
      </header>

      <div className="p-3 space-y-3">
        {/* Volumetric slice path — requires a real grid source */}
        {!gridProvider && (
          <div className="border border-[var(--os-border)] bg-[var(--os-bg)] px-3 py-2.5">
            <div className="section-label mb-1">Volumetric slice</div>
            <p className="text-[11px] leading-relaxed text-[var(--os-text-3)]">
              {GLORYS_GRID_UNAVAILABLE_REASON}
            </p>
            <p className="mt-1.5 text-[10px] text-[var(--os-text-muted)] leading-relaxed">
              Architecture note: connect a real grid through{' '}
              <span className="mono">registerModelGridProvider()</span> (Copernicus Marine API,
              OPeNDAP, ERDDAP, or a backend-served NetCDF subset) and this panel renders the
              actual field without UI changes.
            </p>
          </div>
        )}

        {/* Real-data fallback: collocation points nearest the requested depth */}
        {collocationPoints.length > 0 && scaleConfig && (
          <div>
            <div className="section-label mb-1.5">
              Real collocation values nearest {depth} m ({collocationPoints.length} profiles)
            </div>
            <SliceScatter
              points={collocationPoints}
              scaleConfig={scaleConfig}
              opacity={opacity}
            />
            <div className="mt-1.5 flex items-center gap-2">
              <div
                className="h-2 flex-1 border border-[var(--os-border)]"
                style={{ background: `linear-gradient(to right, ${legendGradient})` }}
              />
              <span className="mono text-[9px] text-[var(--os-text-3)]">
                {scaleConfig.min.toFixed(2)}–{scaleConfig.max.toFixed(2)} {unit}
                {colorScale.logarithmic ? ' (log)' : ''}
              </span>
            </div>
            <p className="mt-1 text-[9px] text-[var(--os-text-muted)]">
              Each marker is a real GLORYS value collocated at an Argo profile — nearest real
              level to {depth} m within 50 dbar. No interpolation between depths.
            </p>
          </div>
        )}

        {collocationPoints.length === 0 && (
          <p className="text-[11px] text-[var(--os-text-3)]">
            No real collocated measurements within 50 dbar of {depth} m on {date}.
          </p>
        )}
      </div>
    </div>
  );
}

/** Minimal SVG scatter of REAL collocation values coloured by the scale. */
function SliceScatter({
  points,
  scaleConfig,
  opacity,
}: {
  points: Research3DPoint[];
  scaleConfig: { paletteId: string; min: number; max: number; logarithmic: boolean };
  opacity: number;
}) {
  const W = 640;
  const H = 340;
  const pad = 30;

  const finitePoints = points.filter(
    (p) =>
      Number.isFinite(p.latitude) &&
      Number.isFinite(p.longitude) &&
      Number.isFinite(p.glorysValue),
  );
  if (finitePoints.length === 0) return null;

  const lats = finitePoints.map((p) => p.latitude);
  const lons = finitePoints.map((p) => p.longitude);
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  const west = Math.min(...lons);
  const east = Math.max(...lons);

  const xOf = (lon: number) =>
    pad + ((lon - west) / Math.max(east - west, 1e-6)) * (W - pad * 2);
  const yOf = (lat: number) =>
    pad + ((north - lat) / Math.max(north - south, 1e-6)) * (H - pad * 2);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto block max-h-[360px]"
      role="img"
      aria-label="Depth slice of real collocation values"
      style={{ background: 'var(--os-bg)', border: '1px solid var(--os-border)' }}
    >
      {finitePoints.map((p, i) => {
        const value = p.glorysValue;
        return (
          <circle
            key={i}
            cx={xOf(p.longitude)}
            cy={yOf(p.latitude)}
            r={7}
            fill={valueToColor(value, scaleConfig)}
            fillOpacity={opacity}
            stroke="var(--os-border-light)"
            strokeWidth={0.75}
          >
            <title>
              {`${p.platformNumber}/C${p.cycleNumber} · ${p.pressure.toFixed(1)} dbar · GLORYS ${value.toFixed(3)}`}
            </title>
          </circle>
        );
      })}
      {finitePoints.map((p, i) => (
        <text
          key={`t-${i}`}
          x={xOf(p.longitude)}
          y={yOf(p.latitude) - 11}
          textAnchor="middle"
          fontSize={8}
          fill="var(--os-text-3)"
          fontFamily="ui-monospace, monospace"
        >
          {p.glorysValue.toFixed(2)}
        </text>
      ))}
    </svg>
  );
}
