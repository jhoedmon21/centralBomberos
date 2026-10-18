// Tipos compartidos entre servidor y cliente (FuegoMap)

export type IncidentStatus =
  | "reportado"
  | "despachado"
  | "en_escena"
  | "controlado"
  | "cerrado";

export type Severity = "critica" | "alta" | "media" | "baja";

export type IncidentSource = "whatsapp" | "telefono116" | "manual" | "webhook" | "simulacion";

export type UnitStatus =
  | "disponible"
  | "en_ruta"
  | "en_escena"
  | "regresando"
  | "fuera_servicio";

export type UnitType = "bomba" | "cisterna" | "rescate" | "ambulancia" | "mando";

export type UnitItemCategory =
  | "extintor"
  | "manguera"
  | "herramienta"
  | "rescate"
  | "medico"
  | "comunicacion"
  | "epp"
  | "equipo";

export type UnitItemCondition = "bueno" | "regular" | "malo";

export type HydrantSituation = "operativo" | "mantenimiento" | "fuera_servicio";

export interface EventDTO {
  id: number;
  type: string;
  message: string;
  actor: string;
  createdAt: string;
}

export interface UnitDTO {
  id: number;
  code: string;
  name: string;
  type: UnitType;
  status: UnitStatus;
  station: string | null;
  crew: number | null;
  lat: number | null;
  lng: number | null;
  incidentId: number | null;
  itemCount: number;
  /** Marca del último cambio de estado (resuelve conflictos app ↔ central) */
  statusAt: string;
  statusSource: "unidad" | "operador" | "sistema";
}

export interface UnitItemDTO {
  id: number;
  unitId: number;
  name: string;
  category: UnitItemCategory;
  quantity: number;
  condition: UnitItemCondition;
  notes: string | null;
  /** Compartimento 3D del vehículo (c1..c6); null = sin ubicación */
  compartment: string | null;
}

export interface IncidentDTO {
  id: number;
  title: string;
  address: string;
  lat: number;
  lng: number;
  severity: Severity;
  status: IncidentStatus;
  source: IncidentSource;
  reporterName: string | null;
  reporterPhone: string | null;
  photoUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  dispatchAt: string | null;
  arrivalAt: string | null;
  closedAt: string | null;
  /** Momento en que la unidad aceptó el despacho desde la app (null = sin aceptar) */
  acceptedAt: string | null;
  /** Punto de salida de la unidad (cuartel) al despacharla */
  departLat: number | null;
  departLng: number | null;
  unitId: number | null;
  unit?: UnitDTO | null;
  events?: EventDTO[];
  /** Unidades asignadas (despacho multi-unidad; presente si el include lo pide) */
  units?: Array<{
    unitId: number;
    code: string;
    name: string;
    status: UnitStatus;
    acceptedAt: string | null;
    dispatchedAt: string;
  }>;
}

export interface HydrantDTO {
  id: number;
  code: string | null;
  lat: number;
  lng: number;
  pressure: string | null;
  diameter: number | null;
  situation: HydrantSituation;
  notes: string | null;
  photoUrl: string | null;
}

export interface RiskDTO {
  id: number;
  name: string;
  type: string;
  level: string;
  lat: number;
  lng: number;
}

/** Ruta vial (OSRM, sin key) entre dos puntos, para dibujarla en el mapa */
export interface RouteDTO {
  /** Geometría de la ruta: [lng, lat] */
  points: [number, number][];
  meters: number;
  seconds: number;
  /** true = OSRM no respondió y la «ruta» es la línea recta estimada */
  estimated: boolean;
}

export interface ActivityDTO extends EventDTO {
  incidentId: number;
  incidentTitle: string;
  incidentStatus: IncidentStatus;
}

export interface StatsDTO {
  activos: number;
  reportados: number;
  despachados: number;
  enEscena: number;
  hoy: number;
  cerradosHoy: number;
  unidadesDisponibles: number;
  unidadesTotal: number;
  respuestaPromedioMin: number | null;
}

export interface SettingsDTO {
  wa_unit: string;
  wa_central: string;
  alert_sound: string;
  webhook_token: string;
  wa_token: string;
  /** URL pública de la central para los enlaces compartidos (foto, mapa); vacío = usar el origen actual */
  public_base: string;
}

/** Instantánea mínima que viaja en algunos eventos SSE (p. ej. posición
 * GPS): permite aplicar el cambio en la central SIN refetch completo. */
export interface UnitSnapshotDTO {
  id: number;
  code: string;
  lat: number | null;
  lng: number | null;
  status: UnitStatus;
}

/** Recorrido histórico de una unidad (GeoJSON [lng,lat] + distancia total) */
export interface TrackDTO {
  points: [number, number][];
  meters: number;
  count: number;
}

/** Mensaje del chat corto entre central y unidad */
export interface ChatDTO {
  id: number;
  from: "central" | "unidad";
  body: string;
  at: string;
}

/** Rol de un operador de la central CAD */
export type OperatorRole = "jefe" | "operador" | "lectura";

export interface OperatorDTO {
  id: number;
  name: string;
  email: string;
  role: OperatorRole;
}

/** Entrada de la bitácora del sistema (auditoría) */
export interface AuditDTO {
  id: number;
  actor: string;
  action: string;
  detail: string | null;
  at: string;
}

/** Ficha operativa de un edificio de riesgo (preplan) */
export interface PreplanDTO {
  id: number;
  title: string;
  address: string;
  lat: number;
  lng: number;
  layout: string | null;
  hazards: string | null;
  keysInfo: string | null;
  waterSources: string | null;
  contactName: string | null;
  contactPhone: string | null;
  notes: string | null;
  photos: string[];
  status: "activo" | "inactivo";
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Evento emitido por SSE */
export interface LiveEvent {
  type:
    | "incident"
    | "unit"
    | "activity"
    | "settings"
    | "hydrant"
    | "chat"
    | "preplan"
    | "hello"
    // Eventos de la app de unidades (FuegoMap Unidades)
    | "unit_mission" // despacho asignado a una unidad
    | "mission_unaccepted" // la unidad no aceptó en 60 s
    | "unit_logout"; // cierre de sesión remoto desde la central
  action?: "created" | "updated" | "deleted" | "declared" | "dispatched";
  id?: number;
  title?: string;
  /** Id de la unidad destinataria (eventos de la app) */
  unitId?: number;
  /** Instantánea de la unidad (posición/estado) para parche incremental */
  unit?: UnitSnapshotDTO;
  /** Mensaje de chat difundido en vivo */
  chat?: { id: number; unitId: number; from: "central" | "unidad"; body: string; at: string };
  at: number;
}
