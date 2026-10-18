"use client";

// Directorio de preplans (fichas de edificios de riesgo): lista con
// búsqueda + formulario de alta/edición. La ubicación se fija con
// «Fijar en el mapa» (los clics posteriores ajustan lat/lng mientras
// la ventana queda abierta — igual que los hidrantes).

import { useEffect, useMemo, useRef, useState } from "react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useDraggablePanel } from "@/hooks/useDraggablePanel";
import { Buildings, Crosshair, MagnifyingGlass, Pencil, Plus, Trash, X } from "@phosphor-icons/react";
import type { OperatorRole, PreplanDTO } from "@/lib/types";
import { cx } from "@/lib/utils";

export interface PreplanDraft {
  id: number | null;
  title: string;
  address: string;
  lat: string;
  lng: string;
  layout: string;
  hazards: string;
  keysInfo: string;
  waterSources: string;
  contactName: string;
  contactPhone: string;
  notes: string;
  photos: string;
  status: "activo" | "inactivo";
}

export const EMPTY_PREPLAN_DRAFT: PreplanDraft = {
  id: null,
  title: "",
  address: "",
  lat: "",
  lng: "",
  layout: "",
  hazards: "",
  keysInfo: "",
  waterSources: "",
  contactName: "",
  contactPhone: "",
  notes: "",
  photos: "",
  status: "activo",
};

export function preplanDraftFrom(p: PreplanDTO): PreplanDraft {
  return {
    id: p.id,
    title: p.title,
    address: p.address,
    lat: String(p.lat),
    lng: String(p.lng),
    layout: p.layout ?? "",
    hazards: p.hazards ?? "",
    keysInfo: p.keysInfo ?? "",
    waterSources: p.waterSources ?? "",
    contactName: p.contactName ?? "",
    contactPhone: p.contactPhone ?? "",
    notes: p.notes ?? "",
    photos: p.photos.join("\n"),
    status: p.status,
  };
}

interface Props {
  preplans: PreplanDTO[];
  role: OperatorRole;
  draft: PreplanDraft;
  setDraft: (d: PreplanDraft) => void;
  busy: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete: (id: number) => void;
  onStartPick: () => void;
  onView: (p: PreplanDTO) => void;
}

export default function PreplansDialog({
  preplans,
  role,
  draft,
  setDraft,
  busy,
  onClose,
  onSave,
  onDelete,
  onStartPick,
  onView,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  const { dragging, panelStyle, handleProps } = useDraggablePanel(dialogRef);

  const [mode, setMode] = useState<"list" | "form">(draft.id == null && draft.title ? "form" : "list");
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && mode === "list") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, mode]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return preplans;
    return preplans.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        (p.hazards ?? "").toLowerCase().includes(q),
    );
  }, [preplans, query]);

  const activeCount = preplans.filter((p) => p.status === "activo").length;

  // ---------- Formulario ----------
  if (mode === "form") {
    const editing = draft.id != null;
    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
        <div
          ref={dialogRef}
          style={panelStyle}
          className={cx(
            "max-h-[88vh] w-full max-w-lg overflow-y-auto rounded border border-line bg-bg2 p-4 shadow-2xl",
            dragging && "select-none",
          )}
        >
          <div
            className="mb-3 flex cursor-grab touch-none select-none items-center gap-2 active:cursor-grabbing [&_button]:cursor-pointer"
            {...handleProps}
          >
            <Buildings size={17} className="text-amber" aria-hidden="true" />
            <h2 className="display text-base font-bold uppercase tracking-wider">
              {editing ? "Editar ficha" : "Ficha operativa nueva"}
            </h2>
            <button className="btn btn-sm ml-auto" onClick={() => setMode("list")} title="Volver a la lista">
              <X size={13} aria-hidden="true" /> Volver
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase">Título *</span>
              <input
                className="input"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="«Mercado San Camilo»"
                maxLength={120}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase">Dirección *</span>
              <input
                className="input"
                value={draft.address}
                onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                placeholder="Av. … Cdra. …"
                maxLength={200}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase">Latitud *</span>
              <input
                className="input font-mono text-[13px]"
                value={draft.lat}
                onChange={(e) => setDraft({ ...draft, lat: e.target.value })}
                placeholder="-16.62"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase">Longitud *</span>
              <div className="flex gap-1.5">
                <input
                  className="input font-mono text-[13px]"
                  value={draft.lng}
                  onChange={(e) => setDraft({ ...draft, lng: e.target.value })}
                  placeholder="-72.71"
                />
                <button className="btn btn-sm shrink-0" onClick={onStartPick} title="Haz clic en el mapa para fijar la ubicación">
                  <Crosshair size={14} aria-hidden="true" /> Mapa
                </button>
              </div>
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase">Distribución (pisos, área, naves)</span>
              <textarea
                className="input min-h-[56px]"
                value={draft.layout}
                onChange={(e) => setDraft({ ...draft, layout: e.target.value })}
                placeholder="2 pisos, patio interno, depósitos en el fondo…"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase">Peligros previstos</span>
              <textarea
                className="input min-h-[56px]"
                value={draft.hazards}
                onChange={(e) => setDraft({ ...draft, hazards: e.target.value })}
                placeholder="Tanques de LPG, balones de gas 45 kg, tableros eléctricos, mucha gente…"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase">Llaves de acceso / cortes</span>
              <textarea
                className="input min-h-[52px]"
                value={draft.keysInfo}
                onChange={(e) => setDraft({ ...draft, keysInfo: e.target.value })}
                placeholder="Portón lateral con llave del administrador; llave general tras el mostrador…"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase">Puntos de agua (cisternas, piscinas, pozos)</span>
              <input
                className="input"
                value={draft.waterSources}
                onChange={(e) => setDraft({ ...draft, waterSources: e.target.value })}
                placeholder="Cisterna de 5 m³ en el patio; piscina del colegio contiguo…"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase">Contacto</span>
              <input
                className="input"
                value={draft.contactName}
                onChange={(e) => setDraft({ ...draft, contactName: e.target.value })}
                placeholder="Nombre del responsable"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase">Teléfono</span>
              <input
                className="input"
                value={draft.contactPhone}
                onChange={(e) => setDraft({ ...draft, contactPhone: e.target.value })}
                placeholder="+51 …"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase">URLs de fotos (una por línea)</span>
              <textarea
                className="input min-h-[52px]"
                value={draft.photos}
                onChange={(e) => setDraft({ ...draft, photos: e.target.value })}
                placeholder="https://… (fachada, accesos, interiores)"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase">Notas</span>
              <textarea
                className="input min-h-[52px]"
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="Observaciones para el despacho"
              />
            </label>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <label className="mr-auto flex items-center gap-1.5 text-[12px] text-mu">
              <input
                type="checkbox"
                checked={draft.status === "activo"}
                onChange={(e) => setDraft({ ...draft, status: e.target.checked ? "activo" : "inactivo" })}
              />
              Ficha activa (aparece en escena)
            </label>
            <button className="btn btn-red" onClick={onSave} disabled={busy}>
              {busy ? "Guardando…" : editing ? "Guardar cambios" : "Crear ficha"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Lista ----------
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div
        ref={dialogRef}
        style={panelStyle}
        className={cx(
          "flex max-h-[88vh] w-full max-w-xl flex-col rounded border border-line bg-bg2 p-4 shadow-2xl",
          dragging && "select-none",
        )}
      >
        <div
          className="flex cursor-grab touch-none select-none items-center gap-2 active:cursor-grabbing [&_button]:cursor-pointer"
          {...handleProps}
        >
          <Buildings size={18} className="text-amber" aria-hidden="true" />
          <h2 className="display text-base font-bold uppercase tracking-wider">Preplans</h2>
          <span className="text-[11px] text-mu2">{activeCount} activas de {preplans.length}</span>
          <button className="btn btn-sm ml-auto" onClick={onClose} title="Cerrar">
            <X size={13} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="flex flex-1 items-center gap-1.5 rounded border border-line bg-panel px-2">
            <MagnifyingGlass size={13} className="text-mu2" aria-hidden="true" />
            <input
              className="w-full bg-transparent py-1.5 text-[12.5px] outline-none"
              placeholder="Buscar por título, dirección o peligro…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            className="btn btn-sm btn-red"
            onClick={() => {
              setDraft(EMPTY_PREPLAN_DRAFT);
              setMode("form");
            }}
          >
            <Plus size={14} weight="bold" aria-hidden="true" /> Ficha nueva
          </button>
        </div>

        <div className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
          {rows.length === 0 && (
            <p className="py-6 text-center text-[12px] text-mu2">
              {preplans.length === 0
                ? "Sin fichas todavía — registra los edificios de riesgo del sector (mercados, gasolineras, colegios…)."
                : "Nada coincide con la búsqueda."}
            </p>
          )}
          {rows.map((p) => (
            <div
              key={p.id}
              className={cx(
                "flex items-center gap-2 rounded border px-2.5 py-2",
                p.status === "activo" ? "border-line bg-panel" : "border-line bg-panel2 opacity-60",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="display truncate text-[13.5px] font-bold">{p.title}</p>
                <p className="truncate text-[11.5px] text-mu">
                  {p.address} · {p.hazards ? p.hazards.slice(0, 60) : "sin peligros anotados"}
                </p>
              </div>
              <button className="btn btn-sm" title="Ver ficha completa" onClick={() => onView(p)}>
                <Buildings size={13} aria-hidden="true" />
              </button>
              {(role === "jefe" || role === "operador") && (
                <button
                  className="btn btn-sm"
                  title="Editar ficha"
                  onClick={() => {
                    setDraft(preplanDraftFrom(p));
                    setMode("form");
                  }}
                >
                  <Pencil size={13} aria-hidden="true" />
                </button>
              )}
              {role === "jefe" && (
                <button className="btn btn-sm text-red" title="Eliminar ficha" onClick={() => onDelete(p.id)}>
                  <Trash size={13} aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
