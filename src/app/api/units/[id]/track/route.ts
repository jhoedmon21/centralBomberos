// GET /api/units/[id]/track — recorrido histórico (GpsPoint) de una unidad
// para el mapa de la central (botón «Ver recorrido» del popup). Se graba solo
// con misión activa. Por defecto: últimas 12 horas; ?since=ISO recorta.

import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, jsonError } from "@/lib/errors";
import { haversineM } from "@/lib/geo";
import type { TrackDTO } from "@/lib/types";

export async function GET(request: Request, ctx: RouteContext<"/api/units/[id]/track">) {
  await connection();
  try {
    const { id } = await ctx.params;
    const unitId = Number(id);
    const sinceRaw = new URL(request.url).searchParams.get("since");
    let since: Date;
    if (sinceRaw) {
      const d = new Date(sinceRaw);
      if (Number.isNaN(+d)) throw new ApiError(400, "Parámetro «since» no válido (debe ser ISO)");
      since = d;
    } else {
      since = new Date(Date.now() - 12 * 3600_000);
    }

    const unit = await prisma.unit.findUnique({ where: { id: unitId }, select: { id: true } });
    if (!unit) throw new ApiError(404, "Unidad no encontrada");

    const rows = await prisma.gpsPoint.findMany({
      where: { unitId, at: { gte: since } },
      orderBy: { at: "asc" },
      take: 4000,
    });

    let meters = 0;
    for (let i = 1; i < rows.length; i++) {
      meters += haversineM(rows[i - 1].lat, rows[i - 1].lng, rows[i].lat, rows[i].lng);
    }
    const track: TrackDTO = {
      points: rows.map((p) => [p.lng, p.lat] as [number, number]),
      meters: Math.round(meters),
      count: rows.length,
    };
    return Response.json({ track });
  } catch (e) {
    return jsonError(e);
  }
}
