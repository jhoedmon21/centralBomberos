"use client";

// Icono del TIPO de emergencia — el mismo lenguaje de pines del mapa
// (MapView), reutilizado en la cola de reportes y el detalle para que el
// operador reconozca el tipo de un vistazo en toda la central.

import type { Icon } from "@phosphor-icons/react";
import {
  Ambulance,
  Car,
  CloudRain,
  FireExtinguisher,
  Flame,
  HardHat,
  Lifebuoy,
  Lightning,
  PawPrint,
  Siren,
  Tree,
} from "@phosphor-icons/react";

const INCIDENT_TYPE_ICONS: Array<[RegExp, Icon]> = [
  [/incendio|fuego|forestal|quemad/i, Flame],
  [/gas|glp|explosiv|granada|munic/i, FireExtinguisher],
  [/vehicular|colisi|choque|volcad|atropell|volque/i, Car],
  [/m[eé]dic|salud|lesion|paciente|ambulancia|infarto/i, Ambulance],
  [/derrumbe|colapso|demolici|construcc/i, HardHat],
  [/el[eé]ctric|cable|poste|tensi|alta tensi/i, Lightning],
  [/inundac|huaico|huayco|lluvia|ribera|r[ií]o|crecida/i, CloudRain],
  [/[aá]rbol|rama|ca[ií]da de [aá]rbol/i, Tree],
  [/animal|serpie|abej|avispa|perro|gato/i, PawPrint],
  [/rescate|atrapad|encerrad|ascensor/i, Lifebuoy],
];

interface Props {
  title: string;
  size?: number;
  weight?: "fill" | "regular" | "bold";
  className?: string;
}

export default function IncidentIcon({ title, size = 14, weight = "fill", className }: Props) {
  let Icon: Icon = Siren; // genérica: cualquier otro reporte
  for (const [re, ic] of INCIDENT_TYPE_ICONS) {
    if (re.test(title)) {
      Icon = ic;
      break;
    }
  }
  return <Icon size={size} weight={weight} className={className} aria-hidden="true" />;
}
