"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useDraggablePanel } from "@/hooks/useDraggablePanel";
import { GearSix, Siren, WhatsappLogo, X } from "@phosphor-icons/react";
import type { HydrantNear } from "@/lib/geo";
import { haversineM } from "@/lib/geo";
import { UNIT_STATUS_META, UNIT_TYPE_META } from "@/lib/meta";
import type { IncidentDTO, UnitDTO } from "@/lib/types";
import { cx, displayCode, fmtDistance } from "@/lib/utils";
import { dispatchMessage, staticOpsMapUrl } from "@/lib/wa";

interface Props {
  incident: IncidentDTO;
  units: UnitDTO[];
  nearHydrants: HydrantNear[];
  waUnit: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (unitIds: number[]) => void;
  onOpenSettings: () => void;
}

/** Selección de unidad + vista previa del despacho por WhatsApp */
export default function DispatchDialog({
  incident,
  units,
  nearHydrants,
  waUnit,
  busy,
  onClose,
  onConfirm,
  onOpenSettings,
}: Props) {
  const code = displayCode(incident.id, incident.createdAt);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  const panelRef = useRef<HTMLDivElement>(null);
  const { dragging, panelStyle, handleProps } = useDraggablePanel(panelRef);

  const sorted = useMemo(() => {
    return [...units]
      .map((u) => ({
        unit: u,
        distance: u.lat != null && u.lng != null ? haversineM(incident.lat, incident.lng, u.lat, u.lng) : null,
      }))
      .sort((a, b) => {
        const aOk = a.unit.status === "disponible" ? 0 : 1;
        const bOk = b.unit.status === "disponible" ? 0 : 1;
        if (aOk !== bOk) return aOk - bOk;
        return (a.distance ?? 1e9) - (b.distance ?? 1e9);
      });
  }, [units, incident]);

  const firstAvailable = sorted.find((s) => s.unit.status === "disponible")?.unit.id ?? units[0]?.id ?? 0;
  // Refuerzos: unidades ya en misión vienen premarcadas y no se pueden desmarcar
  const assigned = useMemo(() => incident.units ?? [], [incident.units]);
  const assignedIds = useMemo(() => new Set(assigned.map((a) => a.unitId)), [assigned]);
  // Despacho MULTI-unidad: varias casillas; la primera disponible viene premarcada
  const [picked, setPicked] = useState<number[]>(() =>
    assigned.length ? assigned.map((a) => a.unitId) : firstAvailable ? [firstAvailable] : [],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const message = dispatchMessage(incident, code, nearHydrants);
  const staticMapUrl = staticOpsMapUrl(incident, nearHydrants);
  const newPicks = picked.filter((pid) => !assignedIds.has(pid));

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-[1000] grid place-items-center bg-black/65 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Despachar unidad"
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
          <div>
            <h2 className="display flex items-center gap-2 text-base font-bold tracking-wide uppercase">
              <Siren size={17} className="text-red" aria-hidden="true" /> Despachar unidades
            </h2>
            <p className="mt-0.5 text-[11.5px] text-mu">
              <span className="font-mono">{code}</span> · {incident.title} · {incident.address}
            </p>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Cerrar">
            <X size={15} aria-hidden="true" />
          </button>
        </header>

        <div className="dialog-scroll min-h-0 flex-1 overflow-y-auto p-4">
          <h3 className="mb-2 text-[10.5px] font-bold tracking-[0.18em] text-mu2 uppercase">
            {assigned.length > 0
              ? `1 · Refuerzos — ya en misión: ${assigned.map((a) => a.code).join(", ")}`
              : `1 · Elige una o varias unidades (${sorted.filter((s) => s.unit.status === "disponible").length} disponibles)`}
          </h3>
          <div className="space-y-1.5" role="group" aria-label="Unidades disponibles">
            {sorted.map(({ unit, distance }) => {
              const committed = assignedIds.has(unit.id);
              const disabled = committed || unit.status !== "disponible";
              const selected = picked.includes(unit.id);
              return (
                <label
                  key={unit.id}
                  className={cx(
                    "flex cursor-pointer items-center gap-3 rounded border p-2.5 transition-colors",
                    selected ? "border-red bg-panel3" : "border-line bg-panel2 hover:border-line2",
                    disabled && "cursor-not-allowed opacity-45",
                  )}
                >
                  <input
                    type="checkbox"
                    name="unit"
                    className="accent-[var(--red)]"
                    checked={selected}
                    disabled={disabled}
                    onChange={() =>
                      setPicked(selected ? picked.filter((id) => id !== unit.id) : [...picked, unit.id])
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="display text-[14.5px] font-bold">
                        {unit.code} <span className="font-sans text-[12px] font-normal text-mu">· {unit.name}</span>
                      </span>
                      <span className="text-[10.5px] font-bold tracking-wider uppercase text-mu2">
                        {UNIT_STATUS_META[unit.status].label}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-mu">
                      <span>
                        {UNIT_TYPE_META[unit.type].label} · {unit.station ?? "Sin compañía"} · {unit.crew ?? "—"} efectivos
                      </span>
                      {distance != null && <span className="font-mono text-mu2">{fmtDistance(distance)}</span>}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          <h3 className="mt-4 mb-2 text-[10.5px] font-bold tracking-[0.18em] text-mu2 uppercase">
            2 · Mensaje de WhatsApp a la unidad
          </h3>
          {waUnit ? (
            <pre className="max-h-44 overflow-y-auto rounded border border-green/40 bg-panel2 p-3 text-[11.5px] leading-relaxed whitespace-pre-wrap text-tx">
              {message}
            </pre>
          ) : (
            <div className="rounded border border-amber/50 bg-panel2 p-3">
              <p className="text-[12px] text-mu">
                No hay número de WhatsApp de unidad configurado. El despacho se registrará en el sistema; podrás
                avisarle por WhatsApp apenas lo configures.
              </p>
              <button className="btn btn-sm btn-amber mt-2" onClick={onOpenSettings}>
                <GearSix size={13} aria-hidden="true" /> Configurar número de unidad
              </button>
            </div>
          )}

          <a
            href={staticMapUrl}
            target="_blank"
            rel="noreferrer"
            title="Abrir el mapa en tamaño completo"
            className="mt-2 block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={staticMapUrl}
              alt="Mapa de la escena con los hidrantes cercanos"
              width={650}
              height={450}
              className="max-h-44 w-full rounded border border-line bg-panel2 object-cover"
              loading="lazy"
            />
          </a>
          <p className="mt-1 text-[10.5px] text-mu2">
            Mapa táctico que acompaña al mensaje: escena (rojo) e hidrantes cercanos (azul).
          </p>
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-line px-4 py-3">
          <span className="hidden text-[10.5px] text-mu2 sm:block">
            {assigned.length > 0
              ? "El refuerzo se suma a la misión; las unidades nuevas aceptan desde su tablet."
              : picked.length > 1
                ? `${picked.length} unidades recibirán la misión; cada una acepta desde su tablet.`
                : "Al confirmar se registra la bitácora y el estado pasa a «Despachado»."}
          </span>
          <div className="flex gap-2">
            <button className="btn" onClick={onClose} disabled={busy}>
              Cancelar
            </button>
            <button
              className="btn btn-red"
              onClick={() => onConfirm(picked)}
              disabled={busy || !picked.length || (assigned.length > 0 && newPicks.length === 0)}
            >
              <WhatsappLogo size={15} weight="fill" aria-hidden="true" />
              {busy
                ? "Despachando…"
                : assigned.length > 0 && newPicks.length > 1
                  ? `Despachar ${newPicks.length} refuerzos`
                  : assigned.length > 0 && newPicks.length === 1
                    ? `Enviar refuerzo ${units.find((u) => u.id === newPicks[0])?.code ?? ""}`.trim()
                    : picked.length > 1
                      ? `Despachar ${picked.length} unidades`
                      : "Confirmar despacho"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
