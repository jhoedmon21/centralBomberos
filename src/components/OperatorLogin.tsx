"use client";

// Login del CAD (central de mando). Cookie httpOnly firmada por
// /api/operator/login; el proxy la exige en cada ruta protegida.

import { useState } from "react";
import { Flame, SignIn } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function OperatorLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/operator/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(d.error ?? `Error ${r.status}`);
      // Cookie puesta: recarga completa para que el shell con datos entre
      window.location.reload();
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="tac-grid flex h-dvh flex-col items-center justify-center bg-bg px-4">
      <div className="w-full max-w-xs">
        <div className="flex flex-col items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded border border-red bg-panel">
            <Flame size={26} weight="fill" className="text-red" aria-hidden="true" />
          </span>
          <div className="text-center">
            <div className="display text-3xl leading-none font-bold tracking-wide">
              FUEGO<span className="text-red">MAP</span>
            </div>
            <div className="text-xs font-semibold tracking-[0.28em] text-mu uppercase">Central de Mando GIS</div>
          </div>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-3 rounded border border-line bg-panel p-4 shadow-lg">
          <label className="block">
            <span className="mb-1 block text-[10.5px] font-semibold tracking-widest text-mu uppercase">
              Correo del operador
            </span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10.5px] font-semibold tracking-widest text-mu uppercase">Clave</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button className="btn btn-red w-full justify-center py-2.5" type="submit" disabled={busy}>
            <SignIn size={16} aria-hidden="true" /> {busy ? "Verificando…" : "Ingresar al CAD"}
          </button>
          <p className="text-center text-[11px] text-mu2">
            Solo personal autorizado · los accesos quedan registrados en la bitácora
          </p>
        </form>
      </div>
    </main>
  );
}
