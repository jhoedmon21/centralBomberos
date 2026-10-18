"use client";

// Gestión de operadores del CAD (solo jefe): alta, rol, activo, borrado
// y restablecimiento de clave. Protege que el CAD nunca quede sin jefe.

import { useCallback, useEffect, useRef, useState } from "react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useDraggablePanel } from "@/hooks/useDraggablePanel";
import { LockKey, Plus, Trash, UserCircle, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { OperatorRole } from "@/lib/types";
import { cx } from "@/lib/utils";

interface OperatorRow {
  id: number;
  email: string;
  name: string;
  role: OperatorRole;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export default function UsersDialog({ unchangedPasswordHint, onClose }: { unchangedPasswordHint?: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref);
  const { dragging, panelStyle, handleProps } = useDraggablePanel(ref);

  const [rows, setRows] = useState<OperatorRow[] | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/operator/users", { cache: "no-store" });
      const d = (await r.json()) as { users?: OperatorRow[]; error?: string };
      if (!r.ok) throw new Error(d.error ?? `Error ${r.status}`);
      setRows(d.users ?? []);
    } catch (e) {
      toast.error((e as Error).message);
      setRows([]);
    }
  }, []);

  useEffect(() => {
    // Diferido un tick (regla react-hooks/set-state-in-effect)
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  async function patch(id: number, body: Record<string, unknown>) {
    setBusyId(id);
    try {
      const r = await fetch(`/api/operator/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error ?? `Error ${r.status}`);
      toast.success("Operador actualizado");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function removeUser(id: number) {
    setBusyId(id);
    try {
      const r = await fetch(`/api/operator/users/${id}`, { method: "DELETE" });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error ?? `Error ${r.status}`);
      toast.success("Operador eliminado");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      const r = await fetch("/api/operator/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role: "operador" }),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error ?? `Error ${r.status}`);
      toast.success(`Operador ${name} creado`);
      setName("");
      setEmail("");
      setPassword("");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div
        ref={ref}
        style={panelStyle}
        className={cx(
          "flex max-h-[88vh] w-full max-w-lg flex-col rounded border border-line bg-bg2 p-4 shadow-2xl",
          dragging && "select-none",
        )}
      >
        <div
          className="flex cursor-grab touch-none select-none items-center gap-2 active:cursor-grabbing [&_button]:cursor-pointer"
          {...handleProps}
        >
          <UserCircle size={18} className="text-blue" aria-hidden="true" />
          <h2 className="display text-base font-bold uppercase tracking-wider">Operadores del CAD</h2>
          <button className="btn btn-sm ml-auto" onClick={onClose} title="Cerrar">
            <X size={13} aria-hidden="true" />
          </button>
        </div>

        {/* Alta rápida */}
        <form onSubmit={createUser} className="mt-3 grid grid-cols-1 gap-2 rounded border border-line bg-panel p-2.5 sm:grid-cols-4">
          <input
            className="input text-[12.5px]"
            placeholder="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
          />
          <input
            className="input text-[12.5px]"
            type="email"
            placeholder="correo@…"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="input text-[12.5px]"
            type="password"
            placeholder="Clave (mín 8)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <button className="btn btn-sm btn-red" disabled={creating} type="submit">
            <Plus size={13} weight="bold" aria-hidden="true" /> Crear operador
          </button>
        </form>

        {unchangedPasswordHint && (
          <p className="mt-2 rounded border border-amber/50 bg-amber/10 px-2.5 py-1.5 text-[11.5px] text-tx">
            {unchangedPasswordHint}
          </p>
        )}

        <div className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
          {rows === null && <p className="py-6 text-center text-[12px] text-mu2">Consultando…</p>}
          {rows?.map((u) => (
            <div key={u.id} className={cx("rounded border border-line bg-panel px-2.5 py-2", !u.active && "opacity-60")}>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="display truncate text-[13.5px] font-bold">
                    {u.name} <span className="font-sans text-[11px] font-normal text-mu2">{u.email}</span>
                  </p>
                  <p className="text-[10.5px] text-mu2">
                    Último acceso: {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "nunca"}
                  </p>
                </div>
                <select
                  className="input w-[104px] shrink-0 py-1 text-[12px]"
                  value={u.role}
                  disabled={busyId === u.id}
                  onChange={(e) => void patch(u.id, { role: e.target.value })}
                  aria-label={`Rol de ${u.name}`}
                >
                  <option value="jefe">Jefe</option>
                  <option value="operador">Operador</option>
                  <option value="lectura">Lectura</option>
                </select>
                <button
                  className="btn btn-sm"
                  disabled={busyId === u.id}
                  title={u.active ? "Desactivar acceso" : "Reactivar acceso"}
                  onClick={() => void patch(u.id, { active: !u.active })}
                >
                  {u.active ? "Activo" : "Inactivo"}
                </button>
                <button
                  className="btn btn-sm"
                  disabled={busyId === u.id}
                  title="Restablecer clave"
                  onClick={() => {
                    const np = window.prompt(`Nueva clave para ${u.name} (mín 8):`);
                    if (np && np.length >= 8) void patch(u.id, { password: np });
                  }}
                >
                  <LockKey size={13} aria-hidden="true" />
                </button>
                <button
                  className="btn btn-sm text-red"
                  disabled={busyId === u.id}
                  title="Eliminar operador"
                  onClick={() => void removeUser(u.id)}
                >
                  <Trash size={13} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
