"use client";

// Mapa táctico de la central: motor MapLibre GL con componentes mapcn
// (https://mapcn.dev, MIT) y estilos vectoriales OpenFreeMap (sin API key).
// Reemplaza al antiguo Leaflet manteniendo capas, modos y controles.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as maplibregl from "maplibre-gl";
import type * as GeoJSON from "geojson";
import {
  Crosshair,
  Drop,
  Plus,
  Square,
  StackSimple,
  TextAa,
  TrafficSignal,
  Triangle,
  X,
} from "@phosphor-icons/react";
import { CITY_CENTER, circleRing, OFM_STYLES, type HydrantNear } from "@/lib/geo";
import { HYDRANT_SITUATION_META, STATUS_META, UNIT_STATUS_META, UNIT_TYPE_META } from "@/lib/meta";
import { EMPTY_QUAKES, placeEs, quakeColor, quakeRadius, type QuakesFeed } from "@/lib/quakes";
import { TRAFFIC_COLORS, TRAFFIC_LABEL, ALERT_META, type TrafficFeed } from "@/lib/traffic";
import type { HydrantDTO, HydrantSituation, IncidentDTO, RiskDTO, RouteDTO, UnitDTO } from "@/lib/types";
import { cx, displayCode, timeAgo } from "@/lib/utils";
import {
  Map,
  MapControls,
  MapGeoJSON,
  MapMarker,
  MapPopup,
  MarkerContent,
  MarkerLabel,
  MarkerTooltip,
  useMap,
} from "./ui/map";
import WazeLiveDialog from "./WazeLiveDialog";

export interface LayersState {
  incidents: boolean;
  addresses: boolean;
  units: boolean;
  hydrants: boolean;
  risks: boolean;
  traffic: boolean;
  quakes: boolean;
  radius: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  reportado: "var(--st-reportado)",
  despachado: "var(--st-despachado)",
  en_escena: "var(--st-escena)",
  controlado: "var(--st-controlado)",
  cerrado: "var(--st-cerrado)",
};

const UNIT_COLOR: Record<string, string> = {
  disponible: "var(--green)",
  en_ruta: "var(--amber)",
  en_escena: "var(--blue)",
  regresando: "var(--amber)",
  fuera_servicio: "var(--mu-2)",
};

const HYDRANT_COLOR: Record<HydrantSituation, string> = {
  operativo: "var(--blue)",
  mantenimiento: "var(--amber)",
  fuera_servicio: "var(--red)",
};

/** Estado neutro mientras no hay respuesta de /api/traffic */
const EMPTY_FEED: TrafficFeed = { source: "none", fetchedAt: "", segments: [], alerts: [] };

// ------------------------------------------------------------------
// Iconos tácticos (mismas clases .mk que antes; ahora como React)
// ------------------------------------------------------------------

function IncidentDot({ incident: i, selected }: { incident: IncidentDTO; selected: boolean }) {
  const color = STATUS_COLOR[i.status] ?? "#ff4a38";
  const pulse = i.status === "reportado" || selected;
  return (
    <div className={cx("mk mk-incident", selected && "sel")}>
      {pulse && (
        <div className="ring" style={{ background: `color-mix(in srgb, ${color} 40%, transparent)` }} />
      )}
      <div className="dot" style={{ background: color }}>
        🔥
      </div>
    </div>
  );
}

function HydrantDot({ near, situation }: { near: boolean; situation: HydrantSituation }) {
  return (
    <div className={cx("mk mk-hydrant", near && "near")}>
      <div className="dot" style={{ background: HYDRANT_COLOR[situation] ?? "var(--blue)" }}>
        H
      </div>
    </div>
  );
}

function RiskDot() {
  return (
    <div className="mk mk-risk">
      <div className="dot">!</div>
    </div>
  );
}

function UnitDot({ unit: u }: { unit: UnitDTO }) {
  return (
    <div className="mk mk-unit">
      <div className="dot" style={{ borderColor: UNIT_COLOR[u.status] ?? "#fff" }}>
        <span>{u.code}</span>
      </div>
    </div>
  );
}

function AlertDot({ symbol, color }: { symbol: string; color: string }) {
  return (
    <div className="mk mk-alert">
      <div className="dot" style={{ background: color }}>{symbol}</div>
    </div>
  );
}

function QuakeDot({ mag }: { mag: number }) {
  const px = quakeRadius(mag) * 2;
  const color = quakeColor(mag);
  return (
    <span
      data-quake
      data-mag={mag}
      aria-hidden="true"
      style={{
        display: "block",
        width: px,
        height: px,
        borderRadius: "50%",
        border: `2px solid ${color}`,
        background: `color-mix(in srgb, ${color} 22%, transparent)`,
        boxShadow: `0 0 0 1px color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    />
  );
}

// ------------------------------------------------------------------
// Ayudantes de mapa
// ------------------------------------------------------------------

/** Respeta la preferencia del sistema de reducir movimiento. */
function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Motor: clic para fijar ubicación, escala, vuelo al seleccionado y hook de pruebas. */
function MapEngine({
  selected,
  picking,
  onPick,
  mapRef,
}: {
  selected: IncidentDTO | null;
  picking: boolean;
  onPick: (lat: number, lng: number) => void;
  mapRef: React.RefObject<maplibregl.Map | null>;
}) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map) return;
    mapRef.current = map;
    // Hook para las pruebas headless (queryRenderedFeatures, etc.)
    (window as unknown as Record<string, unknown>).__fwMap = map;
    const scale = new maplibregl.ScaleControl({ unit: "metric", maxWidth: 100 });
    map.addControl(scale, "bottom-left");
    return () => {
      try {
        map.removeControl(scale);
      } catch {
        /* el estilo puede estar recargándose */
      }
    };
  }, [map, mapRef]);

  useEffect(() => {
    if (!map) return;
    const handler = (e: maplibregl.MapMouseEvent) => {
      if (picking) onPick(e.lngLat.lat, e.lngLat.lng);
    };
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [map, picking, onPick]);

  useEffect(() => {
    if (!map || !isLoaded || !selected) return;
    const zoom = Math.max(map.getZoom(), 15);
    if (prefersReducedMotion()) map.jumpTo({ center: [selected.lng, selected.lat], zoom });
    else map.flyTo({ center: [selected.lng, selected.lat], zoom, duration: 700 });
  }, [map, isLoaded, selected]);

  return null;
}

/** Tooltip al pasar el cursor por una línea de tráfico (capa GeoJSON). */
function TrafficLineHover({
  onHover,
}: {
  onHover: (tip: { lng: number; lat: number; label: string } | null) => void;
}) {
  const { map } = useMap();
  useEffect(() => {
    if (!map) return;
    const layerId = "geojson-line-fw-traffic";
    const enter = (e: maplibregl.MapLayerMouseEvent) => {
      const label = String(e.features?.[0]?.properties?.label ?? "Tráfico");
      onHover({ lng: e.lngLat.lng, lat: e.lngLat.lat, label });
      map.getCanvas().style.cursor = "pointer";
    };
    const leave = () => {
      onHover(null);
      map.getCanvas().style.cursor = "";
    };
    map.on("mouseenter", layerId, enter);
    map.on("mouseleave", layerId, leave);
    return () => {
      map.off("mouseenter", layerId, enter);
      map.off("mouseleave", layerId, leave);
    };
  }, [map, onHover]);
  return null;
}

// ------------------------------------------------------------------
// Panel de capas / leyenda
// ------------------------------------------------------------------

function LayerToggle({
  label,
  checked,
  onChange,
  swatch,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  swatch: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium select-none">
      <input type="checkbox" className="accent-[var(--amber)]" checked={checked} onChange={onChange} />
      <span className="flex items-center gap-1.5 text-mu">
        <span aria-hidden="true" className="flex items-center">
          {swatch}
        </span>
        {label}
      </span>
    </label>
  );
}

/** Contenido del popup de un hidrante: datos + cambio de situación */
function HydrantPopup({
  hydrant,
  onSituation,
}: {
  hydrant: HydrantDTO;
  onSituation: (id: number, situation: HydrantSituation) => Promise<void>;
}) {
  const [situation, setSituation] = useState<HydrantSituation>(hydrant.situation);
  const [busy, setBusy] = useState(false);
  const meta = HYDRANT_SITUATION_META[hydrant.situation];
  const dirty = situation !== hydrant.situation;

  return (
    <div className="min-w-[212px]">
      <div className="display flex items-center gap-1.5 text-[13.5px] font-bold">
        <Drop size={13} weight="fill" className="text-blue" aria-hidden="true" />
        {hydrant.code ?? "Hidrante sin código"}
      </div>
      <div className="mt-0.5 text-[11px] text-mu">
        Presión {hydrant.pressure ?? "s/d"} · {hydrant.diameter ?? "—"} mm
      </div>
      <div className="mt-1.5">
        <span className="chip" style={{ color: `var(${meta.varName})` }}>
          {meta.label}
        </span>
      </div>
      {hydrant.notes && <p className="mt-1 text-[11px] text-mu2">{hydrant.notes}</p>}
      {hydrant.photoUrl && (
        <a
          href={hydrant.photoUrl}
          target="_blank"
          rel="noreferrer"
          title="Abrir la foto en tamaño completo"
          className="mt-1.5 block"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hydrant.photoUrl}
            alt={`Foto del hidrante ${hydrant.code ?? ""}`.trim()}
            width={320}
            height={180}
            className="max-h-32 w-full rounded border border-line object-cover"
          />
        </a>
      )}
      <label
        className="mt-2 block text-[9.5px] font-bold tracking-[0.14em] text-mu2 uppercase"
        htmlFor={`hs-${hydrant.id}`}
      >
        Determinar situación
      </label>
      <div className="mt-1 flex gap-1.5">
        <select
          id={`hs-${hydrant.id}`}
          className="input py-1 text-[12px]"
          value={situation}
          onChange={(e) => setSituation(e.target.value as HydrantSituation)}
        >
          {(Object.keys(HYDRANT_SITUATION_META) as HydrantSituation[]).map((s) => (
            <option key={s} value={s}>
              {HYDRANT_SITUATION_META[s].label}
            </option>
          ))}
        </select>
        <button
          className="btn btn-sm btn-blue shrink-0"
          disabled={!dirty || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSituation(hydrant.id, situation);
            } catch {
              /* el error se avisa con toast en la central */
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Mapa principal
// ------------------------------------------------------------------

interface Props {
  incidents: IncidentDTO[];
  units: UnitDTO[];
  hydrants: HydrantDTO[];
  risks: RiskDTO[];
  selectedId: number | null;
  nearHydrants: HydrantNear[];
  layers: LayersState;
  theme: "dark" | "light";
  picking: boolean;
  /** Ruta vial trazada desde el detalle (null = sin ruta) */
  route: RouteDTO | null;
  onToggleLayer: (key: keyof LayersState) => void;
  onSelect: (id: number) => void;
  onPick: (lat: number, lng: number) => void;
  onCancelPick: () => void;
  onNewHydrant: () => void;
  onHydrantSituation: (id: number, situation: HydrantSituation) => Promise<void>;
}

/** Popup abierto (uno a la vez, controlado por estado) */
type PopupState =
  | null
  | { kind: "incident"; id: number }
  | { kind: "unit"; id: number }
  | { kind: "hydrant"; id: number }
  | { kind: "alert"; id: string };

export default function MapView({
  incidents,
  units,
  hydrants,
  risks,
  selectedId,
  nearHydrants,
  layers,
  theme,
  picking,
  route,
  onToggleLayer,
  onSelect,
  onPick,
  onCancelPick,
  onNewHydrant,
  onHydrantSituation,
}: Props) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [wazeOpen, setWazeOpen] = useState(false);
  const [feed, setFeed] = useState<TrafficFeed | null>(null);
  const [quakes, setQuakes] = useState<QuakesFeed | null>(null);
  const [popup, setPopup] = useState<PopupState>(null);
  const [hoverTip, setHoverTip] = useState<{ lng: number; lat: number; label: string } | null>(null);
  const selected = useMemo(() => incidents.find((i) => i.id === selectedId) ?? null, [incidents, selectedId]);
  const nearIds = useMemo(() => new Set(nearHydrants.map((h) => h.hydrant.id)), [nearHydrants]);

  // Tráfico y zonas problemáticas: consulta /api/traffic (Waze en vivo; si la
  // red lo bloquea no hay datos y se ofrece el visor embebido de Waze) cada 3 min.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/traffic", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as TrafficFeed;
        if (alive) setFeed(data);
      } catch {
        /* sin conexión: se conserva lo último mostrado */
      }
    };
    void load();
    const t = setInterval(load, 180_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // Sismos recientes: consulta /api/quakes (USGS, sin key) cada 10 min.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/quakes", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as QuakesFeed;
        if (alive) setQuakes(data);
      } catch {
        /* sin conexión: se conserva lo último mostrado */
      }
    };
    void load();
    const t = setInterval(load, 600_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const trafficFeed = feed ?? EMPTY_FEED;
  const quakesFeed = quakes ?? EMPTY_QUAKES;
  const onTrafficHover = useCallback((tip: { lng: number; lat: number; label: string } | null) => {
    setHoverTip(tip);
  }, []);

  // ---- Capas GeoJSON ----

  const trafficGeo = useMemo<GeoJSON.FeatureCollection<GeoJSON.LineString>>(
    () => ({
      type: "FeatureCollection",
      features: trafficFeed.segments.map((s) => ({
        type: "Feature",
        properties: { color: TRAFFIC_COLORS[s.level], label: `Tráfico ${TRAFFIC_LABEL[s.level]} · Waze en vivo` },
        geometry: {
          type: "LineString",
          coordinates: s.points.map(([lat, lng]) => [lng, lat] as [number, number]),
        },
      })),
    }),
    [trafficFeed.segments],
  );

  const radiusGeo = useMemo<GeoJSON.Feature<GeoJSON.Polygon> | null>(
    () =>
      selected && layers.radius
        ? {
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [circleRing(selected.lat, selected.lng, 300)] },
          }
        : null,
    [selected, layers.radius],
  );

  const hydrantLinesGeo = useMemo<GeoJSON.FeatureCollection<GeoJSON.LineString> | null>(
    () =>
      selected && layers.radius
        ? {
            type: "FeatureCollection",
            features: nearHydrants.map((h) => ({
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: [
                  [selected.lng, selected.lat],
                  [h.hydrant.lng, h.hydrant.lat],
                ],
              },
            })),
          }
        : null,
    [selected, layers.radius, nearHydrants],
  );

  // ---- Popups (datos del popup abierto) ----

  const popupIncident =
    popup?.kind === "incident" && layers.incidents
      ? incidents.find((i) => i.id === popup.id) ?? null
      : null;
  const popupUnit = popup?.kind === "unit" ? units.find((u) => u.id === popup.id) ?? null : null;
  const popupHydrant =
    popup?.kind === "hydrant" && layers.hydrants
      ? hydrants.find((h) => h.id === popup.id) ?? null
      : null;
  const popupAlert =
    popup?.kind === "alert" && layers.traffic
      ? trafficFeed.alerts.find((a) => a.id === popup.id) ?? null
      : null;

  return (
    <div className={cx("fw-map relative h-full w-full", picking && "picking")}>
      <Map
        center={[CITY_CENTER.lng, CITY_CENTER.lat]}
        zoom={14}
        minZoom={11}
        maxZoom={19}
        theme={theme}
        styles={OFM_STYLES}
      >
        <MapEngine selected={selected} picking={picking} onPick={onPick} mapRef={mapRef} />
        <MapControls position="top-right" />

        {/* Radio de 300 m del incidente seleccionado + líneas a sus hidrantes */}
        {radiusGeo && (
          <MapGeoJSON
            id="fw-radius"
            data={radiusGeo}
            fillPaint={{ "fill-color": "#ff5644", "fill-opacity": 0.08 }}
            linePaint={{ "line-color": "#ff5644", "line-width": 1.5, "line-dasharray": [2, 2] }}
          />
        )}
        {hydrantLinesGeo && (
          <MapGeoJSON
            id="fw-hyd-lines"
            data={hydrantLinesGeo}
            fillPaint={false}
            linePaint={{ "line-color": "#4da3ff", "line-width": 1.5, "line-dasharray": [1, 2], "line-opacity": 0.9 }}
          />
        )}

        {/* Tráfico y zonas problemáticas (Waze en vivo) */}
        {layers.traffic && (
          <>
            <MapGeoJSON
              id="fw-traffic"
              data={trafficGeo}
              fillPaint={false}
              linePaint={{ "line-color": ["get", "color"], "line-width": 5, "line-opacity": 0.75 }}
            />
            <TrafficLineHover onHover={onTrafficHover} />
            {hoverTip && (
              <MapPopup longitude={hoverTip.lng} latitude={hoverTip.lat} className="border-line">
                {hoverTip.label}
              </MapPopup>
            )}
            {trafficFeed.alerts.map((a) => (
              <MapMarker
                key={`al-${a.id}`}
                longitude={a.lng}
                latitude={a.lat}
                onClick={() => setPopup({ kind: "alert", id: a.id })}
              >
                <MarkerContent>
                  <AlertDot symbol={ALERT_META[a.kind].symbol} color={ALERT_META[a.kind].color} />
                </MarkerContent>
              </MapMarker>
            ))}
          </>
        )}

        {/* Ruta vial trazada (botón «Ruta» del detalle) */}
        {route && (
          <MapGeoJSON
            id="fw-route"
            data={{
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: route.points },
            }}
            fillPaint={false}
            linePaint={{ "line-color": "#eea72c", "line-width": 4, "line-opacity": 0.9, "line-dasharray": [1.5, 1] }}
          />
        )}

        {/* Terremotos recientes (USGS) */}
        {layers.quakes &&
          quakesFeed.quakes.map((q) => (
            <MapMarker key={`q-${q.id}`} longitude={q.lng} latitude={q.lat}>
              <MarkerContent>
                <QuakeDot mag={q.mag} />
              </MarkerContent>
              <MarkerTooltip className="max-w-[240px] border border-line2 bg-panel! text-left text-tx! font-medium whitespace-normal">
                Terremoto M{q.mag.toFixed(1)} · {placeEs(q.place)} · prof. {Math.round(q.depthKm)} km ·{" "}
                {timeAgo(new Date(q.at).toISOString())}
              </MarkerTooltip>
            </MapMarker>
          ))}

        {/* Puntos de riesgo */}
        {layers.risks &&
          risks.map((r) => (
            <MapMarker key={`r-${r.id}`} longitude={r.lng} latitude={r.lat}>
              <MarkerContent>
                <RiskDot />
              </MarkerContent>
              <MarkerTooltip className="border border-line2 bg-panel! text-tx!">
                {r.name} · {r.type} · riesgo {r.level}
              </MarkerTooltip>
            </MapMarker>
          ))}

        {/* Hidrantes */}
        {layers.hydrants &&
          hydrants.map((h) => (
            <MapMarker
              key={`h-${h.id}`}
              longitude={h.lng}
              latitude={h.lat}
              onClick={() => setPopup({ kind: "hydrant", id: h.id })}
            >
              <MarkerContent>
                <HydrantDot near={nearIds.has(h.id)} situation={h.situation} />
              </MarkerContent>
              <MarkerTooltip className="border border-line2 bg-panel! text-tx!">
                {h.code ?? "Hidrante"}
              </MarkerTooltip>
            </MapMarker>
          ))}

        {/* Unidades */}
        {layers.units &&
          units
            .filter((u) => u.lat != null && u.lng != null)
            .map((u) => (
              <MapMarker
                key={`u-${u.id}`}
                longitude={u.lng as number}
                latitude={u.lat as number}
                onClick={() => setPopup({ kind: "unit", id: u.id })}
              >
                <MarkerContent>
                  <UnitDot unit={u} />
                </MarkerContent>
              </MapMarker>
            ))}

        {/* Incidentes */}
        {layers.incidents &&
          incidents.map((i) => {
            const isSel = i.id === selectedId;
            return (
              <MapMarker
                key={`i-${i.id}`}
                longitude={i.lng}
                latitude={i.lat}
                onClick={() => {
                  onSelect(i.id);
                  setPopup({ kind: "incident", id: i.id });
                }}
              >
                <MarkerContent>
                  <IncidentDot incident={i} selected={isSel} />
                </MarkerContent>
                {layers.addresses && (
                  <MarkerLabel
                    className={cx(
                      "max-w-[190px] truncate rounded border px-1 py-px font-semibold",
                      isSel ? "border-red/60 bg-panel/95 text-tx!" : "border-line2 bg-panel/90 text-mu!",
                    )}
                  >
                    {i.address.length > 34 ? `${i.address.slice(0, 33)}…` : i.address}
                  </MarkerLabel>
                )}
              </MapMarker>
            );
          })}

        {/* Popups (uno a la vez) */}
        {popupIncident && (
          <MapPopup
            longitude={popupIncident.lng}
            latitude={popupIncident.lat}
            closeButton
            onClose={() => setPopup(null)}
            className="border-line"
          >
            <div className="min-w-[200px]">
              <div className="display text-[13.5px] leading-tight font-bold">{popupIncident.title}</div>
              <div className="mt-0.5 text-[11px] text-mu">{popupIncident.address}</div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="chip" style={{ color: `var(${STATUS_META[popupIncident.status].varName})` }}>
                  {STATUS_META[popupIncident.status].label}
                </span>
                <span className="font-mono text-[10px] text-mu2">
                  {displayCode(popupIncident.id, popupIncident.createdAt)}
                </span>
              </div>
              <div className="mt-1 font-mono text-[10px] text-mu2" suppressHydrationWarning>
                {timeAgo(popupIncident.createdAt)}
                {popupIncident.unit ? ` · ${popupIncident.unit.code}` : ""}
              </div>
              <button
                className="btn btn-sm btn-red mt-2 w-full"
                onClick={() => {
                  onSelect(popupIncident.id);
                  setPopup(null);
                }}
              >
                Ver detalle
              </button>
            </div>
          </MapPopup>
        )}
        {popupUnit && (
          <MapPopup
            longitude={popupUnit.lng as number}
            latitude={popupUnit.lat as number}
            closeButton
            onClose={() => setPopup(null)}
            className="border-line"
          >
            <div className="min-w-[180px]">
              <div className="display text-[13px] font-bold">
                {popupUnit.code} — {popupUnit.name}
              </div>
              <div className="mt-0.5 text-[11px] text-mu">
                {UNIT_TYPE_META[popupUnit.type].label} · {UNIT_STATUS_META[popupUnit.status].label}
              </div>
              <div className="mt-0.5 text-[11px] text-mu">
                {popupUnit.station ?? "Sin compañía"} · {popupUnit.crew ?? "—"} efectivos
              </div>
              {popupUnit.incidentId && (
                <button
                  className="btn btn-sm btn-red mt-2 w-full"
                  onClick={() => {
                    onSelect(popupUnit.incidentId as number);
                    setPopup(null);
                  }}
                >
                  Ver incidente asignado
                </button>
              )}
            </div>
          </MapPopup>
        )}
        {popupHydrant && (
          <MapPopup
            longitude={popupHydrant.lng}
            latitude={popupHydrant.lat}
            closeButton
            onClose={() => setPopup(null)}
            className="border-line"
          >
            <HydrantPopup hydrant={popupHydrant} onSituation={onHydrantSituation} />
          </MapPopup>
        )}
        {popupAlert && (
          <MapPopup
            longitude={popupAlert.lng}
            latitude={popupAlert.lat}
            closeButton
            onClose={() => setPopup(null)}
            className="border-line"
          >
            <div className="min-w-[170px] space-y-0.5">
              <div className="flex items-center gap-1.5 font-semibold">
                <span
                  className="inline-grid h-4 w-4 place-items-center rounded-[3px] text-[9px] text-white"
                  style={{ background: ALERT_META[popupAlert.kind].color }}
                >
                  {ALERT_META[popupAlert.kind].symbol}
                </span>
                {popupAlert.label}
              </div>
              {popupAlert.street && <div className="text-[11px] text-mu">{popupAlert.street}</div>}
              <div className="text-[10.5px] text-mu2">
                Reportado {timeAgo(new Date(popupAlert.at).toISOString())} · Waze en vivo
              </div>
            </div>
          </MapPopup>
        )}
      </Map>

      {/* Aviso de modo "fijar ubicación" */}
      {picking && (
        <div
          role="status"
          className="absolute top-3 left-1/2 z-[950] flex -translate-x-1/2 items-center gap-3 rounded border border-amber/60 bg-panel px-3 py-2 shadow-lg"
        >
          <Crosshair size={15} className="text-amber" aria-hidden="true" />
          <span className="text-[12.5px] font-semibold">Haz clic en el mapa para fijar la ubicación del reporte</span>
          <button className="btn btn-sm" onClick={onCancelPick}>
            <X size={12} aria-hidden="true" /> Cancelar
          </button>
        </div>
      )}

      {/* Capas y leyenda: un solo botón para despejar el mapa */}
      <div className="map-float absolute top-3 left-3 z-[900]">
        <div className="flex items-center gap-1.5">
          <button
            className={cx("btn btn-sm", panelOpen && "border-amber/60 text-amber")}
            onClick={() => setPanelOpen((v) => !v)}
            aria-expanded={panelOpen}
            aria-controls="fw-map-panel"
            title="Capas del mapa"
          >
            <StackSimple size={14} aria-hidden="true" /> Capas
          </button>
          <button
            className="btn btn-sm"
            onClick={onNewHydrant}
            title="Registrar un hidrante en el mapa"
          >
            <Plus size={14} aria-hidden="true" /> Hidrante
          </button>
        </div>
        {panelOpen && (
          <div
            id="fw-map-panel"
            className="map-panel anim-slidein mt-1.5 w-[196px] p-2.5"
            role="group"
            aria-label="Capas del mapa"
          >
            <div className="space-y-1.5">
              <LayerToggle
                label="Incidentes"
                checked={layers.incidents}
                onChange={() => onToggleLayer("incidents")}
                swatch={<span className="inline-block h-2 w-2 rotate-45 rounded-[2px] bg-red" />}
              />
              <LayerToggle
                label="Direcciones"
                checked={layers.addresses}
                onChange={() => onToggleLayer("addresses")}
                swatch={<TextAa size={11} weight="bold" className="text-mu" />}
              />
              <LayerToggle
                label="Unidades"
                checked={layers.units}
                onChange={() => onToggleLayer("units")}
                swatch={<Square size={10} weight="fill" className="text-blue" />}
              />
              <LayerToggle
                label="Hidrantes"
                checked={layers.hydrants}
                onChange={() => onToggleLayer("hydrants")}
                swatch={<Drop size={10} weight="fill" className="text-blue" />}
              />
              <LayerToggle
                label="Puntos de riesgo"
                checked={layers.risks}
                onChange={() => onToggleLayer("risks")}
                swatch={<Triangle size={10} weight="fill" className="text-amber" />}
              />
              <LayerToggle
                label={`Tráfico y alertas · ${trafficFeed.source === "waze" ? "en vivo" : "sin datos"}`}
                checked={layers.traffic}
                onChange={() => onToggleLayer("traffic")}
                swatch={
                  <span className="flex items-center gap-0.5">
                    <span className="inline-block h-[3px] w-1.5 rounded bg-red" />
                    <span className="inline-block h-[3px] w-1.5 rounded bg-amber" />
                    <span className="inline-block h-[3px] w-1.5 rounded bg-green" />
                  </span>
                }
              />
              <LayerToggle
                label={`Terremotos · ${
                  quakesFeed.source !== "usgs"
                    ? "sin datos"
                    : quakesFeed.quakes.length > 0
                      ? `${quakesFeed.quakes.length} recientes`
                      : "sin sismos"
                }`}
                checked={layers.quakes}
                onChange={() => onToggleLayer("quakes")}
                swatch={<span className="inline-block h-2 w-2 rounded-full border-2 border-amber" />}
              />
              <LayerToggle
                label="Radio 300 m e hidrantes"
                checked={layers.radius}
                onChange={() => onToggleLayer("radius")}
                swatch={<span className="inline-block h-2.5 w-2.5 rounded-full border border-dashed border-red" />}
              />
            </div>
            <div className="mt-2 border-t border-line pt-2">
              <button className="btn btn-sm w-full" onClick={() => setWazeOpen(true)}>
                <TrafficSignal size={13} className="text-red" aria-hidden="true" /> Tráfico en vivo · Waze
              </button>
              {layers.traffic && trafficFeed.source === "none" && (
                <p className="mt-1.5 text-[10px] leading-snug text-mu2">
                  Sin datos viales en vivo vía API en este momento; el mapa de Waze muestra la congestión real.
                </p>
              )}
            </div>
            {layers.quakes && (
              <div className="mt-2 border-t border-line pt-2">
                <p className="text-[10px] leading-snug text-mu2">
                  {quakes === null
                    ? "Consultando sismos recientes (USGS)…"
                    : quakesFeed.source === "usgs"
                      ? `Sismos M ≥ 2.5 de los últimos 7 días a ≤ ${quakesFeed.radiusKm} km de Camaná (USGS), en tiempo casi real.`
                      : "Sin datos sísmicos ahora (USGS no respondió); se muestra la última actualización recibida."}
                </p>
              </div>
            )}
            <div className="mt-2 border-t border-line pt-2">
              <div className="mb-1 text-[9.5px] font-bold tracking-[0.16em] text-mu2 uppercase">Estados</div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {(["reportado", "despachado", "en_escena", "controlado"] as const).map((s) => (
                  <span key={s} className="flex items-center gap-1.5 text-[10.5px] text-mu">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: STATUS_COLOR[s] }}
                      aria-hidden="true"
                    />
                    {STATUS_META[s].label}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-2 border-t border-line pt-2">
              <div className="mb-1 text-[9.5px] font-bold tracking-[0.16em] text-mu2 uppercase">
                Alertas viales
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {(["accidente", "cierre", "construccion", "peligro", "clima"] as const).map((k) => (
                  <span key={k} className="flex items-center gap-1.5 text-[10.5px] text-mu">
                    <span
                      aria-hidden="true"
                      className="inline-grid h-3.5 w-3.5 place-items-center rounded-[3px] text-[8px] font-bold text-white"
                      style={{ background: ALERT_META[k].color }}
                    >
                      {ALERT_META[k].symbol}
                    </span>
                    {ALERT_META[k].label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recentrar */}
      <button
        className="map-float absolute right-3 bottom-8 z-[900] btn btn-sm"
        onClick={() => {
          const map = mapRef.current;
          if (!map) return;
          if (prefersReducedMotion()) map.jumpTo({ center: [CITY_CENTER.lng, CITY_CENTER.lat], zoom: 14 });
          else map.flyTo({ center: [CITY_CENTER.lng, CITY_CENTER.lat], zoom: 14, duration: 700 });
        }}
        title="Centrar mapa en Camaná"
        aria-label="Centrar mapa en Camaná"
      >
        <Crosshair size={14} aria-hidden="true" />
      </button>

      {wazeOpen && <WazeLiveDialog onClose={() => setWazeOpen(false)} />}
    </div>
  );
}
