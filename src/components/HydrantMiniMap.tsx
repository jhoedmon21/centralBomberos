"use client";

// Mini-mapa táctico del detalle: incidente + los hidrantes más cercanos con sus
// líneas y el radio de 300 m. Motor MapLibre GL con componentes mapcn y estilos
// OpenFreeMap (sin API key), igual que el mapa principal.

import { useEffect, useMemo } from "react";
import type * as GeoJSON from "geojson";
import { circleRing, OFM_STYLES } from "@/lib/geo";
import { fmtDistance, hydrantLabel } from "@/lib/utils";
import { Map, MapGeoJSON, MapMarker, MarkerContent, MarkerTooltip, useMap } from "./ui/map";

export interface MiniHydrant {
  n: number;
  code: string | null;
  lat: number;
  lng: number;
  meters: number;
}

interface Props {
  lat: number;
  lng: number;
  theme: "dark" | "light";
  hydrants: MiniHydrant[];
}

/** Enmarca el incidente y sus hidrantes (equivale a los bounds de Leaflet). */
function MiniEngine({ lat, lng, hydrants }: { lat: number; lng: number; hydrants: MiniHydrant[] }) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;
    if (hydrants.length === 0) {
      map.jumpTo({ center: [lng, lat], zoom: 16 });
      return;
    }
    const lats = [lat, ...hydrants.map((h) => h.lat)];
    const lngs = [lng, ...hydrants.map((h) => h.lng)];
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 28, maxZoom: 16, duration: 0 },
    );
  }, [map, isLoaded, lat, lng, hydrants]);

  return null;
}

export default function HydrantMiniMap({ lat, lng, theme, hydrants }: Props) {
  const radiusGeo = useMemo<GeoJSON.Feature<GeoJSON.Polygon>>(
    () => ({
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [circleRing(lat, lng, 300)] },
    }),
    [lat, lng],
  );

  const linesGeo = useMemo<GeoJSON.FeatureCollection<GeoJSON.LineString>>(
    () => ({
      type: "FeatureCollection",
      features: hydrants.map((h) => ({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: [[lng, lat], [h.lng, h.lat]] },
      })),
    }),
    [lat, lng, hydrants],
  );

  return (
    <div
      className="fw-map h-40 w-full overflow-hidden rounded border border-line"
      role="group"
      aria-label="Mini-mapa: incidente e hidrantes cercanos"
    >
      <Map
        center={[lng, lat]}
        zoom={16}
        interactive={false}
        theme={theme}
        styles={OFM_STYLES}
      >
        <MiniEngine lat={lat} lng={lng} hydrants={hydrants} />

        {/* Radio táctico de 300 m */}
        <MapGeoJSON
          id="mini-radius"
          data={radiusGeo}
          fillPaint={{ "fill-color": "#ff5644", "fill-opacity": 0.08 }}
          linePaint={{ "line-color": "#ff5644", "line-width": 1.5, "line-dasharray": [2, 2] }}
        />

        {/* Líneas del incidente a cada hidrante */}
        <MapGeoJSON
          id="mini-lines"
          data={linesGeo}
          fillPaint={false}
          linePaint={{ "line-color": "#55a6f2", "line-width": 1.5, "line-dasharray": [1.5, 2], "line-opacity": 0.85 }}
        />

        <MapMarker longitude={lng} latitude={lat}>
          <MarkerContent>
            <div className="mk mk-incident sel">
              <div className="dot" style={{ background: "var(--st-reportado)" }}>
                🔥
              </div>
            </div>
          </MarkerContent>
          <MarkerTooltip className="border border-line2 bg-panel! text-tx!">Emergencia</MarkerTooltip>
        </MapMarker>

        {hydrants.map((h) => (
          <MapMarker key={`h-${h.n}`} longitude={h.lng} latitude={h.lat}>
            <MarkerContent>
              <div className="mk mk-hydrant near">
                <div className="dot">H</div>
              </div>
            </MarkerContent>
            <MarkerTooltip className="border border-line2 bg-panel! text-tx!">
              {hydrantLabel(h.code)} · N.º {h.n} · {fmtDistance(h.meters)}
            </MarkerTooltip>
          </MapMarker>
        ))}
      </Map>
    </div>
  );
}
