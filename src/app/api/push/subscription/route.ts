// POST /api/push/subscription — registra la suscripción Web Push para las
// NOTIFICACIONES DE EMERGENCIA, SIN sesión de chofer: cualquier tablet en
// modo bombero (o en la pantalla de ingreso) se suscribe al recibir cada
// emergencia aunque la app esté cerrada o en segundo plano.
// Upsert por endpoint: si la tablet ya estaba suscrita CON unidad (entró
// como chofer antes), solo refrescamos las claves y NO le quitamos la
// unidad — sigue recibiendo despachos y además las emergencias.
// (La clave pública VAPID la sirve GET /api/push/key.)

import { connection } from "next/server";
import { ApiError, jsonError } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { pushSubscriptionSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  await connection();
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = pushSubscriptionSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, "Suscripción no válida");
    const { endpoint, keys } = parsed.data;

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      // Sin sesión: refrescar claves preservando la unidad previa (si la tenía)
      update: { p256dh: keys.p256dh, auth: keys.auth },
      create: { endpoint, unitId: null, p256dh: keys.p256dh, auth: keys.auth },
    });
    return Response.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
