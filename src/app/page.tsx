import { Suspense } from "react";
import { connection } from "next/server";
import BootScreen from "@/components/BootScreen";
import CommandCenter, { type InitialData } from "@/components/CommandCenter";
import {
  getActivity,
  getSettings,
  getStats,
  listHydrants,
  listIncidents,
  listRisks,
  listUnits,
} from "@/lib/queries";

// Los datos de la central son en vivo: se cargan en tiempo de petición y
// se transmiten tras el cascarón estático (Suspense) — Cache Components (Next 16).
async function CommandCenterLoader() {
  await connection();

  const [incidents, units, hydrants, risks, activity, stats, settings] = await Promise.all([
    listIncidents(),
    listUnits(),
    listHydrants(),
    listRisks(),
    getActivity(40),
    getStats(),
    getSettings(),
  ]);

  const initial: InitialData = { incidents, units, hydrants, risks, activity, stats, settings };
  return <CommandCenter initial={initial} />;
}

export default function Home() {
  return (
    <Suspense fallback={<BootScreen />}>
      <CommandCenterLoader />
    </Suspense>
  );
}
