// GET /api/push/key — clave pública VAPID para suscribir la tablet

import { vapidPublicKey } from "@/lib/push";

export async function GET() {
  const key = vapidPublicKey();
  if (!key) {
    return Response.json(
      { error: "Servidor sin claves VAPID (definir VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY en .env)" },
      { status: 503 },
    );
  }
  return Response.json({ publicKey: key });
}
