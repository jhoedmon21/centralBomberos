// GET /api/units/me — usuario, unidad y misión activa de la tablet.
// Las sesiones de bombero sin unidad (unitId 0) también pasan por aquí:
// devuelven user y sin unidad ni misión.

import { connection } from "next/server";
import { ApiError, jsonError } from "@/lib/errors";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { activeMission, unitDTO } from "@/lib/unitapp";

export async function GET(request: Request) {
  await connection();
  try {
    const auth = await getAuth(request);
    if (!auth) throw new ApiError(401, "Sesión no válida — vuelve a iniciar sesión");

    if (auth.unitId === 0) {
      return Response.json({
        user: { id: auth.uid, name: auth.name, role: auth.role },
        unit: null,
        mission: null,
        serverTime: Date.now(),
      });
    }

    const [unit, mission] = await Promise.all([unitDTO(auth.unitId), activeMission(auth.unitId)]);
    // Aceptación efectiva para esta unidad: su fila IncidentUnit si existe
    // (multi-unidad — cada unidad acepta por su lado; si no hay fila, la
    // aceptación del incidente).
    let accepted: string | null = mission?.acceptedAt?.toISOString() ?? null;
    if (mission) {
      const row = await prisma.incidentUnit.findUnique({
        where: { incidentId_unitId: { incidentId: mission.id, unitId: auth.unitId } },
        select: { acceptedAt: true },
      });
      accepted = row?.acceptedAt?.toISOString() ?? accepted;
    }
    return Response.json({
      user: { id: auth.uid, name: auth.name, role: auth.role },
      unit,
      mission: mission ? { id: mission.id, title: mission.title, status: mission.status, acceptedAt: accepted } : null,
      serverTime: Date.now(),
    });
  } catch (e) {
    return jsonError(e);
  }
}
