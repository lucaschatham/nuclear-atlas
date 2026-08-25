"use client";

import * as React from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { AtlasLocation, Deal } from "@/lib/types";

export type AtlasPoint = AtlasLocation & { deal: Deal };

type Props = {
  points: AtlasPoint[];
  selectedId: string | null;
  viewRevision: number;
  resetWorldRevision: number;
  onSelect: (id: string) => void;
  onReady?: () => void;
};

const sourceId = "nuclear-atlas-projects";

function asGeoJson(points: AtlasPoint[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: points.map((point) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [point.longitude, point.latitude] },
      properties: {
        id: point.deal_id,
        name: point.deal.name,
        precision: point.precision,
        binding: point.deal.bindingness.tier,
        exact: point.precision === "site",
      },
    })),
  };
}

export function AtlasMap({ points, selectedId, viewRevision, resetWorldRevision, onSelect, onReady }: Props) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<MapLibreMap | null>(null);
  const markersRef = React.useRef<maplibregl.Marker[]>([]);
  const [failed, setFailed] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [-30, 24],
      zoom: 1.25,
      minZoom: 0.8,
      maxZoom: 13,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");

    map.once("style.load", () => {
      map.setProjection({ type: "globe" });
      map.addSource(sourceId, { type: "geojson", data: asGeoJson(points), cluster: true, clusterRadius: 42 });
      map.addLayer({
        id: "atlas-clusters",
        type: "circle",
        source: sourceId,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#d9ff68",
          "circle-radius": ["step", ["get", "point_count"], 18, 6, 23, 12, 29],
          "circle-stroke-color": "#11150f",
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: "atlas-cluster-count",
        type: "symbol",
        source: sourceId,
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 },
        paint: { "text-color": "#11150f" },
      });
      map.addLayer({
        id: "atlas-points",
        type: "circle",
        source: sourceId,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["case", ["==", ["get", "exact"], true], "#d9ff68", "#ffb15a"],
          "circle-radius": ["case", ["==", ["get", "id"], selectedId ?? ""], 11, 7],
          "circle-stroke-color": "#0e130f",
          "circle-stroke-width": 2,
          "circle-opacity": ["case", ["==", ["get", "exact"], true], 1, 0.82],
        },
      });
      map.on("click", "atlas-points", (event) => {
        const id = event.features?.[0]?.properties?.id;
        if (typeof id === "string") onSelect(id);
      });
      map.on("click", "atlas-clusters", async (event) => {
        const feature = map.queryRenderedFeatures(event.point, { layers: ["atlas-clusters"] })[0];
        const clusterId = feature?.properties?.cluster_id;
        const source = map.getSource(sourceId) as GeoJSONSource;
        if (typeof clusterId === "number") {
          const zoom = await source.getClusterExpansionZoom(clusterId);
          const coordinates = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
          map.easeTo({ center: coordinates, zoom });
        }
      });
      for (const layer of ["atlas-points", "atlas-clusters"]) {
        map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
      }
      setReady(true);
      onReady?.();
    });
    map.on("error", (event) => {
      if (!map.isStyleLoaded() && event.error) setFailed(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // The map is created once. Data changes flow through the source effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource(sourceId) as GeoJSONSource | undefined;
    source?.setData(asGeoJson(points));
    if (map.getLayer("atlas-points")) {
      map.setPaintProperty("atlas-points", "circle-radius", ["case", ["==", ["get", "id"], selectedId ?? ""], 11, 7]);
    }
  }, [points, ready, selectedId]);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = points.map((point) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "atlas-dom-marker";
      button.dataset.precision = point.precision === "site" ? "site" : "approximate";
      button.dataset.selected = point.deal_id === selectedId ? "true" : "false";
      button.ariaLabel = `${point.deal.name}. ${point.precision} precision. ${point.display_label}`;
      button.title = `${point.deal.name} · ${point.precision} precision`;
      button.addEventListener("pointerdown", (event) => event.stopPropagation());
      button.addEventListener("pointerup", (event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelect(point.deal_id);
      });
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelect(point.deal_id);
      });
      button.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        onSelect(point.deal_id);
      });
      return new maplibregl.Marker({ element: button, anchor: "center" })
        .setLngLat([point.longitude, point.latitude])
        .addTo(map);
    });
  }, [onSelect, points, ready, selectedId]);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (points.length === 0) return;
    if (points.length === 1) {
      map.easeTo({ center: [points[0].longitude, points[0].latitude], zoom: points[0].precision === "site" ? 7 : 4 });
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    points.forEach((point) => bounds.extend([point.longitude, point.latitude]));
    map.fitBounds(bounds, { padding: 72, maxZoom: 5, duration: 700 });
  }, [viewRevision, points, ready]);

  React.useEffect(() => {
    if (resetWorldRevision === 0) return;
    mapRef.current?.easeTo({ center: [-30, 24], zoom: 1.25, pitch: 0, bearing: 0, duration: 700 });
  }, [resetWorldRevision]);

  React.useEffect(() => {
    const point = points.find((item) => item.deal_id === selectedId);
    if (!point || !mapRef.current?.isStyleLoaded()) return;
    mapRef.current.flyTo({ center: [point.longitude, point.latitude], zoom: point.precision === "site" ? 7 : 4.2, duration: 650 });
  }, [selectedId, points]);

  function resetWorld() {
    mapRef.current?.easeTo({ center: [-30, 24], zoom: 1.25, pitch: 0, bearing: 0, duration: 700 });
  }

  return (
    <div className="relative h-full min-h-[460px] overflow-hidden bg-[#08110f]">
      <div ref={containerRef} className="atlas-map-surface absolute inset-0" aria-label="Interactive globe showing nuclear evidence locations" />
      <button
        type="button"
        onClick={resetWorld}
        className="absolute right-3 top-3 z-10 min-h-11 border border-white/20 bg-[#101713]/90 px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-white shadow-lg backdrop-blur hover:bg-[#1b251e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d9ff68]"
      >
        Reset world
      </button>
      {failed && (
        <div className="absolute inset-0 grid place-items-center bg-[#08110f] p-8 text-center">
          <div>
            <p className="font-heading text-2xl text-white">Map tiles are unavailable.</p>
            <p className="mt-2 max-w-md text-sm text-white/65">The evidence list and location precision remain available in the inspector.</p>
          </div>
        </div>
      )}
    </div>
  );
}
