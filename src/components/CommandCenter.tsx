"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Fire, ListBullets, MapTrifold } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useLiveFeed } from "@/hooks/useLiveFeed";
import { playAlarm, primeAudio } from "@/lib/alarm";
import { FIREHOUSE, haversineM, nearestHydrants, nearestPreplan } from "@/lib/geo";
import { ACTIVE_STATUSES, HYDRANT_SITUATION_META } from "@/lib/meta";
import type {
  ActivityDTO,
  ChatDTO,
  HydrantDTO,
  HydrantSituation,
  IncidentDTO,
  IncidentStatus,
  LiveEvent,
  OperatorDTO,
  PreplanDTO,
  RiskDTO,
  RouteDTO,
  SettingsDTO,
  StatsDTO,
  TrackDTO,
  UnitDTO,
  UnitStatus,
} from "@/lib/types";
import { applyTheme, getServerTheme, getTheme, subscribeTheme } from "@/lib/theme";
import { cx, displayCode, fmtDistance, hydrantLabel } from "@/lib/utils";
import { dispatchMessage, incomingMessage, replyMessage, setPublicBase, waLink } from "@/lib/wa";
import DetailPanel, { type DetailTab } from "./DetailPanel";
import DispatchDialog from "./DispatchDialog";
import ChatPanel from "./ChatPanel";
import HydrantDialog, { EMPTY_HYDRANT_DRAFT, type HydrantDraft } from "./HydrantDialog";
import HydrantsDialog from "./HydrantsDialog";
import IncidentQueue from "./IncidentQueue";
import NewIncidentDialog, { EMPTY_DRAFT, type IncidentDraft } from "./NewIncidentDialog";
import NewUnitDialog, { EMPTY_UNIT_DRAFT, type UnitDraft } from "./NewUnitDialog";
import SettingsDialog from "./SettingsDialog";
import AuditDialog from "./AuditDialog";
import MiClaveDialog from "./MiClaveDialog";
import PreplanViewDialog from "./PreplanViewDialog";
import UsersDialog from "./UsersDialog";
import { ViperCards, ViperClock, ViperDrawer, ViperRail, ViperStrip } from "./ViperChrome";
import type { LayersState } from "./MapView";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="tac-grid grid h-full w-full place-items-center bg-bg">
      <div className="text-center">
        <MapTrifold size={30} className="mx-auto text-mu2" />
        <p className="mt-2 text-[11px] tracking-[0.2em] text-mu2 uppercase">Cargando mapa táctico…</p>
      </div>
    </div>
  ),
});

export interface InitialData {
  incidents: IncidentDTO[];
  units: UnitDTO[];
  hydrants: HydrantDTO[];
  risks: RiskDTO[];
  activity: ActivityDTO[];
  stats: StatsDTO;
  settings: SettingsDTO;
  preplans: PreplanDTO[];
}

async function jfetch<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const data = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(data.error ?? `Error ${r.status}`);
  return data;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export default function CommandCenter({ initial, op }: { initial: InitialData; op: OperatorDTO }) {
  // ----- Datos -----
  const [incidents, setIncidents] = useState<IncidentDTO[]>(initial.incidents);
  const [units, setUnits] = useState<UnitDTO[]>(initial.units);
  const [hydrants, setHydrants] = useState<HydrantDTO[]>(initial.hydrants);
  const [activity, setActivity] = useState<ActivityDTO[]>(initial.activity);
  const [stats, setStats] = useState<StatsDTO>(initial.stats);
  const [settings, setSettings] = useState<SettingsDTO>(initial.settings);
  const [preplans, setPreplans] = useState<PreplanDTO[]>(initial.preplans);

  // Los enlaces compartidos por WhatsApp (foto, mapa) usan la URL pública configurada.
  useEffect(() => {
    setPublicBase(settings.public_base);
  }, [settings.public_base]);

  // ----- Selección / vista -----
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const active = initial.incidents.find((i) => ACTIVE_STATUSES.includes(i.status));
    return active?.id ?? initial.incidents[0]?.id ?? null;
  });
  const [detail, setDetail] = useState<IncidentDTO | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [tab, setTab] = useState<DetailTab>("detalle");
  // Paneles flotantes sobre el mapa (mismo diseño de cabina que la tablet):
  // el mapa SIEMPRE queda a fondo; Reportes y Detalle son tarjetas flotantes.
  // CAJÓN B-35: menú de módulos sobre el mapa (abierto por defecto en
  // escritorio, como el diseño de referencia).
  const [queueOpen, setQueueOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastNewId, setLastNewId] = useState<number | null>(null);
  // Unidad seguida por la cámara del mapa (null = cámara libre). La tablet ya
  // hacía esto en modo navegación; aquí la central puede seguir el desplazamiento.
  const [followUnitId, setFollowUnitId] = useState<number | null>(null);
  // Recorrido GPS grabado dibujado en el mapa (toggle desde el popup de unidad)
  const [track, setTrack] = useState<{ unitId: number; data: TrackDTO } | null>(null);
  // Chat abierto con una unidad (panel sobre el mapa) + último evento vivo
  const [chatUnitId, setChatUnitId] = useState<number | null>(null);
  const [lastChat, setLastChat] = useState<{ unitId: number; msg: ChatDTO } | null>(null);

  // ----- Tiempo real / tema / capas -----
  const [live, setLive] = useState(false);
  const [soundOn, setSoundOn] = useState(initial.settings.alert_sound === "1");
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);
  const [layers, setLayers] = useState<LayersState>({
    incidents: true,
    addresses: true,
    units: true,
    hydrants: true,
    risks: true,
    preplans: true,
    traffic: true,
    quakes: true,
    radius: true,
  });

  // En escritorio la cabina abre con el CAJÓN B-35 visible (estado de la
  // imagen de referencia); los paneles Reportes/Detalle quedan a un clic.
  useEffect(() => {
    const wide = window.innerWidth >= 1024;
    setDrawerOpen(wide);
    setQueueOpen(false);
    setDetailOpen(false);
  }, []);

  // El cajón y la lista de reportes comparten la esquinal izquierda:
  // abrir uno esconde el otro para que el mapa nunca quede tapado dos veces.
  function toggleDrawer() {
    const opening = !drawerOpen;
    setDrawerOpen(opening);
    if (opening) setQueueOpen(false);
  }
  function openQueue() {
    setQueueOpen(true);
    setDrawerOpen(false);
  }
  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    if (next) primeAudio();
    void saveSettings({ alert_sound: next ? "1" : "0" });
  }

  // ----- Diálogos -----
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hydrantsOpen, setHydrantsOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [draft, setDraft] = useState<IncidentDraft>(EMPTY_DRAFT);
  const [editFor, setEditFor] = useState<IncidentDTO | null>(null);
  const [editDraft, setEditDraft] = useState<IncidentDraft>(EMPTY_DRAFT);
  const [saveBusy, setSaveBusy] = useState(false);
  const [dispatchFor, setDispatchFor] = useState<IncidentDTO | null>(null);
  const [dispatchBusy, setDispatchBusy] = useState(false);
  const [simBusy, setSimBusy] = useState(false);
  const [pickFor, setPickFor] = useState<null | "incident" | "incident-edit" | "hydrant" | "unit">(null);
  const [hydrantOpen, setHydrantOpen] = useState(false);
  // Preplans: ficha abierta desde el mapa o el detalle (solo VISTA, sin editor)
  const [preplanView, setPreplanView] = useState<PreplanDTO | null>(null);
  const [usersOpen, setUsersOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [miClaveOpen, setMiClaveOpen] = useState(false);
  // Ruta vial trazada en el mapa (botón «Ruta» del detalle)
  const [route, setRoute] = useState<{ incidentId: number; data: RouteDTO } | null>(null);
  const [hydrantDraft, setHydrantDraft] = useState<HydrantDraft>(EMPTY_HYDRANT_DRAFT);
  const [hydrantBusy, setHydrantBusy] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const [unitDraft, setUnitDraft] = useState<UnitDraft>(EMPTY_UNIT_DRAFT);
  const [unitBusy, setUnitBusy] = useState(false);

  // ----- Tema -----
  const toggleTheme = useCallback(() => {
    applyTheme(getTheme() === "dark" ? "light" : "dark");
  }, []);

  // Desbloquea el audio con el primer gesto
  useEffect(() => {
    const h = () => primeAudio();
    window.addEventListener("pointerdown", h, { once: true });
    return () => window.removeEventListener("pointerdown", h);
  }, []);

  // ----- Carga de datos -----
  const refresh = useCallback(async () => {
    try {
      const [inc, un, hy, st, act, pp] = await Promise.all([
        jfetch<{ incidents: IncidentDTO[] }>("/api/incidents"),
        jfetch<{ units: UnitDTO[] }>("/api/units"),
        jfetch<{ hydrants: HydrantDTO[] }>("/api/hydrants"),
        jfetch<{ stats: StatsDTO }>("/api/stats"),
        jfetch<{ activity: ActivityDTO[] }>("/api/activity?limit=40"),
        jfetch<{ preplans: PreplanDTO[] }>("/api/preplans"),
      ]);
      setIncidents(inc.incidents);
      setUnits(un.units);
      setHydrants(hy.hydrants);
      setStats(st.stats);
      setActivity(act.activity);
      setPreplans(pp.preplans);
    } catch {
      /* SSE reintentará */
    }
  }, []);

  // Refetch completo coalescido: en picos de SSE (varias unidades moviéndose,
  // despachos en cadena) NO se apilan refetchs paralelos — si ya hay un
  // refetch en marcha se marca «pendiente» y se ejecuta UNO al terminar.
  const refreshBusyRef = useRef(false);
  const refreshQueuedRef = useRef(false);
  const scheduleRefresh = useCallback(async () => {
    if (refreshBusyRef.current) {
      refreshQueuedRef.current = true;
      return;
    }
    refreshBusyRef.current = true;
    try {
      await refresh();
    } finally {
      refreshBusyRef.current = false;
      if (refreshQueuedRef.current) {
        refreshQueuedRef.current = false;
        void scheduleRefresh();
      }
    }
  }, [refresh]);

  // Ids de unidades conocidas: decide si un evento «unit» se puede aplicar
  // como parche o necesita un refetch (unidad creada hace poco).
  const unitsIdsRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    unitsIdsRef.current = new Set(units.map((u) => u.id));
  }, [units]);

  const loadDetail = useCallback(async (id: number) => {
    setDetailBusy(true);
    try {
      const d = await jfetch<{ incident: IncidentDTO }>(`/api/incidents/${id}`);
      setDetail(d.incident);
    } catch {
      /* mantener detalle previo */
    } finally {
      setDetailBusy(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId == null) return;
    // Diferido un tick: el efecto no debe disparar setState de forma síncrona
    // (regla react-hooks/set-state-in-effect).
    const t = setTimeout(() => void loadDetail(selectedId), 0);
    return () => clearTimeout(t);
  }, [selectedId, loadDetail]);

  // ----- Tiempo real -----
  useLiveFeed({
    onOpen: () => setLive(true),
    onClose: () => setLive(false),
    onEvent: (ev: LiveEvent) => {
      if (ev.type === "hello") return;
      if (ev.type === "settings") {
        void jfetch<{ settings: SettingsDTO }>("/api/settings")
          .then((d) => {
            setSettings(d.settings);
            setSoundOn(d.settings.alert_sound === "1");
          })
          .catch(() => {});
        return;
      }
      if (ev.type === "incident" && ev.action === "created") {
        setLastNewId(ev.id ?? null);
        toast.warning(`Nuevo reporte: ${ev.title ?? "Emergencia"}`, {
          description: "Ingresó por el canal ciudadano — revisa la cola de incidentes.",
          duration: 6500,
        });
        if (soundOn) playAlarm();
      }
      if (ev.type === "mission_unaccepted") {
        toast.error("Despacho sin confirmar", {
          description: "La unidad no aceptó la misión en 60 segundos — considera reasignar.",
          duration: 8000,
        });
      }
      // El ping de GPS viaja con la instantánea: parche local en el estado,
      // sin tocar la BD. Movimientos de una unidad no cambian incidentes,
      // stats ni actividad — no hay que refrescar nada más.
      if (ev.type === "unit" && ev.unit) {
        const s = ev.unit;
        if (!unitsIdsRef.current.has(s.id)) void scheduleRefresh();
        setUnits((prev) => {
          const i = prev.findIndex((u) => u.id === s.id);
          if (i === -1) return prev;
          const cur = prev[i];
          if (cur.lat === s.lat && cur.lng === s.lng && cur.status === s.status) return prev;
          const next = prev.slice();
          next[i] = { ...cur, lat: s.lat, lng: s.lng, status: s.status };
          return next;
        });
        return;
      }
      // Mensaje de chat: llega completo en el evento — el panel abierto lo
      // pinta; los mensajes de la unidad avisan con toast aunque no esté abierto.
      if (ev.type === "chat" && ev.chat) {
        setLastChat({ unitId: ev.chat.unitId, msg: { id: ev.chat.id, from: ev.chat.from, body: ev.chat.body, at: ev.chat.at } });
        if (ev.chat.from === "unidad") {
          const u = units.find((x) => x.id === ev.chat!.unitId);
          const clip = ev.chat.body.length > 80 ? `${ev.chat.body.slice(0, 80)}…` : ev.chat.body;
          toast.info(`💬 ${u?.code ?? "Unidad"}: ${clip}`);
        }
        return;
      }
      void scheduleRefresh();
      if (ev.type === "incident" && ev.id != null && ev.id === selectedId) {
        void loadDetail(ev.id);
      }
    },
  });

  // ----- Derivados -----
  const selectedIncident = useMemo(
    () => incidents.find((i) => i.id === selectedId) ?? null,
    [incidents, selectedId],
  );
  const detailForSelected = detail && detail.id === selectedId ? detail : null;
  const nearHydrants = useMemo(
    () =>
      selectedIncident ? nearestHydrants(selectedIncident.lat, selectedIncident.lng, hydrants, 3) : [],
    [selectedIncident, hydrants],
  );
  const dispatchNearHydrants = useMemo(
    () => (dispatchFor ? nearestHydrants(dispatchFor.lat, dispatchFor.lng, hydrants, 3) : []),
    [dispatchFor, hydrants],
  );
  const activeCount = useMemo(
    () => incidents.filter((i) => ACTIVE_STATUSES.includes(i.status)).length,
    [incidents],
  );

  // El mapa solo carga los incidentes en curso; si seleccionas uno de la cola
  // «Historial» o «Todos», ese también aparece en el mapa para ubicarlo.
  const mapIncidents = useMemo(() => {
    const active = incidents.filter((i) => ACTIVE_STATUSES.includes(i.status));
    const sel = selectedId != null ? incidents.find((i) => i.id === selectedId) : null;
    if (sel && !ACTIVE_STATUSES.includes(sel.status)) return [...active, sel];
    return active;
  }, [incidents, selectedId]);

  // ----- Acciones -----
  function select(id: number, goDetail = false) {
    setSelectedId(id);
    setTab("detalle");
    if (goDetail) setDetailOpen(true);
  }

  async function simulate() {
    setSimBusy(true);
    try {
      const d = await jfetch<{ incident: IncidentDTO }>("/api/simulate", { method: "POST" });
      setSelectedId(d.incident.id);
      setTab("detalle");
      setDetailOpen(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSimBusy(false);
    }
  }

  async function changeStatus(incident: IncidentDTO, status: IncidentStatus) {
    try {
      const d = await jfetch<{ incident: IncidentDTO }>(`/api/incidents/${incident.id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ status }),
      });
      setDetail(d.incident);
      const msg: Partial<Record<IncidentStatus, string>> = {
        en_escena: "Unidad en la escena",
        controlado: "Incendio controlado",
        cerrado: "Incidente cerrado",
      };
      toast.success(msg[status] ?? "Estado actualizado");
      void refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function confirmDispatch(unitIds: number[]) {
    if (!dispatchFor) return;
    setDispatchBusy(true);
    const code = displayCode(dispatchFor.id, dispatchFor.createdAt);
    const waUnit = settings.wa_unit;
    const link = waUnit ? waLink(waUnit, dispatchMessage(dispatchFor, code, dispatchNearHydrants)) : null;
    // Pre-abre la pestaña para sobrevivir al await (bloqueo de popups)
    const win = link ? window.open("", "_blank") : null;
    try {
      const d = await jfetch<{ incident: IncidentDTO }>(`/api/incidents/${dispatchFor.id}/dispatch`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ unitIds }),
      });
      setDetail(d.incident);
      setDispatchFor(null);
      const plural = unitIds.length > 1 ? `${unitIds.length} unidades` : "la unidad";
      if (link && win) {
        win.location.href = link;
        toast.success(`Despacho enviado por WhatsApp a ${plural}`);
      } else if (link) {
        toast.success(`Despacho registrado (${plural})`, {
          action: { label: "Abrir WhatsApp", onClick: () => window.open(link, "_blank") },
        });
      } else {
        toast.success(`Despacho registrado en el sistema (${plural})`, {
          description: "Configura el número de WhatsApp de la unidad para avisarle automáticamente.",
        });
      }
      void refresh();
    } catch (e) {
      win?.close();
      toast.error((e as Error).message);
    } finally {
      setDispatchBusy(false);
    }
  }

  function reply(incident: IncidentDTO) {
    if (!incident.reporterPhone) {
      toast.info("El reporte no tiene teléfono de contacto");
      return;
    }
    const code = displayCode(incident.id, incident.createdAt);
    window.open(waLink(incident.reporterPhone, replyMessage(incident, code)), "_blank", "noopener");
  }

  function notifyCentral(incident: IncidentDTO) {
    if (!settings.wa_central) {
      toast.info("Configura el número de la central");
      return;
    }
    const code = displayCode(incident.id, incident.createdAt);
    window.open(waLink(settings.wa_central, incomingMessage(incident, code)), "_blank", "noopener");
  }

  async function saveNewIncident(picks: number[] = []) {
    setSaveBusy(true);
    try {
      const d = await jfetch<{ incident: IncidentDTO }>("/api/incidents", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          ...draft,
          photo: undefined, // el data URL viaja como photoBase64
          photoBase64: draft.photo || null,
          lat: Number(draft.lat),
          lng: Number(draft.lng),
          reporterName: draft.reporterName || null,
          source: "manual",
        }),
      });
      // «Despachar ahora»: las unidades marcadas salen directo con la misión
      // (push a su tablet + mensaje por WhatsApp) — también para reportes
      // por WhatsApp que la central registra.
      if (picks.length) {
        const disp = await jfetch<{ incident: IncidentDTO }>(`/api/incidents/${d.incident.id}/dispatch`, {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({ unitIds: picks }),
        });
        setDetail(disp.incident);
        toast.success(`Reporte registrado y despachado a ${picks.length} unidad${picks.length > 1 ? "es" : ""}`);
      } else {
        toast.success("Reporte registrado en la central");
      }
      setNewOpen(false);
      setDraft(EMPTY_DRAFT);
      setSelectedId(d.incident.id);
      setTab("detalle");
      setDetailOpen(true);
      void refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaveBusy(false);
    }
  }

  function openEdit(incident: IncidentDTO) {
    setEditDraft({
      title: incident.title,
      address: incident.address,
      severity: incident.severity,
      notes: incident.notes ?? "",
      lat: String(incident.lat),
      lng: String(incident.lng),
      reporterName: incident.reporterName ?? "",
      photo: incident.photoUrl ?? "",
    });
    setEditFor(incident);
    // La ventana queda abierta (y arrastrable): los clics en el mapa ajustan la ubicación
    setPickFor("incident-edit");
  }

  async function saveEdit() {
    if (!editFor) return;
    setSaveBusy(true);
    try {
      // La foto: data URL nueva se sube; "" quita la existente; una URL se deja igual
      const newPhoto = editDraft.photo.startsWith("data:") ? editDraft.photo : null;
      const removePhoto = !editDraft.photo && Boolean(editFor.photoUrl);
      const d = await jfetch<{ incident: IncidentDTO }>(`/api/incidents/${editFor.id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          title: editDraft.title,
          address: editDraft.address,
          severity: editDraft.severity,
          notes: editDraft.notes,
          lat: Number(editDraft.lat),
          lng: Number(editDraft.lng),
          reporterName: editDraft.reporterName || null,
          photoBase64: newPhoto,
          removePhoto,
        }),
      });
      toast.success("Reporte actualizado");
      setEditFor(null);
      setPickFor((p) => (p === "incident-edit" ? null : p));
      setEditDraft(EMPTY_DRAFT);
      setDetail(d.incident);
      void refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaveBusy(false);
    }
  }

  async function saveSettings(patch: Partial<SettingsDTO>) {
    try {
      const d = await jfetch<{ settings: SettingsDTO }>("/api/settings", {
        method: "PUT",
        headers: JSON_HEADERS,
        body: JSON.stringify(patch),
      });
      setSettings(d.settings);
      setSoundOn(d.settings.alert_sound === "1");
      toast.success("Configuración guardada");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function setUnitStatus(id: number, status: UnitStatus) {
    try {
      await jfetch(`/api/units/${id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ status }),
      });
      void refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  /** Cambiar la dotación (efectivos) de una unidad desde el tablero */
  async function setUnitCrew(id: number, crew: number) {
    try {
      await jfetch(`/api/units/${id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ crew }),
      });
      void refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  /** Origen de la ruta hacia la escena: la posición ACTUAL de la unidad
   * despachada si ya se apartó del punto de salida (>60 m, GPS en vivo);
   * si no, el punto de despacho fijado al despachar o el cuartel. */
  function routeOrigin(incident: IncidentDTO): { lat: number; lng: number } {
    const assignedIds = new Set(
      incident.units?.map((a) => a.unitId) ?? (incident.unitId != null ? [incident.unitId] : []),
    );
    for (const u of units) {
      if (!assignedIds.has(u.id) || u.lat == null || u.lng == null || u.status !== "en_ruta") continue;
      const moved =
        incident.departLat != null && incident.departLng != null
          ? haversineM(incident.departLat, incident.departLng, u.lat, u.lng) > 60
          : true; // sin punto de salida conocido, la posición viva es el mejor origen
      if (moved) return { lat: u.lat, lng: u.lng };
    }
    if (incident.departLat != null && incident.departLng != null) {
      return { lat: incident.departLat, lng: incident.departLng };
    }
    return FIREHOUSE;
  }

  /** «Ruta»: traza (o quita) la ruta vial en el mapa hacia la escena — sin
   * abrir Google Maps. Sale de donde está la unidad ahora mismo (no de donde
   * estaba cuando se despachó). */
  async function toggleRoute(incident: IncidentDTO) {
    if (route?.incidentId === incident.id) {
      setRoute(null);
      return;
    }
    const from = routeOrigin(incident);
    try {
      const d = await jfetch<{ route: RouteDTO }>(
        `/api/route?from=${from.lat},${from.lng}&to=${incident.lat},${incident.lng}`,
      );
      setRoute({ incidentId: incident.id, data: d.route });
      toast.info(
        d.route.estimated
          ? `Ruta estimada en línea recta: ${fmtDistance(d.route.meters)} (OSRM no respondió)`
          : `Ruta vial trazada: ${fmtDistance(d.route.meters)} · ~${Math.max(1, Math.round(d.route.seconds / 60))} min`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  /** «Ver recorrido»: dibuja el historial GPS grabado de la unidad (misiones
   * de las últimas 12 h) sobre el mapa — para reconstruir lo hecho.*/
  async function toggleTrack(unit: UnitDTO) {
    if (track?.unitId === unit.id) {
      setTrack(null);
      return;
    }
    try {
      const d = await jfetch<{ track: TrackDTO | null }>(`/api/units/${unit.id}/track`);
      const t = d.track;
      if (!t || t.count < 2) {
        toast.info("Aún no hay recorrido grabado para esta unidad (se graba durante las misiones).");
        setTrack(null);
        return;
      }
      setTrack({ unitId: unit.id, data: t });
      toast.info(`Recorrido: ${fmtDistance(t.meters)} · ${t.count} puntos GPS`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function startPick() {
    // La ventana del reporte manual ya es arrastrable: se queda abierta
    // sobre el mapa y el clic del mapa fija la ubicación.
    setPickFor("incident");
    toast.info("Haz clic en el mapa para fijar la ubicación del reporte");
  }

  function startEditPick() {
    setPickFor("incident-edit");
  }

  function startPickHydrant() {
    // La ventana no se cierra: el mapa queda clicable detrás
    setPickFor("hydrant");
  }

  function handlePick(lat: number, lng: number) {
    if (pickFor === "unit") {
      setUnitDraft((d) => ({ ...d, lat: lat.toFixed(5), lng: lng.toFixed(5) }));
      setUnitOpen(true);
    } else if (pickFor === "hydrant") {
      setHydrantDraft((d) => ({ ...d, lat: lat.toFixed(5), lng: lng.toFixed(5) }));
    } else if (pickFor === "incident-edit") {
      setEditDraft((d) => ({ ...d, lat: lat.toFixed(5), lng: lng.toFixed(5) }));
    } else {
      setDraft((d) => ({ ...d, lat: lat.toFixed(5), lng: lng.toFixed(5) }));
      setNewOpen(true);
    }
    if (pickFor === "incident-edit" || pickFor === "hydrant") {
      // Sigue activo para afinar con más clics; la ventana no se cierra
      toast.info(
        pickFor === "hydrant"
          ? "Ubicación del hidrante fijada en el mapa"
          : "Ubicación de la edición actualizada en el mapa",
      );
    } else {
      setPickFor(null);
      toast.info("Ubicación fijada en el mapa");
    }
  }

  function cancelPick() {
    const target = pickFor;
    setPickFor(null);
    if (target === "unit") setUnitOpen(true);
    else if (target === "incident") setNewOpen(true);
    // "hydrant" e "incident-edit": solo desactiva el clic en el mapa; la ventana sigue abierta
  }

  async function operatorLogout() {
    try {
      await jfetch("/api/operator/logout", { method: "POST" });
    } catch {
      /* aunque falle, la pantalla de login aparece tras recargar */
    }
    window.location.reload();
  }

  function openNewHydrant() {
    setHydrantDraft(EMPTY_HYDRANT_DRAFT);
    setHydrantOpen(true);
    // El mapa queda clicable: los clics ajustan la ubicación sin cerrar la ventana
    setPickFor("hydrant");
  }

  async function saveHydrant() {
    setHydrantBusy(true);
    try {
      const d = await jfetch<{ hydrant: HydrantDTO }>("/api/hydrants", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          code: hydrantDraft.code.trim() || null,
          lat: Number(hydrantDraft.lat),
          lng: Number(hydrantDraft.lng),
          pressure: hydrantDraft.pressure,
          diameter: Number(hydrantDraft.diameter) || null,
          situation: hydrantDraft.situation,
          notes: hydrantDraft.notes.trim() || null,
          photoBase64: hydrantDraft.photo || null,
        }),
      });
      toast.success(`${hydrantLabel(d.hydrant.code)} registrado · ${HYDRANT_SITUATION_META[d.hydrant.situation].label}`);
      setHydrantOpen(false);
      setPickFor((p) => (p === "hydrant" ? null : p));
      setHydrantDraft(EMPTY_HYDRANT_DRAFT);
      void refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setHydrantBusy(false);
    }
  }

  async function setHydrantSituation(id: number, situation: HydrantSituation) {
    try {
      await jfetch<{ hydrant: HydrantDTO }>(`/api/hydrants/${id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ situation }),
      });
      toast.success(`Situación actualizada: ${HYDRANT_SITUATION_META[situation].label}`);
      void refresh();
    } catch (e) {
      toast.error((e as Error).message);
      throw e;
    }
  }

  // ----- Unidades: alta y baja -----

  function openNewUnit() {
    setUnitDraft(EMPTY_UNIT_DRAFT);
    setUnitOpen(true);
  }

  function startPickUnit() {
    setUnitOpen(false);
    setPickFor("unit");
  }

  async function saveUnit() {
    setUnitBusy(true);
    try {
      const d = await jfetch<{ unit: UnitDTO }>("/api/units", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          code: unitDraft.code,
          name: unitDraft.name,
          type: unitDraft.type,
          status: unitDraft.status,
          station: unitDraft.station.trim() || null,
          crew: unitDraft.crew.trim() === "" ? null : Number(unitDraft.crew),
          lat: Number(unitDraft.lat),
          lng: Number(unitDraft.lng),
        }),
      });
      toast.success(`Unidad ${d.unit.code} registrada`);
      setUnitOpen(false);
      setUnitDraft(EMPTY_UNIT_DRAFT);
      void refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUnitBusy(false);
    }
  }

  async function removeUnit(id: number) {
    try {
      await jfetch<{ ok: boolean }>(`/api/units/${id}`, { method: "DELETE" });
      toast.success("Unidad dada de baja");
      void refresh();
    } catch (e) {
      toast.error((e as Error).message);
      throw e;
    }
  }

  // ----- Render -----
  // Auto-ficha: preplan activo a <300 m de la escena seleccionada (First Due).
  const preplanNear = useMemo(
    () =>
      selectedIncident
        ? nearestPreplan(selectedIncident.lat, selectedIncident.lng, preplans, 300)
        : null,
    [selectedIncident, preplans],
  );

  return (
    <div className="relative h-dvh overflow-hidden">
      {/* Mapa SIEMPRE a fondo: la CAD es una cabina — el mapa manda */}
      <div className="absolute inset-0 z-0">
        <MapView
          incidents={mapIncidents}
          route={route?.data ?? null}
          units={units}
          hydrants={hydrants}
          risks={initial.risks}
          preplans={preplans}
          selectedId={selectedId}
          nearHydrants={nearHydrants}
          layers={layers}
          theme={theme}
          picking={pickFor !== null}
          followUnitId={followUnitId}
          onFollowUnit={setFollowUnitId}
          track={track}
          onTrack={toggleTrack}
          onChat={(u) => setChatUnitId(u.id)}
          onPreplanView={(p) => setPreplanView(p)}
          onToggleLayer={(key) => setLayers((l) => ({ ...l, [key]: !l[key] }))}
          onSelect={(id) => select(id)}
          onPick={handlePick}
          onCancelPick={cancelPick}
          onNewHydrant={openNewHydrant}
          onHydrantSituation={setHydrantSituation}
        />
      </div>

      <div className="relative z-[5] flex h-full flex-col">
        <ViperRail
          op={op}
          live={live}
          soundOn={soundOn}
          simBusy={simBusy}
          theme={theme}
          units={units}
          followUnitId={followUnitId}
          onToggleDrawer={toggleDrawer}
          onToggleTheme={toggleTheme}
          onToggleSound={toggleSound}
          onSimulate={simulate}
          onNewReport={() => {
            setDraft(EMPTY_DRAFT);
            setNewOpen(true);
          }}
          onOpenHydrants={() => setHydrantsOpen(true)}
          onFollowUnit={setFollowUnitId}
        />

        {drawerOpen && (
          <ViperDrawer
            op={op}
            theme={theme}
            soundOn={soundOn}
            live={live}
            stats={stats}
            simBusy={simBusy}
            onClose={() => setDrawerOpen(false)}
            onToggleTheme={toggleTheme}
            onToggleSound={toggleSound}
            onSimulate={simulate}
            onNewReport={() => {
              setDraft(EMPTY_DRAFT);
              setNewOpen(true);
            }}
            onOpenHydrants={() => setHydrantsOpen(true)}
            onOpenUsers={() => setUsersOpen(true)}
            onOpenAudit={() => setAuditOpen(true)}
            onOpenMiClave={() => setMiClaveOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenQueue={openQueue}
            onLogout={() => void operatorLogout()}
          />
        )}

      <main className="relative min-h-0 flex-1">
        {/* Franja del incidente en pantalla + reloj de servicio (pie de cabina) */}
        <ViperStrip incident={selectedIncident} onOpenDetail={() => setDetailOpen(true)} />
        <ViperClock />

        {/* Tarjeta de vehículos mientras el panel de detalle o el chat no
            ocupen ese costado */}
        {!detailOpen && chatUnitId == null && (
          <ViperCards units={units} followUnitId={followUnitId} onFollowUnit={setFollowUnitId} />
        )}
        {/* Reportes: tarjeta flotante IZQUIERDA sobre el mapa */}
        {queueOpen && (
          <aside
            className="map-panel absolute left-2 top-2 bottom-16 z-10 flex w-[320px] max-w-[92vw] flex-col overflow-hidden rounded-xl lg:bottom-2"
            aria-label="Reportes activos"
          >
            <IncidentQueue
              incidents={incidents}
              selectedId={selectedId}
              lastNewId={lastNewId}
              onSelect={(id) => select(id, true)}
            />
          </aside>
        )}

        {/* Chat con una unidad (panel sobre el mapa; key fuerza remonto por unidad) */}
        {chatUnitId != null && (
          <ChatPanel
            key={chatUnitId}
            unitId={chatUnitId}
            unitCode={units.find((u) => u.id === chatUnitId)?.code ?? "Unidad"}
            incoming={lastChat}
            onClose={() => setChatUnitId(null)}
          />
        )}

        {/* Detalle: tarjeta flotante DERECHA sobre el mapa */}
        {detailOpen && (
          <aside
            className="map-panel absolute right-2 top-2 bottom-16 z-10 flex w-[385px] max-w-[92vw] flex-col overflow-hidden rounded-xl lg:bottom-2"
            aria-label="Detalle del reporte"
          >
            <DetailPanel
              incident={detailForSelected}
              fallback={selectedIncident}
              busy={detailBusy}
              tab={tab}
              theme={theme}
              onTabChange={setTab}
              hydrants={hydrants}
              units={units}
              activity={activity}
              waCentralConfigured={Boolean(settings.wa_central)}
              onDispatch={(i) => setDispatchFor(i)}
              onStatus={changeStatus}
              onReply={reply}
              onNotifyCentral={notifyCentral}
              onEdit={openEdit}
              onSelectIncident={(id) => select(id)}
              onSetUnitStatus={setUnitStatus}
              onUnitsChanged={() => void refresh()}
              onAddUnit={openNewUnit}
              onRemoveUnit={removeUnit}
              onSetCrew={setUnitCrew}
              routeForId={route?.incidentId ?? null}
              onRoute={toggleRoute}
              preplanNear={preplanNear}
            />
          </aside>
        )}
      </main>

      {/* Píldora flotante de paneles (cabina): el mapa nunca se tapa por columnas */}
      <nav
        className="absolute bottom-2 left-2 z-20 flex h-11 items-center gap-1 rounded-full border border-line bg-panel/95 px-1.5 shadow-lg backdrop-blur"
        aria-label="Paneles de la cabina"
      >
        <button
          type="button"
          className={cx(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10.5px] font-bold tracking-wider uppercase",
            queueOpen && !detailOpen ? "bg-redbtn text-white" : "text-mu",
          )}
          onClick={() => {
            setQueueOpen(true);
            setDetailOpen(false);
          }}
        >
          <ListBullets size={16} aria-hidden="true" /> Reportes
          {activeCount > 0 && (
            <span className="rounded-sm bg-redbtn px-1 text-[9px] text-white">{activeCount}</span>
          )}
        </button>
        <button
          type="button"
          className={cx(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10.5px] font-bold tracking-wider uppercase",
            !queueOpen && !detailOpen ? "bg-redbtn text-white" : "text-mu",
          )}
          onClick={() => {
            setQueueOpen(false);
            setDetailOpen(false);
          }}
        >
          <MapTrifold size={16} aria-hidden="true" /> Mapa
        </button>
        <button
          type="button"
          className={cx(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10.5px] font-bold tracking-wider uppercase",
            detailOpen && !queueOpen ? "bg-redbtn text-white" : "text-mu",
          )}
          onClick={() => {
            setDetailOpen(true);
            setQueueOpen(false);
          }}
        >
          <Fire size={16} aria-hidden="true" /> Detalle
        </button>
      </nav>
      </div>

      {/* Diálogos */}
      {dispatchFor && (
        <DispatchDialog
          incident={dispatchFor}
          units={units}
          nearHydrants={dispatchNearHydrants}
          waUnit={settings.wa_unit}
          busy={dispatchBusy}
          onClose={() => setDispatchFor(null)}
          onConfirm={confirmDispatch}
          onOpenSettings={() => {
            setDispatchFor(null);
            setSettingsOpen(true);
          }}
        />
      )}
      {newOpen && (
        <NewIncidentDialog
          draft={draft}
          setDraft={setDraft}
          busy={saveBusy}
          units={units.filter((u) => u.status === "disponible")}
          onClose={() => setNewOpen(false)}
          onSave={saveNewIncident}
          onStartPick={startPick}
        />
      )}
      {editFor && (
        <NewIncidentDialog
          mode="edit"
          draft={editDraft}
          setDraft={setEditDraft}
          busy={saveBusy}
          onClose={() => {
            setEditFor(null);
            setPickFor((p) => (p === "incident-edit" ? null : p));
          }}
          onSave={saveEdit}
          onStartPick={startEditPick}
        />
      )}
      {unitOpen && (
        <NewUnitDialog
          draft={unitDraft}
          setDraft={setUnitDraft}
          busy={unitBusy}
          onClose={() => setUnitOpen(false)}
          onSave={saveUnit}
          onStartPick={startPickUnit}
        />
      )}
      {hydrantOpen && (
        <HydrantDialog
          draft={hydrantDraft}
          setDraft={setHydrantDraft}
          busy={hydrantBusy}
          onClose={() => {
            setHydrantOpen(false);
            setPickFor((p) => (p === "hydrant" ? null : p));
          }}
          onSave={saveHydrant}
          onStartPick={startPickHydrant}
        />
      )}
      {hydrantsOpen && (
        <HydrantsDialog
          hydrants={hydrants}
          onClose={() => setHydrantsOpen(false)}
          onNewHydrant={openNewHydrant}
          onSituationChange={setHydrantSituation}
        />
      )}
      {settingsOpen && (
        <SettingsDialog settings={settings} onSave={saveSettings} onClose={() => setSettingsOpen(false)} />
      )}
      {preplanView && (
        <PreplanViewDialog preplan={preplanView} onClose={() => setPreplanView(null)} />
      )}
      {usersOpen && op.role === "jefe" && <UsersDialog onClose={() => setUsersOpen(false)} />}
      {auditOpen && op.role === "jefe" && <AuditDialog onClose={() => setAuditOpen(false)} />}
      {miClaveOpen && <MiClaveDialog onClose={() => setMiClaveOpen(false)} />}
    </div>
  );
}
