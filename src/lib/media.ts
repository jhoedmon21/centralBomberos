// Almacenamiento local de evidencias (fotos) recibidas por WhatsApp o
// subidas desde la central. Los archivos viven en ./uploads y se sirven
// por /api/media/[name]. Para producción con S3/GCS, sustituir este módulo.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const UPLOAD_DIR = join(process.cwd(), "uploads");
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  // Notas de voz (chat central ↔ unidad)
  ".webm": "audio/webm",
  ".mp4": "audio/mp4",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
};

export function mediaMime(name: string): string | null {
  return MIME_BY_EXT[extname(name).toLowerCase()] ?? null;
}

/** Guarda bytes de imagen o audio y devuelve la URL pública (/api/media/...) */
export async function saveMedia(bytes: Uint8Array, ext: string): Promise<string | null> {
  if (bytes.length === 0 || bytes.length > MAX_BYTES) return null;
  const safeExt = MIME_BY_EXT[ext.toLowerCase()] ? ext.toLowerCase() : ".jpg";
  await mkdir(UPLOAD_DIR, { recursive: true });
  const name = `ev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`;
  await writeFile(join(UPLOAD_DIR, name), bytes);
  return `/api/media/${name}`;
}

/** Guarda una imagen o audio en formato data URL (data:…;base64,...) */
export async function saveDataUrl(dataUrl: string): Promise<string | null> {
  const m = /^data:(image\/[a-z0-9.+-]+|audio\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl.trim());
  if (!m) return null;
  const mime = m[1].toLowerCase();
  const ext = mime.includes("png")
    ? ".png"
    : mime.includes("webp")
      ? ".webp"
      : mime.includes("gif")
        ? ".gif"
        : mime.includes("svg")
          ? ".svg"
          : mime.includes("mp4")
            ? ".m4a"
            : mime.includes("ogg")
              ? ".ogg"
              : mime.includes("image")
                ? ".jpg"
                : ".webm";
  try {
    return await saveMedia(Buffer.from(m[2].replace(/\s/g, ""), "base64"), ext);
  } catch {
    return null;
  }
}

/** Lee una imagen del directorio de evidencias (nombre saneado) */
export async function readMedia(name: string): Promise<Uint8Array | null> {
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(name) || name.includes("..")) return null;
  try {
    return await readFile(join(UPLOAD_DIR, name));
  } catch {
    return null;
  }
}
