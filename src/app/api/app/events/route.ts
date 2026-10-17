// GET /api/app/events — SSE público para los bomberos SIN sesión (la app
// muestra las emergencias al abrirla, sin claves): reenvía los eventos de
// emergencias e hidrantes a cualquiera conectado. Solo datos básicos —
// los despachos de misión (unit_mission, push…) permanecen privados.

import { connection } from "next/server";
import { subscribe } from "@/lib/bus";
import { jsonError } from "@/lib/errors";

const PUBLIC_EVENTS = new Set(["incident", "hydrant"]);

export async function GET() {
  await connection();
  try {
    const encoder = new TextEncoder();
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let unsubscribe: (() => void) | undefined;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (data: string) => {
          try {
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          } catch {
            /* cliente desconectado */
          }
        };
        send(JSON.stringify({ type: "hello", at: Date.now() }));

        unsubscribe = subscribe((raw) => {
          try {
            const ev = JSON.parse(raw) as { type?: string };
            if (ev.type && PUBLIC_EVENTS.has(ev.type)) send(raw);
          } catch {
            /* evento corrupto: ignorar */
          }
        });

        heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: ping\n\n`));
          } catch {
            /* ignorar */
          }
        }, 25_000);
      },
      cancel() {
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe?.();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    return jsonError(e);
  }
}
