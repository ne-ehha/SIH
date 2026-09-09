import { useEffect, useRef, useCallback, useState } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useOceanStore } from '@/state/oceanStore';
import { regions } from '@/config/regions';
import { fetchObservations } from '@/services/observationService';
import type { ObservationPoint } from '@/types/observation';
import { RESEARCH_DATA_COVERAGE } from '@/config/researchDataCoverage';

// Configure Cesium Ion access token from environment
const cesiumIonToken = import.meta.env.VITE_CESIUM_ION_ACCESS_TOKEN as string | undefined;
if (cesiumIonToken) {
  Cesium.Ion.defaultAccessToken = cesiumIonToken;
}

export function OceanGlobe() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const markersRef = useRef<Cesium.Entity[]>([]);
  const initialCameraSetRef = useRef(false);
  const initialRegionNavigationHandledRef = useRef(false);
  const pendingFitTriggerRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );

  const { setSelectedLocation, selectedLocation, selectedRegion, selectResearchObservation, clearSelectedObservation, selectedObservationId, selectedDate, setWorkspaceMode, fitAllObservationsTrigger } = useOceanStore();
  const [observations, setObservations] = useState<ObservationPoint[]>([]);
  const [observationsLoading, setObservationsLoading] = useState(true);
  const [viewerReady, setViewerReady] = useState(false);
  const [sceneImageryReady, setSceneImageryReady] = useState(false);

  // Fetch real observation data from the API
  useEffect(() => {
    let cancelled = false;
    setObservationsLoading(true);
    setObservations([]);

    fetchObservations(selectedRegion)
      .then((nextObservations) => {
        if (!cancelled) setObservations(nextObservations);
      })
      .catch(() => {
        if (!cancelled) setObservations([]);
      })
      .finally(() => {
        if (!cancelled) setObservationsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedRegion, selectedDate]);

  // Store observations in a ref so the click handler can access them
  const observationsRef = useRef<ObservationPoint[]>([]);

  const handleCoordinateClick = useCallback(
    (position: Cesium.Cartesian3) => {
      const cartographic = Cesium.Cartographic.fromCartesian(position);
      const lat = Cesium.Math.toDegrees(cartographic.latitude);
      const lng = Cesium.Math.toDegrees(cartographic.longitude);

      if (lat === undefined || lng === undefined) return;

      // Find the nearest real observation (from API stations or research coverage)
      const allLocations = [
        ...observationsRef.current.map(o => ({ lat: o.latitude, lng: o.longitude })),
        ...RESEARCH_DATA_COVERAGE.map(p => ({ lat: p.latitude, lng: p.longitude })),
      ];

      let nearestDist = Infinity;
      let nearestLat = lat;
      let nearestLng = lng;

      for (const loc of allLocations) {
        const dist = Math.sqrt((loc.lat - lat) ** 2 + (loc.lng - lng) ** 2);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestLat = loc.lat;
          nearestLng = loc.lng;
        }
      }

      // Snap to nearest observation if within ~200km (~1.8 degrees)
      const SNAP_THRESHOLD = 1.8;
      if (nearestDist < SNAP_THRESHOLD) {
        // This remains navigation only: it must not retain a previously selected profile.
        clearSelectedObservation();
        setSelectedLocation({ latitude: nearestLat, longitude: nearestLng });
      } else {
        clearSelectedObservation();
        // No nearby observation — just navigate (no scientific selection)
        // Don't set selectedLocation to avoid fake observation data
        console.info(`Click at ${lat.toFixed(2)}, ${lng.toFixed(2)} — no Argo profile within ${SNAP_THRESHOLD.toFixed(1)}°. Use observation markers for scientific data.`);
      }
    },
    [clearSelectedObservation, setSelectedLocation, setWorkspaceMode]
  );

  // Initialize Cesium Viewer
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    const viewer = new Cesium.Viewer(containerRef.current, {
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      selectionIndicator: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      vrButton: false,
      infoBox: false,
      useDefaultRenderLoop: true,
      targetFrameRate: 60,
    });

    // Remove default double-click zoom
    viewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    // Dark theme — matching scientific color system
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#080c16');
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0c1830');
    viewer.scene.globe.enableLighting = false;

    // Ocean-like appearance
    viewer.scene.globe.showWaterEffect = false;

    // Atmosphere
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = false;
    }

    // Track when the geographic scene is USABLE — not when every tile has
    // finished loading. Cesium may continue background tile refinement for
    // tens of seconds. We need the scene ready in ~1-2 seconds.
    //
    // Strategy:
    // 1. Primary: tileLoadProgressEvent reaches 0 (queue empty)
    // 2. Fallback: 2500ms safety cap from viewer construction
    // Either condition triggers sceneImageryReady.
    let imageryReadyFired = false;
    const viewerInitTime = Date.now();
    const MAX_IMAGERY_WAIT_MS = 2500;

    const markImageryReady = () => {
      if (imageryReadyFired) return;
      imageryReadyFired = true;
      setSceneImageryReady(true);
    };

    // Primary signal: tile queue empties
    let lastPendingTiles = -1;
    const tileLoadListener = (pendingTileCount: number) => {
      if (imageryReadyFired) return;
      if (pendingTileCount === 0 && lastPendingTiles === 0) {
        markImageryReady();
      }
      lastPendingTiles = pendingTileCount;
    };
    viewer.scene.globe.tileLoadProgressEvent.addEventListener(tileLoadListener);

    // Fallback: time cap + at least one rendered frame.
    // postRender fires after each frame is rendered, confirming the scene
    // is actually drawing. Combined with the time cap, this ensures the
    // veil disappears once the scene is both rendered and has had enough
    // time for initial tiles to arrive.
    const postRenderListener = () => {
      if (imageryReadyFired) return;
      if (Date.now() - viewerInitTime >= MAX_IMAGERY_WAIT_MS) {
        markImageryReady();
      }
    };
    viewer.scene.postRender.addEventListener(postRenderListener);

    // Click handler — consolidated: checks observation markers first,
    // then falls back to coordinate picking with snap-to-nearest.
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(
      (movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        // First: check if the user clicked on an observation marker
        const picked = viewer.scene.pick(movement.position);
        if (Cesium.defined(picked) && picked.id && picked.id.properties) {
          const obsId = picked.id.properties.observationId?.getValue();
          if (obsId) {
            const obs = observationsRef.current.find((o) => o.id === obsId);
            if (obs) {
              selectResearchObservation({
                id: obsId,
                location: { latitude: obs.latitude, longitude: obs.longitude },
                date: obs.timestamp.substring(0, 10),
              });
              setWorkspaceMode('research');
              return; // Observation marker clicked — done
            }
          }

          // Check if clicked on a research coverage location marker
          const isCoverage = picked.id.properties.isCoverageLocation?.getValue();
          if (isCoverage) {
            const covIdx = picked.id.properties.coverageIndex?.getValue();
            if (covIdx !== undefined && covIdx < RESEARCH_DATA_COVERAGE.length) {
              const cov = RESEARCH_DATA_COVERAGE[covIdx];
              // Find the nearest API observation to this coverage location
              const nearestObs = observationsRef.current.find((o) => {
                const dist = Math.sqrt(
                  (o.latitude - cov.latitude) ** 2 + (o.longitude - cov.longitude) ** 2
                );
                return dist < 2.0;
              });
              if (nearestObs) {
                selectResearchObservation({
                  id: nearestObs.id,
                  location: { latitude: nearestObs.latitude, longitude: nearestObs.longitude },
                  date: nearestObs.timestamp.substring(0, 10),
                });
              } else {
                // No API station nearby — set location but no observation ID
                // This prevents fake observation selection
                clearSelectedObservation();
                setSelectedLocation({ latitude: cov.latitude, longitude: cov.longitude });
              }
              setWorkspaceMode('research');
              return;
            }
          }
        }

        // Second: no marker clicked — pick coordinates and snap to nearest
        const cartesian = viewer.camera.pickEllipsoid(
          movement.position,
          viewer.scene.globe.ellipsoid
        );
        if (cartesian) {
          handleCoordinateClick(cartesian);
        }
      },
      Cesium.ScreenSpaceEventType.LEFT_CLICK
    );

    viewerRef.current = viewer;
    setViewerReady(true);

    return () => {
      handler.destroy();
      viewer.scene.globe.tileLoadProgressEvent.removeEventListener(tileLoadListener);
      viewer.scene.postRender.removeEventListener(postRenderListener);
      viewer.destroy();
      viewerRef.current = null;
      setViewerReady(false);
      setSceneImageryReady(false);
    };
  }, [handleCoordinateClick, selectResearchObservation, setWorkspaceMode]);

  const fitCameraToPoints = useCallback((sourceObservations: ObservationPoint[]) => {
    const viewer = viewerRef.current;
    if (!viewer) return false;

    const allLocations = [
      ...sourceObservations.map((observation) => ({
        latitude: observation.latitude,
        longitude: observation.longitude,
      })),
      ...RESEARCH_DATA_COVERAGE.map((coverage) => ({
        latitude: coverage.latitude,
        longitude: coverage.longitude,
      })),
    ].filter(({ latitude, longitude }) =>
      Number.isFinite(latitude) && Number.isFinite(longitude) &&
      latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
    );

    if (allLocations.length === 0) return false;

    const latitudes = allLocations.map(({ latitude }) => latitude);
    const longitudes = allLocations.map(({ longitude }) => longitude);
    const minLatitude = Math.min(...latitudes);
    const maxLatitude = Math.max(...latitudes);
    const minLongitude = Math.min(...longitudes);
    const maxLongitude = Math.max(...longitudes);
    const latitudePadding = Math.max((maxLatitude - minLatitude) * 0.12, 0.5);
    const longitudePadding = Math.max((maxLongitude - minLongitude) * 0.12, 0.5);

    // Use setView (instant) instead of flyTo (animated) to avoid triggering
    // expensive intermediate tile loading during camera animation.
    viewer.camera.setView({
      destination: Cesium.Rectangle.fromDegrees(
        minLongitude - longitudePadding,
        minLatitude - latitudePadding,
        maxLongitude + longitudePadding,
        maxLatitude + latitudePadding
      ),
    });
    return true;
  }, []);

  // Smooth camera transition for user-triggered Fit Observations.
  // Uses flyTo with a short duration. Respects prefers-reduced-motion.
  const flyCameraToPoints = useCallback((sourceObservations: ObservationPoint[]) => {
    const viewer = viewerRef.current;
    if (!viewer) return false;

    const allLocations = [
      ...sourceObservations.map((observation) => ({
        latitude: observation.latitude,
        longitude: observation.longitude,
      })),
      ...RESEARCH_DATA_COVERAGE.map((coverage) => ({
        latitude: coverage.latitude,
        longitude: coverage.longitude,
      })),
    ].filter(({ latitude, longitude }) =>
      Number.isFinite(latitude) && Number.isFinite(longitude) &&
      latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
    );

    if (allLocations.length === 0) return false;

    const latitudes = allLocations.map(({ latitude }) => latitude);
    const longitudes = allLocations.map(({ longitude }) => longitude);
    const minLatitude = Math.min(...latitudes);
    const maxLatitude = Math.max(...latitudes);
    const minLongitude = Math.min(...longitudes);
    const maxLongitude = Math.max(...longitudes);
    const latitudePadding = Math.max((maxLatitude - minLatitude) * 0.12, 0.5);
    const longitudePadding = Math.max((maxLongitude - minLongitude) * 0.12, 0.5);

    const duration = reducedMotionRef.current ? 0 : 1;
    viewer.camera.flyTo({
      destination: Cesium.Rectangle.fromDegrees(
        minLongitude - longitudePadding,
        minLatitude - latitudePadding,
        maxLongitude + longitudePadding,
        maxLatitude + latitudePadding
      ),
      duration,
    });
    return true;
  }, []);

  // The initial view is driven by the loaded evidence extent, not a second
  // hardcoded camera command that can override it.
  useEffect(() => {
    if (!viewerReady || initialCameraSetRef.current) return;
    if (fitCameraToPoints(observations)) initialCameraSetRef.current = true;
  }, [fitCameraToPoints, observations, observationsLoading, viewerReady]);

  // Fit only after the requested observation fetch has settled, so the fit
  // always uses the latest API coordinates plus the visible coverage sites.
  // User-triggered fit uses flyTo for a smooth transition.
  useEffect(() => {
    if (fitAllObservationsTrigger === 0) return;
    pendingFitTriggerRef.current = fitAllObservationsTrigger;
    if (!observationsLoading && flyCameraToPoints(observations)) {
      pendingFitTriggerRef.current = null;
    }
  }, [fitAllObservationsTrigger, flyCameraToPoints, observations, observationsLoading]);

  // Complete a fit request that arrived while the API observations were loading.
  useEffect(() => {
    if (observationsLoading || pendingFitTriggerRef.current === null) return;
    if (flyCameraToPoints(observations)) pendingFitTriggerRef.current = null;
  }, [flyCameraToPoints, observations, observationsLoading]);

  // Preserve intentional region navigation without overriding the evidence-
  // driven initial camera for the default region.
  useEffect(() => {
    if (!viewerReady) return;
    if (!initialRegionNavigationHandledRef.current) {
      initialRegionNavigationHandledRef.current = true;
      return;
    }
    // Do not fly to region until the initial camera has been set,
    // otherwise this overrides the evidence-driven initial view.
    if (!initialCameraSetRef.current) return;

    const viewer = viewerRef.current;
    const region = regions.find((candidate) => candidate.id === selectedRegion);
    if (!viewer || !region) return;

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        region.center.longitude,
        region.center.latitude,
        region.defaultZoom
      ),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-55),
        roll: 0,
      },
      duration: 1,
    });
  }, [selectedRegion, viewerReady]);

  // Update observationsRef when observations change
  useEffect(() => {
    observationsRef.current = observations;
  }, [observations]);

  // Show observation points — API stations + research coverage locations
  // Only show after both viewer AND imagery are ready
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !sceneImageryReady) return;

    // Remove existing observation markers
    markersRef.current.forEach((entity) => viewer.entities.remove(entity));
    markersRef.current = [];

    // Render API observation stations (typically 3-5 per date)
    observations.forEach((obs) => {
      const color =
        obs.status === 'active'
          ? Cesium.Color.fromCssColorString('#22d3ee')  // Argo cyan
          : obs.status === 'pending'
          ? Cesium.Color.YELLOW
          : Cesium.Color.GRAY;

      const isSelected = selectedObservationId === obs.id;

      const entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(obs.longitude, obs.latitude, 0),
        point: {
          pixelSize: isSelected ? 14 : 10,
          color: isSelected ? Cesium.Color.fromCssColorString('#fbbf24') : color,
          outlineColor: Cesium.Color.WHITE.withAlpha(isSelected ? 0.9 : 0.6),
          outlineWidth: isSelected ? 2 : 1,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
        label: {
          text: obs.id.replace('argo_', 'ARGO '),
          font: '11px monospace',
          fillColor: Cesium.Color.WHITE.withAlpha(0.9),
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          outlineColor: Cesium.Color.BLACK,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -16),
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString('#0d1b3e').withAlpha(0.85),
          backgroundPadding: new Cesium.Cartesian2(4, 2),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: {
          observationId: obs.id,
        },
      });

      markersRef.current.push(entity);
    });

    // Render research data coverage locations (real Argo profile sites)
    // These are unique geographic positions where collocation data exists.
    // They use a lighter style to distinguish from API-return stations.
    const apiLats = new Set(observations.map((o) => `${o.latitude.toFixed(2)},${o.longitude.toFixed(2)}`));

    RESEARCH_DATA_COVERAGE.forEach((cov, idx) => {
      const key = `${cov.latitude.toFixed(2)},${cov.longitude.toFixed(2)}`;
      // Skip if an API station already exists at this exact location
      if (apiLats.has(key)) return;

      const entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(cov.longitude, cov.latitude, 0),
        point: {
          pixelSize: 7,
          color: Cesium.Color.fromCssColorString('#22d3ee').withAlpha(0.55),
          outlineColor: Cesium.Color.fromCssColorString('#22d3ee').withAlpha(0.8),
          outlineWidth: 1,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
        label: {
          text: `${cov.latitude.toFixed(2)}°, ${cov.longitude.toFixed(2)}°`,
          font: '10px monospace',
          fillColor: Cesium.Color.WHITE.withAlpha(0.7),
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 1,
          outlineColor: Cesium.Color.BLACK,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -13),
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString('#0d1b3e').withAlpha(0.7),
          backgroundPadding: new Cesium.Cartesian2(3, 1),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,

        },
        properties: {
          coverageIndex: idx,
          isCoverageLocation: true,
        },
      });

      markersRef.current.push(entity);
    });
  }, [observations, selectedObservationId, sceneImageryReady]);

  // Show selected coordinate marker
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // Remove existing selected marker
    const existingSelected = viewer.entities.values.find(
      (e) => e.id === 'selected-marker'
    );
    if (existingSelected) {
      viewer.entities.remove(existingSelected);
    }

    if (selectedLocation) {
      viewer.entities.add({
        id: 'selected-marker',
        position: Cesium.Cartesian3.fromDegrees(
          selectedLocation.longitude,
          selectedLocation.latitude,
          0
        ),
        point: {
          pixelSize: 14,
          color: Cesium.Color.fromCssColorString('#a855f7').withAlpha(0.9),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
        label: {
          text: `${selectedLocation.latitude.toFixed(2)}° ${selectedLocation.latitude >= 0 ? 'N' : 'S'}, ${selectedLocation.longitude.toFixed(2)}° ${selectedLocation.longitude >= 0 ? 'E' : 'W'}`,
          font: '12px sans-serif',
          fillColor: Cesium.Color.WHITE,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          outlineColor: Cesium.Color.BLACK,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -20),
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString('#a855f7').withAlpha(0.85),
          backgroundPadding: new Cesium.Cartesian2(6, 4),
        },
      });
    }
  }, [selectedLocation]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      
      {/* Geographic context loading veil */}
      {!sceneImageryReady && viewerReady && (
        <div 
          className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
          style={{ 
            background: 'rgba(8,12,22,0.7)',
            transition: 'opacity 0.4s ease-out'
          }}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="text-[11px] tracking-wide uppercase text-[var(--os-text-3)]">
              Preparing Geographic Context
            </div>
            <div className="w-16 h-0.5 bg-[var(--os-border)] overflow-hidden">
              <div 
                className="h-full bg-[var(--os-accent)]"
                style={{
                  animation: 'globe-loading-pulse 1.5s ease-in-out infinite'
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Globe overlay hint */}
      <div className="absolute bottom-2 left-2 px-2 py-1 text-[9px] text-[var(--os-text-muted)]" style={{ background: 'rgba(8,12,22,0.85)' }}>
        Click observation marker to select · Click near marker to snap
      </div>
    </div>
  );
}
