// GET  /api/preplans — fichas operativas de riesgo (todas; la central filtra)
// POST /api/preplans — alta de ficha (jefe u operador)

import { ApiError, jsonError } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { operatorActor, requireOperator } from "@/lib/opauth";
import { createPreplan, listPreplans } from "@/lib/preplans";
import { preplanSchema } from "@/lib/schemas";

export async function GET(request: Request) {
  try {
    await requireOperator(request);
    return Response.json({ preplans: await listPreplans() });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(request: Request) {
  try {
    const op = await requireOperator(request, ["jefe", "operador"]);
    const body = await request.json().catch(() => ({}));
    const parsed = preplanSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Ficha no válida");

    const preplan = await createPreplan(parsed.data, op.name);
    logAudit(operatorActor(op), "preplan_create", { preplanId: preplan.id, title: preplan.title });
    return Response.json({ preplan });
  } catch (e) {
    return jsonError(e);
  }
}
