// probe-sse-public.mjs — e2e del canal PÚBLICO de alertas (bomberos sin clave):
// 1) /api/app/alerts sin cookies → 200
// 2) /api/app/events → hello
// 3) crear emergencia de prueba → el evento "incident" llega por SSE público
// 4) la emergencia aparece en las alertas públicas
// 5) cerrarla → evento de actualización por SSE y sale de las alertas
//
// Uso: node scripts/probe-sse-public.mjs [base=http://localhost:3000]

import { setTimeout as sleep } from "node:timers/promises";

const base = process.argv[2] ?? "http://localhost:3000";
const pass = [];
const fail = [];
const ok = (c, msg) => (c ? pass.push(msg) : fail.push(msg), console.log(c ? `  ✓ ${msg}` : `  ✗ ${msg}`));

// ---------- 1) Alertas sin cookies ----------
const r0 = await fetch(`${base}/api/app/alerts`);
const a0 = await r0.json();
ok(r0.status === 200, `GET /api/app/alerts sin cookies → HTTP ${r0.status}`);
ok(Array.isArray(a0.incidents) && Array.isArray(a0.hydrants), `${a0.incidents.length} emergencias · ${a0.hydrants.length} hidrantes · ${a0.dangerZones.length} zonas`);

// ---------- 2) SSE público ----------
const sse = await fetch(`${base}/api/app/events`, { headers: { Accept: "text/event-stream" } });
ok(sse.status === 200 && (sse.headers.get("content-type") ?? "").includes("text/event-stream"), `SSE público → HTTP ${sse.status} (${sse.headers.get("content-type")})`);

const events = [];
const reader = sse.body.getReader();
const dec = new TextDecoder();
const pump = (async () => {
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buf += dec.decode(value, { stream: true });
    for (;;) {
      const i = buf.indexOf("\n\n");
      if (i === -1) break;
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      for (const line of block.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        try {
          events.push(JSON.parse(line.slice(6)));
        } catch {
          /* ignorar */
        }
      }
    }
  }
})();

let t = Date.now();
while (!events.some((e) => e.type === "hello") && Date.now() - t < 6000) await sleep(100);
ok(events.some((e) => e.type === "hello"), "canal público abrió con «hello»");

// ---------- 3) Crear emergencia de prueba ----------
const created = await fetch(`${base}/api/incidents`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: "[PRUEBA] Alerta pública",
    address: "Plaza de Armas, Camaná",
    lat: -16.6215,
    lng: -72.711,
    severity: "leve",
    source: "manual",
    notes: "creada por probe-sse-public, se cierra sola",
  }),
});
const inc = (await created.json())?.incident;
ok(created.status === 201 && inc?.id, `creada INC-${inc?.id} (HTTP ${created.status})`);

let evt = null;
t = Date.now();
while (Date.now() - t < 8000) {
  evt = events.find((e) => e.type === "incident" && e.id === inc?.id && e.action === "created");
  if (evt) break;
  await sleep(100);
}
const ms = evt ? Date.now() - t : 0;
ok(Boolean(evt), `evento «incident created» por SSE público${evt ? ` (${ms} ms tras crear)` : ""}`);

// ---------- 4) Visible en alertas públicas ----------
await sleep(400);
const a1 = await (await fetch(`${base}/api/app/alerts`)).json();
ok(a1.incidents.some((i) => i.id === inc?.id), `INC-${inc?.id} aparece en las alertas públicas (${a1.incidents.length} activas)`);
const basic = a1.incidents.find((i) => i.id === inc?.id);
ok(basic !== undefined && !("reporterPhone" in (basic ?? {})), "payload público: sin reporterPhone (datos sensibles fuera)");

// ---------- 5) Cerrar ----------
const rC = await fetch(`${base}/api/incidents/${inc.id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ status: "cerrado" }),
});
ok(rC.status === 200, `cierre de INC-${inc?.id} → HTTP ${rC.status}`);

let evtU = null;
t = Date.now();
while (Date.now() - t < 8000) {
  evtU = events.find((e) => e.type === "incident" && e.id === inc?.id && e.action === "updated");
  if (evtU) break;
  await sleep(100);
}
ok(Boolean(evtU), "evento «incident updated» por SSE público al cerrar");

await sleep(400);
const a2 = await (await fetch(`${base}/api/app/alerts`)).json();
ok(!a2.incidents.some((i) => i.id === inc?.id), `INC-${inc?.id} salió de las alertas (${a2.incidents.length} activas)`);

await reader.cancel().catch(() => {});
await sleep(150);
await pump.catch(() => {});

console.log(`\nRESULTADO: ${pass.length} ✓ / ${fail.length} ✗`);
process.exit(fail.length ? 1 : 0);
