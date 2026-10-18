"use client";

import { useEffect, useRef, useState } from "react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useDraggablePanel } from "@/hooks/useDraggablePanel";
import { Check, Copy, GearSix, Info, X } from "@phosphor-icons/react";
import type { SettingsDTO } from "@/lib/types";
import { cx, digitsOnly } from "@/lib/utils";

interface Props {
  settings: SettingsDTO;
  onSave: (patch: Partial<SettingsDTO>) => Promise<void>;
  onClose: () => void;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      className="btn btn-sm shrink-0"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          /* portapapeles no disponible */
        }
      }}
      aria-label={label}
      title={label}
    >
      {copied ? <Check size={13} className="text-green" aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

/** Configuración de la central: WhatsApp, alertas y webhook oficial */
export default function SettingsDialog({ settings, onSave, onClose }: Props) {
  const [waUnit, setWaUnit] = useState(settings.wa_unit);
  const [waCentral, setWaCentral] = useState(settings.wa_central);
  const [sound, setSound] = useState(settings.alert_sound === "1");
  const [token, setToken] = useState(settings.webhook_token);
  const [waToken, setWaToken] = useState(settings.wa_token);
  const [publicBase, setPublicBaseUrl] = useState(settings.public_base);
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  const panelRef = useRef<HTMLDivElement>(null);
  const { dragging, panelStyle, handleProps } = useDraggablePanel(panelRef);
  // El diálogo solo se monta cuando está abierto (tras un clic), por lo que
  // es seguro leer `window` en el inicializador.
  const [webhookUrl] = useState(() =>
    typeof window === "undefined" ? "" : `${window.location.origin}/api/whatsapp/webhook`,
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const curlSample = `curl -X POST ${webhookUrl || "http://localhost:3000/api/whatsapp/webhook"} \\
  -H "Content-Type: application/json" \\
  -d '{"phone":"+51987123456","name":"Lucia","text":"Incendio en el mercado","lat":-16.6249,"lng":-72.7083}'`;

  async function save() {
    setBusy(true);
    try {
      await onSave({
        wa_unit: digitsOnly(waUnit),
        wa_central: digitsOnly(waCentral),
        alert_sound: sound ? "1" : "0",
        webhook_token: token.trim() || "firewaze-verifica-2026",
        wa_token: waToken.trim(),
        public_base: publicBase.trim().replace(/\/+$/, ""),
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-[1000] grid place-items-center bg-black/65 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Configuración de la central"
    >
      <div
        ref={panelRef}
        style={panelStyle}
        className={cx(
          "anim-slidein flex max-h-[92vh] w-full max-w-xl flex-col rounded border border-line bg-panel shadow-2xl",
          dragging && "select-none",
        )}
      >
        <header
          className="flex cursor-grab touch-none select-none items-center justify-between border-b border-line px-4 py-3 active:cursor-grabbing [&_button]:cursor-pointer"
          {...handleProps}
        >
          <h2 className="display flex items-center gap-2 text-base font-bold tracking-wide uppercase">
            <GearSix size={17} className="text-red" aria-hidden="true" /> Configuración de la central
          </h2>
          <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Cerrar">
            <X size={15} aria-hidden="true" />
          </button>
        </header>

        <div className="dialog-scroll min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          {/* WhatsApp */}
          <section>
            <h3 className="mb-2 text-[10.5px] font-bold tracking-[0.18em] text-mu2 uppercase">
              WhatsApp operativo
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase" htmlFor="st-unit">
                  Número de la unidad (recibe despachos)
                </label>
                <input
                  id="st-unit"
                  className="input font-mono"
                  name="wa_unit"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  placeholder="51999111222"
                  value={waUnit}
                  onChange={(e) => setWaUnit(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase" htmlFor="st-central">
                  Número de la central (avisos internos)
                </label>
                <input
                  id="st-central"
                  className="input font-mono"
                  name="wa_central"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  placeholder="51999333444"
                  value={waCentral}
                  onChange={(e) => setWaCentral(e.target.value)}
                />
              </div>
            </div>
            <p className="mt-1.5 text-[11.5px] text-mu">
              Formato internacional sin «+» (Perú: 51…). Los despachos y respuestas abren WhatsApp con el mensaje, la
              ubicación y la ruta ya escritos.
            </p>
            <div className="mt-3">
              <label className="mb-1 block text-[11px] font-bold tracking-wider text-mu2 uppercase" htmlFor="st-base">
                URL pública de la central (enlaces de foto y mapa)
              </label>
              <input
                id="st-base"
                className="input font-mono"
                name="public_base"
                autoComplete="off"
                spellCheck={false}
                placeholder="http://192.168.1.17:3000 o https://central.fuegomap.pe"
                value={publicBase}
                onChange={(e) => setPublicBaseUrl(e.target.value)}
              />
              <p className="mt-1.5 text-[11.5px] text-mu">
                Se usa para armar los enlaces que viajan en el WhatsApp («foto del reporte», mapa). Déjala vacía para
                usar la dirección actual del navegador; si abres la central como «localhost», los teléfonos no podrán
                abrir esos enlaces — escribe aquí la IP de la red o el dominio público.
              </p>
            </div>
          </section>

          {/* Alertas */}
          <section>
            <h3 className="mb-2 text-[10.5px] font-bold tracking-[0.18em] text-mu2 uppercase">Alertas</h3>
            <label className="flex cursor-pointer items-center gap-2.5 text-[13px]">
              <input
                type="checkbox"
                className="accent-[var(--red)]"
                name="alert_sound"
                checked={sound}
                onChange={(e) => setSound(e.target.checked)}
              />
              Alerta sonora al recibir un nuevo reporte (sala de mando)
            </label>
          </section>

          {/* Webhook */}
          <section>
            <h3 className="mb-2 text-[10.5px] font-bold tracking-[0.18em] text-mu2 uppercase">
              Integración WhatsApp Business (producción)
            </h3>
            <div className="space-y-2 rounded border border-line bg-panel2 p-3">
              <div className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-[11px] font-bold tracking-wider text-mu2 uppercase">Webhook</span>
                <code className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-blue">{webhookUrl}</code>
                <CopyButton text={webhookUrl} label="Copiar URL del webhook" />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-[11px] font-bold tracking-wider text-mu2 uppercase">Token</span>
                <input
                  className="input h-8 shrink-0 basis-auto py-1 font-mono text-[12px]"
                  name="webhook_token"
                  autoComplete="off"
                  spellCheck={false}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  aria-label="Token de verificación del webhook"
                />
                <CopyButton text={token} label="Copiar token de verificación" />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-[11px] font-bold tracking-wider text-mu2 uppercase">
                  Token Meta
                </span>
                <input
                  type="password"
                  className="input h-8 shrink-0 basis-auto py-1 font-mono text-[12px]"
                  name="wa_token"
                  autoComplete="off"
                  placeholder="EAAG… (para descargar fotos)"
                  value={waToken}
                  onChange={(e) => setWaToken(e.target.value)}
                  aria-label="Token de acceso de Meta (descarga de fotos)"
                />
              </div>
              <pre className="overflow-x-auto rounded border border-line bg-panel p-2 font-mono text-[10.5px] leading-relaxed whitespace-pre-wrap text-mu">
                {curlSample}
              </pre>
              <p className="text-[11.5px] text-mu">
                Con la API oficial de Meta (WhatsApp Cloud API), apunta el webhook a esta URL y usa el token al
                verificar. Los mensajes con <strong>ubicación</strong> actualizan el reporte en la cola y las{" "}
                <strong>fotos</strong> se descargan como evidencia con el token de Meta (o la variable{" "}
                <code className="font-mono">WA_TOKEN</code>).
              </p>
            </div>
          </section>

          {/* Acerca de */}
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-[10.5px] font-bold tracking-[0.18em] text-mu2 uppercase">
              <Info size={13} aria-hidden="true" /> Sistema integrado FuegoMap
            </h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/img/sistema-fuegomap.jpg"
              alt="Diagrama del sistema: ciudadano reporta por WhatsApp, la central despacha y la unidad recibe la misión"
              className="w-full rounded border border-line"
              loading="lazy"
            />
            <p className="mt-2 text-[11.5px] leading-relaxed text-mu">
              Ciudadano → WhatsApp (foto + ubicación) → <strong>Central de Mando</strong> (web) → Despacho por WhatsApp →
              Tablet táctica de la unidad. En modo demo el botón «Simular reporte» genera ingresos ciudadanos; en
              producción los mensajes llegan por este webhook.
            </p>
          </section>
        </div>

        <footer className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button className="btn" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="btn btn-red" onClick={save} disabled={busy}>
            {busy ? "Guardando…" : "Guardar configuración"}
          </button>
        </footer>
      </div>
    </div>
  );
}
