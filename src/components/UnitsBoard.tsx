"use client";

import { useState, type FormEvent } from "react";
import { CaretDown, Plus, Toolbox, Trash, Truck, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  UNIT_ITEM_CATEGORY_META,
  UNIT_ITEM_CONDITION_META,
  UNIT_STATUS_META,
  UNIT_TYPE_META,
} from "@/lib/meta";
import type {
  IncidentDTO,
  UnitDTO,
  UnitItemCategory,
  UnitItemCondition,
  UnitItemDTO,
  UnitStatus,
} from "@/lib/types";
import { cx } from "@/lib/utils";

const STATUS_VAR: Record<UnitStatus, string> = {
  disponible: "--green",
  en_ruta: "--st-despachado",
  en_escena: "--st-escena",
  regresando: "--amber",
  fuera_servicio: "--st-cerrado",
};

const CATEGORY_ORDER: UnitItemCategory[] = [
  "manguera",
  "extintor",
  "herramienta",
  "rescate",
  "medico",
  "comunicacion",
  "epp",
  "equipo",
];

// ------------------------------------------------------------------
// Inventario de materiales de una unidad (ver + agregar + quitar)
// ------------------------------------------------------------------

function UnitInventory({ unit, onChanged }: { unit: UnitDTO; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<UnitItemDTO[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [armedId, setArmedId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [category, setCategory] = useState<UnitItemCategory>("equipo");
  const [condition, setCondition] = useState<UnitItemCondition>("bueno");

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/units/${unit.id}/items`);
      const d = (await r.json()) as { items?: UnitItemDTO[]; error?: string };
      if (!r.ok) throw new Error(d.error ?? `Error ${r.status}`);
      setItems(d.items ?? []);
    } catch (e) {
      toast.error((e as Error).message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    setArmedId(null);
    if (next && items === null && !loading) void load();
  }

  async function addItem(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/units/${unit.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category,
          quantity: Number(quantity) || 1,
          condition,
        }),
      });
      const d = (await r.json()) as { item?: UnitItemDTO; error?: string };
      if (!r.ok || !d.item) throw new Error(d.error ?? `Error ${r.status}`);
      setItems((prev) => [...(prev ?? []), d.item as UnitItemDTO]);
      setName("");
      setQuantity("1");
      toast.success("Material agregado al inventario");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(id: number) {
    setBusy(true);
    try {
      const r = await fetch(`/api/unit-items/${id}`, { method: "DELETE" });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(d.error ?? `Error ${r.status}`);
      setItems((prev) => (prev ?? []).filter((i) => i.id !== id));
      toast.success("Material quitado del inventario");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      setArmedId(null);
    }
  }

  const groups: Array<[UnitItemCategory, UnitItemDTO[]]> = [];
  for (const cat of CATEGORY_ORDER) {
    const list = (items ?? []).filter((i) => i.category === cat);
    if (list.length) groups.push([cat, list]);
  }

  return (
    <div className="mt-2">
      <button
        className="btn btn-sm flex w-full items-center justify-between"
        onClick={toggle}
        aria-expanded={open}
        title={`Materiales y equipamiento de ${unit.code}`}
      >
        <span className="flex items-center gap-1.5">
          <Toolbox size={14} className="text-mu2" aria-hidden="true" /> Materiales
          <span className="text-mu2">· {items?.length ?? unit.itemCount}</span>
        </span>
        <CaretDown size={12} className={cx("transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open && (
        <div className="anim-slidein mt-1.5 space-y-2 rounded border border-line bg-panel p-2">
          {loading && <p className="text-[11.5px] text-mu2">Cargando inventario…</p>}
          {!loading && items && items.length === 0 && (
            <p className="text-[11.5px] text-mu2">Aún no hay materiales registrados en esta unidad.</p>
          )}

          {groups.map(([cat, list]) => (
            <div key={cat}>
              <h4 className="mb-1 text-[9.5px] font-bold tracking-[0.16em] text-mu2 uppercase">
                {UNIT_ITEM_CATEGORY_META[cat].label}
              </h4>
              <ul className="space-y-1">
                {list.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center justify-between gap-2 rounded border border-line bg-panel2 px-2 py-1"
                  >
                    <span className="min-w-0 text-[12px]">
                      <b className="font-mono font-semibold">{i.quantity}×</b> {i.name}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <span
                        className="chip"
                        style={{ color: `var(${UNIT_ITEM_CONDITION_META[i.condition].varName})` }}
                      >
                        {UNIT_ITEM_CONDITION_META[i.condition].label}
                      </span>
                      <button
                        className={cx("btn btn-sm", armedId === i.id && "border-red/60 text-red")}
                        onClick={() => (armedId === i.id ? void removeItem(i.id) : setArmedId(i.id))}
                        disabled={busy}
                        title={armedId === i.id ? "Confirmar: quitar material" : "Quitar material"}
                        aria-label={`Quitar ${i.name}`}
                      >
                        {armedId === i.id ? "¿Quitar?" : <X size={11} aria-hidden="true" />}
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <form onSubmit={addItem} className="space-y-2 rounded border border-dashed border-line2 p-2">
            <div className="flex gap-2">
              <input
                className="input py-1 text-[12.5px]"
                placeholder="Material (ej.: Extintor PQS 12 kg)"
                name="item-name"
                autoComplete="off"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-label="Nombre del material"
              />
              <input
                type="number"
                min={1}
                max={999}
                className="input w-16 py-1 text-center"
                name="item-quantity"
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                aria-label="Cantidad"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                className="input py-1 text-[12px]"
                value={category}
                onChange={(e) => setCategory(e.target.value as UnitItemCategory)}
                aria-label="Categoría del material"
              >
                {CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {UNIT_ITEM_CATEGORY_META[c].label}
                  </option>
                ))}
              </select>
              <select
                className="input py-1 text-[12px]"
                value={condition}
                onChange={(e) => setCondition(e.target.value as UnitItemCondition)}
                aria-label="Condición del material"
              >
                {(Object.keys(UNIT_ITEM_CONDITION_META) as UnitItemCondition[]).map((c) => (
                  <option key={c} value={c}>
                    {UNIT_ITEM_CONDITION_META[c].label}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn btn-sm btn-blue w-full" type="submit" disabled={busy || !name.trim()}>
              <Plus size={13} aria-hidden="true" /> {busy ? "Agregando…" : "Agregar material"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Dotación (efectivos) editable de cada unidad
// ------------------------------------------------------------------

function CrewEditor({ unit, onSetCrew }: { unit: UnitDTO; onSetCrew: (id: number, crew: number) => Promise<void> }) {
  const [crew, setCrew] = useState(String(unit.crew ?? ""));
  const [busy, setBusy] = useState(false);
  const n = Number(crew);
  const dirty = Number.isInteger(n) && n !== unit.crew;

  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        className="input w-14 py-0.5 text-[11.5px]"
        min={0}
        max={30}
        value={crew}
        onChange={(e) => setCrew(e.target.value)}
        aria-label={`Efectivos de la unidad ${unit.code}`}
        title="Dotación: bomberos a bordo"
      />
      <span>efectivos</span>
      {dirty && (
        <button
          type="button"
          className="btn btn-sm btn-blue shrink-0"
          disabled={busy || n < 0 || n > 30}
          onClick={async () => {
            setBusy(true);
            try {
              await onSetCrew(unit.id, n);
            } catch {
              /* el error se avisa con toast en la central */
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "…" : "Guardar"}
        </button>
      )}
    </span>
  );
}

// ------------------------------------------------------------------
// Tablero del parque de unidades (lista plana + inventario por unidad)
// ------------------------------------------------------------------

interface Props {
  units: UnitDTO[];
  incidents: IncidentDTO[];
  onSelectIncident: (id: number) => void;
  onSetStatus: (id: number, status: UnitStatus) => void;
  onUnitsChanged: () => void;
  onAddUnit: () => void;
  onRemoveUnit: (id: number) => Promise<void>;
  /** Cambiar la dotación (efectivos) de una unidad */
  onSetCrew: (id: number, crew: number) => Promise<void>;
}

export default function UnitsBoard({
  units,
  incidents,
  onSelectIncident,
  onSetStatus,
  onUnitsChanged,
  onAddUnit,
  onRemoveUnit,
  onSetCrew,
}: Props) {
  const [armedId, setArmedId] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);

  async function confirmRemove(id: number) {
    if (armedId !== id) {
      setArmedId(id);
      return;
    }
    setRemoving(true);
    try {
      await onRemoveUnit(id);
    } catch {
      /* el error se avisa con toast en la central */
    } finally {
      setRemoving(false);
      setArmedId(null);
    }
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[10.5px] font-bold tracking-[0.18em] text-mu2 uppercase">
          Parque de unidades <span>· {units.length}</span>
        </h3>
        <button className="btn btn-sm btn-blue shrink-0" onClick={onAddUnit} title="Registrar una unidad nueva">
          <Plus size={13} aria-hidden="true" /> Agregar unidad
        </button>
      </div>

      <div className="space-y-1.5">
        {units.map((u) => {
          const incident = u.incidentId ? incidents.find((i) => i.id === u.incidentId) : undefined;
          return (
            <article key={u.id} className="rounded border border-line bg-panel2 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="display flex min-w-0 items-center gap-1.5 text-[15px] font-bold">
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ background: `var(${STATUS_VAR[u.status]})` }}
                    title={UNIT_STATUS_META[u.status].label}
                  />
                  {u.code} <span className="text-mu">· {u.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="chip text-mu" style={{ color: "var(--mu)" }}>
                    {UNIT_TYPE_META[u.type].label}
                  </span>
                  <button
                    className={cx("btn btn-sm", armedId === u.id && "border-red/60 text-red")}
                    onClick={() => void confirmRemove(u.id)}
                    disabled={removing}
                    title={armedId === u.id ? "Confirmar: dar de baja la unidad" : "Dar de baja la unidad"}
                    aria-label={`Quitar unidad ${u.code}`}
                  >
                    {armedId === u.id ? "¿Quitar?" : <Trash size={12} aria-hidden="true" />}
                  </button>
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11.5px] text-mu">
                <span>{u.station ?? "Sin compañía"} ·</span>
                <CrewEditor key={`${u.id}-${u.crew}`} unit={u} onSetCrew={onSetCrew} />
              </div>
              {incident && (
                <button
                  className="mt-1.5 text-[11.5px] font-semibold text-blue hover:underline"
                  onClick={() => onSelectIncident(incident.id)}
                >
                  → Asignada a: {incident.title}
                </button>
              )}
              <div className="mt-2 flex items-center gap-1.5">
                <select
                  className="input py-1 text-[12px]"
                  value={u.status}
                  onChange={(e) => onSetStatus(u.id, e.target.value as UnitStatus)}
                  aria-label={`Estado de la unidad ${u.code}`}
                >
                  {(Object.keys(UNIT_STATUS_META) as UnitStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {UNIT_STATUS_META[s].label}
                    </option>
                  ))}
                </select>
                {u.status !== "disponible" && (
                  <button
                    className={cx("btn btn-sm btn-green shrink-0")}
                    onClick={() => onSetStatus(u.id, "disponible")}
                    title="Marcar unidad como disponible"
                  >
                    <Truck size={13} aria-hidden="true" /> Liberar
                  </button>
                )}
              </div>

              <UnitInventory unit={u} onChanged={onUnitsChanged} />
            </article>
          );
        })}
        {!units.length && (
          <p className="rounded border border-dashed border-line px-2 py-2 text-[11.5px] text-mu2">
            No hay unidades registradas. Usa «Agregar unidad» para incorporar la primera.
          </p>
        )}
      </div>
    </div>
  );
}
