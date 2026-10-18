// GET /api/units/auth/units — listado MÍNIMO de unidades para el selector
// del login de la tablet: solo código y nombre (sin ubicaciones, estados
// ni incidentes). Público porque la pantalla de ingreso necesita ofrecer
// las unidades ANTES de autenticar; el resto del detalle sigue protegido.

import { connection } from "next/server";
import { jsonError } from "@/lib/errors";
import { prisma } from "@/lib/db";

export async function GET() {
  await connection();
  try {
    const units = await prisma.unit.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    });
    return Response.json({ units });
  } catch (e) {
    return jsonError(e);
  }
}
