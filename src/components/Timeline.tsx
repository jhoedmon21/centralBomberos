"use client";

import {
  CheckCircle,
  Fire,
  Flag,
  MapPin,
  NotePencil,
  Swap,
  Truck,
} from "@phosphor-icons/react";
import type { EventDTO } from "@/lib/types";
import { fmtDateTime } from "@/lib/utils";

export const EVENT_ICON: Record<string, { icon: React.ReactNode; color: string }> = {
  creado: { icon: <Fire size={13} weight="fill" />, color: "var(--red)" },
  despacho: { icon: <Truck size={13} />, color: "var(--st-despachado)" },
  llegada: { icon: <MapPin size={13} weight="fill" />, color: "var(--st-escena)" },
  estado: { icon: <Swap size={13} />, color: "var(--st-escena)" },
  nota: { icon: <NotePencil size={13} />, color: "var(--mu)" },
  mensaje: { icon: <NotePencil size={13} />, color: "var(--mu)" },
  cierre: { icon: <CheckCircle size={13} weight="fill" />, color: "var(--green)" },
};

export const ACTOR_LABEL: Record<string, string> = {
  operador: "Operador",
  ciudadano: "Ciudadano",
  unidad: "Unidad",
  sistema: "Sistema",
};

/** Bitácora del incidente (línea de tiempo) */
export default function Timeline({ events }: { events: EventDTO[] }) {
  if (!events.length) {
    return <p className="text-[12px] text-mu2">Sin registros en la bitácora.</p>;
  }
  return (
    <ol className="relative ml-1 space-y-3 border-l border-line pl-4">
      {events.map((e) => {
        const meta = EVENT_ICON[e.type] ?? { icon: <Flag size={13} />, color: "var(--mu)" };
        return (
          <li key={e.id} className="relative">
            <span
              className="absolute top-0.5 -left-[26.5px] grid h-[18px] w-[18px] place-items-center rounded-sm border border-line bg-panel"
              style={{ color: meta.color }}
              aria-hidden="true"
            >
              {meta.icon}
            </span>
            <p className="text-[12.5px] leading-snug">{e.message}</p>
            <p className="mt-0.5 font-mono text-[10px] text-mu2">
              {ACTOR_LABEL[e.actor] ?? e.actor} · {fmtDateTime(e.createdAt)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
