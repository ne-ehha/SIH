import { useEffect, useRef, useCallback, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useOceanStore } from '@/state/oceanStore';
import { regions } from '@/config/regions';
import { fetchObservations } from '@/services/observationService';
import { fetchDatasetProfiles } from '@/services/observationDiscoveryService';
import { getDatasetVisualConfig } from '@/config/datasetVisualConfig';
import type { ObservationPoint } from '@/types/observation';
import { useLatestDataStream } from '@/hooks/useLatestDataStream';
import { LATEST_ARGO_DENIM_GREEN, type LatestArgoObservation } from '@/services/latestDataStream';

// Configure Cesium Ion access token from environment
const cesiumIonToken = import.meta.env.VITE_CESIUM_ION_ACCESS_TOKEN as string | undefined;
if (cesiumIonToken) {
  Cesium.Ion.defaultAccessToken = cesiumIonToken;
}

export function OceanGlobe() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const markersRef = useRef<Cesium.Entity[]>([]);
  const latestArgoEntitiesRef = useRef(new Map<string, Cesium.Entity>());
  const latestArgoRef = useRef<LatestArgoObservation[]>([]);
  const initialCameraSetRef = useRef(false);
  const initialRegionNavigationHandledRef = useRef(false);
  const pendingFitTriggerRef = useRef<number | null>(null);
  const inactivityTimerRef = useRef<number | null>(null);
  const autoRotationActiveRef = useRef(false);
  const applyingAutoRotationRef = useRef(false);
  const reducedMotionRef = useRef(
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );

  const { selectedLocation, selectedRegion, selectResearchObservation, clearSelectedObservation, selectedObservationId, selectedDate, selectedPlatform, fitAllObservationsTrigger, activeLayers } = useOceanStore();

  // Layer manager (SIH26067): observation layer visibility + opacity are real controls.
  const observationsLayer = activeLayers.find((l) => l.id === 'observations');
  const observationsVisible = observationsLayer?.enabled ?? true;
  const observationsOpacity = observationsLayer?.opacity ?? 1;
  const [observations, setObservations] = useState<ObservationPoint[]>([]);
  const [observationsLoading, setObservationsLoading] = useState(true);
  const [viewerReady, setViewerReady] = useState(false);
  const [sceneImageryReady, setSceneImageryReady] = useState(false);
  const [selectedLatestArgo, setSelectedLatestArgo] = useState<LatestArgoObservation | null>(null);
  const latestStream = useLatestDataStream();

  const resetAutoRotation = useCallback(() => {
    autoRotationActiveRef.current = false;
    if (inactivityTimerRef.current !== null) window.clearTimeout(inactivityTimerRef.current);
    if (!reducedMotionRef.current) {
      inactivityTimerRef.current = window.setTimeout(() => {
        autoRotationActiveRef.current = true;
      }, 3000);
    }
  }, []);

  const zoomCamera = useCallback((direction: 'in' | 'out') => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    resetAutoRotation();
    const distance = Math.max(viewer.camera.positionCartographic.height * 0.18, 25000);
    if (direction === 'in') viewer.camera.zoomIn(distance);
    else viewer.camera.zoomOut(distance);
  }, [resetAutoRotation]);

  // Fetch real observation data from the API
  useEffect(() => {
    let cancelled = false;
    setObservationsLoading(true);
    setObservations([]);

    fetchDatasetProfiles(selectedPlatform, 'HISTORICAL_RESEARCH')
      .then((res) => {
        if (cancelled) return;
        const mapType = (pt?: string): 'argo' | 'glider' | 'mooring' | 'ship' | 'ctd' | 'bgc' => {
          const lower = (pt || '').toLowerCase();
          if (lower.includes('bgc')) return 'bgc';
          if (lower.includes('glider')) return 'glider';
          if (lower.includes('ctd')) return 'ctd';
          if (lower.includes('ship')) return 'ship';
          if (lower.includes('mooring')) return 'mooring';
          return 'argo';
        };
        const raw = res.profiles || [];
        const pts: ObservationPoint[] = raw.map((p) => ({
          id: p.profile_id,
          latitude: p.latitude,
          longitude: p.longitude,
          timestamp: p.observation_time,
          depth: p.max_depth,
          status: 'active',
          type: mapType(p.platform_type),
          platform_type: (p.platform_type?.toUpperCase() as any) || 'ARGO',
        }));
        setObservations(pts);
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
  }, [selectedPlatform, selectedRegion]);

  // Store observations in a ref so the click handler can access them
  const observationsRef = useRef<ObservationPoint[]>([]);

  // Arbitrary globe clicks are navigation-only. They must NOT create
  // scientific observations or set selectedLocation. Only clicking an actual
  // observation marker may activate profile inspection.
  const handleCoordinateClick = useCallback(
    (_position: Cesium.Cartesian3) => {
      // Intentionally empty: arbitrary clicks are navigation-only.
      // Scientific selection requires clicking an observation marker.
    },
    []
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

    const onTick = () => {
      if (!autoRotationActiveRef.current || reducedMotionRef.current) return;
      applyingAutoRotationRef.current = true;
      viewer.camera.rotate(Cesium.Cartesian3.UNIT_Z, Cesium.Math.toRadians(0.006));
      applyingAutoRotationRef.current = false;
    };
    viewer.clock.onTick.addEventListener(onTick);

    const onUserInteraction = () => {
      if (!applyingAutoRotationRef.current) resetAutoRotation();
    };
    const interactionEvents: Array<keyof HTMLElementEventMap> = ['pointerdown', 'wheel', 'touchstart', 'keydown'];
    interactionEvents.forEach((eventName) => viewer.canvas.addEventListener(eventName, onUserInteraction, { passive: true }));
    viewer.camera.moveStart.addEventListener(onUserInteraction);
    viewer.camera.moveEnd.addEventListener(onUserInteraction);
    resetAutoRotation();

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
          const latestProfileId = picked.id.properties.latestArgoProfileId?.getValue();
          if (latestProfileId) {
            const profile = latestArgoRef.current.find((item) => item.profile_id === latestProfileId);
            if (profile) {
              setSelectedLatestArgo(profile);
              selectResearchObservation({ id: `latest_argo_${profile.platform_id}_${profile.cycle_number ?? profile.profile_id}`, location: { latitude: profile.latitude, longitude: profile.longitude }, date: profile.observation_time.substring(0, 10) });
              return;
            }
          }
          const obsId = picked.id.properties.observationId?.getValue();
          if (obsId) {
            const obs = observationsRef.current.find((o) => o.id === obsId);
            if (obs) {
              // Select the observation and show it in the panel.
              // Do NOT auto-navigate to Research — user must explicitly choose Inspect.
              selectResearchObservation({
                id: obsId,
                location: { latitude: obs.latitude, longitude: obs.longitude },
                date: obs.timestamp.substring(0, 10),
              });
              return; // Observation marker clicked — selection shown in panel
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
      viewer.clock.onTick.removeEventListener(onTick);
      interactionEvents.forEach((eventName) => viewer.canvas.removeEventListener(eventName, onUserInteraction));
      viewer.camera.moveStart.removeEventListener(onUserInteraction);
      viewer.camera.moveEnd.removeEventListener(onUserInteraction);
      if (inactivityTimerRef.current !== null) window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
      autoRotationActiveRef.current = false;
      applyingAutoRotationRef.current = false;
      viewer.destroy();
      viewerRef.current = null;
      setViewerReady(false);
      setSceneImageryReady(false);
    };
  }, [handleCoordinateClick, selectResearchObservation, clearSelectedObservation, resetAutoRotation]);

  const fitCameraToPoints = useCallback((sourceObservations: ObservationPoint[]) => {
    const viewer = viewerRef.current;
    if (!viewer) return false;

    const allLocations = sourceObservations.map((observation) => ({
      latitude: observation.latitude,
      longitude: observation.longitude,
    })).filter(({ latitude, longitude }) =>
      Number.isFinite(latitude) && Number.isFinite(longitude) &&
      latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
    );

    if (allLocations.length === 0) {
      // Default Bay of Bengal bounding box
      viewer.camera.setView({
        destination: Cesium.Rectangle.fromDegrees(78.0, 5.0, 95.0, 23.0),
      });
      return true;
    }

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

    const allLocations = sourceObservations.map((observation) => ({
      latitude: observation.latitude,
      longitude: observation.longitude,
    })).filter(({ latitude, longitude }) =>
      Number.isFinite(latitude) && Number.isFinite(longitude) &&
      latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
    );

    if (allLocations.length === 0) {
      // Default Bay of Bengal bounding box
      viewer.camera.flyTo({
        destination: Cesium.Rectangle.fromDegrees(78.0, 5.0, 95.0, 23.0),
        duration: reducedMotionRef.current ? 0 : 1,
      });
      return true;
    }

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

  // A stable, diffed layer for real latest-available Argo profiles. Updating
  // entities is intentionally camera-free: data refreshes never navigate the globe.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !sceneImageryReady) return;
    latestArgoRef.current = latestStream.observations;
    const desired = new Set(latestStream.observations.map((profile) => `latest-argo-${profile.profile_id}`));
    latestArgoEntitiesRef.current.forEach((entity, id) => {
      if (!desired.has(id)) { viewer.entities.remove(entity); latestArgoEntitiesRef.current.delete(id); }
    });
    latestStream.observations.forEach((profile) => {
      const id = `latest-argo-${profile.profile_id}`;
      const existing = latestArgoEntitiesRef.current.get(id);
      if (existing) { existing.position = new Cesium.ConstantPositionProperty(Cesium.Cartesian3.fromDegrees(profile.longitude, profile.latitude, 0)); return; }
      latestArgoEntitiesRef.current.set(id, viewer.entities.add({
        id, position: Cesium.Cartesian3.fromDegrees(profile.longitude, profile.latitude, 0),
        point: { pixelSize: 11, color: Cesium.Color.fromCssColorString(LATEST_ARGO_DENIM_GREEN).withAlpha(0.96), outlineColor: Cesium.Color.fromCssColorString('#a7d2c2').withAlpha(0.9), outlineWidth: 2, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
        label: { text: `ARGO ${profile.platform_id} · ${profile.cycle_number ?? '—'}`, font: '10px monospace', fillColor: Cesium.Color.fromCssColorString('#cfe6dc'), style: Cesium.LabelStyle.FILL_AND_OUTLINE, outlineColor: Cesium.Color.BLACK, outlineWidth: 2, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -15), showBackground: true, backgroundColor: Cesium.Color.fromCssColorString('#173c32').withAlpha(0.85), backgroundPadding: new Cesium.Cartesian2(4, 2), disableDepthTestDistance: Number.POSITIVE_INFINITY },
        properties: { latestArgoProfileId: profile.profile_id, source: 'Argo GDAC', observationTime: profile.observation_time, retrievedAt: profile.provenance.retrieved_at },
      }));
    });
  }, [latestStream.observations, sceneImageryReady]);

  // Show observation points — API stations + research coverage locations
  // Only show after both viewer AND imagery are ready
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !sceneImageryReady) return;

    // Remove existing observation markers
    markersRef.current.forEach((entity) => viewer.entities.remove(entity));
    markersRef.current = [];

    // Render real in-situ observation stations adapted to selected dataset/platform
    observations.forEach((obs) => {
      if (!observationsVisible) return; // layer manager visibility
      const visual = getDatasetVisualConfig(obs.type || obs.platform_type);
      const platColor = Cesium.Color.fromCssColorString(visual.hex);
      const isSelected = selectedObservationId === obs.id;

      const labelText = obs.id
        .replace('argo_dm_', 'ARGO ')
        .replace('argo_', 'ARGO ')
        .replace('bgc_argo_', 'BGC ')
        .replace('glider_', 'GLIDER ')
        .replace('ctd_', 'CTD ');

      const entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(obs.longitude, obs.latitude, 0),
        point: {
          pixelSize: isSelected ? 14 : 10,
          color: (isSelected ? Cesium.Color.fromCssColorString('#fbbf24') : platColor).withAlpha(observationsOpacity),
          outlineColor: Cesium.Color.WHITE.withAlpha(isSelected ? 0.95 : 0.7),
          outlineWidth: isSelected ? 2 : 1,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
        label: {
          text: labelText,
          font: '11px monospace',
          fillColor: Cesium.Color.WHITE.withAlpha(0.95),
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          outlineColor: Cesium.Color.BLACK,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -16),
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString('#0a101f').withAlpha(0.9),
          backgroundPadding: new Cesium.Cartesian2(4, 2),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: {
          observationId: obs.id,
        },
      });

      markersRef.current.push(entity);
    });
  }, [observations, selectedObservationId, sceneImageryReady, observationsVisible, observationsOpacity]);

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

      <div className="absolute right-3 top-3 z-20 flex flex-col overflow-hidden border border-slate-700/80 bg-[#08111f]/90 shadow-lg backdrop-blur-sm">
        <button type="button" onClick={() => zoomCamera('in')} className="flex h-8 w-8 items-center justify-center border-b border-slate-700/80 text-slate-300 transition hover:bg-cyan-950/60 hover:text-cyan-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" aria-label="Zoom in on globe" title="Zoom in"><Plus className="h-4 w-4" /></button>
        <button type="button" onClick={() => zoomCamera('out')} className="flex h-8 w-8 items-center justify-center text-slate-300 transition hover:bg-cyan-950/60 hover:text-cyan-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" aria-label="Zoom out on globe" title="Zoom out"><Minus className="h-4 w-4" /></button>
      </div>
      
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

      {latestStream.observations.length > 0 && <div className="absolute bottom-8 left-2 border border-[#3F7F6A]/70 bg-[#08111f]/90 px-2 py-1 text-[10px] text-slate-300"><span className="text-[#83b7a4]">● Latest Argo observations</span> · Argo GDAC</div>}
      {selectedLatestArgo && (
        <div className="absolute bottom-3 right-3 z-20 w-72 border border-[#3F7F6A]/70 bg-[#08111f]/95 p-3 text-[11px] text-slate-300 shadow-xl rounded backdrop-blur-sm">
          <button type="button" className="float-right text-slate-400 hover:text-slate-100 text-sm cursor-pointer" onClick={() => setSelectedLatestArgo(null)}>×</button>
          <div className="font-mono text-[10px] uppercase tracking-wider text-[#83b7a4] font-semibold">Latest Argo observation</div>
          <div className="mt-1 font-semibold text-slate-100">Float {selectedLatestArgo.platform_id} · Cycle {selectedLatestArgo.cycle_number ?? '—'}</div>
          <div className="text-slate-400 font-mono text-[10px]">{selectedLatestArgo.latitude.toFixed(4)}° {selectedLatestArgo.latitude >= 0 ? 'N' : 'S'} · {selectedLatestArgo.longitude.toFixed(4)}° {selectedLatestArgo.longitude >= 0 ? 'E' : 'W'}</div>
          <div className="mt-1 text-slate-300">Observed: {new Date(selectedLatestArgo.observation_time).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC</div>
          <div className="text-slate-400 text-[10px]">Variables: Temperature · Salinity ({selectedLatestArgo.levels.length} levels)</div>

          {/* Copernicus Collocation Section */}
          <div className="mt-2 border-t border-slate-800 pt-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold text-teal-400">COPERNICUS OPERATIONAL MODEL</span>
              <span className="rounded bg-teal-950 px-1 py-0.2 text-[8px] font-mono text-teal-300 border border-teal-800/60">
                {latestStream.copernicus?.available ? 'COLLOCATED' : 'AVAILABLE'}
              </span>
            </div>
            {latestStream.copernicus?.available ? (
              <div className="mt-1 space-y-0.5 text-[10px] text-slate-400">
                <div>Model grid match: <span className="text-slate-200">{latestStream.copernicus.collocation?.horizontal_distance_km ?? 0} km</span> offset</div>
                <div>Time offset: <span className="text-slate-200">{latestStream.copernicus.collocation?.temporal_offset_hours ?? 0} hrs</span></div>
                <div>Model parameters: <span className="text-slate-300">θ, S, u, v, Currents, Chl-a, O₂, NO₃, SSH, MLD</span></div>
              </div>
            ) : (
              <div className="mt-1 text-[10px] text-amber-300/90">
                Operational server connection active (0.083° PHY + 0.25° BGC).
              </div>
            )}
          </div>
        </div>
      )}

      {/* Globe instruction hint */}
      <div className="absolute bottom-2 left-2 px-2 py-1 text-[9px]" style={{ background: 'rgba(8,12,22,0.85)', color: 'var(--os-text-muted)' }}>
        Click a cyan marker to select an Argo observation · Arbitrary clicks are navigation only
      </div>
    </div>
  );
}
