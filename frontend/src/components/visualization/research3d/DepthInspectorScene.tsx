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

import { useState, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Research3DPoint } from '@/integration';
import { findNearestResearchMeasurement } from '@/integration/researchSelection';

// ── Constants ────────────────────────────────────────────────────────────────

/** Maximum reference depth for the scene (dbar). Labels go to 500m. */
const MAX_DEPTH_REF = 500;

/** Scene height in world units for MAX_DEPTH_REF dbar */
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

// ── Types ────────────────────────────────────────────────────────────────────

interface DepthInspectorSceneProps {
  className?: string;
  profilePoints: Research3DPoint[];
  unit: string;
  variable: string;
  /** Selected depth from the slider (0–500 dbar) */
  selectedDepth: number;
}

/** A record with computed Y position */
interface PositionedRecord {
  point: Research3DPoint;
  y: number;
  argoX: number;
  glorysX: number;
}

// ── Coordinate helpers ───────────────────────────────────────────────────────

/** Convert pressure (dbar) to Y scene coordinate (depth increases downward) */
function pressureToY(pressure: number): number {
  return -(pressure / MAX_DEPTH_REF) * SCENE_DEPTH;
}

/**
 * INVERTED pyramid half-width at a given Y position.
 * Wide at surface (Y=0), narrow at depth (Y=-SCENE_DEPTH).
 */
function invertedPyramidHalfWidth(y: number): number {
  const t = Math.min(Math.abs(y) / SCENE_DEPTH, 1);
  return PYRAMID_SURFACE_HALF_WIDTH * (1 - t);
}

/** INVERTED pyramid half-depth in Z at a given Y position. */
function invertedPyramidHalfZ(y: number): number {
  const t = Math.min(Math.abs(y) / SCENE_DEPTH, 1);
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

/** Transparent four-sided water volume using the existing inverted-pyramid taper. */
function createWaterVolumeGeometry(): THREE.BufferGeometry {
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

  for (let segment = 0; segment < segments; segment += 1) {
    const start = segment / segments;
    const end = (segment + 1) / segments;
    const startY = -SCENE_DEPTH * start;
    const endY = -SCENE_DEPTH * end;
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

/** Argo observation: bright cyan/blue */
const ARGO_COLOR = '#22d3ee';
/** GLORYS model: vivid purple/violet */
const GLORYS_COLOR = '#a855f7';
const DIFF_POS_COLOR = '#f59e0b';
const DIFF_NEG_COLOR = '#3b82f6';
const SELECTED_SLICE_COLOR = '#22d3ee';

// ── Sub-components ───────────────────────────────────────────────────────────

/**
 * Semi-transparent inspected water volume. It is deliberately a 0-500 m
 * cutaway volume, not bathymetry or a synthetic ocean data layer.
 */
function WaterVolume() {
  const geometry = useMemo(() => createWaterVolumeGeometry(), []);

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
function InvertedPyramidFrame() {
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
    const apex = new THREE.Vector3(0, -SCENE_DEPTH, 0);
    for (const corner of surfaceCorners) {
      points.push(corner.clone(), apex.clone());
    }
    for (let i = 0; i < 4; i++) {
      points.push(surfaceCorners[i].clone(), surfaceCorners[(i + 1) % 4].clone());
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, []);

  return (
    <group>
      {/* Subtle outer glow makes the water-column silhouette readable on dark backgrounds. */}
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color="#0ea5e9" transparent opacity={0.16} />
      </lineSegments>
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
function DepthLayers() {
  const layers = useMemo(() => {
    // 100m increments, excluding 0m (surface is the pyramid base) and 500m (apex)
    const depths = [100, 200, 300, 400];
    return depths.map((d) => {
      const y = pressureToY(d);
      const hw = invertedPyramidHalfWidth(y);
      const hz = invertedPyramidHalfZ(y);
      const outline = createLayerOutline(y, hw, hz);
      const outlineLine = new THREE.Line(
        outline,
        new THREE.LineBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.22 }),
      );
      return { depth: d, y, hw, hz, shape: createLayerShape(hw, hz), outlineLine };
    });
  }, []);

  return (
    <>
      {layers.map((layer) => (
        <group key={layer.depth}>
          <mesh position={[0, layer.y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <shapeGeometry args={[layer.shape]} />
            <meshBasicMaterial color="#0c4a6e" transparent opacity={0.06} side={THREE.DoubleSide} />
          </mesh>
          <primitive object={layer.outlineLine} />
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
 */
function SelectedDepthSlice({ selectedDepth }: { selectedDepth: number }) {
  const geometry = useMemo(() => {
    const y = pressureToY(selectedDepth);
    const hw = invertedPyramidHalfWidth(y);
    const hz = invertedPyramidHalfZ(y);
    return createLayerOutline(y, hw, hz);
  }, [selectedDepth]);

  const fillGeometry = useMemo(() => {
    const y = pressureToY(selectedDepth);
    const hw = invertedPyramidHalfWidth(y);
    const hz = invertedPyramidHalfZ(y);
    return new THREE.ShapeGeometry(createLayerShape(hw, hz));
  }, [selectedDepth]);

  const edgeObj = useMemo(() => {
    const material = new THREE.LineBasicMaterial({ color: '#67e8f9', transparent: true, opacity: 1 });
    return new THREE.Line(geometry, material);
  }, [geometry]);

  const y = pressureToY(selectedDepth);

  return (
    <group>
      {/* Filled translucent plane */}
      <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <primitive object={fillGeometry} />
        <meshBasicMaterial
          color={SELECTED_SLICE_COLOR}
          transparent
          opacity={0.24}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Edge outline */}
      <primitive object={edgeObj} />
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
          }}
        >
          {selectedDepth}m
        </div>
      </Html>
    </group>
  );
}

/** Depth reference scale — vertical axis with labels at 0–500m. */
function DepthScale({ selectedDepth }: { selectedDepth: number }) {
  const depths = [0, 100, 200, 300, 400, 500];
  const x = -(PYRAMID_SURFACE_HALF_WIDTH + 0.48);

  const lineGeometry = useMemo(() => {
    const pts = [
      new THREE.Vector3(x, 0, 0),
      new THREE.Vector3(x, -SCENE_DEPTH, 0),
    ];
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [x]);

  // Selected depth marker on the axis
  const markerY = pressureToY(selectedDepth);

  return (
    <group>
      <lineSegments geometry={lineGeometry}>
        <lineBasicMaterial color="#94a3b8" transparent opacity={0.82} />
      </lineSegments>

      {depths.map((d) => {
        const y = pressureToY(d);
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

/** Profile line rendered as a thick emissive tube for better visibility. */
function ProfileLine({
  records,
  xPosition,
  color,
}: {
  records: PositionedRecord[];
  xPosition: number;
  color: string;
}) {
  const tubeGeometry = useMemo(() => {
    if (records.length < 2) return null;
    const pts = records.map((r) => new THREE.Vector3(xPosition, r.y, 0));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0);
    return new THREE.TubeGeometry(curve, records.length * 4, 0.014, 6, false);
  }, [records, xPosition]);

  if (!tubeGeometry) return null;
  return (
    <mesh geometry={tubeGeometry}>
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.4}
        roughness={0.3}
        metalness={0.1}
        transparent
        opacity={0.95}
      />
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
}: {
  record: PositionedRecord;
  xPosition: number;
  color: string;
  unit: string;
  variable: string;
  profileLabel: string;
  isHighlighted: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const p = record.point;

  const sphereSize = isHighlighted ? 0.055 : hovered ? 0.045 : 0.028;
  const emissiveIntensity = isHighlighted ? 0.9 : hovered ? 0.6 : 0.15;
  const opacity = isHighlighted ? 1 : hovered ? 1 : 0.92;

  return (
    <group position={[xPosition, record.y, 0]}>
      <mesh
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <sphereGeometry args={[sphereSize, 12, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          transparent
          opacity={opacity}
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
}: {
  record: PositionedRecord;
  isHighlighted: boolean;
}) {
  const p = record.point;
  const diff = p.difference;
  const absDiff = Math.abs(diff);

  if (absDiff < 0.001) return null;

  const width = Math.min(absDiff * DIFF_SCALE, 0.5);
  const sign = diff > 0 ? 1 : -1;
  const midX = (record.argoX + record.glorysX) / 2;
  const startX = midX - (sign * width) / 2;
  const diffColor = diff > 0 ? DIFF_POS_COLOR : DIFF_NEG_COLOR;

  return (
    <group position={[startX, record.y, 0]}>
      <mesh position={[sign * width / 2, 0, 0]}>
        <boxGeometry args={[width, isHighlighted ? 0.028 : 0.016, isHighlighted ? 0.028 : 0.016]} />
        <meshStandardMaterial
          color={diffColor}
          emissive={diffColor}
          emissiveIntensity={isHighlighted ? 0.6 : 0.2}
          transparent
          opacity={isHighlighted ? 0.95 : 0.72}
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

function InspectorScene({
  profilePoints,
  unit,
  variable,
  selectedDepth,
}: {
  profilePoints: Research3DPoint[];
  unit: string;
  variable: string;
  selectedDepth: number;
}) {
  const sorted = useMemo(
    () => [...profilePoints].sort((a, b) => a.pressure - b.pressure),
    [profilePoints],
  );

  const records: PositionedRecord[] = useMemo(
    () =>
      sorted.map((point) => ({
        point,
        y: pressureToY(point.pressure),
        argoX: -ARGO_X_OFFSET,
        glorysX: GLORYS_X_OFFSET,
      })),
    [sorted],
  );

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

  const cameraTargetY = useMemo(() => {
    if (records.length === 0) return -SCENE_DEPTH / 2;
    return (records[0].y + records[records.length - 1].y) / 2;
  }, [records]);

  return (
    <>
      {/* Transparent 0-500 m cutaway water volume, following the same inverse taper. */}
      <WaterVolume />

      {/* Inverted pyramid frame */}
      <InvertedPyramidFrame />

      {/* Wide 0 m surface plane establishes the top of the visual inspection volume. */}
      <SurfacePlane />

      {/* Animated translucent surface sits on top of the static plane. */}
      <WaveSurface />

      {/* Depth reference layers (translucent, following pyramid taper) */}
      <DepthLayers />

      {/* Restrained light rays entering the water column from above. */}
      <UnderwaterLightBeams />

      {/* Sparse particles communicate suspended matter; they never obscure data. */}
      <UnderwaterParticles />

      {/* Selected depth slice (interactive, brighter) */}
      <SelectedDepthSlice selectedDepth={selectedDepth} />

      {/* Depth scale with selected-depth marker */}
      <DepthScale selectedDepth={selectedDepth} />

      {/* Argo profile */}
      <ProfileLine records={records} xPosition={-ARGO_X_OFFSET} color={ARGO_COLOR} />
      {records.map((r, i) => (
        <MeasurementPoint
          key={`argo-${i}`}
          record={r}
          xPosition={-ARGO_X_OFFSET}
          color={ARGO_COLOR}
          unit={unit}
          variable={variable}
          profileLabel="Argo"
          isHighlighted={i === highlightedIndex}
        />
      ))}

      {/* GLORYS profile */}
      <ProfileLine records={records} xPosition={GLORYS_X_OFFSET} color={GLORYS_COLOR} />
      {records.map((r, i) => (
        <MeasurementPoint
          key={`glorys-${i}`}
          record={r}
          xPosition={GLORYS_X_OFFSET}
          color={GLORYS_COLOR}
          unit={unit}
          variable={variable}
          profileLabel="GLORYS"
          isHighlighted={i === highlightedIndex}
        />
      ))}

      {/* Difference indicators */}
      {records.map((r, i) => (
        <DifferenceIndicator
          key={`diff-${i}`}
          record={r}
          isHighlighted={i === highlightedIndex}
        />
      ))}

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
        <Html position={[0, pressureToY(selectedDepth), 0]} center style={{ pointerEvents: 'none' }}>
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
      <OrbitControls
        target={[0, cameraTargetY, 0]}
        enableDamping
        dampingFactor={0.08}
        minDistance={4.5}
        maxDistance={13}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI - 0.2}
        makeDefault
      />
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
}: DepthInspectorSceneProps) {
  const hasData = profilePoints.length > 0;

  const initialCameraY = useMemo(() => {
    if (!hasData) return -1;
    const pressures = profilePoints.map((p) => p.pressure);
    const maxP = Math.max(...pressures);
    const midDepth = maxP / 2;
    return pressureToY(midDepth) + 0.8;
  }, [profilePoints, hasData]);

  return (
    <div className={className ?? 'h-full w-full'}>
      <Canvas
        camera={{
          position: [6.2, initialCameraY + 0.4, 7.2],
          fov: 38,
          near: 0.1,
          far: 100,
        }}
        gl={{ antialias: true }}
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
          <InspectorScene
            profilePoints={profilePoints}
            unit={unit}
            variable={variable}
            selectedDepth={selectedDepth}
          />
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

        <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
          <GizmoViewport
            axisColors={['#ef4444', '#22c55e', '#3b82f6']}
            labelColor="white"
          />
        </GizmoHelper>
      </Canvas>
    </div>
  );
}
