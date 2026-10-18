"use client";

import { useEffect, useRef, useState } from "react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useDraggablePanel } from "@/hooks/useDraggablePanel";
import { Crosshair, MapPin, Truck, X } from "@phosphor-icons/react";
import { CITY_CENTER } from "@/lib/geo";
import { UNIT_STATUS_META, UNIT_TYPE_META } from "@/lib/meta";
import type { UnitStatus, UnitType } from "@/lib/types";
import { cx } from "@/lib/utils";

export interface UnitDraft {
  code: string;
  name: string;
  type: UnitType;
  status: UnitStatus;
  station: string;
  crew: string;
  lat: string;
  lng: string;
}

export const EMPTY_UNIT_DRAFT: UnitDraft = {
  code: "",
  name: "",
  type: "bomba",
  status: "disponible",
  station: "",
  crew: "4",
  lat: CITY_CENTER.lat.toFixed(5),
  lng: CITY_CENTER.lng.toFixed(5),
};

interface Props {
  draft: UnitDraft;
  setDraft: (d: UnitDraft) => void;
  busy: boolean;
  onClose: () => void;
  onSave: () => void;
  onStartPick: () => void;
  /** Modo edición: cambia título y etiqueta (el guardado hace PATCH) */
  title?: string;
  saveLabel?: string;
}

/** Registro de una unidad del parque: identificación, compañía y ubicación */
export default function NewUnitDialog({
  draft,
  setDraft,
  busy,
  onClose,
  onSave,
  onStartPick,
  title = "Agregar unidad",
  saveLabel = "Registrar unidad",
}: Props) {
  const [geoBusy, setGeoBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const wasTouched = useRef(false);
  useDialogFocus(dialogRef);
  const panelRef = useRef<HTMLDivElement>(null);
  const { dragging, panelStyle, handleProps } = useDraggablePanel(panelRef);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function set<K extends keyof UnitDraft>(key: K, value: UnitDraft[K]) {
    setDraft({ ...draft, [key]: value });
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDraft({
          ...draft,
          lat: pos.coords.latitude.toFixed(5),
          lng: pos.coords.longitude.toFixed(5),
        });
        setGeoBusy(false);
      },
      () => setGeoBusy(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  const validCoords =
    Number.isFinite(Number(draft.lat)) &&
    Number.isFinite(Number(draft.lng)) &&
    Number(draft.lat) >= -90 &&
    Number(draft.lat) <= 90 &&
    Number(draft.lng) >= -180 &&
    Number(draft.lng) <= 180;
  const validCrew = /^\d{1,2}$/.test(draft.crew.trim()) && Number(draft.crew) <= 30;
  const invalid = !draft.code.trim() || !draft.name.trim() || !validCoords || !validCrew;

  useEffect(() => {
    if (touched && !wasTouched.current && invalid) errorRef.current?.focus();
    wasTouched.current = touched;
  }, [touched, invalid]);

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-[1000] grid place-items-center bg-black/65 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={panelRef}
        style={panelStyle}
        className={cx(
          "anim-slidein flex max-h-[92vh] w-full max-w-lg flex-col rounded border border-line bg-panel shadow-2xl",
          dragging && "select-none",
        )}
      >
        <header
          className="flex cursor-grab touch-none select-none items-center justify-between border-b border-line px-4 py-3 active:cursor-grabbing [&_button]:cursor-pointer"
          {...handleProps}
        >
          <h2 className="display flex items-center gap-2 text-base font-bold tracking-wide uppercase">
            <Truck size={17} weight="fill" className="text-blue" aria-hidden="true" /> {title}
          </h2>
          <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Cerrar">
            <X size={15} aria-hidden="true" />
          </button>
        </header>

        <div className="dialog-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <div className="grid grid-cols-[1fr_2fr] gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase" htmlFor="nu-code">
                Código *
              </label>
              <input
                id="nu-code"
                className="input uppercase"
                name="code"
                autoComplete="off"
                spellCheck={false}
                placeholder="B-3"
                value={draft.code}
                onChange={(e) => set("code", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase" htmlFor="nu-name">
                Nombre *
              </label>
              <input
                id="nu-name"
                className="input"
                name="name"
                autoComplete="off"
                placeholder="Bomba 3"
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase" htmlFor="nu-type">
                Tipo
              </label>
              <select
                id="nu-type"
                className="input"
                value={draft.type}
                onChange={(e) => set("type", e.target.value as UnitType)}
              >
                {(Object.keys(UNIT_TYPE_META) as UnitType[]).map((t) => (
                  <option key={t} value={t}>
                    {UNIT_TYPE_META[t].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase" htmlFor="nu-status">
                Estado
              </label>
              <select
                id="nu-status"
                className="input"
                value={draft.status}
                onChange={(e) => set("status", e.target.value as UnitStatus)}
              >
                {(Object.keys(UNIT_STATUS_META) as UnitStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {UNIT_STATUS_META[s].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-[2fr_1fr] gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase" htmlFor="nu-station">
                Compañía / base
              </label>
              <input
                id="nu-station"
                className="input"
                name="station"
                autoComplete="off"
                placeholder="Cía. Camaná Centro"
                value={draft.station}
                onChange={(e) => set("station", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase" htmlFor="nu-crew">
                Dotación
              </label>
              <input
                id="nu-crew"
                type="number"
                min={0}
                max={30}
                name="crew"
                inputMode="numeric"
                className="input text-center"
                value={draft.crew}
                onChange={(e) => set("crew", e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase">
              Posición en el mapa *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                className="input font-mono text-[12.5px]"
                name="lat"
                inputMode="decimal"
                aria-label="Latitud"
                value={draft.lat}
                onChange={(e) => set("lat", e.target.value)}
              />
              <input
                className="input font-mono text-[12.5px]"
                name="lng"
                inputMode="decimal"
                aria-label="Longitud"
                value={draft.lng}
                onChange={(e) => set("lng", e.target.value)}
              />
            </div>
            <div className="mt-2 flex gap-2">
              <button className="btn btn-sm" onClick={onStartPick} type="button">
                <Crosshair size={13} aria-hidden="true" /> Fijar en el mapa
              </button>
              <button className="btn btn-sm" onClick={useMyLocation} disabled={geoBusy} type="button">
                <MapPin size={13} aria-hidden="true" /> {geoBusy ? "Ubicando…" : "Usar mi ubicación"}
              </button>
            </div>
          </div>

          {touched && invalid && (
            <p ref={errorRef} role="alert" tabIndex={-1} className="text-[12px] font-semibold text-red">
              Completa código, nombre, dotación válida (0–30) y una ubicación correcta.
            </p>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button className="btn" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button
            className="btn btn-blue"
            onClick={() => {
              setTouched(true);
              if (!invalid) onSave();
            }}
            disabled={busy}
          >
            {busy ? "Guardando…" : saveLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
