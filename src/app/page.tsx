// Central CAD — puerta de sesión: sin cookie de operador válida se
// presenta el login; con ella entra el tablero completo. La lectura
// de la sesión acontece en el servidor (cookies()); el shell sigue
// siendo estático detrás del Suspense.

import { Suspense } from "react";
import { connection } from "next/server";
import { cookies } from "next/headers";
import BootScreen from "@/components/BootScreen";
import OperatorLogin from "@/components/OperatorLogin";
import CommandCenter, { type InitialData } from "@/components/CommandCenter";
import { OPERATOR_COOKIE, verifyOperatorToken } from "@/lib/optoken";
import { prisma } from "@/lib/db";
import {
  getActivity,
  getSettings,
  getStats,
  listHydrants,
  listIncidents,
  listPreplans,
  listRisks,
  listUnits,
} from "@/lib/queries";
import type { OperatorDTO } from "@/lib/types";

/**
 * Cola de la petición: sesión (cookie) comprueba el rol vigente en la
 * BD; guarda `null` cuando no hay sesión de CAD o el operador está inactivo.
 */
async function sessionOperator(): Promise<OperatorDTO | null> {
  const token = (await cookies()).get(OPERATOR_COOKIE)?.value;
  const payload = await verifyOperatorToken(token);
  if (!payload) return null;
  const op = await prisma.operatorUser.findUnique({
    where: { id: payload.uid },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  if (!op || !op.active) return null;
  return { id: op.id, name: op.name, email: op.email, role: op.role as OperatorDTO["role"] };
}

async function CentralGate() {
  await connection();

  const op = await sessionOperator();
  // Sin sesión: pantalla de ingreso (cliente) — el shell estático ya mostró el BootScreen
  if (!op) return <OperatorLogin />;

  const [incidents, units, hydrants, risks, activity, stats, settings, preplans] = await Promise.all([
    listIncidents(),
    listUnits(),
    listHydrants(),
    listRisks(),
    getActivity(40),
    getStats(),
    getSettings(),
    listPreplans(),
  ]);

  const initial: InitialData & { preplans: typeof preplans } = {
    incidents,
    units,
    hydrants,
    risks,
    activity,
    stats,
    settings,
    preplans,
  };
  return <CommandCenter initial={initial} op={op} />;
}

export default function Home() {
  return (
    <Suspense fallback={<BootScreen />}>
      <CentralGate />
    </Suspense>
  );
}
