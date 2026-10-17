// Sonda: ¿qué servicios de datos OSM responden desde esta red?
// Uso: node scripts/probe-osm.mjs

const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.osm.jp/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

const UA = "FuegoMap-Hydrant-Importer/1.0 (central de bomberos Camana; central@fuegomap.pe)";
const QUERY = `[out:json][timeout:25];node["emergency"="fire_hydrant"](-16.75,-72.85,-16.5,-72.55);out body;`;

async function probeOverpass(url) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
      body: "data=" + encodeURIComponent(QUERY),
      signal: AbortSignal.timeout(90_000),
    });
    const ms = Date.now() - t0;
    if (!res.ok) return `${res.status} (${ms}ms)`;
    const data = await res.json();
    return `OK — ${data.elements?.length ?? 0} elementos (${ms}ms)`;
  } catch (e) {
    return `falló: ${e instanceof Error ? e.message : e}`;
  }
}

async function probeOsmApi() {
  const t0 = Date.now();
  try {
    const res = await fetch(
      "https://api.openstreetmap.org/api/0.6/map.json?bbox=-16.64,-72.75,-16.60,-72.68",
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(90_000) },
    );
    const ms = Date.now() - t0;
    if (!res.ok) return `HTTP ${res.status} (${ms}ms)`;
    const data = await res.json();
    const hydrants = (data.elements ?? []).filter(
      (el) => el.type === "node" && el.tags?.["emergency"] === "fire_hydrant",
    );
    return `OK — ${data.elements?.length ?? 0} elementos crudos, ${hydrants.length} hidrantes (${ms}ms)`;
  } catch (e) {
    return `falló: ${e instanceof Error ? e.message : e}`;
  }
}

console.log("Sonda de servicios OSM\n=======================\n");
for (const url of OVERPASS) {
  const name = new URL(url).host;
  console.log(`Overpass ${name.padEnd(34)} → ${await probeOverpass(url)}`);
}
console.log(`API cruda api.openstreetmap.org        → ${await probeOsmApi()}`);
