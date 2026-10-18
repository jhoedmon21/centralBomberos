// ============================================================
//  Mensajería central ↔ unidad (chat corto de comando)
//  Persistida en ChatMessage y difundida por el bus SSE: ambos
//  extremos la reciben en vivo, sin polling.
// ============================================================

import { broadcast } from "./bus";
import { prisma } from "./db";
import { ApiError } from "./errors";
import type { ChatDTO } from "./types";

export type ChatRole = "central" | "unidad";

/** Mensajes de la unidad. Sin `after`: los últimos 50 (ascendente);
 * con `after` (ISO): todo lo posterior — recuperar el hilo en vivo. */
export async function chatList(unitId: number, after?: string | null): Promise<ChatDTO[]> {
  let since: Date | undefined;
  if (after) {
    const d = new Date(after);
    if (Number.isNaN(+d)) throw new ApiError(400, "Cursor «after» no válido (debe ser ISO)");
    since = d;
  }

  const toDTO = (r: { id: number; fromRole: string; body: string; at: Date }): ChatDTO => ({
    id: r.id,
    from: r.fromRole as ChatDTO["from"],
    body: r.body,
    at: r.at.toISOString(),
  });

  if (since) {
    const rows = await prisma.chatMessage.findMany({
      where: { unitId, at: { gt: since } },
      orderBy: { at: "asc" },
      take: 200,
    });
    return rows.map(toDTO);
  }

  const rows = await prisma.chatMessage.findMany({
    where: { unitId },
    orderBy: { at: "desc" },
    take: 50,
  });
  return rows.reverse().map(toDTO);
}

/** Guarda y difunde un mensaje; devuelve el DTO para el remitente. */
export async function chatSend(unitId: number, fromRole: ChatRole, body: string): Promise<ChatDTO> {
  const clean = body.trim().slice(0, 1000);
  if (!clean) throw new ApiError(400, "El mensaje está vacío");
  const unit = await prisma.unit.findUnique({ where: { id: unitId }, select: { id: true } });
  if (!unit) throw new ApiError(404, "Unidad no encontrada");
  const msg = await prisma.chatMessage.create({ data: { unitId, fromRole, body: clean } });
  broadcast({
    type: "chat",
    unitId,
    // Anidado (como consumen la central y la tablet): { ev.chat.id, .from, .body, .at }
    chat: { id: msg.id, unitId, from: fromRole, body: clean, at: msg.at.toISOString() },
  });
  return { id: msg.id, from: fromRole, body: clean, at: msg.at.toISOString() };
}
