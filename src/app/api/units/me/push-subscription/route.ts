// POST /api/units/me/push-subscription — registra (o refresca) la suscripción
// Web Push de esta tablet. Upsert por endpoint: reinstalar la app no duplica.

import { ApiError, jsonError } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { requireUnit } from "@/lib/unitapp";
import { pushSubscriptionSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const auth = await requireUnit(request);
    const body = await request.json().catch(() => ({}));
    const parsed = pushSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, "Suscripción no válida");
    }
    const { endpoint, keys } = parsed.data;

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { unitId: auth.unitId, p256dh: keys.p256dh, auth: keys.auth },
      create: { endpoint, unitId: auth.unitId, p256dh: keys.p256dh, auth: keys.auth },
    });
    return Response.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
