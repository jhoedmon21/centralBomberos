// POST /api/operator/logout — cierra la sesión del CAD y audita la salida.

import { OPERATOR_COOKIE } from "@/lib/optoken";
import { operatorActor, requireOperator } from "@/lib/opauth";
import { logAudit } from "@/lib/audit";
import { jsonError } from "@/lib/errors";

const SECURE = process.env.NODE_ENV === "production";

export async function POST(request: Request) {
  try {
    const op = await requireOperator(request);
    logAudit(operatorActor(op), "logout");
    return Response.json(
      { ok: true },
      {
        headers: {
          "Set-Cookie": `${OPERATOR_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${SECURE ? "; Secure" : ""}`,
        },
      },
    );
  } catch (e) {
    return jsonError(e);
  }
}
