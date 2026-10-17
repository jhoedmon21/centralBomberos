// Errores de API con código HTTP

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function jsonError(e: unknown): Response {
  if (e instanceof ApiError) {
    return Response.json({ error: e.message }, { status: e.status });
  }
  console.error("[fuegomap] error inesperado:", e);
  return Response.json({ error: "Error interno del servidor" }, { status: 500 });
}
