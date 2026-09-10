/**
 * Model-grid data abstraction (SIH26067 Priority 7).
 *
 * The application must not be architecturally limited to collocated point
 * records. This module defines the grid abstraction through which full
 * volumetric model fields (e.g. Copernicus GLORYS, INCOIS HYCOM) plug into
 * the existing visualization architecture WITHOUT rewriting the UI.
 *
 * CURRENT REALITY:
 *   - The collocation dataset (glorys_argo_collocation_2024.nc) contains
 *     model values ONLY at Argo observation positions — not a full grid.
 *   - No full volumetric GLORYS/NetCDF field file is present in the
 *     repository, so grid loading reports unavailable rather than
 *     fabricating grid values.
 *
 * WHEN A REAL GRID FILE/SERVICE IS CONNECTED (NetCDF, OPeNDAP, ERDDAP,
 * WMS/WCS/REST), implement a GridProvider below and register it — the
 * depth-slice renderer and isosurface path consume this contract.
 */

import type { ModelGridRecord } from '@/types/canonical';

/** Metadata describing a registered volumetric model grid. */
export interface ModelGridDescriptor {
  /** Grid id, e.g. 'glorys12v1-reanalysis' */
  id: string;
  /** Human-readable name */
  name: string;
  /** Institution / product id */
  institution?: string;
  productId?: string;
  /** Native horizontal resolution in degrees */
  horizontalResolutionDeg?: number;
  /** Vertical levels (dbar or m, per the source convention) */
  depthLevels?: number[];
  /** Available time steps (ISO dates). Sparse for observation-matched subsets. */
  timeSteps?: string[];
  /** Variables the grid can serve */
  variables: string[];
}

/**
 * Result contract for grid loads. A grid is either really loaded
 * (records present) or explicitly unavailable with a reason.
 * There is no synthetic-data path.
 */
export interface ModelGridLoadResult {
  available: boolean;
  /** Reason when unavailable (shown verbatim in the UI) */
  unavailableReason?: string;
  records: ModelGridRecord[];
  descriptor?: ModelGridDescriptor;
}

/** A provider serves one registered grid through some transport. */
export interface ModelGridProvider {
  readonly descriptor: ModelGridDescriptor;
  /** Whether the underlying dataset/service is connected and readable. */
  isAvailable(): Promise<boolean>;
  /**
   * Load a horizontal slice at one depth/time, optionally spatially
   * subset (spatial + temporal subsetting are REQUIRED for browser use —
   * never pull an entire volumetric field into the client).
   */
  loadDepthSlice(request: GridSliceRequest): Promise<ModelGridLoadResult>;
}

export interface GridSliceRequest {
  variable: string;
  depth: number;
  time: string;
  /** Spatial subset (degrees). Implementations must apply it server-side where possible. */
  bounds?: { north: number; south: number; east: number; west: number };
}

// ── Registry ─────────────────────────────────────────────────────────────────

const gridProviders = new Map<string, ModelGridProvider>();

/** Register a grid provider (call from an adapter module). */
export function registerModelGridProvider(provider: ModelGridProvider): void {
  gridProviders.set(provider.descriptor.id, provider);
}

export function getModelGridProvider(id: string): ModelGridProvider | undefined {
  return gridProviders.get(id);
}

export function listModelGridProviders(): ModelGridDescriptor[] {
  return [...gridProviders.values()].map((p) => p.descriptor);
}

/**
 * GLORYS12V1 volumetric grid — NOT CONNECTED.
 *
 * Realistic future transports: Copernicus Marine API, OPeNDAP, or a
 * pre-processed NetCDF served by the backend with spatial/temporal
 * subsetting. Register a real provider implementation when such a
 * dataset is added; until then this descriptor exists so the UI can
 * state clearly that the grid is unavailable rather than absent.
 */
export const GLORYS_GRID_DESCRIPTOR: ModelGridDescriptor = {
  id: 'glorys12v1-reanalysis',
  name: 'GLORYS12V1 daily reanalysis grid',
  institution: 'Mercator Ocean / CMEMS',
  productId: 'cmems_mod_glo_phy_my_0.083deg_P1D-m',
  horizontalResolutionDeg: 1 / 12,
  variables: ['temperature', 'salinity', 'currents_u', 'currents_v'],
};

export const GLORYS_GRID_UNAVAILABLE_REASON =
  'No full volumetric GLORYS12V1 grid file or service is connected. The collocation dataset contains model values only at Argo profile positions; grid rendering is disabled rather than simulated.';
