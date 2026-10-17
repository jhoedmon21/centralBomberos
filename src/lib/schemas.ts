// ============================================================
//  Validación de los endpoints de FuegoMap Unidades (zod)
//  Documentación viva: cada endpoint declara aquí su contrato.
// ============================================================

import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo no válido"),
  password: z.string().min(4, "Clave demasiado corta"),
  /** Código de la unidad a confirmar (p. ej. "B-1"). Los bomberos sin
   *  unidad (jefe de guardia) entran sin confirmar vehículo. */
  unitCode: z
    .string()
    .trim()
    .toUpperCase()
    .max(12)
    .optional(),
});

export const statusSchema = z.object({
  status: z.enum(["disponible", "en_ruta", "en_escena", "regresando", "fuera_servicio"]),
  /** Id de operación (idempotencia) */
  opId: z.string().uuid().optional(),
  /** Momento del toque en el cliente (ms) — para resolver conflictos */
  clientAt: z.number().int().nonnegative().optional(),
});

export const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().optional(),
  at: z.number().int().nonnegative().optional(),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export const equipmentCheckSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Día inválido (YYYY-MM-DD)"),
  opId: z.string().uuid().optional(),
});

export const closeMissionSchema = z.object({
  result: z.enum(["controlado", "sin_novedad", "falsa_alarma", "derivado"]),
  injured: z.number().int().min(0).max(999).default(0),
  observations: z.string().trim().max(600).optional(),
  /** Foto del cierre (data URL); se guarda como /api/media/... */
  photoBase64: z.string().optional().nullable(),
  opId: z.string().uuid().optional(),
});

export const hydrantNewSchema = z.object({
  code: z.string().trim().max(20).optional().nullable(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  pressure: z.enum(["buena", "media", "baja"]).optional().nullable(),
  diameter: z.number().int().min(25).max(300).optional().nullable(),
  situation: z.enum(["operativo", "mantenimiento", "fuera_servicio"]).optional(),
  notes: z.string().trim().max(300).optional().nullable(),
  photoBase64: z.string().optional().nullable(),
  opId: z.string().uuid().optional(),
});

export const hydrantStatusSchema = z.object({
  situation: z.enum(["operativo", "mantenimiento", "fuera_servicio"]),
  notes: z.string().trim().max(300).optional(),
  photoBase64: z.string().optional().nullable(),
  opId: z.string().uuid().optional(),
});
