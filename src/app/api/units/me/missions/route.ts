// GET /api/units/me/missions — historial de misiones cerradas de la unidad.
// Cada cierre desde la app deja un MissionReport; ordenamos por el más
// reciente para el panel «Misiones» de la cabina de la tablet.

import { connection } from "next/server";
import { jsonError } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { requireUnit } from "@/lib/unitapp";

export async function GET(request: Request) {
  await connection();
  try {
    const auth = await requireUnit(request);
    const reports = await prisma.missionReport.findMany({
      where: { unitId: auth.unitId },
      orderBy: { closedByUnitAt: "desc" },
      take: 30,
      include: {
        incident: {
          select: {
            id: true,
            title: true,
            address: true,
            severity: true,
            createdAt: true,
            closedAt: true,
          },
        },
      },
    });
    const missions = reports.map((r) => ({
      id: r.incident.id,
      title: r.incident.title,
      address: r.incident.address,
      severity: r.incident.severity,
      createdAt: r.incident.createdAt.toISOString(),
      closedAt: (r.incident.closedAt ?? r.closedByUnitAt).toISOString(),
      result: r.result,
      injured: r.injured,
      observations: r.observations,
    }));
    return Response.json({ missions });
  } catch (e) {
    return jsonError(e);
  }
}
