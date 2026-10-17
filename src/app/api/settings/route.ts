// GET /api/settings — configuración de la central
// PUT /api/settings — actualizar configuración (WhatsApp, alertas, token)

import { connection } from "next/server";
import { jsonError } from "@/lib/errors";
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
    const body = await request.json().catch(() => ({}));
    // Solo se permiten claves conocidas (filtrado en setSettings)
    return Response.json({ settings: await setSettings(body) });
  } catch (e) {
    return jsonError(e);
  }
}
