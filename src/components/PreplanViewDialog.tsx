"use client";

// Ficha completa de un preplan (solo lectura). Es lo que la central abre
// cuando una emergencia cae a <300 m del edificio — y desde el directorio.

import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useDraggablePanel } from "@/hooks/useDraggablePanel";
import { Buildings, Phone, X } from "@phosphor-icons/react";
import { useRef } from "react";
import type { PreplanDTO } from "@/lib/types";
import { cx } from "@/lib/utils";

interface Props {
  preplan: PreplanDTO;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10.5px] font-bold tracking-wider text-mu2 uppercase">{label}</p>
      <p className="text-[13.5px] whitespace-pre-wrap">{value}</p>
    </div>
  );
}

export default function PreplanViewDialog({ preplan, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref);
  const { dragging, panelStyle, handleProps } = useDraggablePanel(ref);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div
        ref={ref}
        style={panelStyle}
        className={cx(
          "max-h-[88vh] w-full max-w-lg overflow-y-auto rounded border border-amber/50 bg-bg2 p-4 shadow-2xl",
          dragging && "select-none",
        )}
      >
        <div
          className="flex cursor-grab touch-none select-none items-start gap-2 active:cursor-grabbing [&_button]:cursor-pointer"
          {...handleProps}
        >
          <Buildings size={18} className="mt-0.5 text-amber" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="display text-lg leading-tight font-bold">{preplan.title}</h2>
            <p className="text-[12px] text-mu">
              {preplan.address} · {preplan.lat.toFixed(5)}, {preplan.lng.toFixed(5)}
            </p>
          </div>
          <button className="btn btn-sm ml-auto" onClick={onClose} title="Cerrar">
            <X size={13} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-3 space-y-2.5">
          <Row label="Distribución (pisos, área, naves)" value={preplan.layout} />
          <Row label="Peligros previstos" value={preplan.hazards} />
          <Row label="Llaves de acceso / cortes" value={preplan.keysInfo} />
          <Row label="Puntos de agua" value={preplan.waterSources} />
          <Row label="Notas" value={preplan.notes} />
          {preplan.contactName && (
            <div className="flex items-center gap-2 rounded border border-line bg-panel px-2.5 py-2">
              <Phone size={14} className="text-green" aria-hidden="true" />
              <span className="text-[13px] font-semibold">{preplan.contactName}</span>
              {preplan.contactPhone && (
                <a className="font-mono text-[13px] text-blue underline" href={`tel:${preplan.contactPhone}`}>
                  {preplan.contactPhone}
                </a>
              )}
            </div>
          )}
          {preplan.photos.length > 0 && (
            <div>
              <p className="text-[10.5px] font-bold tracking-wider text-mu2 uppercase">Fotos ({preplan.photos.length})</p>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {preplan.photos.map((url, i) => (
                  <a key={`${i}`} href={url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Foto ${i + 1} de ${preplan.title}`} className="h-20 w-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
