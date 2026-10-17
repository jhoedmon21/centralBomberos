// GET /api/stats — indicadores del turno (activos, tiempos, unidades)

import { connection } from "next/server";
import { jsonError } from "@/lib/errors";
import { getStats } from "@/lib/queries";

export async function GET() {
  await connection();
  try {
    return Response.json({ stats: await getStats() });
  } catch (e) {
    return jsonError(e);
  }
}
