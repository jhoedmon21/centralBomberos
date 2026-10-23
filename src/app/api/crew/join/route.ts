// POST /api/crew/join — la app personal canjea el código del carro
// por un token Bearer para leer y escribir el chat de la unidad.

import { broadcast } from "@/lib/bus";
import { crewError, crewJson, crewPreflight, normalizeJoinCode, signCrewToken } from "@/lib/crew";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";

export async function OPTIONS(request: Request) {
  return crewPreflight(request);
}

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const code = normalizeJoinCode(String((payload as { code?: string }).code ?? ""));
    if (!code) throw new ApiError(400, "Escribe el código de tu carro");

    const crew = await prisma.unitCrew.findFirst({
      where: { joinCode: code, leftAt: null },
      select: {
        id: true,
        unitId: true,
        name: true,
        role: true,
        linkedAt: true,
        unit: { select: { id: true, code: true, name: true } },
      },
    });
    if (!crew) throw new ApiError(404, "Código no válido o el bombero ya no está a bordo");

    if (!crew.linkedAt) {
      await prisma.unitCrew.update({ where: { id: crew.id }, data: { linkedAt: new Date() } });
      broadcast({ type: "unit", action: "updated", id: crew.unitId });
    }

    return crewJson(request, {
      token: signCrewToken(crew.id, crew.unitId),
      member: { id: crew.id, name: crew.name, role: crew.role },
      unit: crew.unit,
    });
  } catch (e) {
    return crewError(request, e);
  }
}
