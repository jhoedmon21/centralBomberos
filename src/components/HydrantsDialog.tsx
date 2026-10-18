"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useDraggablePanel } from "@/hooks/useDraggablePanel";
import { Drop, MagnifyingGlass, Plus, X } from "@phosphor-icons/react";
import { HYDRANT_SITUATION_META } from "@/lib/meta";
import type { HydrantDTO, HydrantSituation } from "@/lib/types";
import { cx, hydrantLabel } from "@/lib/utils";

interface Props {
  hydrants: HydrantDTO[];
  onClose: () => void;
  /** Abre el diálogo de registro (se ubica en el mapa) */
  onNewHydrant: () => void;
  /** Cambio rápido de situación (PATCH /api/hydrants/[id]) */
  onSituationChange: (id: number, situation: HydrantSituation) => Promise<void>;
}

/**
 * Directorio de hidrantes de la zona: búsqueda, filtro por situación y
 * cambio rápido de estado. Los datos llegan ya cargados de la central.
 */
export default function HydrantsDialog({ hydrants, onClose, onNewHydrant, onSituationChange }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useDialogFocus(dialogRef);
  const panelRef = useRef<HTMLDivElement>(null);
  const { dragging, panelStyle, handleProps } = useDraggablePanel(panelRef);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"todos" | HydrantSituation>("todos");
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const counts = useMemo(() => {
    const base: Record<string, number> = { todos: hydrants.length };
    for (const h of hydrants) base[h.situation] = (base[h.situation] ?? 0) + 1;
    return base;
  }, [hydrants]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return hydrants
      .filter((h) => (filter === "todos" ? true : h.situation === filter))
      .filter((h) => {
        if (!q) return true;
        return (
          (h.code ?? "").toLowerCase().includes(q) ||
          (h.notes ?? "").toLowerCase().includes(q) ||
          `${h.lat.toFixed(4)}, ${h.lng.toFixed(4)}`.includes(q)
        );
      });
  }, [hydrants, query, filter]);

  async function changeSituation(id: number, situation: HydrantSituation) {
    setBusyId(id);
    try {
      await onSituationChange(id, situation);
    } catch {
      /* el toast de error lo emite la central */
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-[1000] grid place-items-center bg-black/65 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Directorio de hidrantes"
    >
      <div
        ref={panelRef}
        style={panelStyle}
        className={cx(
          "anim-slidein flex max-h-[92vh] w-full max-w-3xl flex-col rounded border border-line bg-panel shadow-2xl",
          dragging && "select-none",
        )}
      >
        <header
          className="flex cursor-grab touch-none select-none items-center justify-between border-b border-line px-4 py-3 active:cursor-grabbing [&_button]:cursor-pointer"
          {...handleProps}
        >
          <h2 className="display flex items-center gap-2 text-base font-bold tracking-wide uppercase">
            <Drop size={17} weight="fill" className="text-blue" aria-hidden="true" /> Hidrantes de la zona
            <span className="ml-1 font-mono text-xs text-mu">{hydrants.length}</span>
          </h2>
          <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Cerrar">
            <X size={15} aria-hidden="true" />
          </button>
        </header>

        <div className="space-y-3 border-b border-line px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1">
              <MagnifyingGlass
                size={14}
                className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-mu2"
                aria-hidden="true"
              />
              <input
                ref={searchRef}
                className="input pl-8"
                type="search"
                placeholder="Buscar por código, notas o coordenadas…"
                aria-label="Buscar hidrante"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button className="btn btn-sm btn-blue" onClick={onNewHydrant}>
              <Plus size={14} weight="bold" aria-hidden="true" /> Nuevo hidrante
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por situación">
            {(["todos", "operativo", "mantenimiento", "fuera_servicio"] as const).map((key) => {
              const active = filter === key;
              const label = key === "todos" ? "Todos" : HYDRANT_SITUATION_META[key].label;
              return (
                <button
                  key={key}
                  className={cx("btn btn-sm", active ? "btn-blue" : "btn-ghost")}
                  onClick={() => setFilter(key)}
                  aria-pressed={active}
                >
                  {label}
                  <span className="ml-1 font-mono text-[10px] opacity-70">{counts[key] ?? 0}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="dialog-scroll min-h-0 flex-1 overflow-y-auto">
          {rows.length === 0 ? (
            <p className="p-6 text-center text-[13px] text-mu">
              No hay hidrantes que coincidan con la búsqueda.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((h) => {
                const meta = HYDRANT_SITUATION_META[h.situation];
                return (
                  <li
                    key={h.id}
                    className="q-item flex flex-wrap items-center gap-3 px-4 py-2.5"
                    style={{ borderLeft: `3px solid var(${meta.varName})` }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="display font-mono text-[15px] font-bold tracking-wider">
                          {hydrantLabel(h.code) ?? `#${h.id}`}
                        </span>
                        <span className="chip" style={{ color: `var(${meta.varName})` }}>
                          {meta.label}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11.5px] text-mu">
                        <span className="font-mono">{h.lat.toFixed(5)}, {h.lng.toFixed(5)}</span>
                        {h.pressure && <span className="capitalize">Presión {h.pressure}</span>}
                        {h.diameter != null && <span>Ø {h.diameter} mm</span>}
                        {h.notes && <span className="max-w-72 truncate" title={h.notes}>{h.notes}</span>}
                      </div>
                    </div>
                    <div
                      className="flex gap-1"
                      role="group"
                      aria-label={`Cambiar situación de ${h.code ?? `hidrante ${h.id}`}`}
                    >
                      {(Object.keys(HYDRANT_SITUATION_META) as HydrantSituation[]).map((s) => (
                        <button
                          key={s}
                          className={cx("btn btn-sm", h.situation === s ? "btn-ghost" : "btn-ghost opacity-90")}
                          style={
                            h.situation === s
                              ? { color: `var(${HYDRANT_SITUATION_META[s].varName})`, borderColor: `color-mix(in srgb, var(${HYDRANT_SITUATION_META[s].varName}) 45%, var(--line-2))` }
                              : undefined
                          }
                          disabled={busyId === h.id || h.situation === s}
                          onClick={() => void changeSituation(h.id, s)}
                          aria-label={`Marcar ${h.code ?? h.id} como ${HYDRANT_SITUATION_META[s].label}`}
                          title={`Marcar como ${HYDRANT_SITUATION_META[s].label}`}
                        >
                          {h.situation === s ? "●" : HYDRANT_SITUATION_META[s].label.slice(0, 9)}
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-[11.5px] text-mu">
          <span>
            Mostrando {rows.length} de {hydrants.length} hidrantes · el estado se sincroniza con la app de unidades
          </span>
          <button className="btn btn-sm" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}
