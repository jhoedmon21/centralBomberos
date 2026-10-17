"use client";

import { useMemo, useState } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { STATUS_META } from "@/lib/meta";
import type { ActivityDTO } from "@/lib/types";
import { timeAgo } from "@/lib/utils";
import { ACTOR_LABEL, EVENT_ICON } from "./Timeline";

interface Props {
  activity: ActivityDTO[];
  onSelectIncident: (id: number) => void;
}

/** Bitácora global con buscador: filtra por mensaje, incidente, actor o tipo */
export default function ActivityFeed({ activity, onSelectIncident }: Props) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const rows = useMemo(() => {
    if (!query) return activity;
    return activity.filter(
      (e) =>
        e.message.toLowerCase().includes(query) ||
        e.incidentTitle.toLowerCase().includes(query) ||
        (ACTOR_LABEL[e.actor] ?? e.actor).toLowerCase().includes(query) ||
        e.type.toLowerCase().includes(query),
    );
  }, [activity, query]);

  return (
    <div>
      <div className="sticky top-0 z-10 border-b border-line bg-panel p-2.5">
        <div className="relative">
          <MagnifyingGlass
            size={13}
            className="absolute top-1/2 left-2.5 -translate-y-1/2 text-mu2"
            aria-hidden="true"
          />
          <input
            className="input py-1.5 pr-7 pl-8 text-[12px]"
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar en la bitácora…"
            aria-label="Buscar actividades"
          />
          {q && (
            <button
              type="button"
              className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-mu2 hover:text-tx"
              onClick={() => setQ("")}
              aria-label="Limpiar búsqueda"
            >
              <X size={12} aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[10.5px] text-mu2" aria-live="polite">
          {query
            ? `${rows.length} de ${activity.length} movimientos coinciden`
            : `${activity.length} movimientos recientes`}
        </p>
      </div>

      {!rows.length ? (
        <p className="p-4 text-[12.5px] text-mu2">
          {query ? "Sin resultados para esa búsqueda." : "Sin movimientos registrados todavía."}
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((e) => {
            const meta = EVENT_ICON[e.type] ?? { icon: null, color: "var(--mu)" };
            return (
              <li key={e.id} className="flex gap-2.5 px-3 py-2.5">
                <span
                  className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-sm border border-line bg-panel2"
                  style={{ color: meta.color }}
                  aria-hidden="true"
                >
                  {meta.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] leading-snug">{e.message}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-mu2">
                    <button
                      className="max-w-[180px] truncate font-semibold text-blue hover:underline"
                      onClick={() => onSelectIncident(e.incidentId)}
                    >
                      {e.incidentTitle}
                    </button>
                    <span className="chip" style={{ color: `var(${STATUS_META[e.incidentStatus].varName})` }}>
                      {STATUS_META[e.incidentStatus].short}
                    </span>
                    <span className="font-mono" suppressHydrationWarning>
                      {ACTOR_LABEL[e.actor] ?? e.actor} · {timeAgo(e.createdAt)}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
