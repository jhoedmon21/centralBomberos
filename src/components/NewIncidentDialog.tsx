"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import {
  CheckCircle,
  Crosshair,
  DotsSixVertical,
  MagnifyingGlass,
  MapPin,
  PencilSimple,
  PlusCircle,
  X,
} from "@phosphor-icons/react";
import { CITY_CENTER } from "@/lib/geo";
import { SEVERITY_META, UNIT_STATUS_META } from "@/lib/meta";
import type { Severity, UnitDTO } from "@/lib/types";
import { cx } from "@/lib/utils";

export interface IncidentDraft {
  title: string;
  address: string;
  severity: Severity;
  notes: string;
  lat: string;
  lng: string;
  reporterName: string;
  /** Foto adjunta como data URL ("" = sin foto) */
  photo: string;
}

export const EMPTY_DRAFT: IncidentDraft = {
  title: "",
  address: "",
  severity: "alta",
  notes: "",
  lat: CITY_CENTER.lat.toFixed(5),
  lng: CITY_CENTER.lng.toFixed(5),
  reporterName: "",
  photo: "",
};

const TITLE_SUGGESTIONS = [
  "Incendio estructural",
  "Incendio forestal",
  "Incendio en mercado",
  "Fuga de gas",
  "Rescate vehicular",
  "Emergencia médica",
  "Derrumbe",
];

interface Props {
  draft: IncidentDraft;
  setDraft: (d: IncidentDraft) => void;
  busy: boolean;
  /** "create" (por defecto) para registrar; "edit" para modificar un reporte */
  mode?: "create" | "edit";
  onClose: () => void;
  /** Recibe las unidades marcadas en «Despachar ahora» ([] en edit o sin selección) */
  onSave: (dispatchUnitIds: number[]) => void;
  onStartPick: () => void;
  /** Unidades disponibles para «Despachar ahora» (solo create) */
  units?: UnitDTO[];
}

interface GeoHit {
  label: string;
  lat: number;
  lng: number;
}

/** Registro manual de un reporte desde la central */
export default function NewIncidentDialog({ draft, setDraft, busy, mode = "create", units, onClose, onSave, onStartPick }: Props) {
  const editing = mode === "edit";
  const [geoBusy, setGeoBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  // «Despachar ahora»: unidades marcadas al crear (la unidad sale directo
  // con la misión — también para reportes que llegan por WhatsApp)
  const [picked, setPicked] = useState<number[]>([]);
  // Búsqueda de dirección (geocodificación sin API key vía /api/geocode)
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchHits, setSearchHits] = useState<GeoHit[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [fixedLabel, setFixedLabel] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const wasTouched = useRef(false);
  useDialogFocus(dialogRef);

  // Ventana arrastrable (solo al editar) para dejar ver el mapa y ajustar la ubicación con clics
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

  function set<K extends keyof IncidentDraft>(key: K, value: IncidentDraft[K]) {
    setDraft({ ...draft, [key]: value });
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      return;
    }
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

  async function searchAddress() {
    const q = draft.address.trim();
    setSearchError(null);
    setFixedLabel(null);
    if (q.length < 3) {
      setSearchError("Escribe al menos 3 caracteres de la dirección.");
      return;
    }
    setSearchBusy(true);
    setSearchHits(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("geocode");
      const data = (await res.json()) as { results: GeoHit[] };
      setSearchHits(data.results);
    } catch {
      setSearchError("No se pudo buscar la dirección. Revisa la conexión e intenta de nuevo.");
    } finally {
      setSearchBusy(false);
    }
  }

  function applyGeoHit(hit: GeoHit) {
    setDraft({ ...draft, lat: hit.lat.toFixed(5), lng: hit.lng.toFixed(5) });
    setSearchHits(null);
    setSearchError(null);
    setFixedLabel(hit.label);
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
    !draft.title.trim() ||
    !draft.address.trim() ||
    !Number.isFinite(Number(draft.lat)) ||
    !Number.isFinite(Number(draft.lng));

  const submitLabel = busy
    ? editing
      ? "Guardando…"
      : "Registrando…"
    : editing
      ? "Guardar cambios"
      : "Registrar reporte";

  useEffect(() => {
    if (touched && !wasTouched.current && invalid) errorRef.current?.focus();
    wasTouched.current = touched;
  }, [touched, invalid]);

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-[1000] grid place-items-center p-4 pointer-events-none bg-black/15"
      role="dialog"
      aria-label={editing ? "Editar reporte" : "Nuevo reporte manual"}
    >
      <div
        ref={panelRef}
        style={dragPos ? { position: "fixed", left: dragPos.x, top: dragPos.y, margin: 0 } : undefined}
        className={cx(
          "anim-slidein pointer-events-auto flex max-h-[92vh] w-full max-w-lg flex-col rounded border border-line bg-panel shadow-2xl",
          dragging && "select-none",
        )}
      >
        <header
          className="flex items-center justify-between border-b border-line px-4 py-3 cursor-grab touch-none select-none active:cursor-grabbing [&_button]:cursor-pointer"
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <h2 className="display flex items-center gap-2 text-base font-bold tracking-wide uppercase">
            {editing ? (
              <PencilSimple size={17} className="text-red" aria-hidden="true" />
            ) : (
              <PlusCircle size={17} className="text-red" aria-hidden="true" />
            )}
            {editing ? "Editar reporte" : "Nuevo reporte manual"}
          </h2>
          <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Cerrar">
            <X size={15} aria-hidden="true" />
          </button>
        </header>

        <p className="flex items-center gap-1.5 border-b border-line bg-panel2 px-4 py-1.5 text-[11px] text-mu">
          <DotsSixVertical size={13} weight="bold" className="shrink-0 text-mu2" aria-hidden="true" />
          <span>
            Arrastra la ventana desde el título.{" "}
            {editing ? (
              <>
                <span className="font-semibold text-fg">Haz clic en el mapa</span> para ajustar la ubicación.
              </>
            ) : (
              <>
                Con <span className="font-semibold text-fg">«Fijar en el mapa»</span> y un clic en el mapa
                ajustas la ubicación.
              </>
            )}
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
          <div>
            <label className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase" htmlFor="ni-title">
              Tipo de emergencia *
            </label>
            <input
              id="ni-title"
              className="input"
              list="ni-titles"
              name="title"
              autoComplete="off"
              placeholder="Incendio estructural…"
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
            />
            <datalist id="ni-titles">
              {TITLE_SUGGESTIONS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase" htmlFor="ni-addr">
              Dirección *
            </label>
            <div className="flex gap-2">
              <input
                id="ni-addr"
                className="input flex-1"
                name="address"
                autoComplete="off"
                placeholder="Av. Ejemplo 123, distrito"
                value={draft.address}
                onChange={(e) => set("address", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void searchAddress();
                  }
                }}
              />
              <button
                className="btn btn-sm shrink-0"
                onClick={() => void searchAddress()}
                disabled={searchBusy}
                type="button"
              >
                <MagnifyingGlass size={13} aria-hidden="true" /> {searchBusy ? "Buscando…" : "Buscar"}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-mu2">
              Escríbela y pulsa <span className="font-semibold">Buscar</span> (o Enter) para fijar la ubicación sola;
              también puedes fijarla en el mapa.
            </p>
            {searchError && (
              <p role="alert" className="mt-1 text-[11.5px] font-semibold text-amber">
                {searchError}
              </p>
            )}
            {searchHits && searchHits.length === 0 && !searchBusy && (
              <p role="status" className="mt-1.5 text-[11.5px] text-mu">
                Sin resultados para esa dirección. Agrega más detalle (distrito, referencia) o fíjala en el mapa.
              </p>
            )}
            {searchHits && searchHits.length > 0 && (
              <ul className="mt-1.5 max-h-44 space-y-0.5 overflow-y-auto rounded border border-line bg-panel2 p-1">
                {searchHits.map((r) => (
                  <li key={`${r.lat},${r.lng},${r.label}`}>
                    <button
                      className="w-full rounded px-2 py-1.5 text-left hover:bg-line"
                      onClick={() => applyGeoHit(r)}
                      type="button"
                    >
                      <span className="flex items-center gap-1.5 text-[12px] leading-snug">
                        <MapPin size={12} weight="fill" className="shrink-0 text-blue" aria-hidden="true" />
                        <span className="truncate">{r.label}</span>
                      </span>
                      <span className="ml-[18px] block font-mono text-[10.5px] text-mu2">
                        {r.lat.toFixed(5)}, {r.lng.toFixed(5)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {fixedLabel && (
              <p role="status" className="mt-1.5 flex items-center gap-1 text-[11px] text-green">
                <CheckCircle size={12} weight="fill" className="shrink-0" aria-hidden="true" /> Ubicación fijada:{" "}
                {fixedLabel}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase" htmlFor="ni-sev">
                Severidad
              </label>
              <select
                id="ni-sev"
                className="input"
                value={draft.severity}
                onChange={(e) => set("severity", e.target.value as Severity)}
              >
                {(Object.keys(SEVERITY_META) as Severity[]).map((s) => (
                  <option key={s} value={s}>
                    {SEVERITY_META[s].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase" htmlFor="ni-rep">
                Reportante (opcional)
              </label>
              <input
                id="ni-rep"
                className="input"
                name="reporter"
                autoComplete="off"
                placeholder="Nombre o entidad"
                value={draft.reporterName}
                onChange={(e) => set("reporterName", e.target.value)}
              />
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
            <label className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase" htmlFor="ni-notes">
              Notas para la unidad
            </label>
            <textarea
              id="ni-notes"
              className="input min-h-[70px] resize-y"
              name="notes"
              placeholder="Accesos, riesgos, personas atrapadas…"
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase" htmlFor="ni-photo">
              Foto adjunta (opcional)
            </label>
            {draft.photo ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={draft.photo}
                  alt="Foto adjunta del reporte"
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
                id="ni-photo"
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

          {/* Despachar ahora (solo al crear): asigna unidades ANTES de salir.
              Sirve igual para reportes por WhatsApp — la unidad recibe la
              misión y el push de una vez. */}
          {!editing && units && units.length > 0 && (
            <div>
              <span className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase">
                Despachar ahora — unidades que salen directo (opcional)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {units.map((u) => {
                  const on = picked.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setPicked(on ? picked.filter((id) => id !== u.id) : [...picked, u.id])}
                      className={cx(
                        "flex items-center gap-1.5 rounded border px-2 py-1 text-[12px] font-semibold",
                        on ? "border-red bg-red text-white" : "border-line bg-panel2 text-fg hover:bg-line",
                      )}
                    >
                      <span aria-hidden="true">{on ? <CheckCircle size={13} weight="fill" /> : <PlusCircle size={13} />}</span>
                      {u.code}
                      <span className={cx("text-[10px] font-bold uppercase", on ? "text-white/80" : "text-mu2")}>
                        {UNIT_STATUS_META[u.status].label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-[11px] text-mu2">
                {picked.length
                  ? `${picked.length} unidad${picked.length > 1 ? "es" : ""} recibirá la misión + WhatsApp al confirmar`
                  : "Puedes registrar el reporte sin despachar y hacerlo luego con «Despachar unidad»."}
              </p>
            </div>
          )}

          {touched && invalid && (
            <p ref={errorRef} role="alert" tabIndex={-1} className="text-[12px] font-semibold text-red">
              Completa el tipo, la dirección y una ubicación válida.
            </p>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button className="btn" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button
            className={cx("btn btn-red")}
            onClick={() => {
              setTouched(true);
              if (!invalid) onSave(picked);
            }}
            disabled={busy}
          >
            {submitLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
