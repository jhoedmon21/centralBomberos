// GET /api/risks — puntos de riesgo para planificación táctica

import { connection } from "next/server";
import { jsonError } from "@/lib/errors";
import { listRisks } from "@/lib/queries";

export async function GET() {
  await connection();
  try {
    return Response.json({ risks: await listRisks() });
  } catch (e) {
    return jsonError(e);
  }
}
