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

export const chatSchema = z.object({
  body: z.string().trim().min(1, "Mensaje vacío").max(1000, "Máximo 1000 caracteres"),
});

// ---------- Central CAD: operadores, auditoría, preplans ----------

export const operatorLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo no válido"),
  password: z.string().min(4, "Clave demasiado corta"),
});

export const operatorSelfPatchSchema = z.object({
  current: z.string().min(1, "Ingresa tu clave actual"),
  password: z.string().min(8, "Nueva clave: mínimo 8 caracteres"),
});

export const operatorUserCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo no válido"),
  name: z.string().trim().min(2, "Nombre muy corto").max(60),
  role: z.enum(["jefe", "operador", "lectura"]).default("operador"),
  password: z.string().min(8, "Clave: mínimo 8 caracteres"),
});

export const operatorUserPatchSchema = z.object({
  role: z.enum(["jefe", "operador", "lectura"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8, "Clave: mínimo 8 caracteres").optional(),
});

export const preplanSchema = z.object({
  title: z.string().trim().min(2, "Título requerido").max(120),
  address: z.string().trim().min(3, "Dirección requerida").max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  layout: z.string().trim().max(2000).nullable().optional(),
  hazards: z.string().trim().max(2000).nullable().optional(),
  keysInfo: z.string().trim().max(2000).nullable().optional(),
  waterSources: z.string().trim().max(2000).nullable().optional(),
  contactName: z.string().trim().max(120).nullable().optional(),
  contactPhone: z.string().trim().max(40).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  photos: z.array(z.string().max(100_000)).max(8, "Máximo 8 fotos").optional(),
  status: z.enum(["activo", "inactivo"]).optional(),
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
