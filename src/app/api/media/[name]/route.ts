// GET /api/media/[name] — sirve las evidencias (fotos) guardadas localmente

import { connection } from "next/server";
import { mediaMime, readMedia } from "@/lib/media";

export async function GET(_request: Request, ctx: RouteContext<"/api/media/[name]">) {
  await connection();
  try {
    const { name } = await ctx.params;
    const mime = mediaMime(name);
    const bytes = mime ? await readMedia(name) : null;
    if (!bytes) return new Response("No encontrado", { status: 404 });
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": mime as string,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}
