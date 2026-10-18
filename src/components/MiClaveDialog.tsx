"use client";

// Cambio de la PROPIA clave (todos los roles). El jefe cambia las de los
// demás en «Operadores»; la suya (y la de cualquier rol) se cambia aquí,
// verificando la clave actual — PATCH /api/operator/me.

import { useRef, useState } from "react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useDraggablePanel } from "@/hooks/useDraggablePanel";
import { Key, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import { cx } from "@/lib/utils";

export default function MiClaveDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref);
  const { dragging, panelStyle, handleProps } = useDraggablePanel(ref);

  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (password !== repeat) {
      toast.error("Las claves nuevas no coinciden");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/operator/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current, password }),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error ?? `Error ${r.status}`);
      toast.success("Clave actualizada — tus próximas sesiones la usan al ingresar");
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div
        ref={ref}
        style={panelStyle}
        className={cx(
          "w-full max-w-sm rounded border border-line bg-bg2 p-4 shadow-2xl",
          dragging && "select-none",
        )}
      >
        <div
          className="flex cursor-grab touch-none select-none items-center gap-2 active:cursor-grabbing [&_button]:cursor-pointer"
          {...handleProps}
        >
          <Key size={17} className="text-amber" aria-hidden="true" />
          <h2 className="display text-base font-bold uppercase tracking-wider">Mi clave de acceso</h2>
          <button className="btn btn-sm ml-auto" onClick={onClose} title="Cerrar">
            <X size={13} aria-hidden="true" />
          </button>
        </div>
        <form onSubmit={submit} className="mt-3 space-y-2.5">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase">Clave actual</span>
            <input
              className="input"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase">Clave nueva (mín 8)</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase">Repetir clave nueva</span>
            <input
              className="input"
              type="password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <button className="btn btn-red w-full justify-center" disabled={busy} type="submit">
            {busy ? "Guardando…" : "Actualizar mi clave"}
          </button>
        </form>
      </div>
    </div>
  );
}
