"use client";

// ============================================================
//  Gestión del parque: agregar, quitar, modificar y VER EL
//  ESTADO de cada unidad. Vínculo directo desde la fila de
//  botones flotantes de la cabina. Las unidades viven en el
//  mapa (marcadores) — este panel es su mesa de control.
// ============================================================

import { useEffect, useRef, useState } from "react";
import {
  Clock,
  Crosshair,
  MapPin,
  Plus,
  Pencil,
  Trash,
  Truck,
  X,
} from "@phosphor-icons/react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useUnitEtas } from "@/hooks/useUnitEtas";
import { UNIT_STATUS_META, UNIT_TYPE_META } from "@/lib/meta";
import { activeIncidentForUnit, isUnitEnSalida } from "@/lib/units";
import { cx, fmtDistance, timeAgo } from "@/lib/utils";
import { CLAVE_BY_STATUS, STATUS_COLOR } from "./ViperChrome";
import type { IncidentDTO, UnitDTO } from "@/lib/types";

type UnitFilter = "todas" | "salida" | "libres";

/** Duración de ruta en formato compacto para la mesa de control */
function fmtEta(seconds: number): string {
  const min = Math.max(0, Math.round(seconds / 60));
  if (min < 1) return "<1 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

interface Props {
  units: UnitDTO[];
  incidents: IncidentDTO[];
  /** jefe = puede dar de baja; jefe y operador pueden agregar/modificar */
  role: string;
  busyId: number | null;
  onClose: () => void;
  onAdd: () => void;
  onEdit: (u: UnitDTO) => void;
  onRemove: (u: UnitDTO) => void;
  onFollow: (id: number | null) => void;
  followingId: number | null;
}

export default function UnitsPanel({
  units,
  incidents,
  role,
  busyId,
  onClose,
  onAdd,
  onEdit,
  onRemove,
  onFollow,
  followingId,
}: Props) {
  const canWrite = role === "jefe" || role === "operador";
  const canDelete = role === "jefe";
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [filter, setFilter] = useState<UnitFilter>("todas");
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  // El ETA solo se consulta mientras la vista «En salida» está visible.
  const etas = useUnitEtas({ units, incidents, enabled: filter === "salida" });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const libres = units.filter((u) => u.status === "disponible").length;
  const enSalida = units.filter((u) => isUnitEnSalida(u.status)).length;
  const visibleUnits =
    filter === "salida"
      ? units
          .filter((u) => isUnitEnSalida(u.status))
          .sort((a, b) => {
            // Primero las que van a la escena, luego los regresos; dentro de
            // cada grupo, la llegada más próxima arriba.
            const groupA = a.status === "en_ruta" ? 0 : 1;
            const groupB = b.status === "en_ruta" ? 0 : 1;
            if (groupA !== groupB) return groupA - groupB;
            return (
              (etas[a.id]?.seconds ?? Number.POSITIVE_INFINITY) -
              (etas[b.id]?.seconds ?? Number.POSITIVE_INFINITY)
            );
          })
      : filter === "libres"
        ? units.filter((u) => u.status === "disponible")
        : units;

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="pointer-events-auto fixed inset-0 z-[1000] grid place-items-center bg-black/65 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Gestión de unidades"
    >
      <div className="anim-slidein flex max-h-[88vh] w-full max-w-xl flex-col rounded-xl border border-line bg-panel shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
          <h2 className="display flex items-center gap-2 text-base font-bold tracking-wide uppercase">
            <Truck size={17} weight="fill" className="text-blue" aria-hidden="true" /> Unidades del parque
          </h2>
          <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Cerrar">
            <X size={15} aria-hidden="true" />
          </button>
        </header>

        <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2">
          <span className="rounded-full border border-green/35 bg-green/10 px-2 py-0.5 text-[10.5px] font-bold text-green">
            {libres}/{units.length} libres
          </span>
          <p className="mr-auto text-[11px] text-mu2">
            {filter === "salida"
              ? "ETA vial cada 45 s · ordenadas por llegada (≈ = estimación sin ruta)"
              : "Toque «Seguir» para centrar la cámara en el mapa"}
          </p>
          {canWrite && (
            <button type="button" className="btn btn-sm btn-blue shrink-0" onClick={onAdd}>
              <Plus size={13} weight="bold" aria-hidden="true" /> Agregar
            </button>
          )}
        </div>

        {/* Filtro de la mesa de control: ver solo las que salen o las libres */}
        <div className="flex shrink-0 items-center gap-1.5 border-b border-line px-4 py-2">
          {(
            [
              ["todas", `Todas · ${units.length}`],
              ["salida", `En salida · ${enSalida}`],
              ["libres", `Libres · ${libres}`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={cx(
                "rounded-full border px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider",
                filter === key
                  ? "border-amber/60 bg-amber/15 text-amber"
                  : "border-line bg-panel2 text-mu2 hover:text-tx",
              )}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="dialog-scroll min-h-0 flex-1 overflow-y-auto p-3">
          {visibleUnits.length === 0 && (
            <p className="px-1 py-6 text-center text-[12.5px] text-mu2">
              {units.length === 0
                ? "Sin unidades registradas. Agrega la primera con «Agregar»."
                : filter === "salida"
                  ? "Ninguna unidad está saliendo a una emergencia."
                  : "No hay unidades disponibles en este momento."}
            </p>
          )}
          <ul className="space-y-1.5">
            {visibleUnits.map((u) => {
              const meta = UNIT_STATUS_META[u.status];
              const busy = busyId === u.id;
              const eta = filter === "salida" ? etas[u.id] : undefined;
              const destinationIncident =
                u.status === "en_ruta" ? activeIncidentForUnit(u, incidents) : null;
              const destination =
                u.status === "regresando"
                  ? "Cuartel B-35"
                  : destinationIncident?.title ?? "Sin destino";
              const hasDestination = u.status === "regresando" || destinationIncident != null;
              const etaValid =
                eta != null &&
                (u.status === "regresando"
                  ? eta.target === "cuartel"
                  : destinationIncident != null &&
                    eta.target === "incidente" &&
                    eta.incidentId === destinationIncident.id);
              return (
                <li
                  key={u.id}
                  className={`rounded-lg border px-2.5 py-2 transition-colors ${
                    followingId === u.id ? "border-amber bg-amber/10" : "border-line bg-panel2"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: STATUS_COLOR[u.status] }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline gap-x-2 text-[13px] font-bold leading-tight">
                        {u.code}
                        <span
                          className="rounded-full px-1.5 py-0.5 font-mono text-[9px] font-bold"
                          style={{
                            color: STATUS_COLOR[u.status],
                            background: `color-mix(in srgb, ${STATUS_COLOR[u.status]} 16%, transparent)`,
                          }}
                        >
                          {CLAVE_BY_STATUS[u.status]}
                        </span>
                        <span className="text-[11px] font-semibold" style={{ color: STATUS_COLOR[u.status] }}>
                          {meta.label}
                        </span>
                      </p>
                      <p className="truncate text-[11px] text-mu2">
                        {UNIT_TYPE_META[u.type].label} · {u.name}
                        {u.station ? ` · Cía. ${u.station}` : ""}
                      </p>
                      {filter === "salida" && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                          <span className="inline-flex min-w-0 items-center gap-1 text-mu">
                            <MapPin size={11} className="shrink-0" aria-hidden="true" />
                            <span className="truncate">{destination}</span>
                          </span>
                          {etaValid ? (
                            <span
                              className={cx(
                                "inline-flex items-center gap-1 font-semibold",
                                eta.estimated ? "text-mu" : "text-amber",
                              )}
                              title={
                                eta.estimated
                                  ? "OSRM no respondió: estimación en línea recta a 30 km/h"
                                  : "Distancia y tiempo por ruta vial (OSRM)"
                              }
                            >
                              <Clock size={11} className="shrink-0" aria-hidden="true" />
                              {eta.estimated ? "≈ " : ""}
                              {fmtEta(eta.seconds)} · {fmtDistance(eta.meters)}
                            </span>
                          ) : !hasDestination ? (
                            <span className="text-mu2">Sin destino</span>
                          ) : u.lat == null || u.lng == null ? (
                            <span className="text-mu2">Sin GPS</span>
                          ) : (
                            <span className="text-mu2">Calculando ETA…</span>
                          )}
                          {u.speedKmh != null && (
                            <span className="text-mu2">
                              {u.speedKmh < 1 ? "Detenida" : `${Math.round(u.speedKmh)} km/h`}
                            </span>
                          )}
                          {u.pingAt != null && (
                            <span className="text-mu2">
                              GPS {timeAgo(new Date(u.pingAt).toISOString())}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        className="btn btn-sm px-2 py-1"
                        onClick={() => onFollow(followingId === u.id ? null : u.id)}
                        title={followingId === u.id ? "Dejar de seguir la cámara" : "Seguir la cámara"}
                        aria-label={`Seguir cámara de ${u.code}`}
                      >
                        <Crosshair size={12} aria-hidden="true" />
                      </button>
                      {canWrite && (
                        <button
                          type="button"
                          className="btn btn-sm px-2 py-1"
                          onClick={() => onEdit(u)}
                          disabled={busy}
                          title="Modificar estado, dotación o posición"
                          aria-label={`Modificar ${u.code}`}
                        >
                          <Pencil size={12} aria-hidden="true" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          className="btn btn-sm px-2 py-1 text-red"
                          onClick={() => setConfirmId(confirmId === u.id ? null : u.id)}
                          disabled={busy}
                          title="Dar de baja la unidad"
                          aria-label={`Dar de baja ${u.code}`}
                        >
                          <Trash size={12} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                  {confirmId === u.id && (
                    <div className="mt-2 flex items-center gap-2 rounded border border-red/40 bg-red/10 px-2 py-1.5">
                      <p className="text-[11.5px] font-semibold text-red">
                        ¿Dar de baja {u.code} y todo su inventario?
                      </p>
                      <div className="ml-auto flex gap-1">
                        <button
                          type="button"
                          className="btn btn-sm px-2 py-1"
                          onClick={() => setConfirmId(null)}
                        >
                          No
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm bg-red px-2.5 py-1 text-white"
                          onClick={() => {
                            setConfirmId(null);
                            onRemove(u);
                          }}
                        >
                          Sí, dar de baja
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
