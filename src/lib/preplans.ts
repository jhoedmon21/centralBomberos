// ============================================================
//  Preplans: fichas operativas de edificios de riesgo.
//  CRUD + difusión por el bus SSE; la consulta a PostgreSQL la
//  hace el cliente (haversine) para la ficha automática en escena
//  (el volumen es pequeño: cientos de fichas como mucho).
// ============================================================

import { broadcast } from "./bus";
import { prisma } from "./db";
import { ApiError } from "./errors";
import type { PreplanDTO } from "./types";

type PreplanRow = Awaited<ReturnType<typeof prisma.preplan.findFirst>>;

export function toPreplanDTO(p: NonNullable<PreplanRow>): PreplanDTO {
  let photos: string[] = [];
  if (p.photos) {
    try {
      const parsed = JSON.parse(p.photos) as unknown;
      if (Array.isArray(parsed)) photos = parsed.filter((x): x is string => typeof x === "string");
    } catch {
      photos = [];
    }
  }
  return {
    id: p.id,
    title: p.title,
    address: p.address,
    lat: p.lat,
    lng: p.lng,
    layout: p.layout,
    hazards: p.hazards,
    keysInfo: p.keysInfo,
    waterSources: p.waterSources,
    contactName: p.contactName,
    contactPhone: p.contactPhone,
    notes: p.notes,
    photos,
    status: (p.status === "inactivo" ? "inactivo" : "activo") as PreplanDTO["status"],
    createdBy: p.createdBy,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function listPreplans(): Promise<PreplanDTO[]> {
  const rows = await prisma.preplan.findMany({ orderBy: { updatedAt: "desc" } });
  return rows.map(toPreplanDTO);
}

export interface PreplanInput {
  title: string;
  address: string;
  lat: number;
  lng: number;
  layout?: string | null;
  hazards?: string | null;
  keysInfo?: string | null;
  waterSources?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
  photos?: string[];
  status?: "activo" | "inactivo";
}

export async function createPreplan(input: PreplanInput, createdBy: string): Promise<PreplanDTO> {
  const p = await prisma.preplan.create({
    data: {
      title: input.title,
      address: input.address,
      lat: input.lat,
      lng: input.lng,
      layout: input.layout ?? null,
      hazards: input.hazards ?? null,
      keysInfo: input.keysInfo ?? null,
      waterSources: input.waterSources ?? null,
      contactName: input.contactName ?? null,
      contactPhone: input.contactPhone ?? null,
      notes: input.notes ?? null,
      photos: input.photos?.length ? JSON.stringify(input.photos) : null,
      status: input.status ?? "activo",
      createdBy,
    },
  });
  broadcast({ type: "preplan", action: "created", id: p.id, title: p.title, at: Date.now() });
  return toPreplanDTO(p);
}

export async function updatePreplan(id: number, input: Partial<PreplanInput>): Promise<PreplanDTO> {
  const existing = await prisma.preplan.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Preplan no encontrado");
  const p = await prisma.preplan.update({
    where: { id },
    data: {
      title: input.title ?? existing.title,
      address: input.address ?? existing.address,
      lat: input.lat ?? existing.lat,
      lng: input.lng ?? existing.lng,
      layout: input.layout !== undefined ? input.layout : existing.layout,
      hazards: input.hazards !== undefined ? input.hazards : existing.hazards,
      keysInfo: input.keysInfo !== undefined ? input.keysInfo : existing.keysInfo,
      waterSources: input.waterSources !== undefined ? input.waterSources : existing.waterSources,
      contactName: input.contactName !== undefined ? input.contactName : existing.contactName,
      contactPhone: input.contactPhone !== undefined ? input.contactPhone : existing.contactPhone,
      notes: input.notes !== undefined ? input.notes : existing.notes,
      photos: input.photos !== undefined ? (input.photos.length ? JSON.stringify(input.photos) : null) : existing.photos,
      status: input.status ?? existing.status,
    },
  });
  broadcast({ type: "preplan", action: "updated", id: p.id, title: p.title, at: Date.now() });
  return toPreplanDTO(p);
}

export async function deletePreplan(id: number): Promise<void> {
  const p = await prisma.preplan.findUnique({ where: { id }, select: { id: true, title: true } });
  if (!p) throw new ApiError(404, "Preplan no encontrado");
  await prisma.preplan.delete({ where: { id } });
  broadcast({ type: "preplan", action: "deleted", id: p.id, title: p.title, at: Date.now() });
}
