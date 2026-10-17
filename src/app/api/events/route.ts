// GET /api/events — flujo SSE: la central recibe cambios en tiempo real
// (nuevo reporte, despacho, cambio de estado, unidades, configuración)

import { connection } from "next/server";
import { subscribe } from "@/lib/bus";

export async function GET() {
  // Garantiza ejecución en tiempo de petición (Cache Components)
  await connection();

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
      unsubscribe = subscribe(send);
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
}
