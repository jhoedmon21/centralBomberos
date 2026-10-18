// GET /api/units/me/events — flujo SSE filtrado para ESTA unidad:
// despachos, cambios forzados por la central, misión actualizada y
// cierre de sesión remoto. Reconexión automática desde el cliente.

import { connection } from "next/server";
import { subscribe } from "@/lib/bus";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { jsonError } from "@/lib/errors";

export async function GET(request: Request) {
  await connection();
  try {
    const auth = await getAuth(request);
    if (!auth) return Response.json({ error: "Sesión no válida" }, { status: 401 });

    // Id de la misión activa: se actualiza con cada evento para filtrar
    let missionId: number | null = null;
    const loadMissionId = async () => {
      const mission = await prisma.incident.findFirst({
        where: { unitId: auth.unitId, status: { in: ["reportado", "despachado", "en_escena"] } },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      missionId = mission?.id ?? null;
    };
    await loadMissionId();

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
          let ev: Record<string, unknown>;
          try {
            ev = JSON.parse(raw);
          } catch {
            return;
          }
          // Filtrar: solo lo que concierne a esta unidad + alertas globales
          const mine =
            (ev.type === "unit_mission" && ev.unitId === auth.unitId) ||
            (ev.type === "mission_unaccepted" && ev.unitId === auth.unitId) ||
            (ev.type === "unit_logout" && ev.unitId === auth.unitId) ||
            (ev.type === "unit" && ev.id === auth.unitId) ||
            // Mensajes del chat con esta unidad (central ↔ unidad)
            (ev.type === "chat" && ev.unitId === auth.unitId) ||
            // Alerta global: cada emergencia nueva avisa a todos los bomberos
            (ev.type === "incident" && (ev.action === "created" || ev.id === missionId)) ||
            ev.type === "hydrant";
          if (!mine) return;

          if (ev.type === "unit_mission") {
            missionId = typeof ev.id === "number" ? ev.id : missionId;
            void loadMissionId();
          }
          // El resto de campos (unitId, at, etc.) viaja tal cual
          send(raw);
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
