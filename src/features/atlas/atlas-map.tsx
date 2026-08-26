"use client";

import * as React from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AtlasRecord } from "@/lib/atlas-workspace";

type AtlasMapProps = {
  records: AtlasRecord[];
  selectedRecordId: string | null;
  resetRevision: number;
  onSelect: (id: string) => void;
  onFailure: (reason: "startup" | "resource") => void;
};

const RESOURCE_OBSERVATION_WINDOW_MS = 4000;
const RESOURCE_FAILURE_THRESHOLD = 2;
const RESOURCE_FAILURE_CONFIRMATION_DELAY_MS = 1500;
const BASEMAP_STARTUP_TIMEOUT_MS = 15_000;

export function AtlasMap({ records, selectedRecordId, resetRevision, onSelect, onFailure }: AtlasMapProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<MapLibreMap | null>(null);
  const markersRef = React.useRef<maplibregl.Marker[]>([]);
  const initialRecordsRef = React.useRef(true);
  const onFailureRef = React.useRef(onFailure);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => { onFailureRef.current = onFailure; }, [onFailure]);

  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    maplibregl.setWorkerUrl(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/maplibre/maplibre-gl-worker.mjs`);
    containerRef.current.dataset.basemapReady = "false";
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/bright",
      center: [-30, 24],
      zoom: 1.25,
      minZoom: 0.8,
      maxZoom: 13,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
    let styleReady = false;
    let failureReported = false;
    let resourceErrors: number[] = [];
    let resourceSuccesses: number[] = [];
    let resourceFailureTimer: number | null = null;
    const reportFailure = (reason: "startup" | "resource" = "resource") => {
      if (failureReported) return;
      failureReported = true;
      onFailureRef.current(reason);
    };
    const handleMapError = () => {
      const now = Date.now();
      resourceErrors = [
        ...resourceErrors.filter((timestamp) => now - timestamp < RESOURCE_OBSERVATION_WINDOW_MS),
        now,
      ];
      if (resourceErrors.length < RESOURCE_FAILURE_THRESHOLD || resourceFailureTimer !== null) return;
      resourceFailureTimer = window.setTimeout(() => {
        resourceFailureTimer = null;
        const cutoff = Date.now() - RESOURCE_OBSERVATION_WINDOW_MS;
        resourceErrors = resourceErrors.filter((timestamp) => timestamp >= cutoff);
        resourceSuccesses = resourceSuccesses.filter((timestamp) => timestamp >= cutoff);
        if (resourceErrors.length >= RESOURCE_FAILURE_THRESHOLD && resourceSuccesses.length === 0) reportFailure();
      }, RESOURCE_FAILURE_CONFIRMATION_DELAY_MS);
    };
    const handleSourceData = (event: maplibregl.MapSourceDataEvent) => {
      if (event.sourceDataType !== "content" || !event.tile) return;
      const now = Date.now();
      resourceSuccesses = [
        ...resourceSuccesses.filter((timestamp) => now - timestamp < RESOURCE_OBSERVATION_WINDOW_MS),
        now,
      ];
    };
    const styleTimeout = window.setTimeout(() => {
      if (!styleReady) reportFailure();
    }, 8000);
    // A loaded style and HTML markers do not prove the worker drew geography.
    // Worker startup can stall without emitting MapLibre resource errors.
    const basemapTimeout = window.setTimeout(() => reportFailure("startup"), BASEMAP_STARTUP_TIMEOUT_MS);
    const handleRender = () => {
      if (!styleReady) return;
      const hasGeography = map.queryRenderedFeatures().some((feature) => feature.source === "openmaptiles");
      if (!hasGeography) return;
      window.clearTimeout(basemapTimeout);
      if (containerRef.current) containerRef.current.dataset.basemapReady = "true";
      map.off("render", handleRender);
    };

    map.once("style.load", () => {
      styleReady = true;
      window.clearTimeout(styleTimeout);
      map.setProjection({ type: "globe" });
      setReady(true);
    });
    map.on("error", handleMapError);
    map.on("sourcedata", handleSourceData);
    map.on("render", handleRender);

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);
    return () => {
      resizeObserver.disconnect();
      window.clearTimeout(styleTimeout);
      window.clearTimeout(basemapTimeout);
      if (resourceFailureTimer !== null) window.clearTimeout(resourceFailureTimer);
      map.off("error", handleMapError);
      map.off("sourcedata", handleSourceData);
      map.off("render", handleRender);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = records.map((record) => {
      const markerButton = document.createElement("button");
      markerButton.type = "button";
      markerButton.className = "atlas-evidence-marker";
      markerButton.dataset.precision = record.locationPrecision === "site" ? "exact" : "approximate";
      markerButton.dataset.selected = record.id === selectedRecordId ? "true" : "false";
      markerButton.ariaLabel = `${record.name}. ${record.locationPrecision} precision. ${record.locationLabel}`;
      markerButton.title = record.name;
      markerButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelect(record.id);
      });
      markerButton.addEventListener("pointerdown", (event) => event.stopPropagation());
      return new maplibregl.Marker({ element: markerButton, anchor: "center" })
        .setLngLat([record.longitude, record.latitude])
        .addTo(map);
    });
    if (containerRef.current) containerRef.current.dataset.atlasMarkers = String(markersRef.current.length);
  }, [onSelect, ready, records, selectedRecordId]);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || records.length === 0) return;
    if (initialRecordsRef.current) {
      initialRecordsRef.current = false;
      return;
    }
    if (records.length === 1) {
      map.easeTo({ center: [records[0].longitude, records[0].latitude], zoom: records[0].locationPrecision === "site" ? 7 : 4 });
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    records.forEach((record) => bounds.extend([record.longitude, record.latitude]));
    map.fitBounds(bounds, { padding: 72, maxZoom: 5, duration: 500 });
  }, [ready, records]);

  React.useEffect(() => {
    if (!ready) return;
    const record = records.find((item) => item.id === selectedRecordId);
    if (!record || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [record.longitude, record.latitude],
      zoom: record.locationPrecision === "site" ? 7 : 4.2,
      duration: 500,
    });
  }, [ready, records, selectedRecordId]);

  React.useEffect(() => {
    if (resetRevision === 0) return;
    mapRef.current?.easeTo({ center: [-30, 24], zoom: 1.25, pitch: 0, bearing: 0, duration: 500 });
  }, [resetRevision]);

  return (
    <div className="relative h-full min-h-[32rem] overflow-hidden bg-map-water">
      <div ref={containerRef} className="atlas-map-surface absolute inset-0" aria-label="Interactive globe showing nuclear evidence locations" />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="absolute right-3 top-3 z-10 shadow-lg"
        onClick={() => mapRef.current?.easeTo({ center: [-30, 24], zoom: 1.25, pitch: 0, bearing: 0, duration: 500 })}
      >
        <RotateCcw data-icon="inline-start" />
        Reset world
      </Button>
    </div>
  );
}
