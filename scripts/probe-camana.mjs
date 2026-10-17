// Sondeo del terreno real de OpenStreetMap en el centro de Camaná.
// ¿Hay datos OSM allí en absoluto? ¿Qué hay etiquetado?
// Uso: node scripts/probe-camana.mjs

const UA = "FuegoMap-Hydrant-Importer/1.0 (central de bomberos Camana; central@fuegomap.pe)";
const bbox = "-72.75,-16.64,-72.68,-16.60"; // oeste,sur,este,norte (el API de OSM usa lon,lat)

const res = await fetch(`https://api.openstreetmap.org/api/0.6/map.json?bbox=${bbox}`, {
  headers: { "User-Agent": UA },
  signal: AbortSignal.timeout(60_000),
});
console.log("HTTP", res.status);
const data = await res.json();
if (data.error) {
  console.log("API error:", JSON.stringify(data).slice(0, 300));
  process.exit(0);
}
const els = data.elements ?? [];
const byType = {};
for (const el of els) byType[el.type] = (byType[el.type] ?? 0) + 1;
console.log("Elementos crudos en la caja:", els.length, byType);

const tagged = els.filter((e) => e.tags);
console.log("Elementos con etiquetas:", tagged.length);
const hydrants = tagged.filter(
  (e) => e.tags.emergency === "fire_hydrant" || e.tags.man_made === "fire_hydrant",
);
console.log("Hidrantes:", hydrants.length);

console.log("\nMuestra de lo que sí está etiquetado (primeros 20):");
for (const t of tagged.slice(0, 20)) {
  console.log(`  ${t.type}/${t.id}  ${JSON.stringify(t.tags).slice(0, 110)}`);
}
