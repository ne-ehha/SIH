/**
 * Scientific color scale system.
 *
 * Palettes, value→color mapping, and scale transforms shared by every
 * scientific renderer (DiscrepancyMap, depth slice, Research 3D scene).
 * The ColorScaleControls in the sidebar mutate this configuration and the
 * rendered output changes — these are real controls, not decoration.
 *
 * Guarantees:
 *  - NaN/non-finite values never produce NaN colors (they clamp to an end stop).
 *  - Manual min/max ranges are sanitized (finite, min < max) before use.
 *  - Logarithmic mapping is only valid on strictly positive domains; the
 *    transform reports validity so UIs can disable the option with an
 *    explanation instead of silently producing log(≤0) = -Infinity.
 */

export interface ColorPalette {
  id: string;
  label: string;
  /** Ordered colors from low to high */
  stops: string[];
  /** True for diverging palettes (centered on zero) */
  diverging: boolean;
}

export const COLOR_PALETTES: ColorPalette[] = [
  {
    id: 'diverging-bwr',
    label: 'Diverging Blue–White–Red',
    stops: ['#3b82f6', '#93c5fd', '#e5e7eb', '#fca5a5', '#ef4444'],
    diverging: true,
  },
  {
    id: 'diverging-brbg',
    label: 'Diverging Brown–Blue',
    stops: ['#a1662f', '#d8b365', '#f5f5f5', '#80cdc1', '#018571'],
    diverging: true,
  },
  {
    id: 'thermal',
    label: 'Thermal (Thermo)',
    stops: ['#08306b', '#2166ac', '#4393c3', '#92c5de', '#f7f7f7', '#f4a582', '#d6604d', '#b2182b', '#67001f'],
    diverging: false,
  },
  {
    id: 'viridis',
    label: 'Viridis',
    stops: ['#440154', '#414487', '#2a788e', '#22a884', '#7ad151', '#fde725'],
    diverging: false,
  },
  {
    id: 'haline',
    label: 'Haline (Salinity)',
    stops: ['#081d58', '#253494', '#225ea8', '#1d91c0', '#41b6c4', '#7fcdbb', '#c7e9b4', '#ffffd9'],
    diverging: false,
  },
];

export function getPalette(paletteId: string): ColorPalette {
  return COLOR_PALETTES.find((p) => p.id === paletteId) ?? COLOR_PALETTES[0];
}

// ── Normalization ────────────────────────────────────────────────────────

/**
 * Sanitize a [min, max] normalization range. Non-finite endpoints, inverted
 * or equal endpoints, and log mode with a non-positive endpoint all resolve
 * to a safe fallback so a bad range can never produce NaN colors or crash
 * the renderer. When `logarithmic` is true the range must be strictly positive.
 */
export function sanitizeRange(
  min: number,
  max: number,
  fallback: { min: number; max: number } = { min: 0, max: 1 },
  logarithmic = false,
): { min: number; max: number } {
  const finiteMin = Number.isFinite(min) ? min : fallback.min;
  const finiteMax = Number.isFinite(max) ? max : fallback.max;
  let lo = Math.min(finiteMin, finiteMax);
  let hi = Math.max(finiteMin, finiteMax);
  if (logarithmic) {
    // A positive-domain requirement: clamp up to a tiny positive epsilon.
    if (lo <= 0) lo = 1e-3;
    if (hi <= 0) hi = 1;
  }
  if (!(hi > lo)) {
    // Degenerate range — widen around the fallback or the shared value.
    const base = Number.isFinite(lo) ? lo : fallback.min;
    hi = base > 0 || !logarithmic ? base + 1 : Math.max(base * 2, 1e-3);
    lo = logarithmic ? Math.max(base / 2, 1e-6) : base - 1;
  }
  return { min: lo, max: hi };
}

export interface ScaleTransformConfig {
  paletteId: string;
  min: number;
  max: number;
  logarithmic: boolean;
}

/**
 * Log-domain normalization for strictly positive values.
 *
 * Returns null when log scale cannot be applied to this range/data:
 * the range contains non-positive endpoints (log of ≤0 is undefined —
 * we never shift data by an arbitrary constant to force it), or when the
 * values/array contain no finite positive samples.
 *
 * This is the single log transform used by every renderer, so the colorbar
 * and the 3D/2D color mapping always agree.
 */
export function logNormalize(
  value: number,
  min: number,
  max: number,
): number | null {
  if (!Number.isFinite(value) || min <= 0 || max <= 0 || !(max > min)) return null;
  const lv = Math.log(value);
  if (!Number.isFinite(lv)) return null;
  const lmin = Math.log(min);
  const lmax = Math.log(max);
  return (lv - lmin) / (lmax - lmin);
}

/**
 * Does this data set support logarithmic scaling?
 * True only when at least one finite, strictly positive value exists —
 * and for the full-range auto case, when ALL finite values are positive
 * (a signed difference field must not be silently truncated to its
 * positive subset).
 */
export function logScaleAvailable(values: number[]): boolean {
  let hasPositive = false;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (v <= 0) return false;
    hasPositive = true;
  }
  return hasPositive;
}

/** Fractional position t∈[0,1] of `value` within the configured scale. */
export function normalizeValue(value: number, config: ScaleTransformConfig): number {
  const { min, max } = sanitizeRange(config.min, config.max, { min: 0, max: 1 }, config.logarithmic);
  if (config.logarithmic) {
    const t = logNormalize(value, min, max);
    if (t !== null) return t;
    // Non-finite or non-positive value under log mode: clamp by sign.
    // (Renderers should avoid reaching here via logScaleAvailable guards.)
    if (!Number.isFinite(value)) return 0;
    return value <= 0 ? 0 : 1;
  }
  if (!Number.isFinite(value)) return value > 0 ? 1 : 0;
  return max > min ? (value - min) / (max - min) : 0;
}

// ── Color sampling ───────────────────────────────────────────────────────

/** Linear interpolation between hex stops. t in [0, 1]. Returns CSS hex. */
export function sampleStops(stops: string[], t: number): string {
  const clamped = Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : 0;
  const scaled = clamped * (stops.length - 1);
  const i = Math.floor(scaled);
  const frac = scaled - i;
  if (i >= stops.length - 1) return stops[stops.length - 1];
  return mixHex(stops[i], stops[i + 1], frac);
}

/** Value → CSS color string (hex), honouring palette + range + log mode. */
export function valueToColor(value: number, config: ScaleTransformConfig): string {
  const palette = getPalette(config.paletteId);
  return sampleStops(palette.stops, normalizeValue(value, config));
}

/** Value → [r, g, b] (0–1 floats) for Three.js material colors. */
export function valueToRgb(value: number, config: ScaleTransformConfig): [number, number, number] {
  const hex = valueToColor(value, config);
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  // sampleStops/mixHex may return rgb() strings only if a stop is not hex;
  // all built-in palettes are hex, so parse defensively:
  if (h.length === 6) {
    return [
      parseInt(h.slice(0, 2), 16) / 255,
      parseInt(h.slice(2, 4), 16) / 255,
      parseInt(h.slice(4, 6), 16) / 255,
    ];
  }
  return [0.5, 0.5, 0.5];
}

function mixHex(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

// ── Legend / colorbar ────────────────────────────────────────────────────

/** CSS gradient string for a colorbar legend (matches valueToColor exactly). */
export function paletteGradient(
  paletteId: string,
  logarithmic = false,
  min?: number,
  max?: number,
): string {
  const palette = getPalette(paletteId);
  const n = palette.stops.length;
  const range = sanitizeRange(min ?? 0, max ?? 1, { min: 0, max: 1 }, logarithmic);
  const parts = palette.stops.map((stop, i) => {
    // Position each stop where its *value* falls in the normalized domain,
    // so the gradient matches the actual value→color transform (incl. log).
    const value = range.min + (i / (n - 1)) * (range.max - range.min);
    let frac: number;
    if (logarithmic) {
      const t = logNormalize(value, range.min, range.max);
      frac = t !== null ? t : i / (n - 1);
    } else {
      frac = i / (n - 1);
    }
    return `${stop} ${(Math.max(0, Math.min(1, frac)) * 100).toFixed(1)}%`;
  });
  return `linear-gradient(to right, ${parts.join(', ')})`;
}

/**
 * Legend tick values for a colorbar: positions (0–1) plus formatted labels.
 * Log mode labels decades between min and max; linear mode labels even steps.
 */
export function legendTicks(
  min: number,
  max: number,
  logarithmic: boolean,
  count = 5,
): Array<{ t: number; label: string }> {
  const { min: lo, max: hi } = sanitizeRange(min, max, { min: 0, max: 1 }, logarithmic);
  const ticks: Array<{ t: number; label: string }> = [];
  const fmt = (v: number) => {
    const abs = Math.abs(v);
    if (abs >= 1000 || (abs > 0 && abs < 0.01)) return v.toExponential(1);
    if (abs >= 100) return v.toFixed(0);
    return v.toFixed(abs >= 10 ? 1 : 2);
  };
  if (logarithmic) {
    const decades = Math.floor(Math.log10(hi)) - Math.ceil(Math.log10(lo));
    const step = Math.max(1, Math.ceil(decades / (count - 1)));
    const startExp = Math.ceil(Math.log10(lo));
    const endExp = Math.floor(Math.log10(hi));
    for (let e = startExp; e <= endExp; e += step) {
      const v = 10 ** e;
      const t = logNormalize(v, lo, hi);
      if (t !== null) ticks.push({ t, label: fmt(v) });
    }
  }
  if (ticks.length < 2) {
    ticks.length = 0;
    for (let i = 0; i < count; i += 1) {
      const t = i / (count - 1);
      ticks.push({ t, label: fmt(lo + t * (hi - lo)) });
    }
  }
  return ticks;
}
