/**
 * INTEG1 Integration Layer — Mock Ocean Data Provider
 *
 * Generates realistic ocean data based on geographic coordinates and depth.
 * Uses physically-plausible temperature/salinity profiles for ocean regions.
 * When the real backend arrives, this entire file is replaced by the API provider.
 *
 * Data flow:
 *   Coordinates + variable + depth
 *     → MockOceanDataProvider
 *       → Normalized ProviderResponse<T>
 *         → Adapter hooks (normalize for UI components)
 *           → Tanmay's frontend components
 */

import type { OceanDataProvider } from '../provider';
import type {
  ProviderResponse,
  ComparisonRequest,
  ModelComparisonResult,
  ProfileRequest,
  VerticalProfileResult,
  DiscrepancyRequest,
  DiscrepancyResult,
  ObservationRequest,
  ObservationResult,
  DiagnosticRequest,
  DiagnosticResult,
  WorkflowResult,
  VisualizationRequest,
  Visualization3DResult,
  ResearchVisualization3DResult,
  ObservationStation,
  DiscrepancyPoint,
  SurfaceGridPoint,
  DepthSliceData,
} from '../types';

// ── Physical ocean models (simplified) ────────────────────────────────────────

/**
 * Approximate sea surface temperature based on latitude.
 * Tropics: ~28°C, temperate: ~15°C, polar: ~-1.8°C (freezing point of seawater)
 */
function sstFromLatitude(lat: number): number {
  const absLat = Math.abs(lat);
  if (absLat < 10) return 28 + Math.random() * 1.5 - 0.75;
  if (absLat < 20) return 26 + Math.random() * 2 - 1;
  if (absLat < 30) return 22 + Math.random() * 3 - 1.5;
  if (absLat < 40) return 16 + Math.random() * 3 - 1.5;
  if (absLat < 50) return 10 + Math.random() * 3 - 1.5;
  if (absLat < 60) return 5 + Math.random() * 2 - 1;
  return -1.5 + Math.random() * 2;
}

/**
 * Temperature at depth: thermocline model.
 * Surface → mixed layer (~50m) → thermocline (50-1000m) → deep water (stable ~2°C)
 */
function temperatureAtDepth(surfaceTemp: number, depth: number): number {
  if (depth <= 0) return surfaceTemp;
  if (depth <= 50) return surfaceTemp - depth * 0.01; // mixed layer, slight decrease
  if (depth <= 200) {
    const thermoclineDepth = 200 - 50;
    const progress = (depth - 50) / thermoclineDepth;
    return surfaceTemp - 2 - progress * (surfaceTemp - 6) * 0.8; // thermocline
  }
  if (depth <= 1000) {
    const progress = (depth - 200) / 800;
    return 6 - progress * 3.5; // gradual decrease toward deep water
  }
  return 2.5 - Math.max(0, (depth - 1000) / 3000) * 0.8; // deep water, very slow cooling
}

/**
 * Salinity model: surface ~34-36 PSU, peaks at ~100-300m, then stabilizes.
 */
function salinityAtDepth(depth: number, lat: number): number {
  const baseSalinity = 34.5 + Math.abs(lat) * 0.02; // slight lat dependence
  if (depth <= 0) return baseSalinity + 0.3;
  if (depth <= 100) return baseSalinity + 0.3 + depth * 0.005;
  if (depth <= 300) return baseSalinity + 0.8 + (depth - 100) * 0.003;
  if (depth <= 1000) return baseSalinity + 1.4 - (depth - 300) * 0.0008;
  return baseSalinity + 0.85; // deep water stable
}

/** Small noise to make mock data feel realistic */
function noise(amplitude: number = 0.1): number {
  return (Math.random() - 0.5) * 2 * amplitude;
}

// ── Mock Provider ──────────────────────────────────────────────────────────────

export class MockOceanDataProvider implements OceanDataProvider {
  readonly name = 'mock';
  readonly requiresNetwork = false;

  private timestamp(): string {
    return new Date().toISOString();
  }

  private ok<T>(data: T): ProviderResponse<T> {
    return {
      status: 'success',
      data,
      metadata: { timestamp: this.timestamp(), source: 'mock' },
    };
  }

  // ── Comparison ────────────────────────────────────────────────────────────

  async fetchComparison(req: ComparisonRequest): Promise<ProviderResponse<ModelComparisonResult>> {
    const surfaceTemp = sstFromLatitude(req.location.latitude);
    const modelTemp = temperatureAtDepth(surfaceTemp, req.depth) + noise(0.3);
    const obsTemp = temperatureAtDepth(surfaceTemp, req.depth) + noise(0.4);
    const diff = modelTemp - obsTemp;

    const healthScore = Math.max(0, Math.min(100, 80 - Math.abs(diff) * 15 + noise(5)));

    return this.ok({
      point: {
        modelValue: +modelTemp.toFixed(2),
        observationValue: +obsTemp.toFixed(2),
        difference: +diff.toFixed(2),
        unit: '°C',
        variable: req.variable,
        depth: req.depth,
        confidence: Math.abs(diff) < 1 ? 'high' : Math.abs(diff) < 2 ? 'medium' : 'low',
        timestamp: this.timestamp(),
      },
      healthScore: +healthScore.toFixed(0) as unknown as number,
      healthStatus:
        healthScore >= 85
          ? 'excellent'
          : healthScore >= 70
            ? 'good'
            : healthScore >= 50
              ? 'fair'
              : 'poor',
      healthSummary: `Mock analysis for ${req.variable} at ${req.depth}m depth. Model偏差: ${Math.abs(diff).toFixed(1)}°C`,
      sourceModel: 'MOCK_HYCOM_v1',
      sourceObservation: 'MOCK_ARGO_GRID',
    });
  }

  // ── Vertical Profile ──────────────────────────────────────────────────────

  async fetchVerticalProfile(req: ProfileRequest): Promise<ProviderResponse<VerticalProfileResult>> {
    const surfaceTemp = sstFromLatitude(req.location.latitude);
    const depths = [0, 10, 25, 50, 75, 100, 150, 200, 300, 400, 500, 750, 1000, 1500, 2000];

    const unit = req.variable === 'temperature' ? '°C' : req.variable === 'salinity' ? 'PSU' : 'm/s';

    const points = depths.map((depth) => {
      let modelValue: number;
      let observationValue: number;

      if (req.variable === 'temperature') {
        modelValue = temperatureAtDepth(surfaceTemp, depth) + noise(0.2);
        observationValue = temperatureAtDepth(surfaceTemp, depth) + noise(0.3);
      } else if (req.variable === 'salinity') {
        modelValue = salinityAtDepth(depth, req.location.latitude) + noise(0.05);
        observationValue = salinityAtDepth(depth, req.location.latitude) + noise(0.08);
      } else {
        // Currents: magnitude decreases with depth
        const surfaceCurrent = 0.3 + Math.random() * 0.5;
        modelValue = surfaceCurrent * Math.exp(-depth / 500) + noise(0.02);
        observationValue = surfaceCurrent * Math.exp(-depth / 500) + noise(0.03);
      }

      return {
        depth,
        modelValue: +modelValue.toFixed(2),
        observationValue: +observationValue.toFixed(2),
        unit,
      };
    });

    return this.ok({
      points,
      variable: req.variable,
      unit,
      maxDepth: 2000,
    });
  }

  // ── Discrepancy ───────────────────────────────────────────────────────────

  async fetchDiscrepancy(req: DiscrepancyRequest): Promise<ProviderResponse<DiscrepancyResult>> {
    const { bounds, variable } = req;
    const latSteps = 10;
    const lonSteps = 10;
    const latStep = (bounds.north - bounds.south) / latSteps;
    const lonStep = (bounds.east - bounds.west) / lonSteps;

    const points: DiscrepancyPoint[] = [];
    for (let i = 0; i < latSteps; i++) {
      for (let j = 0; j < lonSteps; j++) {
        const lat = bounds.south + (i + 0.5) * latStep;
        const lon = bounds.west + (j + 0.5) * lonStep;
        const depth = 100 + Math.random() * 400;
        // Error increases near coastlines and thermocline depths
        const baseError = (Math.sin(lat * 0.5) + Math.cos(lon * 0.3)) * 1.5;
        const errorMagnitude = baseError + noise(0.8);

        points.push({
          latitude: +lat.toFixed(2),
          longitude: +lon.toFixed(2),
          depth: +depth.toFixed(0) as unknown as number,
          errorMagnitude: +errorMagnitude.toFixed(2),
          variable,
        });
      }
    }

    const errors = points.map((p) => p.errorMagnitude);
    const meanError = errors.reduce((a, b) => a + b, 0) / errors.length;
    const maxError = Math.max(...errors.map(Math.abs));
    const rmsError = Math.sqrt(errors.reduce((a, b) => a + b * b, 0) / errors.length);

    return this.ok({
      points,
      stats: {
        meanError: +meanError.toFixed(2),
        maxError: +maxError.toFixed(2),
        rmsError: +rmsError.toFixed(2),
        totalPoints: points.length,
      },
    });
  }

  // ── Observations ──────────────────────────────────────────────────────────

  async fetchObservations(req: ObservationRequest): Promise<ProviderResponse<ObservationResult>> {
    const mockStations: ObservationStation[] = [
      { id: 'obs-001', latitude: 14.52, longitude: 88.76, timestamp: '2024-01-15T08:30:00Z', depth: 125, status: 'active', type: 'argo', temperature: 26.82, salinity: 34.5 },
      { id: 'obs-002', latitude: 12.30, longitude: 85.40, timestamp: '2024-01-15T09:15:00Z', depth: 200, status: 'active', type: 'argo', temperature: 24.15, salinity: 35.1 },
      { id: 'obs-003', latitude: 16.80, longitude: 90.20, timestamp: '2024-01-15T10:00:00Z', depth: 50, status: 'active', type: 'glider', temperature: 28.40, salinity: 33.8 },
      { id: 'obs-004', latitude: 10.15, longitude: 87.90, timestamp: '2024-01-15T11:45:00Z', depth: 500, status: 'active', type: 'argo', temperature: 12.30, salinity: 35.4 },
      { id: 'obs-005', latitude: 18.50, longitude: 89.60, timestamp: '2024-01-15T12:30:00Z', depth: 75, status: 'active', type: 'mooring', temperature: 27.50, salinity: 34.2 },
      { id: 'obs-006', latitude: 8.90, longitude: 82.50, timestamp: '2024-01-15T13:00:00Z', depth: 100, status: 'active', type: 'ship', temperature: 25.60, salinity: 34.8 },
      { id: 'obs-007', latitude: 15.70, longitude: 92.10, timestamp: '2024-01-15T14:20:00Z', depth: 300, status: 'pending', type: 'argo', temperature: 18.90, salinity: 35.2 },
      { id: 'obs-008', latitude: 20.30, longitude: 87.40, timestamp: '2024-01-15T15:00:00Z', depth: 25, status: 'active', type: 'glider', temperature: 29.10, salinity: 33.5 },
      { id: 'obs-009', latitude: 11.40, longitude: 90.80, timestamp: '2024-01-15T16:10:00Z', depth: 750, status: 'inactive', type: 'argo', temperature: 8.50, salinity: 35.6 },
      { id: 'obs-010', latitude: 17.20, longitude: 84.30, timestamp: '2024-01-15T17:30:00Z', depth: 150, status: 'active', type: 'mooring', temperature: 23.70, salinity: 34.9 },
    ];

    return this.ok({
      stations: mockStations,
      totalActive: mockStations.filter((s) => s.status === 'active').length,
      totalPending: mockStations.filter((s) => s.status === 'pending').length,
      region: req.region,
    });
  }

  // ── Diagnostics ───────────────────────────────────────────────────────────

  async fetchDiagnostics(req: DiagnosticRequest): Promise<ProviderResponse<DiagnosticResult>> {
    const surfaceTemp = sstFromLatitude(req.location.latitude);
    const modelTemp = temperatureAtDepth(surfaceTemp, req.depth);
    const obsTemp = temperatureAtDepth(surfaceTemp, req.depth);
    const bias = modelTemp - obsTemp;
    const isSubsurface = req.depth >= 50 && req.depth <= 500;

    const causes = [
      {
        name: 'Vertical Mixing Parameterization',
        confidence: isSubsurface ? ('medium' as const) : ('low' as const),
        evidence: [
          `Subsurface temperature bias concentrated at ${req.depth}m depth`,
          `Surface temperature relatively accurate`,
          `Persistent bias pattern across multiple time steps`,
          `Similar bias observed in adjacent grid points`,
        ],
      },
      {
        name: 'Surface Forcing Error',
        confidence: req.depth < 50 ? ('medium' as const) : ('low' as const),
        evidence: [
          'Wind stress or heat flux may be mis-specified',
          'Forcing data resolution may be insufficient',
        ],
      },
      {
        name: 'Bathymetry Resolution',
        confidence: 'low' as const,
        evidence: [
          'Bathymetric features near the selected location may affect currents',
          'Resolution may not capture important topographic effects',
        ],
      },
    ];

    const topCause = causes.reduce((best, c) => {
      const rank = { high: 3, medium: 2, low: 1 };
      return rank[c.confidence] > rank[best.confidence] ? c : best;
    });

    return this.ok({
      id: `diag-${Date.now()}`,
      errorFingerprint: isSubsurface ? 'SUBSURFACE_WARM_BIAS_MIXING' : 'SURFACE_FORCING_VARIATION',
      possibleCauses: causes,
      topCause,
      status: 'complete',
    });
  }

  // ── Workflow ──────────────────────────────────────────────────────────────

  async fetchWorkflow(_diagnosticId: string): Promise<ProviderResponse<WorkflowResult>> {
    return this.ok({
      steps: [
        { id: 'step-1', title: 'Detect', description: 'High temperature bias detected', status: 'complete' },
        { id: 'step-2', title: 'Analyze', description: 'Pattern consistent across multiple days', status: 'complete' },
        { id: 'step-3', title: 'Diagnose', description: 'Possible causes identified', status: 'active' },
        { id: 'step-4', title: 'Solutions', description: 'Recommended experiments', status: 'inactive' },
        { id: 'step-5', title: 'Evaluate', description: 'Compare results', status: 'inactive' },
      ],
      solution: {
        id: 'sol-001',
        recommendedTest: 'Alternative vertical mixing configuration (k-ω vs k-ε)',
        expectedOutcome: 'Check whether subsurface temperature error decreases while surface accuracy is maintained',
        caution: 'This diagnostic analysis does not establish causality. Results should be validated against multiple independent observations.',
        status: 'inactive',
      },
    });
  }

  // ── 3D Visualization ──────────────────────────────────────────────────────

  async fetchVisualization(req: VisualizationRequest): Promise<ProviderResponse<Visualization3DResult>> {
    const surfaceTemp = sstFromLatitude(req.location.latitude);
    const unit = req.variable === 'temperature' ? '°C' : req.variable === 'salinity' ? 'PSU' : 'm/s';

    // Surface grid (8x8 around the point)
    const gridPoints: SurfaceGridPoint[] = [];
    for (let i = -4; i < 4; i++) {
      for (let j = -4; j < 4; j++) {
        const lat = req.location.latitude + i * 0.25;
        const lon = req.location.longitude + j * 0.25;
        let value: number;
        if (req.variable === 'temperature') {
          value = temperatureAtDepth(sstFromLatitude(lat), 0) + noise(0.3);
        } else if (req.variable === 'salinity') {
          value = salinityAtDepth(0, lat) + noise(0.05);
        } else {
          value = 0.2 + Math.random() * 0.4 + noise(0.05);
        }
        gridPoints.push({ latitude: +lat.toFixed(2), longitude: +lon.toFixed(2), value: +value.toFixed(2), unit });
      }
    }

    // Depth slices
    const depths = [0, 50, 100, 200, 500, 1000];
    const depthSlices: DepthSliceData[] = depths.map((depth) => {
      let meanValue: number;
      if (req.variable === 'temperature') {
        meanValue = temperatureAtDepth(surfaceTemp, depth);
      } else if (req.variable === 'salinity') {
        meanValue = salinityAtDepth(depth, req.location.latitude);
      } else {
        meanValue = 0.3 * Math.exp(-depth / 500);
      }
      return {
        depth,
        meanValue: +(meanValue + noise(0.1)).toFixed(2),
        unit,
        gridPoints: gridPoints.slice(0, 4), // reuse surface grid as proxy
      };
    });

    // Vertical profile (same as ProfileRequest but here bundled with viz data)
    const profileDepths = [0, 10, 25, 50, 75, 100, 150, 200, 300, 400, 500, 750, 1000];
    const verticalProfile = profileDepths.map((depth) => ({
      depth,
      modelValue: +(temperatureAtDepth(surfaceTemp, depth) + noise(0.2)).toFixed(2),
      observationValue: +(temperatureAtDepth(surfaceTemp, depth) + noise(0.3)).toFixed(2),
      unit,
    }));

    return this.ok({
      variable: req.variable,
      unit,
      surfaceLayer: gridPoints,
      depthSlices,
      verticalProfile,
    });
  }

  // ── Research 3D Visualization (mock stub) ──────────────────────────────────

  async fetchResearchVisualization(req: VisualizationRequest): Promise<ProviderResponse<ResearchVisualization3DResult>> {
    const unit = req.variable === 'temperature' ? '°C' : 'PSU';
    return this.ok({
      variable: req.variable,
      unit,
      date: req.date,
      time: req.time,
      sourceModel: 'MOCK_GLORYS',
      sourceObservation: 'MOCK_ARGO',
      points: [],
      stats: {
        totalPoints: 0,
        argoMean: 0,
        glorysMean: 0,
        meanDifference: 0,
        rmsDifference: 0,
        maxDifference: 0,
        depthRange: [0, 0],
        spatialBounds: { north: 0, south: 0, east: 0, west: 0 },
      },
    });
  }
}
