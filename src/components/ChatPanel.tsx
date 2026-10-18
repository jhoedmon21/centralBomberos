"use client";

// Chat corto central ↔ unidad (estilo Bryx team messaging). Panel anclado
// sobre el mapa; el hilo llega por GET en la apertura y por SSE después.

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatCircle, PaperPlaneTilt, Truck, X } from "@phosphor-icons/react";
import type { ChatDTO } from "@/lib/types";
import { useDraggablePanel } from "@/hooks/useDraggablePanel";
import { cx, timeAgo } from "@/lib/utils";

interface Props {
  unitId: number;
  unitCode: string;
  /** Último evento SSE de chat (cualquier unidad); este panel filtra el suyo */
  incoming: { unitId: number; msg: ChatDTO } | null;
  onClose: () => void;
}

export default function ChatPanel({ unitId, unitCode, incoming, onClose }: Props) {
  const [messages, setMessages] = useState<ChatDTO[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const { dragging, panelStyle, handleProps } = useDraggablePanel(panelRef);

  // Historial al abrir (el panel se remonta por key en el padre)
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await fetch(`/api/units/${unitId}/chat`, { cache: "no-store" });
        const d = (await r.json()) as { messages?: ChatDTO[]; error?: string };
        if (!alive) return;
        if (!r.ok) throw new Error(d.error ?? `Error ${r.status}`);
        setMessages(d.messages ?? []);
      } catch (e) {
        if (alive) {
          setError((e as Error).message);
          setMessages([]);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [unitId]);

  // Mensaje entrante por SSE (dedupe por id: el eco del propio POST puede
  // repetirse). La fusión se hace en un callback externo — no un setState
  // síncrono dentro del efecto.
  useEffect(() => {
    if (!incoming || incoming.unitId !== unitId) return;
    const t = setTimeout(() => {
      setMessages((prev) =>
        prev && !prev.some((m) => m.id === incoming.msg.id) ? [...prev, incoming.msg] : prev,
      );
    }, 0);
    return () => clearTimeout(t);
  }, [incoming, unitId]);

  // Autodesplazamiento al fondo con cada mensaje nuevo
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages?.length]);

  const send = useCallback(async () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/units/${unitId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const d = (await r.json()) as { message?: ChatDTO; error?: string };
      if (!r.ok || !d.message) throw new Error(d.error ?? `Error ${r.status}`);
      setMessages((prev) => (prev ? [...prev, d.message as ChatDTO] : [d.message as ChatDTO]));
      setDraft("");
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [draft, busy, unitId]);

  return (
    <div
      ref={panelRef}
      style={panelStyle}
      className={cx(
        "absolute right-3 bottom-3 top-3 z-[960] flex w-[320px] max-w-[85vw] flex-col overflow-hidden rounded border border-line bg-panel shadow-lg",
        dragging && "select-none",
      )}
      role="dialog"
      aria-label={`Chat con la unidad ${unitCode}`}
    >
      <header
        className="flex shrink-0 cursor-grab touch-none select-none items-center gap-2 border-b border-line px-3 py-2.5 active:cursor-grabbing [&_button]:cursor-pointer"
        {...handleProps}
      >
        <ChatCircle size={16} className="text-blue" aria-hidden="true" />
        <span className="display flex items-center gap-1.5 text-[14px] font-bold">
          <Truck size={14} className="text-blue" aria-hidden="true" /> {unitCode}
        </span>
        <button className="btn btn-sm ml-auto" onClick={onClose} title="Cerrar chat" aria-label="Cerrar chat">
          <X size={12} aria-hidden="true" />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {messages === null && <p className="text-[12px] text-mu2">Cargando mensajes…</p>}
        {messages?.length === 0 && (
          <p className="text-[12px] text-mu2" suppressHydrationWarning>
            Sin mensajes todavía. Escribe a la tablet de la unidad — la respuesta llega aquí al instante.
          </p>
        )}
        {error && <p className="text-[12px] text-red">{error}</p>}
        {messages?.map((m) => (
          <div key={m.id} className={cx("flex", m.from === "central" ? "justify-end" : "justify-start")}>
            <div
              className={cx(
                "max-w-[85%] rounded border px-2.5 py-1.5 text-[12.5px] leading-snug",
                m.from === "central"
                  ? "border-amber/50 bg-amber/10 text-tx"
                  : "border-line bg-panel2 text-tx",
              )}
            >
              <p className="break-words whitespace-pre-wrap">{m.body}</p>
              <p className="mt-0.5 text-right font-mono text-[9.5px] text-mu2" suppressHydrationWarning>
                {timeAgo(m.at)}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex shrink-0 items-center gap-2 border-t border-line p-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          className="input flex-1 py-1.5 text-[12.5px]"
          placeholder={`Mensaje a ${unitCode}…`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Escribir mensaje"
          autoComplete="off"
          maxLength={1000}
        />
        <button className="btn btn-sm btn-blue shrink-0" type="submit" disabled={busy || !draft.trim()}>
          <PaperPlaneTilt size={13} aria-hidden="true" /> {busy ? "…" : "Enviar"}
        </button>
      </form>
    </div>
  );
}
