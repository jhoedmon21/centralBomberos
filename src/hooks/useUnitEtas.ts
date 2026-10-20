"use client";

// ============================================================
//  ETA de las unidades en salida hacia la escena (o de regreso al
//  cuartel). Se calcula con la ruta vial de la central (OSRM) y se
//  refresca cada 45 s; no sigue cada ping GPS para no saturar OSRM.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { FIREHOUSE } from "@/lib/geo";
import { activeIncidentForUnit, isUnitEnSalida } from "@/lib/units";
import type { IncidentDTO, RouteDTO, UnitDTO } from "@/lib/types";

export interface UnitEta {
  /** Distancia vial en metros */
  meters: number;
  /** Duración vial en segundos */
  seconds: number;
  /** true = OSRM no respondió y el cálculo es línea recta a 30 km/h */
  estimated: boolean;
  /** Momento del cálculo (ms) */
  at: number;
  target: "incidente" | "cuartel";
  incidentId: number | null;
}

interface Options {
  units: UnitDTO[];
  incidents: IncidentDTO[];
  /** Solo consulta mientras la vista «En salida» está visible */
  enabled: boolean;
}

const REFRESH_MS = 45_000;

interface Destination {
  lat: number;
  lng: number;
  target: UnitEta["target"];
  incidentId: number | null;
}

/** Destino de la unidad: la escena si va en ruta, el cuartel si regresa. */
function destinationFor(unit: UnitDTO, incidents: IncidentDTO[]): Destination | null {
  if (unit.status === "regresando") {
    return { ...FIREHOUSE, target: "cuartel", incidentId: null };
  }
  if (unit.status !== "en_ruta") return null;
  const incident = activeIncidentForUnit(unit, incidents);
  if (!incident) return null;
  return {
    lat: incident.lat,
    lng: incident.lng,
    target: "incidente",
    incidentId: incident.id,
  };
}

async function fetchEta(unit: UnitDTO, dest: Destination): Promise<UnitEta> {
  if (unit.lat == null || unit.lng == null) throw new Error("Sin GPS");
  const from = encodeURIComponent(`${unit.lat},${unit.lng}`);
  const to = encodeURIComponent(`${dest.lat},${dest.lng}`);
  const res = await fetch(`/api/route?from=${from}&to=${to}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { route?: RouteDTO; error?: string };
  if (!res.ok || !data.route) throw new Error(data.error ?? "Sin ruta");
  return {
    meters: data.route.meters,
    seconds: data.route.seconds,
    estimated: data.route.estimated,
    at: Date.now(),
    target: dest.target,
    incidentId: dest.incidentId,
  };
}

export function useUnitEtas({ units, incidents, enabled }: Options): Record<number, UnitEta> {
  const [etas, setEtas] = useState<Record<number, UnitEta>>({});
  // Las posiciones cambian cada ping; el temporizador lee siempre la última
  // versión sin rearmarse en cada actualización de `units`.
  const latestRef = useRef({ units, incidents });
  useEffect(() => {
    latestRef.current = { units, incidents };
  }, [units, incidents]);

  const activeKey = units
    .filter((u) => isUnitEnSalida(u.status))
    .map((u) => `${u.id}:${u.status}:${u.incidentId ?? ""}`)
    .sort()
    .join("|");

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let inFlight = false;

    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const current = latestRef.current;
        const targets = current.units
          .filter((u) => isUnitEnSalida(u.status) && u.lat != null && u.lng != null)
          .map((u) => ({ unit: u, dest: destinationFor(u, current.incidents) }))
          .filter((t): t is { unit: UnitDTO; dest: Destination } => t.dest != null);

        const results = await Promise.allSettled(
          targets.map(async ({ unit, dest }) => [unit.id, await fetchEta(unit, dest)] as const),
        );
        if (cancelled) return;

        setEtas((prev) => {
          const next = { ...prev };
          const activeIds = new Set(targets.map((t) => t.unit.id));
          for (const key of Object.keys(next)) {
            if (!activeIds.has(Number(key))) delete next[Number(key)];
          }
          for (const result of results) {
            if (result.status === "fulfilled") {
              const [id, eta] = result.value;
              next[id] = eta;
            }
          }
          return next;
        });
      } finally {
        inFlight = false;
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // activeKey rearma el ciclo cuando aparece/cambia una salida; las
    // posiciones se leen frescas desde latestRef en cada tick.
  }, [enabled, activeKey]);

  return etas;
}
