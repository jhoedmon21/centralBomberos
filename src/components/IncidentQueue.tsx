"use client";

import { useMemo, useState } from "react";
import { MagnifyingGlass, Phone, WhatsappLogo, X } from "@phosphor-icons/react";
import { ACTIVE_STATUSES, SEVERITY_META, STATUS_META } from "@/lib/meta";
import type { IncidentDTO } from "@/lib/types";
import { cx, displayCode, timeAgo } from "@/lib/utils";
import IncidentIcon from "./IncidentIcon";

type Filter = "curso" | "todos" | "historial";

interface Props {
  incidents: IncidentDTO[];
  selectedId: number | null;
  lastNewId: number | null;
  onSelect: (id: number) => void;
}

export default function IncidentQueue({ incidents, selectedId, lastNewId, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("curso");

  const counts = useMemo(
    () => ({
      curso: incidents.filter((i) => ACTIVE_STATUSES.includes(i.status)).length,
      historial: incidents.filter((i) => !ACTIVE_STATUSES.includes(i.status)).length,
      todos: incidents.length,
    }),
    [incidents],
  );

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return incidents.filter((i) => {
      if (filter === "curso" && !ACTIVE_STATUSES.includes(i.status)) return false;
      if (filter === "historial" && ACTIVE_STATUSES.includes(i.status)) return false;
      if (!q) return true;
      const hay = `${i.title} ${i.address} ${i.unit?.code ?? ""} ${displayCode(i.id, i.createdAt)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [incidents, filter, query]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      {/* Cabecera */}
      <div className="border-b border-line px-3 py-2.5">
        <div className="flex items-center justify-between">
          <h2 className="display text-sm font-bold tracking-[0.18em] uppercase">
            Incidentes <span className={cx("ml-1", counts.curso > 0 ? "text-red" : "text-mu")}>· {counts.curso} en curso</span>
          </h2>
        </div>
        <div className="relative mt-2">
          <MagnifyingGlass size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-mu2" aria-hidden="true" />
          <input
            className="input py-1.5 pr-7 pl-7 text-[13px]"
            placeholder="Buscar por título, dirección, código…"
            name="q"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar incidentes"
          />
          {query && (
            <button
              className="absolute top-1/2 right-1.5 -translate-y-1/2 text-mu2 hover:text-tx"
              onClick={() => setQuery("")}
              aria-label="Limpiar búsqueda"
            >
              <X size={13} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="mt-2 flex gap-1" role="group" aria-label="Filtro de incidentes">
          {(
            [
              ["curso", "En curso"],
              ["todos", "Todos"],
              ["historial", "Historial"],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              aria-pressed={filter === key}
              className={cx(
                "rounded px-2 py-1 text-[11px] font-bold tracking-wider uppercase transition-colors",
                filter === key ? "bg-panel3 text-tx" : "text-mu hover:text-tx",
              )}
              onClick={() => setFilter(key)}
            >
              {label} · {counts[key]}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {list.length === 0 && (
          <p className="px-4 py-8 text-center text-[13px] text-mu">
            {filter === "curso" ? "Sin incidentes en curso. La ciudad está bajo control." : "No se encontraron incidentes."}
          </p>
        )}
        {list.length > 0 && (
          <ul>
            {list.map((i) => {
              const st = STATUS_META[i.status];
              const sel = i.id === selectedId;
              return (
                <li key={i.id}>
                  <button
                    onClick={() => onSelect(i.id)}
                    data-status={i.status}
                    data-sel={sel ? "1" : undefined}
                    className={cx(
                      "q-item block w-full border-b border-line px-3 py-2.5 text-left",
                      "border-l-4",
                      i.id === lastNewId && "fw-flash",
                    )}
                    style={{ borderLeftColor: sel ? "var(--red)" : `var(${SEVERITY_META[i.severity].varName})` }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex min-w-0 items-start gap-1.5">
                        <IncidentIcon
                          title={i.title}
                          size={13}
                          className="mt-0.5 shrink-0"
                          // El icono hereda el color de la severidad
                        />
                        <span className="line-clamp-2 text-[13.5px] leading-tight font-semibold">{i.title}</span>
                      </span>
                      <span className="chip shrink-0" style={{ color: `var(${st.varName})` }}>
                        {st.short}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-mu">
                      <span className="font-mono text-[10.5px] text-mu2">{displayCode(i.id, i.createdAt)}</span>
                      {i.source === "whatsapp" || i.source === "webhook" ? (
                        <WhatsappLogo
                          size={12}
                          weight="fill"
                          role="img"
                          className="text-green"
                          aria-label="Reporte por WhatsApp"
                        />
                      ) : (
                        <Phone size={11} role="img" className="text-mu2" aria-label="Reporte telefónico" />
                      )}
                      <span className="truncate">{i.address}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-mu2">
                      <span suppressHydrationWarning>
                        {timeAgo(i.createdAt)} · {SEVERITY_META[i.severity].label}
                      </span>
                      {i.unit && (
                        <span className="rounded border border-line2 px-1.5 py-px font-mono text-[10px] font-bold text-blue">
                          {i.unit.code}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
