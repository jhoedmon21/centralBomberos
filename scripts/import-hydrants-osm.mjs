// ============================================================
//  Crawler de hidrantes de Camaná → FuegoMap
//  Fuente: OpenStreetMap (Overpass API) — datos abiertos, sin API key.
//  Busca nodos `emergency=fire_hydrant` dentro de la caja de Camaná,
//  mapea sus atributos al modelo de la app y los importa a la base
//  (idempotente: re-ejecutar no duplica).
//
//  Uso:
//    npm run import:hydrants                 # importa (por defecto)
//    npm run import:hydrants -- --dry-run    # solo lista lo que encuentra
//    npm run import:hydrants -- --bbox S,O,N,E
// ============================================================

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Caja de Camaná (sur, oeste, norte, este): de Ocoña por el norte hasta
// debajo de Camaná, del mar a los distritos del interior.
const DEFAULT_BBOX = "-16.85,-73.45,-16.35,-72.55";

// Servidores Overpass con respaldo (se prueban en orden; kumi es el más rápido)
const OVERPASS_ENDPOINTS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

// Identificación ante Overpass (etiqueta del servicio) — sin esto responde 406
const USER_AGENT =
  "FuegoMap-Hydrant-Importer/1.0 (central de bomberos Camana; central@fuegomap.pe)";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const bboxIdx = args.indexOf("--bbox");
const bbox = bboxIdx !== -1 && args[bboxIdx + 1] ? args[bboxIdx + 1] : DEFAULT_BBOX;
const srcIdx = args.indexOf("--source");
const forcedSource = srcIdx !== -1 && args[srcIdx + 1] ? args[srcIdx + 1] : undefined; // "osmapi" fuerza la vía cruda

const QUERY = `[out:json][timeout:90];
(
  node["emergency"="fire_hydrant"](${bbox});
  node["man_made"="fire_hydrant"](${bbox});
);
out body;`;

async function fetchOverpass() {
  const body = "data=" + encodeURIComponent(QUERY);
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
        body,
        signal: AbortSignal.timeout(90_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.elements ?? [];
    } catch (e) {
      console.warn(`⚠ ${new URL(endpoint).host} falló: ${e instanceof Error ? e.message : e}`);
    }
  }
  throw new Error("Ningún servidor de Overpass respondió. Revisa la conexión e intenta de nuevo.");
}

/** Vía 2 (respaldo): API cruda de OSM — para cuando Overpass está caído.
 *  Descarga el mapa completo en celdas de ~0.2° y filtra hidrantes localmente. */
async function fetchOsmApi(box) {
  const [S, W, N, E] = box.split(",").map(Number);
  if ([S, W, N, E].some((v) => !Number.isFinite(v))) throw new Error(`Caja inválida: ${box}`);
  const STEP = 0.2; // el API de OSM rechaza cajas mayores a ~0.25° por lado
  const ids = new Set();
  const elements = [];
  for (let lat = S; lat < N; lat += STEP) {
    for (let lon = W; lon < E; lon += STEP) {
      const s = lat, w = lon, n = Math.min(lat + STEP, N), e = Math.min(lon + STEP, E);
      const url = `https://api.openstreetmap.org/api/0.6/map.json?bbox=${w},${s},${e},${n}`; // lon,lat: orden del API de OSM
      try {
        const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(60_000) });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status} ${body.slice(0, 160)}`);
        }
        const data = await res.json();
        for (const el of data.elements ?? []) {
          const key = `${el.type}/${el.id}`;
          if (!ids.has(key)) { ids.add(key); elements.push(el); }
        }
      } catch (e) {
        console.warn(`⚠ celda (${s.toFixed(2)}, ${w.toFixed(2)}) falló: ${e instanceof Error ? e.message : e}`);
      }
      await new Promise((r) => setTimeout(r, 700)); // amabilidad con el API público
    }
  }
  return elements;
}

/** ¿Es un nodo hidrante? (Overpass ya trae filtrados; el API cruda trae de todo) */
function isHydrantNode(el) {
  const tags = el.tags ?? {};
  return tags.emergency === "fire_hydrant" || tags.man_made === "fire_hydrant";
}

/** Atributos OSM → modelo de la app */
function mapHydrant(node) {
  const tags = node.tags ?? {};
  const parts = [];
  if (tags.ref) parts.push(`ref ${tags.ref}`);
  if (tags["fire_hydrant:type"]) parts.push(`tipo ${tags["fire_hydrant:type"]}`);
  if (tags["fire_hydrant:position"]) parts.push(`posición ${tags["fire_hydrant:position"]}`);
  if (tags["fire_hydrant:pressure"]) parts.push(`presión ${tags["fire_hydrant:pressure"]}`);
  if (tags["survey:date"]) parts.push(`verificado ${tags["survey:date"]}`);

  // Diámetro: solo si es un número razonable en mm
  let diameter = null;
  const rawDiameter = Number(String(tags["fire_hydrant:diameter"] ?? "").replace(/[^\d.]/g, ""));
  if (Number.isFinite(rawDiameter) && rawDiameter >= 25 && rawDiameter <= 300) {
    diameter = Math.round(rawDiameter);
  }

  // Presión en bar → escala de la app (solo si el dato existe)
  let pressure = null;
  const rawPressure = Number(String(tags["fire_hydrant:pressure"] ?? "").replace(/[^\d.]/g, ""));
  if (Number.isFinite(rawPressure) && rawPressure > 0) {
    pressure = rawPressure >= 5 ? "buena" : rawPressure >= 3 ? "media" : "baja";
  }

  // Fuera de servicio si OSM lo marca como abandonado/retirado
  const situation =
    tags["disused:emergency"] === "fire_hydrant" || tags.abandoned === "yes"
      ? "fuera_servicio"
      : "operativo";

  return {
    code: `OSM-${node.id}`, // estable entre ejecuciones → importación idempotente
    lat: node.lat,
    lng: node.lon,
    pressure,
    diameter,
    situation,
    notes: ["OpenStreetMap (importado " + new Date().toISOString().slice(0, 10) + ")", ...parts]
      .join(" · ")
      .slice(0, 300),
  };
}

async function main() {
  console.log("🔥 Crawler de hidrantes · Camaná → FuegoMap");
  console.log(`   Caja (S,O,N,E): ${bbox}`);
  let rawNodes;
  if (forcedSource === "osmapi") {
    const elements = await fetchOsmApi(bbox);
    rawNodes = elements.filter((el) => el.type === "node" && isHydrantNode(el) && Number.isFinite(el.lat) && Number.isFinite(el.lon));
    console.log(`   Fuente: api.openstreetmap.org ✓ (${rawNodes.length} hidrantes)`);
  } else {
    try {
      const elements = await fetchOverpass();
      rawNodes = elements.filter((el) => el.type === "node" && Number.isFinite(el.lat) && Number.isFinite(el.lon));
      console.log(`   Fuente: Overpass ✓ (${rawNodes.length} nodos)`);
    } catch (eOverpass) {
      console.warn(`⚠ Overpass indisponible (${eOverpass instanceof Error ? eOverpass.message : eOverpass}). Usando el API cruda de OSM como respaldo…`);
      const elements = await fetchOsmApi(bbox);
      rawNodes = elements.filter((el) => el.type === "node" && isHydrantNode(el) && Number.isFinite(el.lat) && Number.isFinite(el.lon));
      console.log(`   Fuente: api.openstreetmap.org ✓ (${rawNodes.length} hidrantes)`);
    }
  }
  const hydrants = rawNodes.map(mapHydrant);

  console.log(`\nEncontrados en OpenStreetMap: ${hydrants.length}`);
  if (hydrants.length === 0) {
    console.log(
      "\nNo hay hidrantes mapeados en OSM dentro de esa caja todavía.\n" +
        "Opciones:\n" +
        "  · Amplía el área:  npm run import:hydrants -- --bbox -17.0,-73.5,-15.5,-71.0\n" +
        "  · Regístralos en campo con la app de la tablet (Hidrantes → Nuevo, GPS automático)\n" +
        "  · Si conoces las ubicaciones reales, agrégalas desde la central (Hidrantes → Nuevo)",
    );
    return;
  }

  // Resumen de lo encontrado
  for (const h of hydrants.slice(0, 50)) {
    console.log(
      `   ${h.code.padEnd(12)} (${h.lat.toFixed(5)}, ${h.lng.toFixed(5)})  Ø${h.diameter ?? "?"}mm  ${h.situation}${h.notes ? "  · " + h.notes : ""}`,
    );
  }
  if (hydrants.length > 50) console.log(`   … y ${hydrants.length - 50} más`);

  if (dryRun) {
    console.log("\n(dry-run: nada se importó. Ejecuta sin --dry-run para cargarlos a la app.)");
    return;
  }

  // Importar (upsert por código OSM-<id>: re-ejecutar no duplica)
  let created = 0;
  let updated = 0;
  for (const h of hydrants) {
    const existing = await prisma.hydrant.findUnique({ where: { code: h.code } });
    await prisma.hydrant.upsert({ where: { code: h.code }, update: h, create: h });
    existing ? updated++ : created++;
  }
  console.log(`\n✓ Importación completa: ${created} nuevos, ${updated} actualizados.`);
  console.log("  Refresca la central (F5) y la tablet (Ajustes → Sincronizar) para verlos.");
}

main()
  .catch((e) => {
    console.error("✗", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
