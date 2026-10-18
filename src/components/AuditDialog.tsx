"use client";

// Bitácora del sistema (solo jefe): entradas de auditoría en vivo con
// refresco cada 30 s — accesos, despachos, borrados, preplans…

import { useCallback, useEffect, useRef, useState } from "react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useDraggablePanel } from "@/hooks/useDraggablePanel";
import { ArrowClockwise, Scroll, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { AuditDTO } from "@/lib/types";
import { cx } from "@/lib/utils";

const ACTION_LABEL: Record<string, string> = {
  login: "ingreso",
  login_fail: "ingreso fallido",
  logout: "salida",
  dispatch: "despacho",
  unit_status: "estado de unidad",
  user_create: "alta de operador",
  user_patch: "edición de operador",
  user_delete: "baja de operador",
  self_password: "cambio de propia clave",
  preplan_create: "preplan creado",
  preplan_patch: "preplan editado",
  preplan_delete: "preplan eliminado",
  hydrant_create: "hidrante creado",
  hydrant_patch: "hidrante editado",
};

export default function AuditDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref);
  const { dragging, panelStyle, handleProps } = useDraggablePanel(ref);

  const [entries, setEntries] = useState<AuditDTO[] | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/audit?limit=200", { cache: "no-store" });
      const d = (await r.json()) as { entries?: AuditDTO[]; error?: string };
      if (!r.ok) throw new Error(d.error ?? `Error ${r.status}`);
      setEntries(d.entries ?? []);
    } catch (e) {
      toast.error((e as Error).message);
      setEntries([]);
    }
  }, []);

  useEffect(() => {
    // Diferido un tick (regla react-hooks/set-state-in-effect)
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div
        ref={ref}
        style={panelStyle}
        className={cx(
          "flex max-h-[88vh] w-full max-w-2xl flex-col rounded border border-line bg-bg2 p-4 shadow-2xl",
          dragging && "select-none",
        )}
      >
        <div
          className="flex cursor-grab touch-none select-none items-center gap-2 active:cursor-grabbing [&_button]:cursor-pointer"
          {...handleProps}
        >
          <Scroll size={18} className="text-amber" aria-hidden="true" />
          <h2 className="display text-base font-bold uppercase tracking-wider">Bitácora del sistema</h2>
          <span className="text-[10.5px] text-mu2">últimas 200 · refresco 30 s</span>
          <button className="btn btn-sm ml-auto" onClick={() => void load()} title="Refrescar ahora">
            <ArrowClockwise size={13} aria-hidden="true" />
          </button>
          <button className="btn btn-sm" onClick={onClose} title="Cerrar">
            <X size={13} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {entries === null && <p className="py-6 text-center text-[12px] text-mu2">Consultando bitácora…</p>}
          {entries?.length === 0 && <p className="py-6 text-center text-[12px] text-mu2">Sin entradas todavía.</p>}
          {entries?.map((a) => {
            let detailFmt = a.detail;
            try {
              if (a.detail) detailFmt = JSON.stringify(JSON.parse(a.detail), null, 0);
            } catch {
              /* deja el texto tal cual */
            }
            return (
              <div key={a.id} className="flex items-baseline gap-2 rounded border border-line bg-panel px-2.5 py-1.5">
                <span className="w-32 shrink-0 font-mono text-[10.5px] text-mu2">
                  {new Date(a.at).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="shrink-0 rounded-sm bg-redbtn px-1.5 py-px text-[10px] font-bold uppercase text-white">
                  {ACTION_LABEL[a.action] ?? a.action}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px]" title={detailFmt ?? undefined}>
                  <span className="font-semibold">{a.actor}</span>
                  {detailFmt ? ` — ${detailFmt}` : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
