"use client";

// ============================================================
//  Cromo de cabina B-35 de la CAD central — mismas señales que la
//  tablet del chofer pero con TODA la funcionalidad real del CAD:
//   · Rail superior: marca, en vivo, unidades y píldoras rápidas
//   · Cajón (drawer): TODOS los módulos + diagnóstico del turno
//   · Tarjetas derechas: Sugerencia, Claves y Vehículos (datos vivos)
//   · Franja de incidente + reloj de servicio
// ============================================================

import Link from "next/link";
import { useState } from "react";
import {
  Buildings,
  ChartBar,
  Drop,
  Fire,
  GearSix,
  Key,
  ListBullets,
  Plus,
  Scroll,
  SignOut,
  Siren,
  Sun,
  Moon,
  Bell,
  BellSlash,
  Broadcast,
  Truck,
  Users,
  WhatsappLogo,
  X,
} from "@phosphor-icons/react";
import { useClock } from "@/hooks/useClock";
import { haversineM } from "@/lib/geo";
import { STATUS_META, UNIT_STATUS_META } from "@/lib/meta";
import { pad, timeAgo } from "@/lib/utils";
import type {
  IncidentDTO,
  OperatorDTO,
  StatsDTO,
  UnitDTO,
  UnitStatus,
} from "@/lib/types";

const CLAVE_BY_STATUS: Record<UnitStatus, string> = {
  disponible: "6-0",
  en_ruta: "6-8",
  en_escena: "6-10",
  regresando: "6-9",
  fuera_servicio: "F/S",
};

const STATUS_COLOR: Record<UnitStatus, string> = {
  disponible: "var(--green)",
  en_ruta: "var(--amber)",
  en_escena: "var(--st-escena)",
  regresando: "var(--amber)",
  fuera_servicio: "var(--mu-2)",
};

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-baseline gap-1.5 leading-none select-none">
      <span className={`display font-bold tracking-wide ${compact ? "text-[15px]" : "text-[19px]"}`}>
        B<span className="text-red">-35</span>
      </span>
      {!compact && <span className="text-[9px] font-bold tracking-[0.2em] text-mu2 uppercase">Central de mando</span>}
    </span>
  );
}

/* ---------- RAIL superior (píldoras sobre el mapa) ---------- */

export interface ViperRailProps {
  op: OperatorDTO;
  live: boolean;
  soundOn: boolean;
  simBusy: boolean;
  theme: "dark" | "light";
  units: UnitDTO[];
  followUnitId: number | null;
  onToggleDrawer: () => void;
  onToggleTheme: () => void;
  onToggleSound: () => void;
  onSimulate: () => void;
  onNewReport: () => void;
  onOpenHydrants: () => void;
  onOpenPreplans: () => void;
  onFollowUnit: (id: number | null) => void;
}

export function ViperRail({
  op,
  live,
  soundOn,
  simBusy,
  theme,
  units,
  followUnitId,
  onToggleDrawer,
  onToggleTheme,
  onToggleSound,
  onSimulate,
  onNewReport,
  onOpenHydrants,
  onOpenPreplans,
  onFollowUnit,
}: ViperRailProps) {
  return (
    <header
      className="chrome-top absolute inset-x-0 top-0 z-20 flex h-12 shrink-0 items-center gap-2 overflow-x-auto border-b border-line px-2"
      aria-label="Cabina B-35"
    >
      {/* Marca + cajón */}
      <button
        type="button"
        onClick={onToggleDrawer}
        className="flex shrink-0 items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-panel2/70"
        title="Abrir el cajón de módulos"
        aria-label="Abrir cajón"
      >
        <Siren size={18} weight="fill" className="text-red" aria-hidden="true" />
        <Brand />
      </button>
      <div
        className={`flex shrink-0 items-center gap-1.5 rounded border px-2 py-1 ${
          live ? "border-green/35 bg-green/10" : "border-amber/45 bg-amber/10"
        }`}
        role="status"
        title={live ? "Datos en tiempo real activos" : "Reconectando"}
      >
        <Broadcast size={12} className={live ? "text-green" : "text-amber anim-blink"} aria-hidden="true" />
        <span className={`text-[9px] font-bold tracking-widest uppercase ${live ? "text-green" : "text-amber"}`}>
          {live ? "En vivo" : "Reconectando"}
        </span>
      </div>

      {/* Unidades: toque = seguir cámara (dot de estado) */}
      <div className="flex shrink-0 items-center gap-1 border-l border-line pl-2">
        {units.slice(0, 8).map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => onFollowUnit(followUnitId === u.id ? null : u.id)}
            title={`${u.code} · ${u.name} — clic para seguir la cámara`}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[10.5px] font-bold transition-colors ${
              followUnitId === u.id ? "border-amber text-amber" : "border-line text-tx hover:border-line2"
            }`}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: STATUS_COLOR[u.status] }}
              aria-hidden="true"
            />
            {u.code}
            <span className="font-mono text-[9px] text-mu2">{CLAVE_BY_STATUS[u.status]}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 min-w-2" />

      {/* Píldoras rápidas — todas con función real del CAD */}
      <button type="button" className="btn btn-sm btn-red shrink-0" onClick={onOpenHydrants} title="Directorio de hidrantes (grifos)">
        <Drop size={14} aria-hidden="true" /> <span className="hidden sm:inline">Grifos</span>
      </button>
      <button type="button" className="btn btn-sm btn-red shrink-0" onClick={onOpenPreplans} title="Planos de emergencia (preplans)">
        <Buildings size={14} aria-hidden="true" /> <span className="hidden sm:inline">Planos</span>
      </button>
      <button type="button" className="btn btn-sm btn-red shrink-0" onClick={onNewReport} title="Registrar un reporte manual">
        <Plus size={14} weight="bold" aria-hidden="true" /> <span className="hidden sm:inline">Nuevo</span>
      </button>
      <button type="button" className="btn btn-sm shrink-0" onClick={onSimulate} disabled={simBusy} title="Simular reporte por WhatsApp">
        <WhatsappLogo size={14} weight="fill" className="text-green" aria-hidden="true" />
        <span className="hidden md:inline">{simBusy ? "Recibiendo…" : "Simular"}</span>
      </button>
      <Link href="/reportes" className="btn btn-sm shrink-0" title="Informe de tiempos de respuesta (P50/P90)">
        <ChartBar size={14} aria-hidden="true" /> <span className="hidden md:inline">Informe</span>
      </Link>
      <button
        type="button"
        className="btn btn-sm shrink-0"
        onClick={onToggleSound}
        title={soundOn ? "Alertas sonoras activadas" : "Alertas silenciadas"}
        aria-label={soundOn ? "Silenciar alertas" : "Activar alertas sonoras"}
      >
        {soundOn ? <Bell size={14} className="text-amber" aria-hidden="true" /> : <BellSlash size={14} className="text-mu" aria-hidden="true" />}
      </button>
      <button
        type="button"
        className="btn btn-sm shrink-0"
        onClick={onToggleTheme}
        title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
        aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      >
        {theme === "dark" ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
      </button>
      <span className="hidden shrink-0 items-center pl-1 text-[10px] leading-none text-mu2 xl:flex" title={`Sesión: ${op.email}`}>
        {op.name}
      </span>
    </header>
  );
}

/* ---------- CAJÓN con todos los módulos ---------- */

export interface ViperDrawerProps {
  op: OperatorDTO;
  theme: "dark" | "light";
  soundOn: boolean;
  live: boolean;
  stats: StatsDTO;
  simBusy: boolean;
  onClose: () => void;
  onToggleTheme: () => void;
  onToggleSound: () => void;
  onSimulate: () => void;
  onNewReport: () => void;
  onOpenHydrants: () => void;
  onOpenPreplans: () => void;
  onOpenUsers: () => void;
  onOpenAudit: () => void;
  onOpenMiClave: () => void;
  onOpenSettings: () => void;
  /** Abre el panel flotante de REPORTES (la «tabla» live de la CAD) */
  onOpenQueue: () => void;
  onLogout: () => void;
}

function MenuItem({
  icon,
  label,
  onClick,
  tone = "normal",
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: "normal" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13.5px] font-semibold transition-[background-color,transform] hover:translate-x-0.5 hover:bg-panel2/80 ${
        tone === "danger" ? "text-red" : "text-tx"
      }`}
    >
      <span className="shrink-0 text-mu">{icon}</span>
      {label}
    </button>
  );
}

export function ViperDrawer(props: ViperDrawerProps) {
  const { op, theme, soundOn, live, stats, simBusy, onClose } = props;
  const now = useClock(30_000);
  const chief = op.role === "jefe";

  return (
    <div
      className="absolute left-2 top-14 bottom-2 z-40 flex w-[300px] max-w-[84vw] flex-col overflow-hidden rounded-xl border border-line bg-panel/95 shadow-2xl backdrop-blur"
      role="dialog"
      aria-label="Cajón de módulos B-35"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <Brand />
        <button type="button" onClick={onClose} className="btn btn-sm px-2 py-1" aria-label="Cerrar cajón">
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      <div className="px-4 pt-3">
        <p className="text-[11px] text-mu2">
          Central de Mando GIS · Camaná, PE
        </p>
        <p className="text-[12.5px] font-bold">{op.name} · {op.role === "jefe" ? "Jefe" : op.role === "operador" ? "Operador" : "Lectura"}</p>
      </div>

      <nav className="dialog-scroll min-h-0 flex-1 overflow-y-auto px-2 py-2" aria-label="Módulos del CAD">
        <MenuItem icon={<WhatsappLogo size={17} className="text-green" />} label="Simular reporte" onClick={props.onSimulate} />
        <MenuItem icon={<Plus size={17} />} label="Nuevo reporte" onClick={props.onNewReport} />
        <MenuItem icon={<Drop size={17} className="text-blue" />} label="Grifos / hidrantes" onClick={props.onOpenHydrants} />
        <MenuItem icon={<Buildings size={17} className="text-amber" />} label="Planos de emergencia" onClick={props.onOpenPreplans} />
        <MenuItem icon={<ListBullets size={17} />} label="Reportes (lista viva)" onClick={props.onOpenQueue} />
        <MenuItem icon={<GearSix size={17} />} label="Preferencias de la central" onClick={props.onOpenSettings} />
        <MenuItem icon={<Key size={17} />} label="Mi clave" onClick={props.onOpenMiClave} />
        {chief && <MenuItem icon={<Users size={17} />} label="Operadores" onClick={props.onOpenUsers} />}
        {chief && <MenuItem icon={<Scroll size={17} />} label="Historial de comunicaciones" onClick={props.onOpenAudit} />}
        <MenuItem
          icon={theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          label={theme === "dark" ? "Modo claro" : "Modo oscuro"}
          onClick={props.onToggleTheme}
        />
        <MenuItem
          icon={soundOn ? <Bell size={17} className="text-amber" /> : <BellSlash size={17} />}
          label={soundOn ? "Silenciar alertas" : "Activar alertas"}
          onClick={props.onToggleSound}
        />
        <MenuItem icon={<SignOut size={17} />} label="Cerrar sesión" onClick={props.onLogout} tone="danger" />
      </nav>

      {/* Diagnóstico del turno (lo que antes era la tira de indicadores) */}
      <div className="border-t border-line px-4 py-3">
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-mu2 uppercase">
          <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-green" : "bg-amber anim-blink"}`} aria-hidden="true" />
          {live ? "Sincronización activa" : "Reconectando"}
        </p>
        <div className="grid grid-cols-2 gap-1.5 text-[11.5px]">
          <div className="rounded border border-line bg-panel2 px-2 py-1.5">
            <span className="block text-[9px] tracking-widest text-mu2 uppercase">Activos</span>
            <span className="display text-base font-bold" style={{ color: "var(--red)" }}>{stats.activos}</span>
          </div>
          <div className="rounded border border-line bg-panel2 px-2 py-1.5">
            <span className="block text-[9px] tracking-widest text-mu2 uppercase">Unidades libres</span>
            <span className="display text-base font-bold" style={{ color: "var(--green)" }}>
              {stats.unidadesDisponibles}/{stats.unidadesTotal}
            </span>
          </div>
          <div className="rounded border border-line bg-panel2 px-2 py-1.5">
            <span className="block text-[9px] tracking-widest text-mu2 uppercase">Reportes hoy</span>
            <span className="display text-base font-bold">{stats.hoy}</span>
          </div>
          <div className="rounded border border-line bg-panel2 px-2 py-1.5">
            <span className="block text-[9px] tracking-widest text-mu2 uppercase">Resp. promedio</span>
            <span className="display text-base font-bold">
              {stats.respuestaPromedioMin !== null ? `${stats.respuestaPromedioMin}′` : "—"}
            </span>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-mu2">
          Última actualización{" "}
          {now
            ? `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`
            : "—"}
        </p>
      </div>
    </div>
  );
}

/* ---------- TARJETAS derechas (Sugerencia · Claves · Vehículos) ---------- */

export interface ViperCardsProps {
  incident: IncidentDTO | null;
  units: UnitDTO[];
  followUnitId: number | null;
  canDispatch: boolean;
  onFollowUnit: (id: number | null) => void;
  onDispatch: () => void;
}

export function ViperCards({ incident, units, followUnitId, canDispatch, onFollowUnit, onDispatch }: ViperCardsProps) {
  const [showAll, setShowAll] = useState(false);

  // Sugerencia: la unidad DISPOSICCIÓN más cercana al incidente seleccionado
  const sugerida = (() => {
    if (!incident || !incident.lat || !incident.lng) return null;
    const pool = units.filter((u) => u.status === "disponible" && u.lat != null && u.lng != null);
    if (pool.length === 0) return null;
    return pool.reduce((best, u) =>
      haversineM(incident.lat, incident.lng, u.lat!, u.lng!) < haversineM(incident.lat, incident.lng, best.lat!, best.lng!) ? u : best,
    );
  })();
  const sugMeters = sugerida && incident ? haversineM(incident.lat, incident.lng, sugerida.lat!, sugerida.lng!) : null;

  const clavesUnits = showAll ? units : units.filter((u) => u.status !== "fuera_servicio");

  return (
    <div className="dialog-scroll absolute right-2 top-14 z-10 flex w-[292px] max-w-[92vw] flex-col gap-2 overflow-y-auto pb-2" role="complementary" aria-label="Tarjetas operativas">
      {/* SUGERENCIA — unidad más cercana disponible para el incidente en pantalla */}
      <div className="map-panel rounded-xl p-3" data-b35-card="sugerencia">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-green/15 px-2 py-0.5 text-[10.5px] font-bold text-green">
            <Truck size={12} aria-hidden="true" /> Sugerencia de despacho
          </span>
        </div>
        <p className="mt-1 text-[10.5px] text-mu2">La unidad libre más cercana a la emergencia en pantalla.</p>
        {sugerida ? (
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="display text-3xl font-bold tracking-wider text-green">{sugerida.code}</span>
            <button
              type="button"
              onClick={onDispatch}
              disabled={!canDispatch}
              className="btn btn-sm btn-blue shrink-0"
              title={canDispatch ? `Despachar ${sugerida.code} al incidente en pantalla` : "El incidente de fondo ya no está activo"}
            >
              Despachar
            </button>
          </div>
        ) : (
          <p className="mt-1 text-[12px] text-mu">Sin unidades disponibles cerca.</p>
        )}
        {sugerida && sugMeters != null && (
          <p className="text-[10.5px] text-mu2">
            Distancia a la escena: <span className="font-mono">{Math.round(sugMeters / 10) * 10} m</span>
          </p>
        )}
      </div>

      {/* CLAVES — estado vivo de cada unidad con su clave radial */}
      <div className="map-panel rounded-xl p-3" data-b35-card="claves">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[10.5px] font-bold tracking-widest text-mu uppercase">
            <Fire size={12} className="text-red" aria-hidden="true" /> Claves radiales
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {clavesUnits.slice(0, 6).map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => onFollowUnit(followUnitId === u.id ? null : u.id)}
              className={`flex items-center justify-between gap-1 rounded-lg border px-2.5 py-2 text-[12px] font-bold transition-colors ${
                followUnitId === u.id ? "border-amber text-amber" : "border-line text-tx hover:border-line2"
              }`}
              style={{ background: u.status === "disponible" ? "color-mix(in srgb, var(--green) 22%, transparent)" : undefined }}
              title={`${u.code} · ${u.name}`}
            >
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[u.status] }} aria-hidden="true" />
                {CLAVE_BY_STATUS[u.status]}
              </span>
              <span className="text-mu2">{u.code}</span>
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[10px] leading-snug text-mu2">
          6-0 disponible · 6-8 en ruta · 6-10 en el lugar · 6-9 regresando
        </p>
        <button
          type="button"
          className="mt-1 w-full rounded-lg border px-2.5 py-1.5 text-[11.5px] font-bold text-green hover:border-green/40"
          style={{ background: showAll ? "color-mix(in srgb, var(--green) 22%, transparent)" : undefined }}
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? "Ver menos" : "Ver más"}
        </button>
      </div>

      {/* VEHÍCULOS — flota completa con su estado */}
      <div className="map-panel rounded-xl p-3" data-b35-card="vehiculos">
        <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-bold tracking-widest text-mu uppercase">
          <Truck size={12} aria-hidden="true" /> Vehículos
        </div>
        <div className="flex flex-wrap gap-1.5">
          {units.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => onFollowUnit(followUnitId === u.id ? null : u.id)}
              title={`Seguir a ${u.code} · ${u.name}`}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                followUnitId === u.id ? "border-amber text-amber" : "border-line text-tx hover:border-line2"
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[u.status] }} aria-hidden="true" />
              {u.code}
              <span className="text-[9.5px] font-semibold text-mu2">({UNIT_STATUS_META[u.status].label})</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- FRANJA de incidente + RELOJ (pie de cabina) ---------- */

export interface ViperStripProps {
  incident: IncidentDTO | null;
  onOpenDetail: () => void;
}

export function ViperStrip({ incident, onOpenDetail }: ViperStripProps) {
  if (!incident) {
    return (
      <div className="absolute bottom-16 left-1/2 z-10 -translate-x-1/2 lg:bottom-2" role="status">
        <div className="map-panel flex items-center gap-2 rounded-full px-4 py-2 text-[12px] text-mu">
          <Fire size={14} className="text-green" aria-hidden="true" /> Sin emergencias en pantalla
        </div>
      </div>
    );
  }
  const when = new Date(incident.createdAt);
  return (
    <div className="absolute bottom-16 left-1/2 z-10 w-[min(92vw,540px)] -translate-x-1/2 lg:bottom-2" role="status">
      <div className="map-panel flex items-center gap-3 rounded-xl p-2.5 pr-4">
        <button
          type="button"
          onClick={onOpenDetail}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-red text-white shadow-[0_0_16px_-4px_var(--red)]"
          title="Abrir el detalle flotante"
          aria-label="Abrir detalle del incidente"
        >
          <Siren size={20} weight="fill" aria-hidden="true" />
        </button>
        <button type="button" onClick={onOpenDetail} className="min-w-0 flex-1 text-left">
          <p className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold tracking-wider text-mu uppercase">
            <span>
              {when ? `${pad(when.getDate())}-${pad(when.getMonth() + 1)}-${when.getFullYear()} · ${pad(when.getHours())}:${pad(when.getMinutes())}:${pad(when.getSeconds())}` : ""}
            </span>
            <span
              className="rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase"
              style={{
                color: `var(${STATUS_META[incident.status].varName})`,
                background: `color-mix(in srgb, var(${STATUS_META[incident.status].varName}) 18%, transparent)`,
              }}
            >
              {STATUS_META[incident.status].label}
            </span>
            <span className="text-mu2">·</span>
            <span className="truncate">{timeAgo(incident.createdAt)}</span>
          </p>
          <p className="truncate text-[14.5px] font-bold leading-tight">{incident.title}</p>
          <p className="truncate text-[11px] text-mu">
            {incident.address}
            {incident.notes ? ` — ${incident.notes}` : ""}
          </p>
        </button>
      </div>
    </div>
  );
}

export function ViperClock() {
  const now = useClock();
  if (!now) return <div aria-hidden="true" />;
  const dias = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
  const meses = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
  return (
    <div className="absolute right-2 bottom-2 z-10 hidden text-right lg:block" aria-label="Hora del servicio">
      <p className="text-[11px] font-bold tracking-[0.18em] text-mu">
        {dias[now.getDay()]} {now.getDate()} / {meses[now.getMonth()]}
      </p>
      <p className="display text-[26px] font-bold leading-none tabular-nums text-tx drop-shadow">
        {pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}
      </p>
    </div>
  );
}
