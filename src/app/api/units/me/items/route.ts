// GET /api/units/me/items — inventario de la unidad autenticada (su cookie de
// sesión de vehículo). Lista todos los materiales con compartimento y notas.

import { connection } from "next/server";
import { jsonError } from "@/lib/errors";
import { listUnitItems } from "@/lib/queries";
import { requireUnit } from "@/lib/unitapp";

export async function GET(request: Request) {
  await connection();
  try {
    const auth = await requireUnit(request);
    return Response.json({ items: await listUnitItems(auth.unitId) });
  } catch (e) {
    return jsonError(e);
  }
}
