import { useEffect, useRef, useCallback, useState } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useOceanStore } from '@/state/oceanStore';
import { regions } from '@/config/regions';
import { fetchObservations } from '@/services/observationService';
import type { ObservationPoint } from '@/types/observation';

// Configure Cesium Ion access token from environment
const cesiumIonToken = import.meta.env.VITE_CESIUM_ION_ACCESS_TOKEN as string | undefined;
if (cesiumIonToken) {
  Cesium.Ion.defaultAccessToken = cesiumIonToken;
}

export function OceanGlobe() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const markersRef = useRef<Cesium.Entity[]>([]);

  const { setSelectedLocation, selectedLocation, selectedRegion, setSelectedObservationId } = useOceanStore();
  const [observations, setObservations] = useState<ObservationPoint[]>([]);

  // Fetch real observation data from the API
  useEffect(() => {
    fetchObservations(selectedRegion)
      .then(setObservations)
      .catch(() => setObservations([]));
  }, [selectedRegion]);

  const handleCoordinateClick = useCallback(
    (position: Cesium.Cartesian3) => {
      const cartographic = Cesium.Cartographic.fromCartesian(position);
      const lat = Cesium.Math.toDegrees(cartographic.latitude);
      const lng = Cesium.Math.toDegrees(cartographic.longitude);

      if (lat !== undefined && lng !== undefined) {
        setSelectedLocation({ latitude: lat, longitude: lng });
      }
    },
    [setSelectedLocation]
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

    // Dark theme
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0a0e1a');
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0d1b3e');
    viewer.scene.globe.enableLighting = false;

    // Ocean-like appearance
    viewer.scene.globe.showWaterEffect = false;

    // Atmosphere
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = false;
    }

    // Smooth camera
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(88.0, 15.0, 5000000),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-45),
        roll: 0,
      },
      duration: 0,
    });

    // Click handler — use pickEllipsoid for reliable coordinate picking
    // (globe.pick depends on terrain tile loading and can return null)
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(
      (movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
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

    return () => {
      handler.destroy();
      viewer.destroy();
      viewerRef.current = null;
    };
  }, [handleCoordinateClick]);

  // Update camera when region changes
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const region = regions.find((r) => r.id === selectedRegion);
    if (!region) return;

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        region.center.longitude,
        region.center.latitude,
        region.defaultZoom
      ),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-45),
        roll: 0,
      },
      duration: 2,
    });
  }, [selectedRegion]);

  // Show observation points
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // Remove existing observation markers
    markersRef.current.forEach((entity) => viewer.entities.remove(entity));
    markersRef.current = [];

    // Add observation points from real API data
    observations.forEach((obs) => {
      const color =
        obs.status === 'active'
          ? Cesium.Color.CYAN
          : obs.status === 'pending'
          ? Cesium.Color.YELLOW
          : Cesium.Color.GRAY;

      const entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(obs.longitude, obs.latitude, obs.depth),
        point: {
          pixelSize: 8,
          color: color,
          outlineColor: Cesium.Color.WHITE.withAlpha(0.5),
          outlineWidth: 1,
          heightReference: Cesium.HeightReference.NONE,
        },
        label: {
          text: `Obs: ${obs.id}`,
          font: '10px sans-serif',
          fillColor: Cesium.Color.WHITE.withAlpha(0.8),
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          outlineColor: Cesium.Color.BLACK,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -12),
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString('#0d1b3e').withAlpha(0.8),
          backgroundPadding: new Cesium.Cartesian2(4, 2),
        },
        properties: {
          observationId: obs.id,
        },
      });

      markersRef.current.push(entity);
    });

    // Click handler for observation points
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(
      (movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        const picked = viewer.scene.pick(movement.position);
        if (Cesium.defined(picked) && picked.id && picked.id.properties) {
          const obsId = picked.id.properties.observationId?.getValue();
          if (obsId) {
            setSelectedObservationId(obsId);
            const obs = observations.find((o) => o.id === obsId);
            if (obs) {
              setSelectedLocation({ latitude: obs.latitude, longitude: obs.longitude });
            }
          }
        }
      },
      Cesium.ScreenSpaceEventType.LEFT_CLICK
    );

    return () => {
      handler.destroy();
    };
  }, [setSelectedLocation, setSelectedObservationId, observations]);

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
      {/* Globe overlay info */}
      <div className="absolute bottom-4 left-4 rounded-lg border border-slate-700/50 bg-[#0d1224]/80 px-3 py-2 backdrop-blur-md">
        <p className="text-[10px] text-slate-500">
          Click anywhere on the ocean to select a coordinate
        </p>
      </div>
    </div>
  );
}
