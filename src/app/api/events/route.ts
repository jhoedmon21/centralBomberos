// GET /api/events — flujo SSE: la central recibe cambios en tiempo real
// (nuevo reporte, despacho, cambio de estado, unidades, configuración)

import { connection } from "next/server";
import { subscribe } from "@/lib/bus";
import { prisma } from "@/lib/db";

// Latido laboral: además del comentario SSE, un SELECT 1 mantiene templado el
// compute de Neon (el plan gratuito lo apaga tras ~5 min sin consultas; un
// arranque en frío añade 1-3 s a las siguientes consultas del tablero).
const KEEPALIVE_MS = 60_000;

export async function GET() {
  // Garantiza ejecución en tiempo de petición (Cache Components)
  await connection();

  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let keepalive: ReturnType<typeof setInterval> | undefined;
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
      keepalive = setInterval(() => {
        void prisma.$queryRaw`SELECT 1`.catch(() => {
          /* la BD responde cuando pueda; el SSE no depende de esto */
        });
      }, KEEPALIVE_MS);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (keepalive) clearInterval(keepalive);
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
