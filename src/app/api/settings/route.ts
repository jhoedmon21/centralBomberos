// GET /api/settings — configuración de la central
// PUT /api/settings — actualizar configuración (WhatsApp, alertas, token)

import { connection } from "next/server";
import { jsonError } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { operatorActor, requireOperator } from "@/lib/opauth";
import { getSettings, setSettings } from "@/lib/queries";

export async function GET() {
  await connection();
  try {
    return Response.json({ settings: await getSettings() });
  } catch (e) {
    return jsonError(e);
  }
}

export async function PUT(request: Request) {
  try {
    const op = await requireOperator(request, ["jefe", "operador"]);
    const body = await request.json().catch(() => ({}));
    // Solo se permiten claves conocidas (filtrado en setSettings)
    const settings = await setSettings(body);
    logAudit(operatorActor(op), "settings", { keys: Object.keys(body) });
    return Response.json({ settings });
  } catch (e) {
    return jsonError(e);
  }
}
