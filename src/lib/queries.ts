// Capa de acceso a datos + reglas de negocio de la central FuegoMap.
// Todas las mutaciones pasan por aquí: validan, escriben, registran la
// bitácora (IncidentEvent) y emiten eventos SSE (broadcast).

import type {
  Hydrant,
  Incident,
  IncidentEvent,
  IncidentUnit,
  RiskPoint,
  Unit,
  UnitCrew,
  UnitItem,
} from "@prisma/client";
import { prisma } from "./db";
import { broadcast } from "./bus";
import { ApiError } from "./errors";
import { sendPushToAll } from "./push";
import { ACTIVE_STATUSES } from "./meta";
import { haversineM, CITY_CENTER } from "./geo";
import type {
  ActivityDTO,
  EventDTO,
  HydrantDTO,
  HydrantSituation,
  IncidentDTO,
  IncidentSource,
  IncidentStatus,
  RiskDTO,
  Severity,
  SettingsDTO,
  StatsDTO,
  UnitDTO,
  UnitItemCategory,
  UnitItemCondition,
  UnitItemDTO,
  UnitStatus,
  UnitType,
} from "./types";

// Preplans viven en su propio módulo (fichas de riesgo); se reexporta
// para que la carga inicial de la central use la misma puerta que el resto.
export { listPreplans } from "./preplans";

const INCIDENT_STATUSES: IncidentStatus[] = [
  "reportado",
  "despachado",
  "en_escena",
  "controlado",
  "cerrado",
];
const SEVERITIES: Severity[] = ["critica", "alta", "media", "baja"];
const UNIT_STATUSES: UnitStatus[] = [
  "disponible",
  "en_ruta",
  "en_escena",
  "regresando",
  "fuera_servicio",
];
const SOURCES: IncidentSource[] = ["whatsapp", "telefono116", "manual", "webhook", "simulacion"];

// ------------------------------------------------------------------
// Serialización DTO
// ------------------------------------------------------------------

type UnitWithIncidents = Unit & {
  incidents?: { id: number }[];
  crewMembers?: UnitCrew[];
  _count?: { items: number };
};

export function toUnitDTO(u: UnitWithIncidents): UnitDTO {
  return {
    id: u.id,
    code: u.code,
    name: u.name,
    type: u.type as UnitDTO["type"],
    status: u.status as UnitStatus,
    station: u.station,
    crew: u.crew,
    lat: u.lat,
    lng: u.lng,
    incidentId: u.incidents?.[0]?.id ?? null,
    itemCount: u._count?.items ?? 0,
    statusAt: u.statusAt.toISOString(),
    statusSource: u.statusSource as UnitDTO["statusSource"],
    crewMembers: (u.crewMembers ?? []).map((c) => ({
      id: c.id,
      unitId: c.unitId,
      name: c.name,
      role: c.role as UnitDTO["crewMembers"][number]["role"],
      status: c.status as UnitDTO["crewMembers"][number]["status"],
      joinedAt: c.joinedAt.toISOString(),
    })),
  };
}

type EventDTOLike = IncidentEvent;

export function toEventDTO(e: EventDTOLike): EventDTO {
  return {
    id: e.id,
    type: e.type,
    message: e.message,
    actor: e.actor,
    createdAt: e.createdAt.toISOString(),
  };
}

type IncidentFull = Incident & {
  unit?: Unit | null;
  events?: IncidentEvent[];
  unitAssignments?: Array<IncidentUnit & { unit: Pick<Unit, "id" | "code" | "name" | "status"> }>;
};

export function toIncidentDTO(i: IncidentFull): IncidentDTO {
  return {
    id: i.id,
    title: i.title,
    address: i.address,
    lat: i.lat,
    lng: i.lng,
    severity: i.severity as Severity,
    status: i.status as IncidentStatus,
    source: i.source as IncidentSource,
    reporterName: i.reporterName,
    reporterPhone: i.reporterPhone,
    photoUrl: i.photoUrl,
    notes: i.notes,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
    dispatchAt: i.dispatchAt?.toISOString() ?? null,
    arrivalAt: i.arrivalAt?.toISOString() ?? null,
    closedAt: i.closedAt?.toISOString() ?? null,
    acceptedAt: i.acceptedAt?.toISOString() ?? null,
    departLat: i.departLat,
    departLng: i.departLng,
    unitId: i.unitId,
    unit: i.unit ? toUnitDTO(i.unit) : null,
    events: i.events ? i.events.map(toEventDTO) : undefined,
    // Unidades asignadas (despacho multi-unidad) cuando el include las trae
    units: i.unitAssignments?.map((a) => ({
      unitId: a.unit.id,
      code: a.unit.code,
      name: a.unit.name,
      status: a.unit.status as UnitDTO["status"],
      acceptedAt: a.acceptedAt?.toISOString() ?? null,
      dispatchedAt: a.dispatchedAt.toISOString(),
    })),
  };
}

function toHydrantDTO(h: Hydrant): HydrantDTO {
  return {
    id: h.id,
    code: h.code,
    lat: h.lat,
    lng: h.lng,
    pressure: h.pressure,
    diameter: h.diameter,
    situation: h.situation as HydrantSituation,
    photoUrl: h.photoUrl,
    notes: h.notes,
  };
}

function toRiskDTO(r: RiskPoint): RiskDTO {
  return { id: r.id, name: r.name, type: r.type, level: r.level, lat: r.lat, lng: r.lng };
}

// ------------------------------------------------------------------
// Consultas
// ------------------------------------------------------------------

export async function listIncidents(): Promise<IncidentDTO[]> {
  const rows = await prisma.incident.findMany({
    include: {
      unit: true,
      unitAssignments: { include: { unit: { select: { id: true, code: true, name: true, status: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return rows.map(toIncidentDTO);
}

export async function getIncident(id: number): Promise<IncidentDTO> {
  const row = await prisma.incident.findUnique({
    where: { id },
    include: {
      unit: true,
      unitAssignments: { include: { unit: { select: { id: true, code: true, name: true, status: true } } } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!row) throw new ApiError(404, "Incidente no encontrado");
  return toIncidentDTO(row);
}

export async function listUnits(): Promise<UnitDTO[]> {
  const rows = await prisma.unit.findMany({
    include: {
      incidents: {
        where: { status: { in: ACTIVE_STATUSES } },
        select: { id: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      crewMembers: {
        where: { leftAt: null },
        orderBy: { joinedAt: "asc" },
      },
      _count: { select: { items: true } },
    },
    orderBy: { code: "asc" },
  });
  return rows.map(toUnitDTO);
}

export async function listHydrants(): Promise<HydrantDTO[]> {
  const rows = await prisma.hydrant.findMany({ orderBy: { code: "asc" } });
  return rows.map(toHydrantDTO);
}

export async function listRisks(): Promise<RiskDTO[]> {
  const rows = await prisma.riskPoint.findMany({ orderBy: { name: "asc" } });
  return rows.map(toRiskDTO);
}

export async function getActivity(limit = 40): Promise<ActivityDTO[]> {
  const rows = await prisma.incidentEvent.findMany({
    include: { incident: { select: { id: true, title: true, status: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((e) => ({
    ...toEventDTO(e),
    incidentId: e.incident.id,
    incidentTitle: e.incident.title,
    incidentStatus: e.incident.status as IncidentStatus,
  }));
}

export async function getSettings(): Promise<SettingsDTO> {
  const rows = await prisma.setting.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    wa_unit: map.wa_unit ?? "",
    wa_central: map.wa_central ?? "",
    alert_sound: map.alert_sound ?? "1",
    webhook_token: map.webhook_token ?? "fuegomap-verifica-2026",
    wa_token: map.wa_token ?? "",
    public_base: map.public_base ?? "",
  };
}

export async function setSettings(patch: Partial<SettingsDTO>): Promise<SettingsDTO> {
  const allowed: (keyof SettingsDTO)[] = [
    "wa_unit",
    "wa_central",
    "alert_sound",
    "webhook_token",
    "wa_token",
    "public_base",
  ];
  for (const [key, value] of Object.entries(patch)) {
    if (!allowed.includes(key as keyof SettingsDTO) || typeof value !== "string") continue;
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
  broadcast({ type: "settings", action: "updated" });
  return getSettings();
}

export async function getStats(): Promise<StatsDTO> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [active, today, closedToday, units] = await Promise.all([
    prisma.incident.findMany({
      where: { status: { in: ACTIVE_STATUSES } },
      select: { status: true },
    }),
    prisma.incident.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.incident.count({ where: { closedAt: { gte: startOfDay } } }),
    prisma.unit.findMany({ select: { status: true } }),
  ]);

  // Tiempo de respuesta = despacho -> llegada (últimos 50 casos)
  const responded = await prisma.incident.findMany({
    where: { dispatchAt: { not: null }, arrivalAt: { not: null } },
    select: { dispatchAt: true, arrivalAt: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const avgMin =
    responded.length > 0
      ? Math.round(
          responded.reduce(
            (acc, r) => acc + (r.arrivalAt!.getTime() - r.dispatchAt!.getTime()) / 60_000,
            0,
          ) / responded.length,
        )
      : null;

  return {
    activos: active.length,
    reportados: active.filter((a) => a.status === "reportado").length,
    despachados: active.filter((a) => a.status === "despachado").length,
    enEscena: active.filter((a) => a.status === "en_escena").length,
    hoy: today,
    cerradosHoy: closedToday,
    unidadesDisponibles: units.filter((u) => u.status === "disponible").length,
    unidadesTotal: units.length,
    respuestaPromedioMin: avgMin,
  };
}

// ------------------------------------------------------------------
// Mutaciones
// ------------------------------------------------------------------

export interface CreateIncidentInput {
  title: string;
  address: string;
  lat: number;
  lng: number;
  severity?: Severity;
  source?: IncidentSource;
  reporterName?: string | null;
  reporterPhone?: string | null;
  photoUrl?: string | null;
  notes?: string | null;
  createdBy?: string;
}

export async function createIncident(input: CreateIncidentInput): Promise<IncidentDTO> {
  const title = input.title?.trim();
  const address = input.address?.trim();
  if (!title) throw new ApiError(400, "El título es obligatorio");
  if (!address) throw new ApiError(400, "La dirección es obligatoria");
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new ApiError(400, "Latitud inválida");
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new ApiError(400, "Longitud inválida");
  const severity: Severity = SEVERITIES.includes(input.severity as Severity)
    ? (input.severity as Severity)
    : "alta";
  const source: IncidentSource = SOURCES.includes(input.source as IncidentSource)
    ? (input.source as IncidentSource)
    : "manual";

  const row = await prisma.incident.create({
    data: {
      title,
      address,
      lat,
      lng,
      severity,
      source,
      status: "reportado",
      reporterName: input.reporterName ?? null,
      reporterPhone: input.reporterPhone ?? null,
      photoUrl: input.photoUrl ?? null,
      notes: input.notes ?? null,
      events: {
        create: {
          type: "creado",
          message:
            source === "whatsapp" || source === "webhook"
              ? "Reporte ciudadano recibido por WhatsApp con ubicación"
              : "Reporte registrado en la central",
          actor: input.createdBy ?? (source === "whatsapp" || source === "webhook" ? "ciudadano" : "operador"),
        },
      },
    },
    include: { unit: true, unitAssignments: { include: { unit: true } } },
  });

  broadcast({ type: "incident", action: "created", id: row.id, title: row.title });
  broadcast({ type: "activity" });
  // Web Push de emergencia a TODAS las tablets (con o sin sesión de chofer):
  // la nueva emergencia es pública. Va en segundo plano y no bloquea la
  // respuesta; si no hay claves VAPID o suscripciones, no pasa nada.
  void sendPushToAll(
    {
      kind: "incident",
      title: `🚨 ${row.title}`,
      body: `${row.address} · prioridad ${row.severity}`,
      incidentId: row.id,
      at: Date.now(),
    },
    { ttl: 300, urgency: "high" },
  ).catch(() => {});
  return toIncidentDTO(row);
}

/** Transiciones de estado permitidas */
const TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  reportado: ["cerrado"],
  despachado: ["en_escena", "cerrado"],
  en_escena: ["controlado", "cerrado"],
  controlado: ["cerrado"],
  cerrado: [],
};

const STATUS_MESSAGE: Record<IncidentStatus, string> = {
  reportado: "Incidente reabierto",
  despachado: "Unidad despachada",
  en_escena: "Unidad en la escena",
  controlado: "Incendio controlado",
  cerrado: "Incidente cerrado",
};

export async function updateIncident(
  id: number,
  patch: {
    status?: IncidentStatus;
    notes?: string | null;
    severity?: Severity;
    /** Edición del reporte desde la central */
    title?: string;
    address?: string;
    lat?: number;
    lng?: number;
    reporterName?: string | null;
    reporterPhone?: string | null;
    photoUrl?: string | null;
  },
  actor = "operador",
): Promise<IncidentDTO> {
  const current = await prisma.incident.findUnique({
    where: { id },
    include: { unitAssignments: true },
  });
  if (!current) throw new ApiError(404, "Incidente no encontrado");

  const data: Record<string, unknown> = {};
  const events: { type: string; message: string; actor: string }[] = [];
  const now = new Date();
  let newStatus: IncidentStatus | null = null;

  if (patch.status && patch.status !== current.status) {
    newStatus = patch.status;
    if (!INCIDENT_STATUSES.includes(newStatus)) throw new ApiError(400, "Estado inválido");
    const allowed = TRANSITIONS[current.status as IncidentStatus] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new ApiError(
        409,
        `Transición no permitida: ${current.status} → ${newStatus}`,
      );
    }
    data.status = newStatus;
    if (newStatus === "en_escena") data.arrivalAt = now;
    if (newStatus === "cerrado") data.closedAt = now;
    events.push({
      type: newStatus === "cerrado" ? "cierre" : "estado",
      message: STATUS_MESSAGE[newStatus],
      actor,
    });
  }

  if (patch.severity && patch.severity !== current.severity) {
    if (!SEVERITIES.includes(patch.severity)) throw new ApiError(400, "Severidad inválida");
    data.severity = patch.severity;
    events.push({ type: "nota", message: `Severidad cambiada a ${patch.severity}`, actor });
  }

  // Edición del reporte desde la central (tipo, dirección, ubicación, reportante, foto)
  const edited: string[] = [];
  if (patch.title !== undefined) {
    const title = String(patch.title).trim();
    if (!title) throw new ApiError(400, "El título es obligatorio");
    if (title !== current.title) {
      data.title = title;
      edited.push("tipo");
    }
  }
  if (patch.address !== undefined) {
    const address = String(patch.address).trim();
    if (!address) throw new ApiError(400, "La dirección es obligatoria");
    if (address !== current.address) {
      data.address = address;
      edited.push("dirección");
    }
  }
  if (patch.lat !== undefined || patch.lng !== undefined) {
    const lat = Number(patch.lat ?? current.lat);
    const lng = Number(patch.lng ?? current.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new ApiError(400, "Latitud inválida");
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new ApiError(400, "Longitud inválida");
    if (lat !== current.lat || lng !== current.lng) {
      data.lat = lat;
      data.lng = lng;
      edited.push("ubicación");
    }
  }
  if (patch.reporterName !== undefined && (patch.reporterName ?? null) !== current.reporterName) {
    data.reporterName = patch.reporterName;
    edited.push("reportante");
  }
  if (patch.reporterPhone !== undefined && (patch.reporterPhone ?? null) !== current.reporterPhone) {
    data.reporterPhone = patch.reporterPhone;
    edited.push("teléfono del reportante");
  }
  if (patch.photoUrl !== undefined && patch.photoUrl !== current.photoUrl) {
    data.photoUrl = patch.photoUrl;
    edited.push(patch.photoUrl ? "foto" : "sin foto");
  }
  if (edited.length) {
    events.push({ type: "nota", message: `Reporte editado: ${edited.join(" · ")}`, actor });
  }

  if (patch.notes !== undefined && patch.notes !== current.notes) {
    data.notes = patch.notes;
    events.push({ type: "nota", message: "Se actualizaron las notas del incidente", actor });
  }

  if (Object.keys(data).length === 0) return getIncident(id);

  const row = await prisma.incident.update({
    where: { id },
    data: {
      ...data,
      ...(events.length ? { events: { create: events } } : {}),
    },
    include: { unit: true, unitAssignments: { include: { unit: true } } },
  });

  // Sincronizar las unidades asignadas (con marca de tiempo y origen del cambio).
  // updateMany libera/marca TODAS en una sola escritura: menos ventana de carrera
  // contra un despacho simultáneo que podría re-marcar una unidad tras liberarla.
  const assignedIdList = [
    ...new Set<number>([
      ...(current.unitAssignments ?? []).map((a) => a.unitId),
      ...(current.unitId ? [current.unitId] : []),
    ]),
  ];
  let unitSynced = false;
  if (assignedIdList.length) {
    if (newStatus === "en_escena") {
      await prisma.unit.updateMany({
        where: { id: { in: assignedIdList } },
        data: { status: "en_escena", statusAt: now, statusSource: "sistema" },
      });
      unitSynced = true;
      for (const unitId of assignedIdList) broadcast({ type: "unit", action: "updated", id: unitId });
    } else if (newStatus === "cerrado") {
      await prisma.unit.updateMany({
        where: { id: { in: assignedIdList } },
        data: { status: "disponible", statusAt: now, statusSource: "sistema" },
      });
      unitSynced = true;
      for (const unitId of assignedIdList) broadcast({ type: "unit", action: "updated", id: unitId });
    }
  }

  broadcast({ type: "incident", action: "updated", id });
  broadcast({ type: "activity" });
  // Si la unidad cambió de estado, re-leer para devolver datos frescos.
  return unitSynced ? getIncident(id) : toIncidentDTO(row);
}

export async function dispatchIncident(
  id: number,
  unitIds: number[],
  actor = "operador",
): Promise<IncidentDTO> {
  // Despacho multi-unidad: dedupe preservando el orden; la primera es la
  // principal (unitId del incidente — compat con el flujo existente).
  const ids = [...new Set(unitIds)].filter((n) => Number.isInteger(n) && n > 0).slice(0, 8);
  if (!ids.length) throw new ApiError(400, "Selecciona al menos una unidad válida");

  const incident = await prisma.incident.findUnique({
    where: { id },
    include: { unitAssignments: true },
  });
  if (!incident) throw new ApiError(404, "Incidente no encontrado");
  if (!["reportado", "despachado", "en_escena"].includes(incident.status)) {
    throw new ApiError(409, "El incidente ya está controlado o cerrado");
  }

  const units = await prisma.unit.findMany({ where: { id: { in: ids } } });
  if (units.length !== ids.length) throw new ApiError(400, "Una de las unidades no existe");

  const prevIds = new Set(incident.unitAssignments.map((a) => a.unitId));
  if (incident.unitId) prevIds.add(incident.unitId);
  for (const unit of units) {
    if (unit.status !== "disponible" && !prevIds.has(unit.id)) {
      throw new ApiError(409, `La unidad ${unit.code} no está disponible (${unit.status})`);
    }
  }

  const now = new Date();
  const firstDispatch = incident.dispatchAt == null;
  const primary = incident.unitId ?? ids[0];
  const primaryUnit = units.find((u) => u.id === primary) ?? units[0];

  // Transacción POR LOTES (una sola ida): upserts de asignaciones, estados
  // de las unidades y el update del incidente. La interactiva vence a 5 s
  // (SQLite + polling de la app la hace lenta); el lote va en un solo turno.
  const rows = ids.map((unitId) =>
    prisma.incidentUnit.upsert({
      where: { incidentId_unitId: { incidentId: id, unitId } },
      create: { incidentId: id, unitId },
      update: { dispatchedAt: now },
    }),
  );
  const unitStates = ids.map((unitId) =>
    prisma.unit.update({
      where: { id: unitId },
      data: { status: "en_ruta", statusAt: now, statusSource: "operador" },
    }),
  );
  // Liberar la unidad principal anterior si salió de la lista
  const releaseOld = incident.unitId && !ids.includes(incident.unitId)
    ? [
        prisma.unit.update({
          where: { id: incident.unitId },
          data: { status: "disponible", statusAt: now, statusSource: "operador" },
        }),
      ]
    : [];
  const finalUpdate = prisma.incident.update({
    where: { id },
    data: {
      unitId: primary,
      // Refuerzos: si la emergencia ya está en escena no se degrada el estado
      status: incident.status === "reportado" ? "despachado" : incident.status,
      dispatchAt: incident.dispatchAt ?? now,
      acceptedAt: firstDispatch ? null : incident.acceptedAt,
      // Punto de salida de la unidad principal (cuartel) — trayecto tipo Uber
      ...(firstDispatch && primaryUnit.lat != null && primaryUnit.lng != null
        ? { departLat: primaryUnit.lat, departLng: primaryUnit.lng }
        : {}),
      events: {
        // Solo se registra en bitácora las unidades NUEVAS de este despacho
        // (un refuerzo no vuelve a "despachar" a las que ya están en misión)
        create: units
          .filter((u) => !prevIds.has(u.id))
          .map((unit) => ({
            type: "despacho",
            message:
              prevIds.size > 0
                ? `Refuerzo: unidad ${unit.code} enviada por la central`
                : `Unidad ${unit.code} despachada por la central`,
            actor,
          })),
      },
    },
    include: { unit: true, unitAssignments: { include: { unit: true } } },
  });
  await prisma.$transaction([...rows, ...unitStates, ...releaseOld, finalUpdate]);

  if (incident.unitId && !ids.includes(incident.unitId)) {
    broadcast({ type: "unit", action: "updated", id: incident.unitId });
  }

  broadcast({ type: "incident", action: "updated", id });
  for (const unitId of ids) {
    broadcast({ type: "unit", action: "updated", id: unitId });
    // Aviso dedicado a la tablet de la unidad (SSE + Web Push lo consumen)
    broadcast({ type: "unit_mission", action: "dispatched", id, unitId, title: incident.title });
  }
  broadcast({ type: "activity" });
  const fresh = await prisma.incident.findUnique({
    where: { id },
    include: { unit: true, unitAssignments: { include: { unit: true } } },
  });
  if (!fresh) {
    // Imposible en la práctica (acabamos de escribirlo); sin asignaciones si ocurriera
    return toIncidentDTO({ ...incident, unitAssignments: [] });
  }
  return toIncidentDTO(fresh);
}

export async function updateUnit(
  id: number,
  patch: {
    status?: UnitStatus;
    crew?: number | null;
    lat?: number;
    lng?: number;
    /** Origen del cambio de estado: unidad (app) | operador (central) | sistema */
    statusSource?: "unidad" | "operador" | "sistema";
  },
): Promise<UnitDTO> {
  const unit = await prisma.unit.findUnique({
    where: { id },
    include: {
      incidents: {
        where: { status: { in: ACTIVE_STATUSES } },
        select: { id: true },
        take: 1,
      },
      _count: { select: { items: true } },
    },
  });
  if (!unit) throw new ApiError(404, "Unidad no encontrada");

  const data: Record<string, unknown> = {};
  if (patch.status) {
    if (!UNIT_STATUSES.includes(patch.status)) throw new ApiError(400, "Estado de unidad inválido");
    data.status = patch.status;
    data.statusAt = new Date();
    data.statusSource = patch.statusSource ?? "operador";
  }
  if (patch.crew !== undefined) {
    const crew = Number(patch.crew);
    if (!Number.isInteger(crew) || crew < 0 || crew > 30) throw new ApiError(400, "Dotación inválida");
    data.crew = crew;
  }
  if (patch.lat !== undefined || patch.lng !== undefined) {
    const lat = Number(patch.lat);
    const lng = Number(patch.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new ApiError(400, "Latitud inválida");
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new ApiError(400, "Longitud inválida");
    data.lat = lat;
    data.lng = lng;
  }
  if (Object.keys(data).length === 0) return toUnitDTO(unit);

  const row = await prisma.unit.update({
    where: { id },
    data,
    include: {
      incidents: {
        where: { status: { in: ACTIVE_STATUSES } },
        select: { id: true },
        take: 1,
      },
      _count: { select: { items: true } },
    },
  });
  broadcast({ type: "unit", action: "updated", id });
  return toUnitDTO(row);
}

// ------------------------------------------------------------------
// Parque de unidades: alta y baja
// ------------------------------------------------------------------

const UNIT_TYPES: UnitType[] = ["bomba", "cisterna", "rescate", "ambulancia", "auxiliar", "mando"];

export async function createUnit(input: {
  code: string;
  name: string;
  type?: string;
  status?: string;
  station?: string | null;
  crew?: number | string | null;
  lat?: number | string | null;
  lng?: number | string | null;
}): Promise<UnitDTO> {
  const code = String(input.code ?? "").trim().toUpperCase();
  if (!code) throw new ApiError(400, "El código de la unidad es obligatorio");
  if (code.length > 10) throw new ApiError(400, "Código demasiado largo (máx. 10 caracteres)");

  const name = String(input.name ?? "").trim();
  if (!name) throw new ApiError(400, "El nombre de la unidad es obligatorio");
  if (name.length > 60) throw new ApiError(400, "Nombre demasiado largo (máx. 60 caracteres)");

  const type = (input.type ?? "bomba") as UnitType;
  if (!UNIT_TYPES.includes(type)) throw new ApiError(400, "Tipo de unidad inválido");

  const status = (input.status ?? "disponible") as UnitStatus;
  if (!UNIT_STATUSES.includes(status)) throw new ApiError(400, "Estado de unidad inválido");

  const station = input.station ? String(input.station).trim().slice(0, 80) || null : null;

  let crew: number | null = null;
  if (input.crew !== undefined && input.crew !== null && input.crew !== "") {
    crew = Number(input.crew);
    if (!Number.isInteger(crew) || crew < 0 || crew > 30) {
      throw new ApiError(400, "Dotación inválida (0–30)");
    }
  }

  let lat: number | null = null;
  let lng: number | null = null;
  if (input.lat !== undefined && input.lat !== null && input.lat !== "") {
    const coords = normalizeCoords(input.lat, input.lng);
    lat = coords.lat;
    lng = coords.lng;
  }

  try {
    const row = await prisma.unit.create({
      data: { code, name, type, status, station, crew, lat, lng },
    });
    broadcast({ type: "unit", action: "created", id: row.id });
    return toUnitDTO(row);
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      throw new ApiError(409, "Ya existe una unidad con ese código");
    }
    throw e;
  }
}

export async function deleteUnit(id: number): Promise<void> {
  const unit = await prisma.unit.findUnique({ where: { id }, select: { id: true } });
  if (!unit) throw new ApiError(404, "Unidad no encontrada");
  await prisma.unit.delete({ where: { id } });
  broadcast({ type: "unit", action: "deleted", id });
}

// ------------------------------------------------------------------
// Inventario de materiales por unidad
// ------------------------------------------------------------------

const UNIT_ITEM_CATEGORIES: UnitItemCategory[] = [
  "extintor",
  "manguera",
  "herramienta",
  "rescate",
  "medico",
  "comunicacion",
  "epp",
  "equipo",
];
const UNIT_ITEM_CONDITIONS: UnitItemCondition[] = ["bueno", "regular", "malo"];

function toUnitItemDTO(i: UnitItem): UnitItemDTO {
  return {
    id: i.id,
    unitId: i.unitId,
    name: i.name,
    category: i.category as UnitItemCategory,
    quantity: i.quantity,
    condition: i.condition as UnitItemCondition,
    notes: i.notes,
    compartment: i.compartment,
  };
}

function normalizeItemName(name: unknown): string {
  const s = String(name ?? "").trim();
  if (!s) throw new ApiError(400, "El nombre del material es obligatorio");
  if (s.length > 80) throw new ApiError(400, "Nombre demasiado largo (máx. 80 caracteres)");
  return s;
}

function normalizeCategory(category?: string | null): UnitItemCategory {
  if (category === undefined || category === null || category === "") return "equipo";
  if (!UNIT_ITEM_CATEGORIES.includes(category as UnitItemCategory)) {
    throw new ApiError(400, "Categoría inválida");
  }
  return category as UnitItemCategory;
}

function normalizeCondition(condition?: string | null): UnitItemCondition {
  if (condition === undefined || condition === null || condition === "") return "bueno";
  if (!UNIT_ITEM_CONDITIONS.includes(condition as UnitItemCondition)) {
    throw new ApiError(400, "Condición inválida (bueno | regular | malo)");
  }
  return condition as UnitItemCondition;
}

function normalizeQuantity(quantity?: number | string | null): number {
  const n = Number(quantity ?? 1);
  if (!Number.isInteger(n) || n < 1 || n > 999) throw new ApiError(400, "Cantidad inválida (1–999)");
  return n;
}

function normalizeNotes(notes?: string | null): string | null {
  if (notes === undefined || notes === null) return null;
  const s = String(notes).trim();
  if (!s) return null;
  if (s.length > 300) throw new ApiError(400, "Notas demasiado largas (máx. 300 caracteres)");
  return s;
}

export async function listUnitItems(unitId: number): Promise<UnitItemDTO[]> {
  const unit = await prisma.unit.findUnique({ where: { id: unitId }, select: { id: true } });
  if (!unit) throw new ApiError(404, "Unidad no encontrada");
  const rows = await prisma.unitItem.findMany({
    where: { unitId },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return rows.map(toUnitItemDTO);
}

export async function createUnitItem(
  unitId: number,
  input: { name: string; category?: string; quantity?: number; condition?: string; notes?: string | null },
): Promise<UnitItemDTO> {
  const unit = await prisma.unit.findUnique({ where: { id: unitId }, select: { id: true } });
  if (!unit) throw new ApiError(404, "Unidad no encontrada");
  const row = await prisma.unitItem.create({
    data: {
      unitId,
      name: normalizeItemName(input.name),
      category: normalizeCategory(input.category),
      quantity: normalizeQuantity(input.quantity),
      condition: normalizeCondition(input.condition),
      notes: normalizeNotes(input.notes),
    },
  });
  broadcast({ type: "unit", action: "updated", id: unitId });
  return toUnitItemDTO(row);
}

export async function updateUnitItem(
  id: number,
  patch: { name?: string; category?: string; quantity?: number; condition?: string; notes?: string | null },
): Promise<UnitItemDTO> {
  const item = await prisma.unitItem.findUnique({ where: { id } });
  if (!item) throw new ApiError(404, "Material no encontrado");
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = normalizeItemName(patch.name);
  if (patch.category !== undefined) data.category = normalizeCategory(patch.category);
  if (patch.quantity !== undefined) data.quantity = normalizeQuantity(patch.quantity);
  if (patch.condition !== undefined) data.condition = normalizeCondition(patch.condition);
  if (patch.notes !== undefined) data.notes = normalizeNotes(patch.notes);
  if (Object.keys(data).length === 0) return toUnitItemDTO(item);
  const row = await prisma.unitItem.update({ where: { id }, data });
  broadcast({ type: "unit", action: "updated", id: item.unitId });
  return toUnitItemDTO(row);
}

export async function deleteUnitItem(id: number): Promise<void> {
  const item = await prisma.unitItem.findUnique({ where: { id } });
  if (!item) throw new ApiError(404, "Material no encontrado");
  await prisma.unitItem.delete({ where: { id } });
  broadcast({ type: "unit", action: "updated", id: item.unitId });
}

// ------------------------------------------------------------------
// Hidrantes: registro y situación
// ------------------------------------------------------------------

const HYDRANT_SITUATIONS: HydrantSituation[] = ["operativo", "mantenimiento", "fuera_servicio"];
const HYDRANT_PRESSURES = ["buena", "media", "baja"];

function normalizeCoords(lat: unknown, lng: unknown): { lat: number; lng: number } {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || la < -90 || la > 90 || !Number.isFinite(ln) || ln < -180 || ln > 180) {
    throw new ApiError(400, "Coordenadas inválidas");
  }
  return { lat: la, lng: ln };
}

function normalizeSituation(situation?: string | null): HydrantSituation {
  if (situation === undefined || situation === null || situation === "") return "operativo";
  if (!HYDRANT_SITUATIONS.includes(situation as HydrantSituation)) {
    throw new ApiError(400, "Situación inválida (operativo | mantenimiento | fuera_servicio)");
  }
  return situation as HydrantSituation;
}

function normalizePressure(pressure?: string | null): string {
  const s = String(pressure ?? "media").toLowerCase().trim();
  if (!HYDRANT_PRESSURES.includes(s)) throw new ApiError(400, "Presión inválida (buena | media | baja)");
  return s;
}

function normalizeDiameter(diameter?: number | null): number | null {
  if (diameter === undefined || diameter === null || (diameter as unknown) === "") return null;
  const n = Number(diameter);
  if (!Number.isInteger(n) || n < 25 || n > 300) throw new ApiError(400, "Diámetro inválido (25–300 mm)");
  return n;
}

export async function createHydrant(input: {
  code?: string | null;
  lat: number;
  lng: number;
  pressure?: string | null;
  diameter?: number | null;
  situation?: string | null;
  notes?: string | null;
  photoUrl?: string | null;
}): Promise<HydrantDTO> {
  const { lat, lng } = normalizeCoords(input.lat, input.lng);
  const code = input.code ? String(input.code).trim().toUpperCase() : "";
  if (code.length > 20) throw new ApiError(400, "Código demasiado largo (máx. 20 caracteres)");
  try {
    const row = await prisma.hydrant.create({
      data: {
        code: code || null,
        lat,
        lng,
        pressure: normalizePressure(input.pressure),
        diameter: normalizeDiameter(input.diameter ?? 100),
        situation: normalizeSituation(input.situation),
        notes: normalizeNotes(input.notes),
        photoUrl: input.photoUrl ?? null,
      },
    });
    broadcast({ type: "hydrant", action: "created", id: row.id });
    return toHydrantDTO(row);
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      throw new ApiError(409, "Ya existe un hidrante con ese código");
    }
    throw e;
  }
}

export async function updateHydrant(
  id: number,
  patch: {
    pressure?: string | null;
    diameter?: number | null;
    situation?: string | null;
    notes?: string | null;
    photoUrl?: string | null;
  },
): Promise<HydrantDTO> {
  const hydrant = await prisma.hydrant.findUnique({ where: { id } });
  if (!hydrant) throw new ApiError(404, "Hidrante no encontrado");
  const data: Record<string, unknown> = {};
  if (patch.situation !== undefined) data.situation = normalizeSituation(patch.situation);
  if (patch.pressure !== undefined) data.pressure = normalizePressure(patch.pressure);
  if (patch.diameter !== undefined) data.diameter = normalizeDiameter(patch.diameter);
  if (patch.notes !== undefined) data.notes = normalizeNotes(patch.notes);
  if (patch.photoUrl !== undefined) data.photoUrl = patch.photoUrl;
  if (Object.keys(data).length === 0) return toHydrantDTO(hydrant);
  const row = await prisma.hydrant.update({ where: { id }, data });
  broadcast({ type: "hydrant", action: "updated", id });
  return toHydrantDTO(row);
}

// ------------------------------------------------------------------
// Simulación ciudadana (modo demo) y nueva "lámina" de reporte
// ------------------------------------------------------------------

const DEMO_SCENARIOS: Array<{
  title: string;
  address: string;
  lat: number;
  lng: number;
  severity: Severity;
  notes: string;
}> = [
  {
    title: "Incendio en vivienda",
    address: "Calle Comercio, a 2 cuadras de la Plaza de Armas, Camaná",
    lat: -16.6218,
    lng: -72.7089,
    severity: "alta",
    notes: "Humo visible desde la calle, posible incendio en segundo piso.",
  },
  {
    title: "Incendio en mercado",
    address: "Mercado Central de Camaná, junto a la Plaza de Armas",
    lat: -16.6249,
    lng: -72.7083,
    severity: "critica",
    notes: "Fuego en puesto de abarrotes, se propaga a puestos contiguos.",
  },
  {
    title: "Fuga de gas con humo",
    address: "Grifo de la Panamericana Sur, ingreso norte a Camaná",
    lat: -16.617,
    lng: -72.7133,
    severity: "critica",
    notes: "Fuerte olor a gas, la gente evacúa la zona.",
  },
  {
    title: "Incendio forestal",
    address: "Laderas del valle, margen del río Camaná",
    lat: -16.6002,
    lng: -72.6986,
    severity: "media",
    notes: "Vegetación seca ardiendo en la ladera junto a viviendas.",
  },
  {
    title: "Rescate vehicular",
    address: "Panamericana Sur, frente al puente Camaná",
    lat: -16.6122,
    lng: -72.7146,
    severity: "alta",
    notes: "Colisión de dos vehículos, una persona atrapada.",
  },
  {
    title: "Incendio en edificio multifamiliar",
    address: "Zona este de Camaná, cerca al Estadio Municipal",
    lat: -16.6181,
    lng: -72.7058,
    severity: "alta",
    notes: "Humo negro desde el tercer piso, vecinos evacuados.",
  },
  {
    title: "Fuego en almacén pesquero",
    address: "Zona de almacenes, camino al malecón de Camaná",
    lat: -16.6331,
    lng: -72.7224,
    severity: "critica",
    notes: "Cajas y redes en llamas, riesgo de propagación a galpones vecinos.",
  },
  {
    title: "Emergencia médica",
    address: "Malecón de Camaná, frente a la playa",
    lat: -16.6338,
    lng: -72.7238,
    severity: "media",
    notes: "Persona adulta desmayada, se solicita ambulancia.",
  },
];

const DEMO_NAMES = ["Lucía Paredes", "Marco Aquino", "Rosa Medina", "Jorge Salas", "Ana Quispe", "Diego Herrera"];

/** Foto de referencia que acompaña algunos reportes simulados (evidencia demo) */
const DEMO_EVIDENCE_PHOTO = "/evidencia-incendio.jpg";

/** Crea un reporte ciudadano simulado (como si llegara por WhatsApp) */
export async function simulateCitizenReport(): Promise<IncidentDTO> {
  const s = DEMO_SCENARIOS[Math.floor(Math.random() * DEMO_SCENARIOS.length)];
  const jitter = () => (Math.random() - 0.5) * 0.003;
  const phone = `+519${String(Math.floor(10_000_000 + Math.random() * 89_999_999))}`;
  const name = DEMO_NAMES[Math.floor(Math.random() * DEMO_NAMES.length)];
  return createIncident({
    title: s.title,
    address: s.address,
    lat: s.lat + jitter(),
    lng: s.lng + jitter(),
    severity: s.severity,
    source: "whatsapp",
    reporterName: name,
    reporterPhone: phone,
    photoUrl: Math.random() < 0.6 ? DEMO_EVIDENCE_PHOTO : null,
    notes: s.notes,
    createdBy: "ciudadano",
  });
}

// ------------------------------------------------------------------
// Ingesta de mensajes de WhatsApp (webhook oficial o demo)
// ------------------------------------------------------------------

export interface IngestedMessage {
  phone: string;
  name: string | null;
  text: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  photoUrl: string | null;
  /** Llegó una foto pero no se pudo descargar (falta token de Meta) */
  photoPending: boolean;
  source: IncidentSource;
}

function inferTitle(text: string | null): { title: string; severity: Severity } {
  const t = (text ?? "").toLowerCase();
  if (/atrapad|explosi|colapso|derrumbe/.test(t)) return { title: "Emergencia crítica reportada", severity: "critica" };
  if (/incendio|fuego|humo|quema/.test(t)) return { title: "Incendio reportado", severity: "alta" };
  if (/gas/.test(t)) return { title: "Fuga de gas", severity: "alta" };
  if (/rescate|choque|colisi|accidente|vehícul|vehicul/.test(t)) return { title: "Rescate vehicular", severity: "alta" };
  if (/inunda|aniego|agua/.test(t)) return { title: "Inundación", severity: "media" };
  if (/herid|ambulanc|salud|desmay/.test(t)) return { title: "Emergencia médica", severity: "media" };
  return { title: "Emergencia reportada", severity: "media" };
}

const PHOTO_PENDING_NOTE =
  "Llegó una foto por WhatsApp (sin descargar: configure el token de Meta en Configuración)";

/**
 * Une un mensaje nuevo (ubicación en tiempo real, foto o descripción) al
 * reporte abierto reciente del mismo teléfono, en lugar de crear otro incidente.
 */
async function attachMessageToIncident(incident: Incident, msg: IngestedMessage): Promise<IncidentDTO> {
  const data: Record<string, unknown> = {};
  const events: Array<{ type: string; message: string; actor: string }> = [];

  if (msg.lat != null && msg.lng != null) {
    data.lat = msg.lat;
    data.lng = msg.lng;
    if (msg.address) data.address = msg.address;
    events.push({ type: "mensaje", message: "Ubicación en tiempo real recibida por WhatsApp", actor: "ciudadano" });
  }
  if (msg.photoUrl) {
    data.photoUrl = msg.photoUrl;
    events.push({ type: "mensaje", message: "Foto de evidencia recibida por WhatsApp", actor: "ciudadano" });
  } else if (msg.photoPending) {
    events.push({ type: "nota", message: PHOTO_PENDING_NOTE, actor: "sistema" });
  }
  if (msg.text && !incident.notes) {
    const { title, severity } = inferTitle(msg.text);
    data.title = title;
    data.severity = severity;
    data.notes = msg.text;
    events.push({ type: "mensaje", message: "Descripción recibida por WhatsApp", actor: "ciudadano" });
  }

  if (Object.keys(data).length === 0 && events.length === 0) return toIncidentDTO(incident);

  const row = await prisma.incident.update({
    where: { id: incident.id },
    data: { ...data, ...(events.length ? { events: { create: events } } : {}) },
    include: { unit: true },
  });
  broadcast({ type: "incident", action: "updated", id: row.id });
  broadcast({ type: "activity" });
  return toIncidentDTO(row);
}

export async function ingestWhatsApp(msg: IngestedMessage): Promise<IncidentDTO> {
  // ¿Es el mismo ciudadano que reportó hace minutos? -> completar ese reporte
  const recent = msg.phone
    ? await prisma.incident.findFirst({
        where: {
          reporterPhone: msg.phone,
          status: { in: ACTIVE_STATUSES },
          createdAt: { gte: new Date(Date.now() - 15 * 60_000) },
        },
        orderBy: { createdAt: "desc" },
      })
    : null;
  if (recent) return attachMessageToIncident(recent, msg);

  const { title, severity } = inferTitle(msg.text);
  const hasCoords = msg.lat != null && msg.lng != null;
  const lat = msg.lat ?? CITY_CENTER.lat + (Math.random() - 0.5) * 0.01;
  const lng = msg.lng ?? CITY_CENTER.lng + (Math.random() - 0.5) * 0.01;
  const finalTitle = msg.text
    ? title
    : hasCoords
      ? "Ubicación compartida por WhatsApp"
      : msg.photoUrl || msg.photoPending
        ? "Reporte con foto por WhatsApp"
        : title;

  const incident = await createIncident({
    title: finalTitle,
    address:
      msg.address ||
      (hasCoords
        ? `Ubicación compartida por WhatsApp (${lat.toFixed(4)}, ${lng.toFixed(4)})`
        : "Dirección por confirmar (reporte por WhatsApp)"),
    lat,
    lng,
    severity,
    source: msg.source,
    reporterName: msg.name ?? "Ciudadano",
    reporterPhone: msg.phone,
    photoUrl: msg.photoUrl,
    notes: msg.text,
    createdBy: "ciudadano",
  });

  if (msg.photoPending) {
    const row = await prisma.incident.update({
      where: { id: incident.id },
      data: { events: { create: { type: "nota", message: PHOTO_PENDING_NOTE, actor: "sistema" } } },
      include: { unit: true },
    });
    broadcast({ type: "incident", action: "updated", id: row.id });
    return toIncidentDTO(row);
  }

  return incident;
}

/** Útil para marcar hidrantes usados en un radio (reporte táctico) */
export function hydrantsWithin(lat: number, lng: number, hydrants: HydrantDTO[], meters: number): HydrantDTO[] {
  return hydrants.filter((h) => haversineM(lat, lng, h.lat, h.lng) <= meters);
}
