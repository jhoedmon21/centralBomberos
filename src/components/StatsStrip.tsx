"use client";

import { Clock, Drop, Fire, Siren, Truck, WhatsappLogo } from "@phosphor-icons/react";
import type { StatsDTO } from "@/lib/types";

interface Props {
  stats: StatsDTO;
  live: boolean;
}

function Stat({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-r border-line px-3 py-1 last:border-r-0">
      <span className="text-mu2" aria-hidden="true">
        {icon}
      </span>
      <div className="leading-none">
        <div className="text-[9.5px] font-bold tracking-[0.14em] text-mu2 uppercase">{label}</div>
        <div className="display text-lg font-bold tabular-nums" style={color ? { color } : undefined}>
          {value}
        </div>
      </div>
    </div>
  );
}

/** Tira de indicadores del turno */
export default function StatsStrip({ stats, live }: Props) {
  return (
    <div className="chrome-strip hidden h-11 shrink-0 items-center overflow-x-auto border-b border-line lg:flex">
      <Stat
        icon={<Fire size={16} weight="fill" className="text-red" />}
        label="Activos"
        value={stats.activos}
        color="var(--red)"
      />
      <Stat
        icon={<WhatsappLogo size={15} weight="fill" className="text-amber" />}
        label="Reportados"
        value={stats.reportados}
      />
      <Stat icon={<Siren size={15} className="text-mu2" />} label="Despachados" value={stats.despachados} />
      <Stat icon={<Fire size={15} className="text-mu2" />} label="En escena" value={stats.enEscena} />
      <Stat
        icon={<Truck size={16} className="text-green" />}
        label="Unidades libres"
        value={`${stats.unidadesDisponibles}/${stats.unidadesTotal}`}
        color="var(--green)"
      />
      <Stat
        icon={<Clock size={15} className="text-mu2" />}
        label="Resp. promedio"
        value={stats.respuestaPromedioMin !== null ? `${stats.respuestaPromedioMin} min` : "—"}
      />
      <Stat icon={<Fire size={15} className="text-mu2" />} label="Reportes hoy" value={stats.hoy} />
      <Stat icon={<Drop size={15} className="text-mu2" />} label="Cerrados hoy" value={stats.cerradosHoy} />
      <div className="flex-1" />
      <div className="hidden items-center gap-2 px-3 text-[10px] tracking-[0.18em] text-mu2 uppercase xl:flex">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${live ? "bg-green" : "bg-amber anim-blink"}`}
          aria-hidden="true"
        />
        <span>{live ? "Sincronización activa" : "Modo local — reconectando"} · Camaná, PE</span>
      </div>
    </div>
  );
}
