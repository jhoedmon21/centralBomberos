// Metadatos de dominio: etiquetas y estilos por estado/severidad/tipo

import type {
  HydrantSituation,
  IncidentStatus,
  IncidentSource,
  Severity,
  UnitItemCategory,
  UnitItemCondition,
  UnitStatus,
  UnitType,
} from "./types";

export const INCIDENT_STATUS: IncidentStatus[] = [
  "reportado",
  "despachado",
  "en_escena",
  "controlado",
  "cerrado",
];

export const STATUS_META: Record<
  IncidentStatus,
  { label: string; short: string; varName: string }
> = {
  reportado: { label: "Reportado", short: "RPT", varName: "--st-reportado" },
  despachado: { label: "Despachado", short: "DSP", varName: "--st-despachado" },
  en_escena: { label: "En escena", short: "ESC", varName: "--st-escena" },
  controlado: { label: "Controlado", short: "CTL", varName: "--st-controlado" },
  cerrado: { label: "Cerrado", short: "CER", varName: "--st-cerrado" },
};

export const SEVERITY_META: Record<Severity, { label: string; varName: string }> = {
  critica: { label: "Crítica", varName: "--sev-critica" },
  alta: { label: "Alta", varName: "--sev-alta" },
  media: { label: "Media", varName: "--sev-media" },
  baja: { label: "Baja", varName: "--sev-baja" },
};

export const SOURCE_META: Record<IncidentSource, { label: string }> = {
  whatsapp: { label: "WhatsApp" },
  telefono116: { label: "Central 116" },
  manual: { label: "Manual" },
  webhook: { label: "WhatsApp API" },
  simulacion: { label: "Simulación" },
};

export const UNIT_STATUS_META: Record<UnitStatus, { label: string }> = {
  disponible: { label: "Disponible" },
  en_ruta: { label: "En ruta" },
  en_escena: { label: "En escena" },
  regresando: { label: "Regresando" },
  fuera_servicio: { label: "Fuera de servicio" },
};

export const UNIT_TYPE_META: Record<UnitType, { label: string }> = {
  bomba: { label: "Bomba" },
  cisterna: { label: "Cisterna" },
  rescate: { label: "Rescate" },
  ambulancia: { label: "Ambulancia" },
  mando: { label: "Mando" },
};

// ---------- Inventario de unidades ----------

export const UNIT_ITEM_CATEGORY_META: Record<UnitItemCategory, { label: string }> = {
  extintor: { label: "Extintores" },
  manguera: { label: "Mangueras y pitones" },
  herramienta: { label: "Herramientas" },
  rescate: { label: "Equipo de rescate" },
  medico: { label: "Equipo médico" },
  comunicacion: { label: "Comunicaciones" },
  epp: { label: "EPP / seguridad" },
  equipo: { label: "Equipo general" },
};

export const UNIT_ITEM_CONDITION_META: Record<UnitItemCondition, { label: string; varName: string }> = {
  bueno: { label: "Bueno", varName: "--green" },
  regular: { label: "Regular", varName: "--amber" },
  malo: { label: "Malo", varName: "--red" },
};

// ---------- Hidrantes ----------

export const HYDRANT_SITUATION_META: Record<HydrantSituation, { label: string; varName: string }> = {
  operativo: { label: "Operativo", varName: "--green" },
  mantenimiento: { label: "En mantenimiento", varName: "--amber" },
  fuera_servicio: { label: "Fuera de servicio", varName: "--red" },
};

export const HYDRANT_PRESSURES = ["buena", "media", "baja"] as const;
export const HYDRANT_DIAMETERS = [75, 100, 150] as const;

/** Estados que cuentan como "en curso" para la central */
export const ACTIVE_STATUSES: IncidentStatus[] = ["reportado", "despachado", "en_escena"];
