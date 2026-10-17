// ============================================================
//  Web Push hacia las tablets de las unidades (VAPID)
//  Las suscripciones viven en PushSubscription (una tablet puede
//  tener varias: Chrome + PWA instalada). Al fallar con 404/410
//  la suscripción se elimina (la app la vuelve a registrar).
// ============================================================

import webpush from "web-push";
import { prisma } from "./db";

let configured = false;

function ensureConfigured(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:central@fuegomap.pe",
      publicKey,
      privateKey,
    );
    configured = true;
  }
  return true;
}

export interface PushPayload {
  kind: "dispatch" | "incident" | "mission_unaccepted" | "status_forced" | "test";
  title?: string;
  body?: string;
  incidentId?: number;
  at?: number;
}

/** Entrega un payload a un lote de suscripciones. Devuelve cuántos llegaron;
 *  404/410 → se purga la suscripción (app desinstalada, permiso revocado). */
async function deliver(
  subs: { id: number; endpoint: string; p256dh: string; auth: string }[],
  payload: PushPayload,
  opts?: { ttl?: number; urgency?: "very-low" | "low" | "normal" | "high" },
): Promise<number> {
  if (subs.length === 0 || !ensureConfigured()) return 0;
  let delivered = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: opts?.ttl ?? 120, urgency: opts?.urgency ?? "high" },
        );
        delivered++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    }),
  );
  console.log(`[push] ${payload.kind}: ${delivered}/${subs.length} tablet(s)`);
  return delivered;
}

/** Envía un push a todas las tablets suscritas de una unidad. */
export async function sendPushToUnit(
  unitId: number,
  payload: PushPayload,
  opts?: { ttl?: number; urgency?: "very-low" | "low" | "normal" | "high" },
): Promise<number> {
  return deliver(await prisma.pushSubscription.findMany({ where: { unitId } }), payload, opts);
}

/** Push de emergencia a TODAS las tablets registradas: con unidad (chofer)
 *  y sin ella (bomberos en modo público — suscripción sin sesión). */
export async function sendPushToAll(
  payload: PushPayload,
  opts?: { ttl?: number; urgency?: "very-low" | "low" | "normal" | "high" },
): Promise<number> {
  return deliver(await prisma.pushSubscription.findMany(), payload, opts);
}

/** Clave pública VAPID para que el cliente registre la suscripción (GET /api/push/key) */
export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}
