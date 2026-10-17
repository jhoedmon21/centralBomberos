// Webhook de WhatsApp Business (Cloud API)
//
// GET  — verificación del webhook por Meta:
//        ?hub.mode=subscribe&hub.verify_token=XXX&hub.challenge=YYY
// POST — recepción de mensajes del ciudadano (texto, ubicación, imagen).
//        Acepta el formato oficial de Meta y también un formato simple
//        para pruebas locales:
//          { "phone": "51987...", "text": "Incendio...", "lat": -12, "lng": -77,
//            "photoUrl": "https://...", "photoBase64": "data:image/jpeg;base64,..." }
//
// Las fotos de Meta se descargan con el token de acceso (Configuración de la
// central o variable de entorno WA_TOKEN) y se guardan en /uploads para
// mostrarlas como evidencia del incidente. Si no hay token, el incidente se
// registra igual y la bitácora deja constancia de que llegó una foto.

import { connection } from "next/server";
import { jsonError } from "@/lib/errors";
import { saveDataUrl, saveMedia } from "@/lib/media";
import { getSettings, ingestWhatsApp, type IngestedMessage } from "@/lib/queries";

function settingOrEnv(value: string | undefined, envName: string, fallback: string): string {
  return value || process.env[envName] || fallback;
}

export async function GET(request: Request) {
  await connection();
  try {
    const params = new URL(request.url).searchParams;
    const mode = params.get("hub.mode");
    const token = params.get("hub.verify_token");
    const challenge = params.get("hub.challenge");
    const settings = await getSettings();
    const expected = settingOrEnv(settings.webhook_token, "WA_VERIFY_TOKEN", "fuegomap-verifica-2026");

    if (mode === "subscribe" && token === expected && challenge) {
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return new Response("Verificación fallida", { status: 403 });
  } catch (e) {
    return jsonError(e);
  }
}

interface CloudMessage {
  from?: string;
  type?: string;
  text?: { body?: string };
  image?: { caption?: string; id?: string; mime_type?: string };
  location?: { latitude?: number; longitude?: number; name?: string; address?: string };
}

/**
 * Descarga una imagen alojada en Meta y la guarda como evidencia local.
 * Requiere el token de acceso (Configuración → token de Meta, o WA_TOKEN).
 */
async function downloadMetaImage(mediaId: string, token: string): Promise<string | null> {
  try {
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metaRes.ok) return null;
    const info = (await metaRes.json()) as { url?: string };
    if (!info.url) return null;

    const bin = await fetch(info.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!bin.ok) return null;
    const bytes = new Uint8Array(await bin.arrayBuffer());
    if (bytes.length === 0 || bytes.length > 8 * 1024 * 1024) return null;

    const mime = bin.headers.get("content-type") ?? "image/jpeg";
    const ext = mime.includes("png") ? ".png" : mime.includes("webp") ? ".webp" : ".jpg";
    return saveMedia(bytes, ext);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return Response.json({ error: "JSON inválido" }, { status: 400 });

    let msg: IngestedMessage | null = null;

    // --- Formato oficial WhatsApp Cloud API ---
    const cloud: CloudMessage | undefined = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (cloud?.from) {
      let photoUrl: string | null = null;
      let photoPending = false;
      if (cloud.type === "image" && cloud.image?.id) {
        const settings = await getSettings();
        const waToken = settingOrEnv(settings.wa_token, "WA_TOKEN", "");
        if (waToken) {
          photoUrl = await downloadMetaImage(cloud.image.id, waToken);
        }
        photoPending = !photoUrl; // llegó foto pero no se pudo descargar
      }
      msg = {
        phone: `+${cloud.from}`,
        name: body?.entry?.[0]?.changes?.[0]?.value?.contacts?.[0]?.profile?.name ?? null,
        text: cloud.text?.body ?? cloud.image?.caption ?? cloud.location?.name ?? null,
        lat: cloud.location?.latitude ?? null,
        lng: cloud.location?.longitude ?? null,
        address: cloud.location?.address ?? cloud.location?.name ?? null,
        photoUrl,
        photoPending,
        source: "webhook",
      };
    }

    // --- Formato simple para pruebas locales ---
    if (!msg && typeof body.phone === "string") {
      let photoUrl = typeof body.photoUrl === "string" && body.photoUrl ? body.photoUrl : null;
      let photoPending = false;
      if (!photoUrl && typeof body.photoBase64 === "string" && body.photoBase64) {
        photoUrl = await saveDataUrl(body.photoBase64);
        photoPending = !photoUrl;
      }
      msg = {
        phone: body.phone,
        name: typeof body.name === "string" ? body.name : null,
        text: typeof body.text === "string" ? body.text : null,
        lat: typeof body.lat === "number" ? body.lat : null,
        lng: typeof body.lng === "number" ? body.lng : null,
        address: typeof body.address === "string" ? body.address : null,
        photoUrl,
        photoPending,
        source: "webhook",
      };
    }

    if (!msg) return Response.json({ ok: true, ignored: true });

    const incident = await ingestWhatsApp(msg);
    return Response.json({ ok: true, incidentId: incident.id }, { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
