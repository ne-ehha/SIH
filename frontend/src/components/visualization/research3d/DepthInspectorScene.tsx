/**
 * DepthInspectorScene — R3F 3D Canvas for the Research depth inspector.
 *
 * Phase 6C: Convincing translucent ocean cutaway with:
 *   - INVERTED PYRAMID frame (wide at surface, narrow at depth)
 *   - Translucent depth reference layers following pyramid taper
 *   - Interactive selected depth slice (controlled by slider)
 *   - Nearest real measurement detection and highlighting
 *   - Real Argo profile (thick tube + measurement points)
 *   - Real GLORYS profile (thick tube + measurement points)
 *   - Restrained difference indicators
 *   - Depth reference scale (0–500m labels)
 *   - Selected observation anchor
 *   - Clean single-record hover tooltip
 *   - Selected-depth info panel
 *   - Ocean surface with animated waves
 *   - Underwater light shafts with depth fading
 *   - Sparse floating particles
 *
 * Coordinate system (local):
 *   X = horizontal (profile separation axis)
 *       Argo at X = -ARGO_X_OFFSET
 *       GLORYS at X = +GLORYS_X_OFFSET
 *   Y = depth axis (surface at Y=0, depth increases downward)
 *       yPosition = -(pressure / MAX_DEPTH_REF) * SCENE_DEPTH
 *   Z = depth-space axis (Z=0, flat cross-section plane)
 *
 * Depth transform:
 *   MAX_DEPTH_REF = 500 dbar (reference scale, not data limit)
 *   SCENE_DEPTH = 5.0 scene units
 *   yPosition(p) = -(p / 500) * 5.0
 *
 * Inverted pyramid:
 *   Surface (Y=0): WIDEST cross-section (the base)
 *   Depth (Y=-5):  NARROWEST point (the apex)
 *   width(y) = MAX_HALF_WIDTH * (1 - |y|/SCENE_DEPTH)
 *
 * The inverted pyramid is a VISUAL INSPECTION FRAME only.
 * It is NOT bathymetry or ocean floor data.
 */

import { useState, useMemo, useRef, useEffect, Component, type MutableRefObject, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { Research3DPoint } from '@/integration';
import { findNearestResearchMeasurement } from '@/integration/researchSelection';
import type { ColorScaleConfig } from '@/types/ocean';
import {
  valueToRgb,
  valueToColor,
  sanitizeRange,
  logScaleAvailable,
  legendTicks,
  paletteGradient,
  type ScaleTransformConfig,
} from '@/config/colorScales';

// ── Constants ────────────────────────────────────────────────────────────────

/** Maximum reference depth for the scene (dbar). Labels go to 500m. */
const MAX_DEPTH_REF = 500;

/** Scene height in world units for MAX_DEPTH_REF dbar at 1× vertical exaggeration */
const SCENE_DEPTH = 5.0;

/** X offset of Argo profile from center */
const ARGO_X_OFFSET = 0.78;

/** X offset of GLORYS profile from center */
const GLORYS_X_OFFSET = 0.78;

/** Maximum half-width of the inverted pyramid at the SURFACE (the base) */
const PYRAMID_SURFACE_HALF_WIDTH = 2.35;

/** Maximum half-depth of the inverted pyramid at the SURFACE in Z */
const PYRAMID_SURFACE_HALF_Z = 1.2;

/** Scale factor for difference indicator width (per unit difference) */
const DIFF_SCALE = 0.3;

// ── Scientific field coloring (SIH26067: real color-scale controls) ─────────

/** Which field the 3D colors encode: the measured variables or the signed difference. */
export type FieldRenderMode = 'variables' | 'difference';

/**
 * Effective normalization range for a rendered field, computed from the REAL
 * profile values. Used by BOTH the 3D scene and the synchronized colorbar so
 * the legend always matches the renderer exactly.
 *
 * - variables mode: min/max of all Argo + GLORYS values in the profile.
 * - difference mode: symmetric ±max|GLORYS − Argo| (diverging convention).
 * - manual (auto = false) ranges extend the data range but never invert it.
 */
export function computeFieldRange(
  profilePoints: Research3DPoint[],
  mode: FieldRenderMode,
  colorScale?: Pick<ColorScaleConfig, 'auto' | 'min' | 'max'>,
): { min: number; max: number } {
  if (profilePoints.length === 0) return { min: 0, max: 1 };
  let lo: number;
  let hi: number;
  if (mode === 'difference') {
    const maxAbs = Math.max(...profilePoints.map((p) => Math.abs(p.difference)));
    lo = -maxAbs;
    hi = maxAbs;
  } else {
    const values = profilePoints.flatMap((p) => [p.argoValue, p.glorysValue]).filter(Number.isFinite);
    if (values.length === 0) return { min: 0, max: 1 };
    lo = Math.min(...values);
    hi = Math.max(...values);
  }
  if (colorScale && !colorScale.auto) {
    // Manual range participates, but a degenerate manual range must not
    // collapse the scale (sanitizeRange enforces min < max).
    const manual = sanitizeRange(colorScale.min, colorScale.max, { min: lo, max: hi });
    lo = Math.min(lo, manual.min);
    hi = Math.max(hi, manual.max);
  }
  return lo < hi ? { min: lo, max: hi } : { min: lo, max: lo + 1 };
}

/**
 * Resolve the exact ScaleTransformConfig the 3D renderer uses.
 * Returns null when the scene should fall back to identity source colors
 * (no color-scale configuration provided).
 *
 * Log mode is only applied when the field actually supports it (strictly
 * positive finite values); otherwise the renderer silently falls back to
 * linear and the UI explains why (see Sidebar / workspace colorbar note).
 */
export function sceneScaleConfig(
  profilePoints: Research3DPoint[],
  colorScale: ColorScaleConfig | undefined,
  mode: FieldRenderMode,
): { config: ScaleTransformConfig; range: { min: number; max: number }; logApplied: boolean } | null {
  if (!colorScale) return null;
  const range = computeFieldRange(profilePoints, mode, colorScale);
  let logarithmic = colorScale.logarithmic;
  if (logarithmic) {
    const values =
      mode === 'difference'
        ? profilePoints.map((p) => p.difference)
        : profilePoints.flatMap((p) => [p.argoValue, p.glorysValue]);
    // Signed difference fields (containing ≤ 0) cannot be log-mapped —
    // we never shift data by an arbitrary constant to force log to work.
    logarithmic = logScaleAvailable(values);
  }
  return {
    config: {
      paletteId: colorScale.paletteId,
      min: range.min,
      max: range.max,
      logarithmic,
    },
    range,
    logApplied: logarithmic,
  };
}

/**
 * Layer visibility/opacity state for the 3D scene, resolved from the
 * canonical layer manager. Every entry is a real rendering control.
 */
export interface SceneLayers {
  argo: { visible: boolean; opacity: number };
  glorys: { visible: boolean; opacity: number };
  discrepancies: { visible: boolean; opacity: number };
  depthSlice: { visible: boolean; opacity: number };
}

export const DEFAULT_SCENE_LAYERS: SceneLayers = {
  argo: { visible: true, opacity: 1 },
  glorys: { visible: true, opacity: 1 },
  discrepancies: { visible: true, opacity: 1 },
  depthSlice: { visible: true, opacity: 1 },
};

/**
 * React error boundary INSIDE the R3F Canvas: a runtime exception in the
 * 3D subtree (geometry, material, raycasting) must degrade to an inline
 * message — it must never unmount the whole application (blank screen).
 */
class SceneErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Surface the real cause in the console — root causes stay visible.
    console.error('[DepthInspectorScene] 3D scene error:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <Html center style={{ pointerEvents: 'none' }}>
          <div
            style={{
              background: 'rgba(10, 14, 26, 0.92)',
              border: '1px solid rgba(239, 68, 68, 0.45)',
              borderRadius: '6px',
              padding: '10px 14px',
              color: '#fca5a5',
              fontSize: '11px',
              maxWidth: '280px',
              textAlign: 'center',
            }}
          >
            3D scene could not render this profile.
            <div style={{ fontSize: '9px', marginTop: '4px', color: '#94a3b8' }}>
              The rest of the application is unaffected — adjust depth or select another profile.
            </div>
          </div>
        </Html>
      );
    }
    return this.props.children;
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

interface DepthInspectorSceneProps {
  className?: string;
  profilePoints: Research3DPoint[];
  unit: string;
  variable: string;
  /** Selected depth from the slider (0–500 dbar) */
  selectedDepth: number;
  /** Vertical exaggeration factor (1–5). Stretches the depth axis. */
  verticalExaggeration?: number;
  /** Canonical color-scale config — palette/range/log drive real 3D colors. */
  colorScale?: ColorScaleConfig;
  /** Field the colors encode: measured variables or the signed difference. */
  renderMode?: FieldRenderMode;
  /** Layer manager wiring — visibility/opacity are real rendering controls. */
  layers?: SceneLayers;
  /** Set false to suppress the synchronized colorbar (used by compact hosts). */
  showColorbar?: boolean;
  viewControlsRef?: MutableRefObject<InspectorViewControls | null>;
}

export interface InspectorViewControls {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
}

/** A record with computed Y position */
interface PositionedRecord {
  point: Research3DPoint;
  y: number;
  argoX: number;
  glorysX: number;
}

interface InspectorInitialView {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

// ── Coordinate helpers ───────────────────────────────────────────────────────

/** Convert pressure (dbar) to Y scene coordinate (depth increases downward).
 *  verticalExaggeration stretches the water column vertically (SIH26067 control).
 *  It rescales the depth axis only — it never rescales or distorts data values. */
function pressureToY(pressure: number, verticalExaggeration = 1): number {
  return -(pressure / MAX_DEPTH_REF) * SCENE_DEPTH * verticalExaggeration;
}

/**
 * INVERTED pyramid half-width at a given Y position for a given exaggeration.
 * Wide at surface (Y=0), narrow at depth (Y=-SCENE_DEPTH × exaggeration).
 */
function invertedPyramidHalfWidth(y: number, verticalExaggeration = 1): number {
  const t = Math.min(Math.abs(y) / (SCENE_DEPTH * verticalExaggeration), 1);
  return PYRAMID_SURFACE_HALF_WIDTH * (1 - t);
}

/** INVERTED pyramid half-depth in Z at a given Y position. */
function invertedPyramidHalfZ(y: number, verticalExaggeration = 1): number {
  const t = Math.min(Math.abs(y) / (SCENE_DEPTH * verticalExaggeration), 1);
  return PYRAMID_SURFACE_HALF_Z * (1 - t);
}

/** Rectangle outline for a horizontal pyramid cross-section. */
function createLayerOutline(y: number, halfWidth: number, halfZ: number): THREE.BufferGeometry {
  return new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-halfWidth, y, -halfZ),
    new THREE.Vector3(halfWidth, y, -halfZ),
    new THREE.Vector3(halfWidth, y, halfZ),
    new THREE.Vector3(-halfWidth, y, halfZ),
    new THREE.Vector3(-halfWidth, y, -halfZ),
  ]);
}

/** Filled rectangle shape for a horizontal pyramid cross-section. */
function createLayerShape(halfWidth: number, halfZ: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth, -halfZ);
  shape.lineTo(halfWidth, -halfZ);
  shape.lineTo(halfWidth, halfZ);
  shape.lineTo(-halfWidth, halfZ);
  shape.closePath();
  return shape;
}

/** Unit square shape centered at origin — reused via mesh scale (churn-free slice geometry). */
function createUnitSquareShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, -0.5);
  shape.lineTo(0.5, -0.5);
  shape.lineTo(0.5, 0.5);
  shape.lineTo(-0.5, 0.5);
  shape.closePath();
  return shape;
}

/** Unit square outline as a line geometry (4 corners, closed loop). */
function createUnitSquareOutline(): THREE.BufferGeometry {
  return new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.5, -0.5, 0),
    new THREE.Vector3(0.5, -0.5, 0),
    new THREE.Vector3(0.5, 0.5, 0),
    new THREE.Vector3(-0.5, 0.5, 0),
    new THREE.Vector3(-0.5, -0.5, 0),
  ]);
}

/** Transparent four-sided water volume using the existing inverted-pyramid taper. */
function createWaterVolumeGeometry(verticalExaggeration = 1): THREE.BufferGeometry {
  const segments = 16;
  const positions: number[] = [];
  const colors: number[] = [];

  const addVertex = (x: number, y: number, z: number, depthFraction: number) => {
    positions.push(x, y, z);
    const lateralVariation = Math.sin(x * 1.7 + z * 3.2) * 0.018;
    const surfaceBoost = (1 - depthFraction) * 0.08;
    const depthDarken = depthFraction * depthFraction * 0.12;
    colors.push(
      0.02 + depthFraction * 0.01 + surfaceBoost * 0.3,
      0.44 - depthDarken + lateralVariation + surfaceBoost,
      0.74 - depthDarken * 0.8 + lateralVariation + surfaceBoost * 0.5,
    );
  };

  const sceneDepth = SCENE_DEPTH * verticalExaggeration;

  for (let segment = 0; segment < segments; segment += 1) {
    const start = segment / segments;
    const end = (segment + 1) / segments;
    const startY = -sceneDepth * start;
    const endY = -sceneDepth * end;
    const startWidth = PYRAMID_SURFACE_HALF_WIDTH * (1 - start);
    const startZ = PYRAMID_SURFACE_HALF_Z * (1 - start);
    const endWidth = PYRAMID_SURFACE_HALF_WIDTH * (1 - end);
    const endZ = PYRAMID_SURFACE_HALF_Z * (1 - end);
    const startRing = [
      [-startWidth, startY, -startZ], [startWidth, startY, -startZ],
      [startWidth, startY, startZ], [-startWidth, startY, startZ],
    ];
    const endRing = [
      [-endWidth, endY, -endZ], [endWidth, endY, -endZ],
      [endWidth, endY, endZ], [-endWidth, endY, endZ],
    ];

    for (let side = 0; side < 4; side += 1) {
      const next = (side + 1) % 4;
      const a = startRing[side];
      const b = startRing[next];
      const c = endRing[next];
      const d = endRing[side];
      addVertex(a[0], a[1], a[2], start);
      addVertex(b[0], b[1], b[2], start);
      addVertex(c[0], c[1], c[2], end);
      addVertex(a[0], a[1], a[2], start);
      addVertex(c[0], c[1], c[2], end);
      addVertex(d[0], d[1], d[2], end);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Lightweight gridded surface for low-amplitude procedural wave motion. */
function createWaveSurfaceGeometry(): THREE.BufferGeometry {
  const xSegments = 36;
  const zSegments = 18;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let zIndex = 0; zIndex <= zSegments; zIndex += 1) {
    for (let xIndex = 0; xIndex <= xSegments; xIndex += 1) {
      const x = -PYRAMID_SURFACE_HALF_WIDTH + (xIndex / xSegments) * PYRAMID_SURFACE_HALF_WIDTH * 2;
      const z = -PYRAMID_SURFACE_HALF_Z + (zIndex / zSegments) * PYRAMID_SURFACE_HALF_Z * 2;
      const variation = (Math.sin(x * 2.3 + z * 1.7) + 1) * 0.04;
      positions.push(x, 0.025, z);
      colors.push(0.018 + variation * 0.8, 0.36 + variation * 2.0, 0.58 + variation * 2.5);
    }
  }

  for (let zIndex = 0; zIndex < zSegments; zIndex += 1) {
    for (let xIndex = 0; xIndex < xSegments; xIndex += 1) {
      const a = zIndex * (xSegments + 1) + xIndex;
      const b = a + 1;
      const c = a + xSegments + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Deterministic visual-only particles, placed within the reverse-pyramid volume. */
function createParticleGeometry(): THREE.BufferGeometry {
  const count = 200;
  const positions: number[] = [];
  const colors: number[] = [];
  const fract = (value: number) => value - Math.floor(value);

  for (let index = 0; index < count; index += 1) {
    const seed = index + 1;
    const rawDepth = fract(Math.sin(seed * 12.9898) * 43758.5453);
    // Bias toward mid-water: squeeze extremes, peak density around 0.3–0.6
    const depthFraction = 0.04 + (0.5 + 0.5 * Math.sin((rawDepth - 0.5) * Math.PI)) * 0.84;
    const halfWidth = PYRAMID_SURFACE_HALF_WIDTH * (1 - depthFraction) * 0.82;
    const halfZ = PYRAMID_SURFACE_HALF_Z * (1 - depthFraction) * 0.82;
    const x = (fract(Math.sin(seed * 78.233) * 19341.918) * 2 - 1) * halfWidth;
    const z = (fract(Math.sin(seed * 39.425) * 9283.147) * 2 - 1) * halfZ;
    const brightness = 0.72 - depthFraction * 0.48;
    const warmth = (1 - depthFraction) * 0.08;
    positions.push(x, -SCENE_DEPTH * depthFraction, z);
    colors.push(0.14 * brightness + warmth, 0.74 * brightness + warmth * 0.3, 0.96 * brightness);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

// ── Color helpers ────────────────────────────────────────────────────────────

/** Argo observation: bright cyan/blue (identity color when no color scale is active) */
const ARGO_COLOR = '#22d3ee';
/** GLORYS model: vivid purple/violet (identity color when no color scale is active) */
const GLORYS_COLOR = '#a855f7';
const DIFF_POS_COLOR = '#f59e0b';
const DIFF_NEG_COLOR = '#3b82f6';
const SELECTED_SLICE_COLOR = '#22d3ee';

// ── Sub-components ───────────────────────────────────────────────────────────

/**
 * Semi-transparent inspected water volume. It is deliberately a 0-500 m
 * cutaway volume, not bathymetry or a synthetic ocean data layer.
 */
function WaterVolume({ verticalExaggeration = 1 }: { verticalExaggeration?: number }) {
  const geometry = useMemo(() => createWaterVolumeGeometry(verticalExaggeration), [verticalExaggeration]);

  return (
    <mesh geometry={geometry} renderOrder={0}>
      <meshPhysicalMaterial
        vertexColors
        transparent
        opacity={0.23}
        side={THREE.DoubleSide}
        roughness={0.32}
        metalness={0}
        clearcoat={0.42}
        clearcoatRoughness={0.15}
        depthWrite={false}
      />
    </mesh>
  );
}

/** Subtle multi-scale surface motion; it remains bounded to the 0 m water patch. */
function WaveSurface() {
  const geometry = useMemo(() => createWaveSurfaceGeometry(), []);

  useFrame(({ clock }) => {
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
    const time = clock.getElapsedTime();
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const z = positions.getZ(index);
      const wave = Math.sin(x * 2.4 + time * 0.55) * 0.022
        + Math.sin(z * 4.1 - time * 0.38) * 0.013
        + Math.sin((x + z) * 6.5 + time * 0.25) * 0.006;
      positions.setY(index, 0.028 + wave);
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
  });

  return (
    <mesh geometry={geometry} renderOrder={2}>
      <meshStandardMaterial
        vertexColors
        color="#38bdf8"
        emissive="#075985"
        emissiveIntensity={0.8}
        roughness={0.12}
        metalness={0.3}
        transparent
        opacity={0.42}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/** Underwater light shafts: merged ring geometry fading from surface to depth. */
function UnderwaterLightBeams() {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    let vertexOffset = 0;

    const addRing = (
      cx: number, cz: number, topY: number, topR: number,
      botY: number, botR: number, topColor: [number, number, number],
      botColor: [number, number, number],
    ) => {
      const segs = 8;
      const base = vertexOffset;
      for (let i = 0; i <= segs; i++) {
        const angle = (i / segs) * Math.PI * 2;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        positions.push(cx + cosA * topR, topY, cz + sinA * topR);
        colors.push(...topColor);
        positions.push(cx + cosA * botR, botY, cz + sinA * botR);
        colors.push(...botColor);
      }
      for (let i = 0; i < segs; i++) {
        const a = base + i * 2;
        const b = a + 1;
        const c = a + 2;
        const d = a + 3;
        indices.push(a, c, b, b, c, d);
      }
      vertexOffset += (segs + 1) * 2;
    };

    // 5 light shafts with slight position/size variation
    const shafts: Array<{ cx: number; cz: number; topR: number; botR: number; topY: number; botY: number }> = [
      { cx: -0.35, cz: 0.22, topR: 0.38, botR: 0.08, topY: 0.01, botY: -3.8 },
      { cx: 0.15, cz: -0.15, topR: 0.32, botR: 0.06, topY: 0.01, botY: -3.2 },
      { cx: 0.55, cz: 0.18, topR: 0.28, botR: 0.05, topY: 0.01, botY: -2.9 },
      { cx: -0.6, cz: -0.08, topR: 0.25, botR: 0.04, topY: 0.01, botY: -2.6 },
      { cx: 0.7, cz: -0.22, topR: 0.22, botR: 0.03, topY: 0.01, botY: -2.2 },
    ];

    for (const s of shafts) {
      addRing(s.cx, s.cz, s.topY, s.topR, s.botY, s.botR,
        [0.45, 0.92, 0.98], [0.12, 0.35, 0.52]);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} renderOrder={1}>
      <meshBasicMaterial
        vertexColors
        transparent
        opacity={0.12}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/** Sparse visual particles communicate suspended matter without representing measurements. */
function UnderwaterParticles() {
  const geometry = useMemo(() => createParticleGeometry(), []);
  const pointsRef = useRef<THREE.Points>(null);
  const initialY = useMemo(() => {
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) arr[i] = pos.getY(i);
    return arr;
  }, [geometry]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const time = clock.getElapsedTime();
    const positions = pointsRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < positions.count; i++) {
      const baseY = initialY[i];
      const drift = Math.sin(time * 0.12 + i * 0.47) * 0.018;
      positions.setY(i, baseY + drift);
    }
    positions.needsUpdate = true;
    pointsRef.current.rotation.y = Math.sin(time * 0.08) * 0.025;
  });

  return (
    <points ref={pointsRef} geometry={geometry} renderOrder={3}>
      <pointsMaterial
        vertexColors
        transparent
        opacity={0.44}
        size={0.022}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/** Inverted pyramid frame with a strong surface rim and four visible sloping edges. */
function InvertedPyramidFrame({ verticalExaggeration = 1 }: { verticalExaggeration?: number }) {
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const sw = PYRAMID_SURFACE_HALF_WIDTH;
    const sz = PYRAMID_SURFACE_HALF_Z;
    const surfaceCorners = [
      new THREE.Vector3(-sw, 0, -sz),
      new THREE.Vector3(sw, 0, -sz),
      new THREE.Vector3(sw, 0, sz),
      new THREE.Vector3(-sw, 0, sz),
    ];
    const apex = new THREE.Vector3(0, -SCENE_DEPTH * verticalExaggeration, 0);
    for (const corner of surfaceCorners) {
      points.push(corner.clone(), apex.clone());
    }
    for (let i = 0; i < 4; i++) {
      points.push(surfaceCorners[i].clone(), surfaceCorners[(i + 1) % 4].clone());
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [verticalExaggeration]);

  return (
    <group>
      {/* Primary high-contrast frame: surface rim plus the four edges converging at 500 m. */}
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color="#7dd3fc" transparent opacity={0.65} />
      </lineSegments>
    </group>
  );
}

/** Broad translucent 0 m plane: a visual water-surface reference, not bathymetry. */
function SurfacePlane() {
  const shape = useMemo(
    () => createLayerShape(PYRAMID_SURFACE_HALF_WIDTH, PYRAMID_SURFACE_HALF_Z),
    [],
  );
  const outline = useMemo(
    () => createLayerOutline(0, PYRAMID_SURFACE_HALF_WIDTH, PYRAMID_SURFACE_HALF_Z),
    [],
  );
  const outlineLine = useMemo(
    () => new THREE.Line(outline, new THREE.LineBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.95 })),
    [outline],
  );
  const surfaceContours = useMemo(() => {
    const contourZ = [-0.72, -0.36, 0, 0.36, 0.72];
    return contourZ.map((baseZ, index) => {
      const points: THREE.Vector3[] = [];
      for (let step = 0; step <= 28; step += 1) {
        const x = -PYRAMID_SURFACE_HALF_WIDTH + (step / 28) * PYRAMID_SURFACE_HALF_WIDTH * 2;
        const z = baseZ + Math.sin(x * 3.1 + index * 0.8) * 0.045;
        points.push(new THREE.Vector3(x, 0.018, z));
      }
      return new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: '#7dd3fc', transparent: true, opacity: 0.16 }),
      );
    });
  }, []);

  return (
    <group>
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial
          color="#0284c7"
          emissive="#075985"
          emissiveIntensity={0.38}
          roughness={0.24}
          metalness={0.05}
          transparent
          opacity={0.28}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {surfaceContours.map((contour, index) => <primitive key={index} object={contour} />)}
      <primitive object={outlineLine} />
      <Html position={[0, 0.08, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ color: '#bae6fd', fontSize: '9px', fontFamily: 'monospace', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
          SURFACE · 0m
        </span>
      </Html>
    </group>
  );
}

/** Translucent depth reference layers following inverted pyramid taper. */
function DepthLayers({ verticalExaggeration = 1 }: { verticalExaggeration?: number }) {
  const layers = useMemo(() => {
    // 100m increments, excluding 0m (surface is the pyramid base) and 500m (apex).
    // Geometry is declarative (<shapeGeometry>/<lineSegments>) so exaggeration
    // changes rebuild through R3F's normal reconciliation — no leaked objects.
    const depths = [100, 200, 300, 400];
    return depths.map((d) => {
      const y = pressureToY(d, verticalExaggeration);
      const hw = invertedPyramidHalfWidth(y, verticalExaggeration);
      const hz = invertedPyramidHalfZ(y, verticalExaggeration);
      return { depth: d, y, hw, hz };
    });
  }, [verticalExaggeration]);

  return (
    <>
      {layers.map((layer) => (
        <group key={layer.depth}>
          <mesh position={[0, layer.y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <shapeGeometry args={[createLayerShape(layer.hw, layer.hz)]} />
            <meshBasicMaterial color="#0c4a6e" transparent opacity={0.06} side={THREE.DoubleSide} />
          </mesh>
          <lineSegments position={[0, layer.y, 0]}>
            <edgesGeometry args={[createLayerOutline(layer.y, layer.hw, layer.hz)]} />
            <lineBasicMaterial color="#38bdf8" transparent opacity={0.22} />
          </lineSegments>
          <Html position={[-layer.hw - 0.12, layer.y, 0]} center style={{ pointerEvents: 'none' }}>
            <span style={{ color: '#7dd3fc', fontSize: '8px', fontFamily: 'monospace', opacity: 0.72, whiteSpace: 'nowrap' }}>
              {layer.depth}m
            </span>
          </Html>
        </group>
      ))}
    </>
  );
}

/**
 * Selected depth slice — brighter translucent plane at the slider depth.
 * Follows inverted pyramid taper at the exact slider depth.
 *
 * Robustness (blank-screen fix): the slice plane is rebuilt declaratively on
 * every depth change. Creating fresh THREE objects and passing them through
 * <primitive> at slider-drag rate forces R3F to reconstruct instances while
 * the same objects are still attached in the scene graph — a known source of
 * runtime exceptions. Plain <mesh>/<lineSegments> elements let R3F handle
 * attachment, disposal and reconciliation safely.
 */
function SelectedDepthSlice({
  selectedDepth,
  verticalExaggeration = 1,
  visible = true,
  opacity = 1,
}: {
  selectedDepth: number;
  verticalExaggeration?: number;
  visible?: boolean;
  opacity?: number;
}) {
  // Churn-free geometry: one unit square (fill + outline) created once, then
  // positioned/scaled per depth. Scale and position are pure matrix updates —
  // dragging the slider never rebuilds or re-attaches GPU buffers.
  // (Hooks stay above the early return — rules-of-hooks.)
  const unitFill = useMemo(() => new THREE.ShapeGeometry(createUnitSquareShape()), []);
  const unitOutline = useMemo(() => createUnitSquareOutline(), []);

  // Safe geometry inputs: finite depth, positive half-extents. An invalid
  // input renders nothing — never an invalid Three.js geometry.
  const y = pressureToY(selectedDepth, verticalExaggeration);
  const hw = invertedPyramidHalfWidth(y, verticalExaggeration);
  const hz = invertedPyramidHalfZ(y, verticalExaggeration);
  const geometryValid =
    Number.isFinite(y) && Number.isFinite(hw) && Number.isFinite(hz) && hw > 0 && hz > 0;

  if (!visible || !geometryValid) return null;

  const safeOpacity = Math.max(0, Math.min(1, Number.isFinite(opacity) ? opacity : 1));

  return (
    <group>
      {/* Filled translucent plane at the requested depth */}
      <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[hw * 2, hz * 2, 1]}>
        <primitive object={unitFill} attach="geometry" />
        <meshBasicMaterial
          color={SELECTED_SLICE_COLOR}
          transparent
          opacity={0.24 * safeOpacity}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Edge outline follows the same taper */}
      <lineSegments position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[hw * 2, hz * 2, 1]} geometry={unitOutline}>
        <lineBasicMaterial color="#67e8f9" transparent opacity={0.9 * Math.max(0.15, safeOpacity)} />
      </lineSegments>
      {/* Depth label at the slice */}
      <Html position={[0, y, 0]} center style={{ pointerEvents: 'none' }}>
        <div
          style={{
            background: 'rgba(6, 182, 212, 0.28)',
            border: '1px solid rgba(103, 232, 249, 0.9)',
            borderRadius: '3px',
            padding: '1px 5px',
            fontSize: '9px',
            color: '#cffafe',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            opacity: Math.max(0.2, safeOpacity),
          }}
        >
          {selectedDepth}m
        </div>
      </Html>
    </group>
  );
}

/** Depth reference scale — vertical axis with labels at 0–500m. */
function DepthScale({ selectedDepth, verticalExaggeration = 1 }: { selectedDepth: number; verticalExaggeration?: number }) {
  const depths = [0, 100, 200, 300, 400, 500];
  const x = -(PYRAMID_SURFACE_HALF_WIDTH + 0.48);

  const lineGeometry = useMemo(() => {
    const pts = [
      new THREE.Vector3(x, 0, 0),
      new THREE.Vector3(x, -SCENE_DEPTH * verticalExaggeration, 0),
    ];
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [x, verticalExaggeration]);

  // Selected depth marker on the axis
  const markerY = pressureToY(selectedDepth, verticalExaggeration);

  return (
    <group>
      <lineSegments geometry={lineGeometry}>
        <lineBasicMaterial color="#94a3b8" transparent opacity={0.82} />
      </lineSegments>

      {depths.map((d) => {
        const y = pressureToY(d, verticalExaggeration);
        return (
          <group key={d} position={[x, y, 0]}>
            <mesh>
              <boxGeometry args={[0.13, 0.012, 0.012]} />
              <meshBasicMaterial color="#94a3b8" />
            </mesh>
            <Html position={[-0.15, 0, 0]} center style={{ pointerEvents: 'none' }}>
              <span style={{ color: '#cbd5e1', fontSize: '10px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                {d}m
              </span>
            </Html>
          </group>
        );
      })}

      {/* Selected depth marker on the axis */}
      <group position={[x, markerY, 0]}>
        <mesh>
          <boxGeometry args={[0.19, 0.025, 0.025]} />
          <meshBasicMaterial color="#67e8f9" />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Profile line rendered as a thick tube. When `colorFromValues` is provided
 * the tube uses per-vertex colors from the canonical color scale (the same
 * value→color mapping as the colorbar); otherwise it uses the identity
 * source color. `opacity` is the layer manager control (0–1).
 */
function ProfileLine({
  records,
  xPosition,
  color,
  colorFromValues = null,
  opacity = 1,
}: {
  records: PositionedRecord[];
  xPosition: number;
  color?: string;
  colorFromValues?: Array<[number, number, number]> | null;
  opacity?: number;
}) {
  const tubeGeometry = useMemo(() => {
    if (records.length < 2) return null;
    const pts = records.map((r) => new THREE.Vector3(xPosition, r.y, 0));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0);
    return new THREE.TubeGeometry(curve, records.length * 4, 0.014, 6, false);
  }, [records, xPosition]);

  const vertexColors = useMemo(() => {
    if (!colorFromValues || records.length < 2) return null;
    const geometry = tubeGeometry;
    if (!geometry) return null;
    // Interpolate per-measurement colors along the tube's tubular segments so
    // the tube gradient matches the value→color mapping between measurements.
    const tubularSegments = records.length * 4;
    const colors: number[] = [];
    for (let s = 0; s <= tubularSegments; s += 1) {
      const pos = (s / tubularSegments) * (records.length - 1);
      const i = Math.min(records.length - 2, Math.floor(pos));
      const f = pos - i;
      const a = colorFromValues[i];
      const b = colorFromValues[i + 1] ?? a;
      colors.push(
        a[0] + (b[0] - a[0]) * f,
        a[1] + (b[1] - a[1]) * f,
        a[2] + (b[2] - a[2]) * f,
      );
    }
    const attr = new THREE.Float32BufferAttribute(colors, 3);
    geometry.setAttribute('color', attr);
    return attr;
  }, [colorFromValues, records, tubeGeometry]);

  if (!tubeGeometry) return null;

  const safeOpacity = Math.max(0, Math.min(1, Number.isFinite(opacity) ? opacity : 1));

  return (
    <mesh geometry={tubeGeometry}>
      {vertexColors ? (
        <meshStandardMaterial
          vertexColors
          emissive={color ?? '#ffffff'}
          emissiveIntensity={0.12}
          roughness={0.3}
          metalness={0.1}
          transparent
          opacity={0.95 * safeOpacity}
        />
      ) : (
        <meshStandardMaterial
          color={color ?? ARGO_COLOR}
          emissive={color ?? ARGO_COLOR}
          emissiveIntensity={0.4}
          roughness={0.3}
          metalness={0.1}
          transparent
          opacity={0.95 * safeOpacity}
        />
      )}
    </mesh>
  );
}

/**
 * Individual measurement point with hover tooltip and optional depth-highlight.
 * Highlighted points get an outer glow halo.
 */
function MeasurementPoint({
  record,
  xPosition,
  color,
  unit,
  variable,
  profileLabel,
  isHighlighted,
  opacityOverride = 1,
}: {
  record: PositionedRecord;
  xPosition: number;
  color: string;
  unit: string;
  variable: string;
  profileLabel: string;
  isHighlighted: boolean;
  /** Layer manager opacity (0–1) multiplied into the point's material. */
  opacityOverride?: number;
}) {
  const [hovered, setHovered] = useState(false);
  const p = record.point;

  const layerOpacity = Math.max(0, Math.min(1, Number.isFinite(opacityOverride) ? opacityOverride : 1));
  const sphereSize = isHighlighted ? 0.055 : hovered ? 0.045 : 0.028;
  const emissiveIntensity = isHighlighted ? 0.9 : hovered ? 0.6 : 0.15;
  const opacity = (isHighlighted ? 1 : hovered ? 1 : 0.92) * layerOpacity;

  return (
    <group position={[xPosition, record.y, 0]}>
      <mesh
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >          <sphereGeometry args={[sphereSize, 12, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          transparent
          opacity={opacity}
          depthWrite={layerOpacity > 0.9}
        />
      </mesh>

      {/* Glow halo for highlighted measurement */}
      {isHighlighted && (
        <mesh>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.12}
            depthWrite={false}
          />
        </mesh>
      )}

      {hovered && (
        <Html distanceFactor={5} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              background: 'rgba(10, 14, 26, 0.94)',
              border: '1px solid rgba(100, 116, 139, 0.4)',
              borderRadius: '6px',
              padding: '6px 8px',
              fontSize: '10px',
              color: '#e2e8f0',
              whiteSpace: 'nowrap',
              lineHeight: '1.5',
              transform: 'translateX(12px)',
            }}
          >
            <div style={{ color: '#94a3b8', fontSize: '9px', marginBottom: '2px' }}>
              {profileLabel}
            </div>
            <div>
              Depth: <strong>{p.pressure.toFixed(1)}</strong> dbar
            </div>
            <div style={{ color }}>
              {variable} ({profileLabel}): <strong>{profileLabel === 'Argo' ? p.argoValue.toFixed(3) : p.glorysValue.toFixed(3)}</strong> {unit}
            </div>
            <div style={{ color: '#f59e0b' }}>
              Diff: {p.difference > 0 ? '+' : ''}{p.difference.toFixed(4)} {unit}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

/** Difference indicator — horizontal segment between Argo and GLORYS. */
function DifferenceIndicator({
  record,
  isHighlighted,
  opacity = 1,
  colorOverride,
}: {
  record: PositionedRecord;
  isHighlighted: boolean;
  /** Discrepancies layer opacity (0–1) from the layer manager. */
  opacity?: number;
  /** Canonical color-scale color for this difference value (optional). */
  colorOverride?: string;
}) {
  const p = record.point;
  const diff = p.difference;
  const absDiff = Math.abs(diff);

  if (absDiff < 0.001) return null;

  const layerOpacity = Math.max(0, Math.min(1, Number.isFinite(opacity) ? opacity : 1));
  const width = Math.min(absDiff * DIFF_SCALE, 0.5);
  const sign = diff > 0 ? 1 : -1;
  const midX = (record.argoX + record.glorysX) / 2;
  const startX = midX - (sign * width) / 2;
  const diffColor = colorOverride ?? (diff > 0 ? DIFF_POS_COLOR : DIFF_NEG_COLOR);

  return (
    <group position={[startX, record.y, 0]}>
      <mesh position={[sign * width / 2, 0, 0]}>
        <boxGeometry args={[width, isHighlighted ? 0.028 : 0.016, isHighlighted ? 0.028 : 0.016]} />
        <meshStandardMaterial
          color={diffColor}
          emissive={diffColor}
          emissiveIntensity={isHighlighted ? 0.6 : 0.2}
          transparent
          opacity={(isHighlighted ? 0.95 : 0.72) * layerOpacity}
        />
      </mesh>
    </group>
  );
}

/** Selected observation anchor at surface with metadata. */
function ObservationAnchor({ firstRecord }: { firstRecord: PositionedRecord }) {
  const p = firstRecord.point;

  return (
    <group position={[0, 0, 0]}>
      <mesh>
        <octahedronGeometry args={[0.05, 0]} />
        <meshStandardMaterial
          color="#f59e0b"
          emissive="#f59e0b"
          emissiveIntensity={0.5}
          transparent
          opacity={0.9}
        />
      </mesh>

      <Html position={[0.6, 0.15, 0]} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            background: 'rgba(10, 14, 26, 0.88)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '5px',
            padding: '5px 8px',
            fontSize: '9px',
            color: '#cbd5e1',
            whiteSpace: 'nowrap',
            lineHeight: '1.5',
          }}
        >
          <div style={{ color: '#f59e0b', fontWeight: 'bold', marginBottom: '1px' }}>
            {p.platformNumber} / Cycle {p.cycleNumber}
          </div>
          <div style={{ color: '#94a3b8' }}>
            {p.latitude.toFixed(3)}°N, {p.longitude.toFixed(3)}°E
          </div>
          <div style={{ color: '#64748b' }}>
            {p.timestamp.substring(0, 10)} — {p.pressure.toFixed(1)} dbar
          </div>
        </div>
      </Html>
    </group>
  );
}

// ── Main scene ───────────────────────────────────────────────────────────────

/**
 * Owns the camera exactly once per mounted inspector. It deliberately has no
 * frame callback: after initialization, the camera changes only through
 * OrbitControls or explicit view actions.
 */
function InspectorCameraController({
  initialView,
  viewControlsRef,
}: {
  initialView: InspectorInitialView;
  viewControlsRef?: MutableRefObject<InspectorViewControls | null>;
}) {
  const { camera, invalidate } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return undefined;

    const applyView = (position: THREE.Vector3, target: THREE.Vector3) => {
      camera.position.copy(position);
      controls.target.copy(target);
      controls.update();
      invalidate();
    };

    // One-time initialization; there is no render-driven lookAt or camera fit.
    applyView(initialView.position, initialView.target);

    if (viewControlsRef) {
      const zoomBy = (factor: number) => {
        const offset = camera.position.clone().sub(controls.target);
        const distance = offset.length();
        if (distance === 0) return;
        const nextDistance = THREE.MathUtils.clamp(
          distance * factor,
          controls.minDistance,
          controls.maxDistance,
        );
        camera.position.copy(controls.target).add(offset.multiplyScalar(nextDistance / distance));
        controls.update();
        invalidate();
      };

      viewControlsRef.current = {
        zoomIn: () => zoomBy(0.8),
        zoomOut: () => zoomBy(1.25),
        resetView: () => applyView(initialView.position, initialView.target),
      };
    }

    return () => {
      if (viewControlsRef) viewControlsRef.current = null;
    };
  }, [camera, initialView, invalidate, viewControlsRef]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping={false}
      enablePan
      autoRotate={false}
      minDistance={4.5}
      maxDistance={13}
      minPolarAngle={0.35}
      maxPolarAngle={Math.PI - 0.2}
    />
  );
}

function InspectorScene({
  profilePoints,
  unit,
  variable,
  selectedDepth,
  verticalExaggeration,
  colorScale,
  renderMode = 'variables',
  layers = DEFAULT_SCENE_LAYERS,
}: {
  profilePoints: Research3DPoint[];
  unit: string;
  variable: string;
  selectedDepth: number;
  verticalExaggeration: number;
  colorScale?: ColorScaleConfig;
  renderMode?: FieldRenderMode;
  layers?: SceneLayers;
}) {
  const sorted = useMemo(
    () => [...profilePoints].sort((a, b) => a.pressure - b.pressure),
    [profilePoints],
  );

  // Canonical color-scale resolution — the SAME config drives every 3D color
  // and the synchronized colorbar rendered alongside the scene.
  const scale = useMemo(
    () => sceneScaleConfig(sorted, colorScale, renderMode),
    [sorted, colorScale, renderMode],
  );
  const fieldConfig = scale?.config ?? null;

  // Per-record colors from the real values. The underlying scientific values
  // are never mutated — only their color encoding changes.
  const recordColors = useMemo(() => {
    if (!fieldConfig) return null;
    return sorted.map((point) => ({
      argo: valueToRgb(point.argoValue, fieldConfig),
      glorys: valueToRgb(point.glorysValue, fieldConfig),
      difference: valueToRgb(point.difference, fieldConfig),
    }));
  }, [sorted, fieldConfig]);

  const profileOffsets = useMemo(() => {
    const keys = [...new Set(sorted.map((point) => `${point.platformNumber}:${point.cycleNumber}`))];
    return new Map(keys.map((key, index) => [key, (index - (keys.length - 1) / 2) * 0.32]));
  }, [sorted]);

  const records: PositionedRecord[] = useMemo(
    () => sorted.map((point) => {
      const offset = profileOffsets.get(`${point.platformNumber}:${point.cycleNumber}`) ?? 0;
      return ({
        point,
        y: pressureToY(point.pressure, verticalExaggeration),
        argoX: -ARGO_X_OFFSET + offset,
        glorysX: GLORYS_X_OFFSET + offset,
      });
    }), [sorted, verticalExaggeration, profileOffsets],
  );
  const profileRecordGroups = useMemo(() => {
    const groups = new Map<string, PositionedRecord[]>();
    records.forEach((record) => {
      const key = `${record.point.platformNumber}:${record.point.cycleNumber}`;
      groups.set(key, [...(groups.get(key) ?? []), record]);
    });
    return [...groups.values()];
  }, [records]);

  // Shared selector guarantees this is the same real record used by Research charts/cards.
  const nearestRecord = useMemo(() => {
    const measurement = findNearestResearchMeasurement(sorted, selectedDepth);
    if (!measurement) return null;
    return records.find(
      (record) => record.point.platformNumber === measurement.platformNumber
        && record.point.cycleNumber === measurement.cycleNumber
        && record.point.pressure === measurement.pressure,
    ) ?? null;
  }, [records, selectedDepth, sorted]);

  const highlightedIndex = useMemo(() => {
    if (!nearestRecord) return -1;
    return records.findIndex(
      (r) =>
        r.point.platformNumber === nearestRecord.point.platformNumber &&
        r.point.pressure === nearestRecord.point.pressure,
    );
  }, [records, nearestRecord]);

  const platformNumber = sorted[0]?.platformNumber ?? '';
  const cycleNumber = sorted[0]?.cycleNumber ?? '';

  return (
    <>
      {/* Transparent 0-500 m cutaway water volume, following the same inverse taper. */}
      <WaterVolume verticalExaggeration={verticalExaggeration} />

      {/* Inverted pyramid frame */}
      <InvertedPyramidFrame verticalExaggeration={verticalExaggeration} />

      {/* Wide 0 m surface plane establishes the top of the visual inspection volume. */}
      <SurfacePlane />

      {/* Depth reference layers (translucent, following pyramid taper) */}
      <DepthLayers verticalExaggeration={verticalExaggeration} />

      {/* Selected depth slice (interactive, brighter) — real layer control */}
      <SelectedDepthSlice
        selectedDepth={selectedDepth}
        verticalExaggeration={verticalExaggeration}
        visible={layers.depthSlice.visible}
        opacity={layers.depthSlice.opacity}
      />

      {/* Depth scale with selected-depth marker */}
      <DepthScale selectedDepth={selectedDepth} verticalExaggeration={verticalExaggeration} />

      {/* Argo profile — visibility + opacity from the canonical layer manager;
          color from the canonical color scale (identity colors when unset). */}
      {layers.argo.visible && (
        <>
          {profileRecordGroups.map((group) => <ProfileLine key={`argo-line-${group[0]?.point.platformNumber}-${group[0]?.point.cycleNumber}`} records={group} xPosition={group[0]?.argoX ?? -ARGO_X_OFFSET} color={fieldConfig ? undefined : ARGO_COLOR} colorFromValues={recordColors ? group.map((record) => recordColors[records.indexOf(record)].argo) : null} opacity={layers.argo.opacity} />)}
          {records.map((r, i) => (
            <MeasurementPoint
              key={`argo-${i}`}
              record={r}
              xPosition={r.argoX}
              color={fieldConfig ? valueToColor(r.point.argoValue, fieldConfig) : ARGO_COLOR}
              unit={unit}
              variable={variable}
              profileLabel="Argo"
              isHighlighted={i === highlightedIndex}
              opacityOverride={layers.argo.opacity}
            />
          ))}
        </>
      )}

      {/* GLORYS profile — same canonical wiring as Argo */}
      {layers.glorys.visible && (
        <>
          {profileRecordGroups.map((group) => <ProfileLine key={`glorys-line-${group[0]?.point.platformNumber}-${group[0]?.point.cycleNumber}`} records={group} xPosition={group[0]?.glorysX ?? GLORYS_X_OFFSET} color={fieldConfig ? undefined : GLORYS_COLOR} colorFromValues={recordColors ? group.map((record) => recordColors[records.indexOf(record)].glorys) : null} opacity={layers.glorys.opacity} />)}
          {records.map((r, i) => (
            <MeasurementPoint
              key={`glorys-${i}`}
              record={r}
              xPosition={r.glorysX}
              color={fieldConfig ? valueToColor(r.point.glorysValue, fieldConfig) : GLORYS_COLOR}
              unit={unit}
              variable={variable}
              profileLabel="GLORYS"
              isHighlighted={i === highlightedIndex}
              opacityOverride={layers.glorys.opacity}
            />
          ))}
        </>
      )}

      {/* Difference indicators — the Discrepancies layer (GLORYS − Argo).
          In difference mode the bars take palette colors; in variables mode
          they keep the amber/blue identity semantics (model high / model low). */}
      {layers.discrepancies.visible && (
        <>
          {records.map((r, i) => (
            <DifferenceIndicator
              key={`diff-${i}`}
              record={r}
              isHighlighted={i === highlightedIndex}
              opacity={layers.discrepancies.opacity}
              colorOverride={
                renderMode === 'difference' && fieldConfig
                  ? valueToColor(r.point.difference, fieldConfig)
                  : undefined
              }
            />
          ))}
        </>
      )}

      {/* Selected observation anchor at surface */}
      {records.length > 0 && (
        <ObservationAnchor firstRecord={records[0]} />
      )}

      {/* Selected depth info panel */}
      {nearestRecord && (
        <Html position={[ARGO_X_OFFSET + 0.6, nearestRecord.y, 0]} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              background: 'rgba(10, 14, 26, 0.92)',
              border: '1px solid rgba(6, 182, 212, 0.35)',
              borderRadius: '5px',
              padding: '5px 8px',
              fontSize: '9px',
              color: '#e2e8f0',
              whiteSpace: 'nowrap',
              lineHeight: '1.5',
              minWidth: '160px',
            }}
          >
            <div style={{ color: '#64748b', fontSize: '8px', marginBottom: '2px' }}>
              Selected: {selectedDepth}m → Nearest: {nearestRecord.point.pressure.toFixed(1)} dbar
            </div>
            <div style={{ color: ARGO_COLOR }}>
              Argo {variable}: <strong>{nearestRecord.point.argoValue.toFixed(3)}</strong> {unit}
            </div>
            <div style={{ color: GLORYS_COLOR }}>
              GLORYS {variable}: <strong>{nearestRecord.point.glorysValue.toFixed(3)}</strong> {unit}
            </div>
            <div style={{ color: '#f59e0b' }}>
              Diff: {nearestRecord.point.difference > 0 ? '+' : ''}{nearestRecord.point.difference.toFixed(4)} {unit}
            </div>
          </div>
        </Html>
      )}

      {/* No nearby measurement message */}
      {!nearestRecord && records.length > 0 && (
        <Html position={[0, pressureToY(selectedDepth, verticalExaggeration), 0]} center style={{ pointerEvents: 'none' }}>
          <div
            style={{
              background: 'rgba(10, 14, 26, 0.85)',
              border: '1px solid rgba(100, 116, 139, 0.25)',
              borderRadius: '4px',
              padding: '3px 8px',
              fontSize: '9px',
              color: '#64748b',
              whiteSpace: 'nowrap',
            }}
          >
            No nearby measurement ({selectedDepth}m)
          </div>
        </Html>
      )}

      {/* Profile label at top */}
      <Html position={[0, 0.45, 0]} center style={{ pointerEvents: 'none' }}>
        <div
          style={{
            background: 'rgba(10, 14, 26, 0.85)',
            border: '1px solid rgba(100, 116, 139, 0.3)',
            borderRadius: '4px',
            padding: '3px 8px',
            fontSize: '9px',
            color: '#94a3b8',
            whiteSpace: 'nowrap',
            textAlign: 'center',
          }}
        >
          <span style={{ color: ARGO_COLOR }}>Argo</span>
          {' vs '}
          <span style={{ color: GLORYS_COLOR }}>GLORYS</span>
          {' — '}
          {records.length} records — {platformNumber}/{cycleNumber}
        </div>
      </Html>

      {/* Orbit controls — user retains camera control */}
    </>
  );
}

// ── Canvas wrapper ───────────────────────────────────────────────────────────

export function DepthInspectorScene({
  className,
  profilePoints,
  unit,
  variable,
  selectedDepth,
  verticalExaggeration = 1,
  colorScale,
  renderMode = 'variables',
  layers,
  showColorbar = true,
  viewControlsRef,
}: DepthInspectorSceneProps) {
  const hasData = profilePoints.length > 0;
  const [initialView] = useState<InspectorInitialView>(() => {
    const targetY = -(SCENE_DEPTH * verticalExaggeration) / 2;
    return {
      position: new THREE.Vector3(6.2, targetY + 1.2, 7.2),
      target: new THREE.Vector3(0, targetY, 0),
    };
  });
  const cameraConfig = useMemo(
    () => ({
      position: [initialView.position.x, initialView.position.y, initialView.position.z] as [number, number, number],
      fov: 38,
      near: 0.1,
      far: 100,
    }),
    [initialView],
  );
  const glConfig = useMemo(() => ({ antialias: true }), []);

  // Resolve the SAME scale config as the 3D renderer so the colorbar always
  // matches what the scene actually displays (Task 1 requirement 12/13).
  const scale = useMemo(
    () => sceneScaleConfig(profilePoints, colorScale, renderMode),
    [profilePoints, colorScale, renderMode],
  );

  return (
    <div className={`${className ?? 'h-full w-full'} flex min-h-0 flex-col overflow-hidden`}>
      {/*
       * Canvas and colorbar must share a bounded flex column. A 100%-height
       * Canvas followed by a normal-flow colorbar creates a ResizeObserver
       * feedback loop: the colorbar increases content height, the Canvas
       * resizes to that new height, then increases it again.
       */}
      <div className="min-h-0 flex-1">
        <Canvas
          className="h-full w-full"
          camera={cameraConfig}
          frameloop="demand"
          gl={glConfig}
          style={{ background: '#0a0e1a' }}
        >
        <fog attach="fog" args={['#061526', 8, 19]} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[2, 5, 3]} intensity={0.55} />
        <pointLight position={[0, 0.8, 1.8]} color="#38bdf8" intensity={0.55} distance={9} />
        <spotLight
          position={[0, 3.5, 0]}
          angle={0.55}
          penumbra={0.8}
          color="#67e8f9"
          intensity={0.35}
          distance={12}
          castShadow={false}
        />
        <hemisphereLight args={['#67e8f9', '#0c4a6e', 0.2]} />

        {hasData ? (
          <SceneErrorBoundary>
            <InspectorScene
              profilePoints={profilePoints}
              unit={unit}
              variable={variable}
              selectedDepth={selectedDepth}
              verticalExaggeration={verticalExaggeration}
              colorScale={colorScale}
              renderMode={renderMode}
              layers={layers}
            />
          </SceneErrorBoundary>
        ) : (
          <Html center style={{ pointerEvents: 'none' }}>
            <div
              style={{
                background: 'rgba(10, 14, 26, 0.85)',
                border: '1px solid rgba(100, 116, 139, 0.3)',
                borderRadius: '8px',
                padding: '16px 24px',
                color: '#94a3b8',
                fontSize: '13px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '16px', marginBottom: '6px', color: '#64748b' }}>○</div>
              No selected profile data
              <div style={{ fontSize: '10px', marginTop: '4px', color: '#475569' }}>
                Click an Argo observation marker on the globe
              </div>
            </div>
          </Html>
        )}

        <InspectorCameraController
          initialView={initialView}
          viewControlsRef={viewControlsRef}
        />

        </Canvas>
      </div>

      {showColorbar && hasData && scale && (
        <SceneColorbar
          scale={scale}
          unit={unit}
          variable={variable}
          renderMode={renderMode}
          logRequested={colorScale?.logarithmic ?? false}
        />
      )}
    </div>
  );
}

/**
 * SceneColorbar — legend synchronized with the actual renderer.
 *
 * It uses the exact ScaleTransformConfig the 3D scene resolved (same palette,
 * same sanitized range, same log transform), so it can never disagree with
 * the displayed colors.
 */
function SceneColorbar({
  scale,
  unit,
  variable,
  renderMode,
  logRequested,
}: {
  scale: { config: ScaleTransformConfig; range: { min: number; max: number }; logApplied: boolean };
  unit: string;
  variable: string;
  renderMode: FieldRenderMode;
  /** True when the user asked for log mode (may be unapplied for signed fields). */
  logRequested: boolean;
}) {
  const { config, range, logApplied } = scale;
  const ticks = useMemo(
    () => legendTicks(range.min, range.max, config.logarithmic, 5),
    [range.min, range.max, config.logarithmic],
  );
  const gradient = useMemo(
    () => paletteGradient(config.paletteId, config.logarithmic, range.min, range.max),
    [config.paletteId, config.logarithmic, range.min, range.max],
  );

  return (
    <div
      className="mt-1.5 flex items-center gap-2 px-1"
      style={{ pointerEvents: 'none' }}
      aria-label={`${renderMode === 'difference' ? 'Difference' : variable} color scale`}
    >
      <div className="relative h-2 flex-1 border" style={{ borderColor: 'var(--os-border)' }}>
        <div className="absolute inset-0" style={{ background: gradient, opacity: 0.92 }} />
        {ticks.map((tick, i) => (
          <div
            key={i}
            className="absolute top-[-3px] bottom-[-3px] w-px"
            style={{ left: `${(tick.t * 100).toFixed(1)}%`, background: 'var(--os-text-muted)', opacity: 0.5 }}
          />
        ))}
      </div>
      <div className="mono text-[9px] whitespace-nowrap" style={{ color: 'var(--os-text-3)' }}>
        {range.min.toFixed(2)} … {range.max.toFixed(2)} {unit}
        {config.logarithmic ? ' · log10' : ''}
        {logRequested && !logApplied ? ' · log unavailable for this field' : ''}
      </div>
    </div>
  );
}
