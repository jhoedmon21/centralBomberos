"use client";

// Registro de un hidrante: ventana arrastrable con el mapa visible detrás
// (se ubica con clics, como «Editar reporte») y foto opcional de la boca.

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { Crosshair, DotsSixVertical, Drop, MapPin, X } from "@phosphor-icons/react";
import { CITY_CENTER } from "@/lib/geo";
import { HYDRANT_DIAMETERS, HYDRANT_PRESSURES, HYDRANT_SITUATION_META } from "@/lib/meta";
import type { HydrantSituation } from "@/lib/types";
import { cx } from "@/lib/utils";

export interface HydrantDraft {
  code: string;
  pressure: string;
  diameter: string;
  situation: HydrantSituation;
  notes: string;
  lat: string;
  lng: string;
  /** Foto de la boca como data URL ("" = sin foto) */
  photo: string;
}

export const EMPTY_HYDRANT_DRAFT: HydrantDraft = {
  code: "",
  pressure: "buena",
  diameter: "100",
  situation: "operativo",
  notes: "",
  lat: CITY_CENTER.lat.toFixed(5),
  lng: CITY_CENTER.lng.toFixed(5),
  photo: "",
};

interface Props {
  draft: HydrantDraft;
  setDraft: (d: HydrantDraft) => void;
  busy: boolean;
  onClose: () => void;
  onSave: () => void;
  onStartPick: () => void;
}

/** Registro de un hidrante: se ubica con clics en el mapa y puede llevar foto */
export default function HydrantDialog({ draft, setDraft, busy, onClose, onSave, onStartPick }: Props) {
  const [geoBusy, setGeoBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const wasTouched = useRef(false);
  useDialogFocus(dialogRef);

  // Ventana arrastrable: deja ver el mapa y fijar la ubicación con clics
  const panelRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragState = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  function startDrag(e: ReactPointerEvent<HTMLElement>) {
    if ((e.target as HTMLElement).closest("button, a, input, select, textarea")) return;
    const panel = panelRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    dragState.current = { px: e.clientX, py: e.clientY, ox: r.left, oy: r.top };
    setDragPos({ x: r.left, y: r.top });
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function moveDrag(e: ReactPointerEvent<HTMLElement>) {
    const d = dragState.current;
    const panel = panelRef.current;
    if (!d || !panel) return;
    const margin = 8;
    const maxX = Math.max(margin, window.innerWidth - panel.offsetWidth - margin);
    const maxY = Math.max(margin, window.innerHeight - panel.offsetHeight - margin);
    setDragPos({
      x: Math.min(Math.max(e.clientX - d.px + d.ox, margin), maxX),
      y: Math.min(Math.max(e.clientY - d.py + d.oy, margin), maxY),
    });
  }

  function endDrag(e: ReactPointerEvent<HTMLElement>) {
    if (!dragState.current) return;
    dragState.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function set<K extends keyof HydrantDraft>(key: K, value: HydrantDraft[K]) {
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

  function pickPhoto(file: File | null) {
    setPhotoError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("El archivo debe ser una imagen.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("La imagen supera los 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set("photo", String(reader.result ?? ""));
    reader.readAsDataURL(file);
  }

  const invalid =
    !Number.isFinite(Number(draft.lat)) ||
    !Number.isFinite(Number(draft.lng)) ||
    Number(draft.lat) < -90 ||
    Number(draft.lat) > 90 ||
    Number(draft.lng) < -180 ||
    Number(draft.lng) > 180;

  useEffect(() => {
    if (touched && !wasTouched.current && invalid) errorRef.current?.focus();
    wasTouched.current = touched;
  }, [touched, invalid]);

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-[1000] grid place-items-center bg-black/15 p-4 pointer-events-none"
      role="dialog"
      aria-label="Registrar hidrante"
    >
      <div
        ref={panelRef}
        style={dragPos ? { position: "fixed", left: dragPos.x, top: dragPos.y, margin: 0 } : undefined}
        className={cx(
          "anim-slidein flex max-h-[92vh] w-full max-w-lg flex-col rounded border border-line bg-panel shadow-2xl pointer-events-auto",
          dragging && "select-none",
        )}
      >
        <header
          className={cx(
            "flex items-center justify-between border-b border-line px-4 py-3 cursor-grab touch-none select-none active:cursor-grabbing [&_button]:cursor-pointer",
          )}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <h2 className="display flex items-center gap-2 text-base font-bold tracking-wide uppercase">
            <Drop size={17} weight="fill" className="text-blue" aria-hidden="true" /> Registrar hidrante
          </h2>
          <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Cerrar">
            <X size={15} aria-hidden="true" />
          </button>
        </header>

        <p className="flex items-center gap-1.5 border-b border-line bg-panel2 px-4 py-1.5 text-[11px] text-mu">
          <DotsSixVertical size={13} weight="bold" className="shrink-0 text-mu2" aria-hidden="true" />
          <span>
            Arrastra la ventana desde el título y{" "}
            <span className="font-semibold text-fg">haz clic en el mapa</span> para ubicar el hidrante.
          </span>
          {dragPos && (
            <button
              type="button"
              className="btn btn-sm btn-ghost ml-auto shrink-0"
              onClick={() => setDragPos(null)}
            >
              Centrar
            </button>
          )}
        </p>

        <div className="dialog-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase" htmlFor="nh-code">
                Código (opcional)
              </label>
              <input
                id="nh-code"
                className="input uppercase"
                name="code"
                autoComplete="off"
                spellCheck={false}
                placeholder="H-13"
                value={draft.code}
                onChange={(e) => set("code", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase" htmlFor="nh-sit">
                Situación *
              </label>
              <select
                id="nh-sit"
                className="input"
                name="situation"
                value={draft.situation}
                onChange={(e) => set("situation", e.target.value as HydrantSituation)}
              >
                {(Object.keys(HYDRANT_SITUATION_META) as HydrantSituation[]).map((s) => (
                  <option key={s} value={s}>
                    {HYDRANT_SITUATION_META[s].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase" htmlFor="nh-pres">
                Presión
              </label>
              <select
                id="nh-pres"
                className="input capitalize"
                name="pressure"
                value={draft.pressure}
                onChange={(e) => set("pressure", e.target.value)}
              >
                {HYDRANT_PRESSURES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase" htmlFor="nh-diam">
                Diámetro (mm)
              </label>
              <select
                id="nh-diam"
                className="input"
                name="diameter"
                value={draft.diameter}
                onChange={(e) => set("diameter", e.target.value)}
              >
                {HYDRANT_DIAMETERS.map((d) => (
                  <option key={d} value={String(d)}>
                    {d} mm
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase">
              Ubicación *
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

          <div>
            <label className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase" htmlFor="nh-notes">
              Observaciones
            </label>
            <textarea
              id="nh-notes"
              className="input min-h-[64px] resize-y"
              name="notes"
              placeholder="Estado de la tapa, accesos, presión, requerimientos…"
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase" htmlFor="nh-photo">
              Foto de la boca (opcional)
            </label>
            {draft.photo ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={draft.photo}
                  alt="Foto adjunta del hidrante"
                  width={640}
                  height={360}
                  className="max-h-40 w-full rounded border border-line object-cover"
                />
                <button
                  className="btn btn-sm absolute top-1.5 right-1.5"
                  onClick={() => set("photo", "")}
                  type="button"
                  aria-label="Quitar foto adjunta"
                >
                  <X size={12} /> Quitar
                </button>
              </div>
            ) : (
              <input
                id="nh-photo"
                type="file"
                accept="image/*"
                name="photo"
                className="block w-full cursor-pointer rounded border border-dashed border-line2 bg-panel2 px-2 py-1.5 text-[12px] text-mu file:mr-2 file:rounded file:border-0 file:bg-line file:px-2 file:py-1 file:text-[11.5px] file:font-semibold file:text-fg"
                onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
              />
            )}
            {photoError && (
              <p role="alert" className="mt-1 text-[11.5px] font-semibold text-red">
                {photoError}
              </p>
            )}
          </div>

          {touched && invalid && (
            <p ref={errorRef} role="alert" tabIndex={-1} className="text-[12px] font-semibold text-red">
              La ubicación no es válida. Fíjala en el mapa o corrige las coordenadas.
            </p>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button className="btn" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button
            className={cx("btn btn-blue")}
            onClick={() => {
              setTouched(true);
              if (!invalid) onSave();
            }}
            disabled={busy}
          >
            {busy ? "Registrando…" : "Registrar hidrante"}
          </button>
        </footer>
      </div>
    </div>
  );
}
