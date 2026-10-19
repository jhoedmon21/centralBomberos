"use client";

// Chat corto central ↔ unidad (estilo Bryx team messaging). Panel anclado
// sobre el mapa; el hilo llega por GET en la apertura y por SSE después.
// Con voz: notas grabadas (AUDIO) — la respuesta de la unidad llega como alerta.

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatCircle, Microphone, PaperPlaneTilt, Stop, Truck, X } from "@phosphor-icons/react";
import type { ChatDTO } from "@/lib/types";
import { useDraggablePanel } from "@/hooks/useDraggablePanel";
import { cx, timeAgo } from "@/lib/utils";

interface Props {
  unitId: number;
  unitCode: string;
  /** Último evento SSE de chat (cualquier unidad); este panel filtra el suyo */
  incoming: { unitId: number; msg: ChatDTO } | null;
  /** La unidad tenía avisos sin leer al abrir: la última respuesta va con NUEVO */
  openUnread: boolean;
  onClose: () => void;
}

export default function ChatPanel({ unitId, unitCode, incoming, openUnread, onClose }: Props) {
  const [messages, setMessages] = useState<ChatDTO[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const { dragging, panelStyle, handleProps } = useDraggablePanel(panelRef);
  // Respuesta que llegó sin leer (capturada al abrir) — para el destello NUEVO
  const [initialUnread] = useState(openUnread);
  // Respuestas que llegan por SSE con el panel abierto: destello NUEVO también
  const flashRef = useRef(true);
  const [flashIds, setFlashIds] = useState<ReadonlySet<number>>(() => new Set());

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
  // síncrono dentro del efecto. La primera pasada no destella (ya viene del GET).
  useEffect(() => {
    if (!incoming || incoming.unitId !== unitId) return;
    const t = setTimeout(() => {
      setMessages((prev) =>
        prev && !prev.some((m) => m.id === incoming.msg.id) ? [...prev, incoming.msg] : prev,
      );
      if (!flashRef.current && incoming.msg.from === "unidad") {
        setFlashIds((s) => new Set(s).add(incoming.msg.id));
      }
      flashRef.current = false;
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

  // ---------- Nota de voz (la grabación se envía como AUDIO) ----------
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const secsRef = useRef(0);
  const [recSecs, setRecSecs] = useState<number | null>(null);

  const postVoice = useCallback(
    async (blob: Blob, url: string) => {
      setBusy(true);
      try {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let bin = "";
        for (let i = 0; i < bytes.length; i += 0x8000) {
          bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        }
        const mime = (blob.type || "audio/webm").split(";")[0];
        const r = await fetch(`/api/units/${unitId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            body: url.trim() || "🎤 Nota de voz de la central",
            audio: `data:${mime};base64,${btoa(bin)}`,
          }),
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
    },
    [unitId],
  );

  const stopRec = useCallback(() => {
    try {
      recRef.current?.state === "recording" && recRef.current.stop();
    } catch {
      /* ya parada */
    }
  }, []);

  const startRec = useCallback(async () => {
    try {
      if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Este navegador no soporta grabar audio");
      }
      const mimeList = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
      const mime = mimeList.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      chunksRef.current = [];
      secsRef.current = 0;
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const secs = secsRef.current;
        setRecSecs(null);
        recRef.current = null;
        void postVoice(
          new Blob(chunksRef.current, { type: rec.mimeType || mime || "audio/webm" }),
          draft.trim() || `🎤 Nota de voz (${secs}s de la central)`,
        );
      };
      rec.start();
      recRef.current = rec;
      setRecSecs(0);
      setError(null);
    } catch (e) {
      setError((e as Error).message || "No se pudo usar el micrófono");
    }
  }, [draft, postVoice]);

  // Cronómetro de la grabación + corte automático a 90 s
  useEffect(() => {
    if (recSecs == null) return;
    const id = window.setInterval(() => {
      secsRef.current += 1;
      if (secsRef.current >= 90) stopRec();
      else setRecSecs((s) => (s == null ? s : secsRef.current));
    }, 1000);
    return () => window.clearInterval(id);
  }, [recSecs != null, stopRec]);

  // Última respuesta de la unidad: si la unidad tenía avisos sin leer al
  // abrir, esa respuesta lleva el destello NUEVO.
  const unitMsgs = (messages ?? []).filter((m) => m.from === "unidad");
  const lastUnitId = unitMsgs.length ? unitMsgs[unitMsgs.length - 1].id : null;

  return (
    <div
      ref={panelRef}
      style={panelStyle}
      className={cx(
        "map-panel pointer-events-auto absolute right-3 bottom-3 top-24 z-[960] flex w-[320px] max-w-[85vw] flex-col overflow-hidden rounded-xl",
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
        {messages?.map((m) => {
          // AUDIO:<url> = nota de voz · LLAMADA:<…> = llamado de voz (antiguo)
          const audioUrl = m.body.startsWith("AUDIO:") ? m.body.slice(6) : null;
          const callRest = m.body.startsWith("LLAMADA:") ? m.body.slice(8) : null;
          const callUrl = callRest?.startsWith("/api/media/") ? callRest : null;
          const callText = callRest != null && callUrl == null ? callRest.trim() : null;
          const voiceUrl = audioUrl ?? callUrl;
          const isVoice = voiceUrl != null;
          const own = m.from === "central";
          const isNew = !own && (flashIds.has(m.id) || (initialUnread && lastUnitId === m.id));
          const body = isVoice ? (
            <>
              <p className="flex items-center gap-1.5 text-[11px] font-bold">
                <Microphone size={12} className="text-blue" aria-hidden="true" /> Nota de voz
              </p>
              <audio className="mt-1.5 w-[212px]" controls preload="none" src={voiceUrl ?? undefined}>
                Tu navegador no reproduce este audio.
              </audio>
            </>
          ) : (
            <p className="break-words whitespace-pre-wrap">{callText ?? m.body}</p>
          );
          return (
            <div key={m.id} className={cx("flex", own && "justify-end")}>
              {own ? (
                <div className="max-w-[85%] rounded border border-amber/50 bg-amber/10 px-2.5 py-1.5 text-[12.5px] leading-snug text-tx">
                  {body}
                  <p className="mt-0.5 text-right font-mono text-[9.5px] text-mu2" suppressHydrationWarning>
                    {timeAgo(m.at)}
                  </p>
                </div>
              ) : (
                /* Respuesta de la UNIDAD: tarjeta de alerta — con NUEVO si
                   acaba de llegar (al abrir sin leer o en vivo con el chat abierto) */
                <div
                  className={cx(
                    "max-w-[92%] rounded border border-red/50 border-l-4 border-l-red bg-red/10 px-2.5 py-1.5 text-[12.5px] leading-snug",
                    isNew && "chat-unit-new",
                  )}
                >
                  <p className="chat-unit-hd">
                    <Truck size={12} weight="fill" aria-hidden="true" />
                    Respuesta de {unitCode}
                    {isNew && <span className="chat-unit-pill">NUEVO</span>}
                  </p>
                  <div className="mt-1 text-tx">{body}</div>
                  <p className="mt-0.5 text-right font-mono text-[9.5px] text-mu2" suppressHydrationWarning>
                    {timeAgo(m.at)}
                  </p>
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex shrink-0 items-center gap-2 border-t border-line p-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        {recSecs != null ? (
          <button
            type="button"
            className="btn btn-sm relative shrink-0 anim-pulse-ring bg-red text-white"
            onClick={stopRec}
            title="Detener grabación y enviar la nota de voz"
            aria-label="Detener grabación"
          >
            <Stop size={12} weight="fill" aria-hidden="true" /> {recSecs}s
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-sm shrink-0"
            onClick={() => void startRec()}
            title="Grabar una nota de voz para la unidad (pulsar de nuevo para enviar)"
            aria-label="Grabar nota de voz"
            disabled={busy}
          >
            <Microphone size={13} aria-hidden="true" />
          </button>
        )}
        <input
          className="input min-w-0 flex-1 py-1.5 text-[12.5px]"
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
