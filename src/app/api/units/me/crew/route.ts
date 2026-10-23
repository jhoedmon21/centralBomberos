// GET  /api/units/me/crew — tripulación a bordo de esta unidad
// POST /api/units/me/crew — el chofer agrega un bombero a la unidad

import { z } from "zod";
import { broadcast } from "@/lib/bus";
import { createCrewMember } from "@/lib/crew";
import { prisma } from "@/lib/db";
import { ApiError, jsonError } from "@/lib/errors";
import { requireUnit } from "@/lib/unitapp";

const CREW_ROLES = ["chofer", "jefe_equipo", "bombero", "practicante"] as const;

const crewSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre del bombero").max(60, "Nombre demasiado largo"),
  role: z.enum(CREW_ROLES).optional(),
});

async function activeCrew(unitId: number) {
  return prisma.unitCrew.findMany({
    where: { unitId, leftAt: null },
    orderBy: { joinedAt: "asc" },
    select: {
      id: true,
      unitId: true,
      name: true,
      role: true,
      status: true,
      joinCode: true,
      linkedAt: true,
      joinedAt: true,
    },
  });
}

export async function GET(request: Request) {
  try {
    const auth = await requireUnit(request);
    return Response.json({ crew: await activeCrew(auth.unitId) });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUnit(request);
    const payload = await request.json().catch(() => ({}));
    const parsed = crewSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? "Datos no válidos");
    }
    const duplicate = await prisma.unitCrew.findFirst({
      where: { unitId: auth.unitId, leftAt: null, name: { equals: parsed.data.name, mode: "insensitive" } },
      select: { id: true },
    });
    if (duplicate) throw new ApiError(409, "Ese bombero ya está a bordo");
    const created = await createCrewMember(
      auth.unitId,
      parsed.data.name,
      parsed.data.role ?? "bombero",
    );
    const member = {
      id: created.id,
      unitId: created.unitId,
      name: created.name,
      role: created.role,
      status: created.status,
      joinCode: created.joinCode,
      linkedAt: created.linkedAt,
      joinedAt: created.joinedAt,
    };
    broadcast({ type: "unit", action: "updated", id: auth.unitId });
    return Response.json({ member });
  } catch (e) {
    return jsonError(e);
  }
}
