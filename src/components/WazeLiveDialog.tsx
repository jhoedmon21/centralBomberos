"use client";

import { useEffect, useRef } from "react";
import { ArrowSquareOut, TrafficSignal, X } from "@phosphor-icons/react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useDraggablePanel } from "@/hooks/useDraggablePanel";
import { CITY_CENTER } from "@/lib/geo";
import { cx } from "@/lib/utils";

interface Props {
  onClose: () => void;
}

// Visor oficial embebido de Waze (Google), sin API key, centrado en Camaná.
const EMBED_URL = `https://embed.waze.com/es-419/iframe?zoom=13&lat=${CITY_CENTER.lat}&lon=${CITY_CENTER.lng}`;
const LIVE_URL = `https://www.waze.com/es-419/live-map/directions?to=ll.${CITY_CENTER.lat},${CITY_CENTER.lng}`;

/** Tráfico en vivo de la zona con el mapa colaborativo de Waze (embed oficial) */
export default function WazeLiveDialog({ onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  const panelRef = useRef<HTMLDivElement>(null);
  const { dragging, panelStyle, handleProps } = useDraggablePanel(panelRef);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-[1000] grid place-items-center bg-black/65 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Tráfico en vivo de Waze"
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
          className="flex cursor-grab touch-none select-none items-center justify-between gap-3 border-b border-line px-4 py-3 active:cursor-grabbing [&_button]:cursor-pointer"
          {...handleProps}
        >
          <div>
            <h2 className="display flex items-center gap-2 text-base font-bold tracking-wide uppercase">
              <TrafficSignal size={17} className="text-red" aria-hidden="true" /> Tráfico en vivo · Waze
            </h2>
            <p className="mt-0.5 text-[11.5px] text-mu">
              Mapa colaborativo de Waze (Google) con la congestión y las alertas viales de la zona, en tiempo real.
            </p>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Cerrar">
            <X size={15} aria-hidden="true" />
          </button>
        </header>
        <div className="dialog-scroll min-h-0 flex-1 p-3">
          <iframe
            title="Mapa de tráfico en vivo de Waze centrado en Camaná"
            src={EMBED_URL}
            className="h-[62vh] w-full rounded border border-line bg-panel2"
          />
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5">
          <span className="text-[10.5px] text-mu2">Datos colaborativos © Waze / Google · sin credenciales</span>
          <a className="btn btn-sm" href={LIVE_URL} target="_blank" rel="noopener noreferrer">
            <ArrowSquareOut size={13} aria-hidden="true" /> Abrir en Waze
          </a>
        </footer>
      </div>
    </div>
  );
}
