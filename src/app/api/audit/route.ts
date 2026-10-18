// GET /api/audit — bitácora del sistema (solo jefe). Toma `limit` entradas
// más recientes; `?action=` filtra por tipo si se quiere depurar.

import { jsonError } from "@/lib/errors";
import { requireOperator } from "@/lib/opauth";
import { prisma } from "@/lib/db";

const MAX_LIMIT = 500;

export async function GET(request: Request) {
  try {
    await requireOperator(request, ["jefe"]);
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 200, 1), MAX_LIMIT);
    const action = searchParams.get("action");

    const entries = await prisma.auditLog.findMany({
      where: action ? { action } : undefined,
      orderBy: { at: "desc" },
      take: limit,
    });
    return Response.json({
      entries: entries.map((a) => ({
        id: a.id,
        actor: a.actor,
        action: a.action,
        detail: a.detail,
        at: a.at.toISOString(),
      })),
    });
  } catch (e) {
    return jsonError(e);
  }
}
