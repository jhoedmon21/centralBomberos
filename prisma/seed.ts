// ============================================================
//  FuegoMap · Datos de ejemplo (Camaná, Arequipa, Perú)
//  Ejecutar:  npx prisma db seed
// ============================================================
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/passwords";

const prisma = new PrismaClient();

const minAgo = (m: number) => new Date(Date.now() - m * 60_000);

async function main() {
  console.log("🔥 Sembrando datos de FuegoMap (Camaná)…");

  // ---------- Limpieza (idempotente) ----------
  await prisma.dangerZone.deleteMany();
  await prisma.equipmentCheck.deleteMany();
  await prisma.missionReport.deleteMany();
  await prisma.operation.deleteMany();
  await prisma.pushSubscription.deleteMany();
  await prisma.appUser.deleteMany();
  await prisma.unitItem.deleteMany();
  await prisma.incidentEvent.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.hydrant.deleteMany();
  await prisma.riskPoint.deleteMany();
  await prisma.setting.deleteMany();

  // ---------- Unidades ----------
  // Se crean una a una para poder referenciar sus ids reales en los
  // incidentes (los autoincrementales no se reinician con deleteMany).
  const uAB = await prisma.unit.create({
    data: { code: "B-1", name: "AUTOBOMBA", type: "bomba", status: "en_escena", station: "Cía. Camaná Centro", crew: 5, lat: -16.6247, lng: -72.7095 },
  });
  const uAux1 = await prisma.unit.create({
    data: { code: "AUX-1", name: "AUXILIAR-1", type: "auxiliar", status: "disponible", station: "Cía. Samuel Pastor (La Pampa)", crew: 5, lat: -16.606, lng: -72.706 },
  });
  const uCis = await prisma.unit.create({
    data: { code: "C-1", name: "CISTERNA", type: "cisterna", status: "en_ruta", station: "Cía. José María Quimper (El Cardo)", crew: 3, lat: -16.6115, lng: -72.7365 },
  });
  const uRes = await prisma.unit.create({
    data: { code: "R-1", name: "RESCATE", type: "rescate", status: "disponible", station: "Cía. Camaná Sur", crew: 4, lat: -16.631, lng: -72.708 },
  });
  const uAmb = await prisma.unit.create({
    data: { code: "AMB-1", name: "AMBULANCIA", type: "ambulancia", status: "disponible", station: "SAMU Camaná — Hospital", crew: 3, lat: -16.6272, lng: -72.7075 },
  });
  const uAux2 = await prisma.unit.create({
    data: { code: "AUX-2", name: "AUXILIAR-2", type: "auxiliar", status: "disponible", station: "Comandancia Camaná", crew: 2, lat: -16.6252, lng: -72.712 },
  });

  // ---------- Inventario de materiales por unidad ----------
  await prisma.unitItem.createMany({
    data: [
      // Autobomba (B-1)
      { unitId: uAB.id, name: "Manguera 38 mm × 15 m", category: "manguera", quantity: 10, condition: "bueno" },
      { unitId: uAB.id, name: "Manguera 64 mm × 15 m", category: "manguera", quantity: 8, condition: "bueno" },
      { unitId: uAB.id, name: "Pitón universal 38/64 mm", category: "manguera", quantity: 4, condition: "bueno" },
      { unitId: uAB.id, name: "Llave de hidrante", category: "manguera", quantity: 2, condition: "bueno" },
      { unitId: uAB.id, name: "Extintor PQS 12 kg", category: "extintor", quantity: 2, condition: "bueno" },
      { unitId: uAB.id, name: "Hacha de bombero", category: "herramienta", quantity: 2, condition: "regular", notes: "Un mango con desgaste, programar reposición." },
      { unitId: uAB.id, name: "Barra de palanca", category: "herramienta", quantity: 1, condition: "bueno" },
      { unitId: uAB.id, name: "Motosierra", category: "herramienta", quantity: 1, condition: "bueno" },
      { unitId: uAB.id, name: "Casco F1 con visor", category: "epp", quantity: 6, condition: "bueno" },
      { unitId: uAB.id, name: "Chaquetón y pantalón de combate", category: "epp", quantity: 6, condition: "bueno" },
      { unitId: uAB.id, name: "Botas de jebe", category: "epp", quantity: 6, condition: "bueno" },
      { unitId: uAB.id, name: "Guantes de combate", category: "epp", quantity: 8, condition: "bueno" },
      { unitId: uAB.id, name: "Linterna portátil recargable", category: "equipo", quantity: 6, condition: "bueno" },
      { unitId: uAB.id, name: "Cuerda de rescate 30 m", category: "equipo", quantity: 2, condition: "bueno" },
      { unitId: uAB.id, name: "Escalera de extensión 8 m", category: "equipo", quantity: 1, condition: "bueno" },
      { unitId: uAB.id, name: "Radio portátil VHF", category: "comunicacion", quantity: 3, condition: "bueno" },

      // Auxiliar-1 (AUX-1)
      { unitId: uAux1.id, name: "Manguera 38 mm × 15 m", category: "manguera", quantity: 6, condition: "bueno" },
      { unitId: uAux1.id, name: "Manguera 64 mm × 15 m", category: "manguera", quantity: 4, condition: "regular", notes: "Dos tramos con fugas leves." },
      { unitId: uAux1.id, name: "Pitón universal 38/64 mm", category: "manguera", quantity: 2, condition: "bueno" },
      { unitId: uAux1.id, name: "Extintor PQS 12 kg", category: "extintor", quantity: 1, condition: "bueno" },
      { unitId: uAux1.id, name: "Hacha de bombero", category: "herramienta", quantity: 2, condition: "bueno" },
      { unitId: uAux1.id, name: "Equipo de protección completo", category: "epp", quantity: 4, condition: "bueno" },
      { unitId: uAux1.id, name: "Linterna portátil", category: "equipo", quantity: 4, condition: "bueno" },
      { unitId: uAux1.id, name: "Radio portátil VHF", category: "comunicacion", quantity: 2, condition: "bueno" },

      // Cisterna (C-1)
      { unitId: uCis.id, name: "Manguera 64 mm × 15 m", category: "manguera", quantity: 6, condition: "bueno" },
      { unitId: uCis.id, name: "Llave de hidrante", category: "manguera", quantity: 2, condition: "bueno" },
      { unitId: uCis.id, name: "Manguera de succión 4\"", category: "equipo", quantity: 2, condition: "bueno" },
      { unitId: uCis.id, name: "Extintor PQS 12 kg", category: "extintor", quantity: 1, condition: "bueno" },
      { unitId: uCis.id, name: "Hacha de bombero", category: "herramienta", quantity: 1, condition: "bueno" },
      { unitId: uCis.id, name: "Equipo de protección completo", category: "epp", quantity: 3, condition: "bueno" },
      { unitId: uCis.id, name: "Linterna portátil", category: "equipo", quantity: 2, condition: "bueno" },
      { unitId: uCis.id, name: "Radio portátil VHF", category: "comunicacion", quantity: 2, condition: "regular" },

      // Rescate (R-1)
      { unitId: uRes.id, name: "Quijada hidráulica (Jaws of Life)", category: "rescate", quantity: 1, condition: "bueno" },
      { unitId: uRes.id, name: "Cizalla hidráulica", category: "rescate", quantity: 1, condition: "bueno" },
      { unitId: uRes.id, name: "Cilindros de elevación neumática", category: "rescate", quantity: 2, condition: "bueno" },
      { unitId: uRes.id, name: "Cuerda kernmantle 50 m", category: "rescate", quantity: 2, condition: "bueno" },
      { unitId: uRes.id, name: "Arnés de rescate", category: "rescate", quantity: 4, condition: "bueno" },
      { unitId: uRes.id, name: "Camilla rígida de rescate", category: "rescate", quantity: 1, condition: "bueno" },
      { unitId: uRes.id, name: "Amoladora de corte", category: "herramienta", quantity: 1, condition: "regular", notes: "Disco próximo a vencer, reponer." },
      { unitId: uRes.id, name: "Hacha de rescate", category: "herramienta", quantity: 2, condition: "bueno" },
      { unitId: uRes.id, name: "Casco de rescate", category: "epp", quantity: 4, condition: "bueno" },
      { unitId: uRes.id, name: "Eslingas y mosquetones varios", category: "equipo", quantity: 6, condition: "bueno" },
      { unitId: uRes.id, name: "Radio portátil VHF", category: "comunicacion", quantity: 2, condition: "bueno" },

      // Ambulancia (AMB-1)
      { unitId: uAmb.id, name: "Desfibrilador externo automático (DEA)", category: "medico", quantity: 1, condition: "bueno" },
      { unitId: uAmb.id, name: "Balón de oxígeno 2 m³ con regulador", category: "medico", quantity: 2, condition: "bueno" },
      { unitId: uAmb.id, name: "Botiquín de primeros auxilios", category: "medico", quantity: 2, condition: "bueno" },
      { unitId: uAmb.id, name: "Collarín cervical ajustable", category: "medico", quantity: 3, condition: "bueno" },
      { unitId: uAmb.id, name: "Camilla telescópica", category: "medico", quantity: 1, condition: "bueno" },
      { unitId: uAmb.id, name: "Tablilla de inmovilización", category: "medico", quantity: 2, condition: "bueno" },
      { unitId: uAmb.id, name: "Tensiómetro y estetoscopio", category: "medico", quantity: 1, condition: "bueno" },
      { unitId: uAmb.id, name: "Radio portátil VHF", category: "comunicacion", quantity: 2, condition: "bueno" },

      // Auxiliar-2 (AUX-2)
      { unitId: uAux2.id, name: "Radio base móvil VHF", category: "comunicacion", quantity: 1, condition: "bueno" },
      { unitId: uAux2.id, name: "Radio portátil VHF", category: "comunicacion", quantity: 2, condition: "bueno" },
      { unitId: uAux2.id, name: "Chaleco reflectivo identificatorio", category: "epp", quantity: 4, condition: "bueno" },
      { unitId: uAux2.id, name: "Plano impreso de Camaná", category: "equipo", quantity: 3, condition: "regular", notes: "Actualizar con los hidrantes nuevos." },
      { unitId: uAux2.id, name: "Megáfono portátil", category: "equipo", quantity: 1, condition: "bueno" },
      { unitId: uAux2.id, name: "Binoculares", category: "equipo", quantity: 1, condition: "bueno" },
    ],
  });

  // ---------- Compartimentos del visor 3D ----------
  // Mapa por defecto: c1 ataque/mangueras · c2 herramientas/rescate ·
  // c3 EPP · c4 comunicaciones/medico/equipo general
  const COMPARTMENTS: Record<string, string> = {
    manguera: "c1",
    extintor: "c1",
    herramienta: "c2",
    rescate: "c2",
    epp: "c3",
    comunicacion: "c4",
    medico: "c4",
    equipo: "c4",
  };
  for (const [category, compartment] of Object.entries(COMPARTMENTS)) {
    await prisma.unitItem.updateMany({ where: { category }, data: { compartment } });
  }

  // ---------- Usuarios de la app (FuegoMap Unidades) ----------
  await prisma.appUser.createMany({
    data: [
      {
        email: "conductor@fuegomap.pe",
        passwordHash: hashPassword("bombero123"),
        name: "Conductor B-1",
        role: "unidad",
      },
      {
        email: "jefe@fuegomap.pe",
        passwordHash: hashPassword("bombero123"),
        name: "Jefe de Guardia",
        role: "jefe",
      },
    ],
  });

  // ---------- Zonas peligrosas para el tránsito de las unidades ----------
  // Tramos con curvas cerradas, pendientes o derrumbes: la app del vehículo
  // las dibuja en el mapa y avisa al conductor cuando la ruta pasa por ellas.
  const zone = (name: string, kind: string, level: string, advisory: string, coords: number[][]) => ({
    name,
    kind,
    level,
    advisory,
    path: JSON.stringify({ type: "LineString", coordinates: coords.map(([lat, lng]) => [lng, lat]) }),
  });
  await prisma.dangerZone.createMany({
    data: [
      zone(
        "Curvas de la Quebrada del Toro",
        "curvas",
        "alto",
        "Curvas cerradas en descenso — máx. 30 km/h, calzada angosta",
        [
          [-16.525, -71.475],
          [-16.545, -71.455],
          [-16.56, -71.435],
        ],
      ),
      zone(
        "Bajada a Ocoña — curvas del acantilado",
        "curvas",
        "alto",
        "Curvas con precipicio lateral — usar freno de motor, máx. 40 km/h",
        [
          [-16.455, -73.315],
          [-16.462, -73.335],
          [-16.466, -73.348],
        ],
      ),
      zone(
        "Curvas del descenso a Camaná (Panamericana Sur)",
        "curvas",
        "medio",
        "Curvas al bajar al valle — camiones lentos, mantener distancia",
        [
          [-16.575, -72.745],
          [-16.595, -72.735],
          [-16.612, -72.727],
        ],
      ),
      zone(
        "Tramo de derrumbes — Quebrada Seca (El Cardo)",
        "derrumbes",
        "medio",
        "Caída de rocas en temporada de lluvias — no detenerse en el tramo",
        [
          [-16.53, -72.77],
          [-16.52, -72.76],
        ],
      ),
      zone(
        "Cruce riesgoso — ingreso al malecón de Camaná",
        "cruce",
        "bajo",
        "Cruce con poca visibilidad — tocar bocina, ceder el paso",
        [
          [-16.633, -72.722],
          [-16.6345, -72.7235],
        ],
      ),
    ],
  });

  // ---------- Hidrantes ----------
  await prisma.hydrant.createMany({
    data: [
      { code: "H-01", lat: -16.622, lng: -72.712, pressure: "buena", diameter: 100, situation: "operativo" },
      { code: "H-02", lat: -16.6248, lng: -72.7088, pressure: "media", diameter: 100, situation: "operativo" },
      { code: "H-03", lat: -16.6268, lng: -72.707, pressure: "buena", diameter: 100, situation: "mantenimiento", notes: "Válvula dura; requiere lubricación." },
      { code: "H-04", lat: -16.6195, lng: -72.712, pressure: "buena", diameter: 150, situation: "operativo" },
      { code: "H-05", lat: -16.6285, lng: -72.7105, pressure: "media", diameter: 100, situation: "operativo" },
      { code: "H-06", lat: -16.6215, lng: -72.706, pressure: "baja", diameter: 75, situation: "mantenimiento", notes: "Pérdida de agua en la tapa superior." },
      { code: "H-07", lat: -16.6165, lng: -72.7085, pressure: "buena", diameter: 100, situation: "operativo" },
      { code: "H-08", lat: -16.63, lng: -72.715, pressure: "media", diameter: 100, situation: "operativo" },
      { code: "H-09", lat: -16.615, lng: -72.7135, pressure: "buena", diameter: 150, situation: "operativo" },
      { code: "H-10", lat: -16.6272, lng: -72.718, pressure: "media", diameter: 100, situation: "operativo" },
      { code: "H-11", lat: -16.6115, lng: -72.705, pressure: "buena", diameter: 100, situation: "operativo" },
      { code: "H-12", lat: -16.634, lng: -72.723, pressure: "baja", diameter: 75, situation: "fuera_servicio", notes: "Sin presión; en evaluación de reparación." },
    ],
  });

  // ---------- Puntos de riesgo ----------
  await prisma.riskPoint.createMany({
    data: [
      { name: "Mercado Central de Camaná", type: "mercado", level: "alto", lat: -16.6249, lng: -72.7085 },
      { name: "Grifo Panamericana Sur", type: "gasolinera", level: "alto", lat: -16.617, lng: -72.7135 },
      { name: "Zona de almacenes pesqueros", type: "industria", level: "alto", lat: -16.633, lng: -72.7225 },
      { name: "Terminal Terrestre de Camaná", type: "terminal", level: "medio", lat: -16.629, lng: -72.718 },
      { name: "I.E. del centro de Camaná", type: "colegio", level: "medio", lat: -16.6215, lng: -72.706 },
      { name: "Hospedajes del malecón", type: "turismo", level: "bajo", lat: -16.632, lng: -72.721 },
    ],
  });

  // ---------- Incidentes (con historia) ----------
  await prisma.incident.create({
    data: {
      title: "Incendio estructural",
      address: "Calle Comercio, a 2 cuadras de la Plaza de Armas, Camaná",
      lat: -16.6218,
      lng: -72.7089,
      severity: "alta",
      status: "reportado",
      source: "whatsapp",
      reporterName: "Ciudadano",
      reporterPhone: "+51988771221",
      photoUrl: "/evidencia-incendio.jpg",
      notes: "Humo negro en el segundo piso de una vivienda. Vecinos evacuados.",
      createdAt: minAgo(4),
      events: {
        create: [
          { type: "creado", message: "Reporte recibido por WhatsApp con ubicación en tiempo real", actor: "ciudadano", createdAt: minAgo(4) },
        ],
      },
    },
  });

  await prisma.incident.create({
    data: {
      title: "Incendio forestal",
      address: "Laderas del valle, margen del río Camaná",
      lat: -16.6002,
      lng: -72.6986,
      severity: "media",
      status: "en_escena",
      source: "whatsapp",
      reporterName: "Ciudadano",
      reporterPhone: "+51944322874",
      notes: "Vegetación seca junto a viviendas. Viento moderado.",
      createdAt: minAgo(64),
      dispatchAt: minAgo(60),
      arrivalAt: minAgo(41),
      unitId: uAB.id,
      events: {
        create: [
          { type: "creado", message: "Reporte recibido por WhatsApp", actor: "ciudadano", createdAt: minAgo(64) },
          { type: "despacho", message: "Unidad B-1 despachada por WhatsApp", actor: "operador", createdAt: minAgo(60) },
          { type: "llegada", message: "B-1 llegó a la escena", actor: "unidad", createdAt: minAgo(41) },
        ],
      },
    },
  });

  await prisma.incident.create({
    data: {
      title: "Rescate vehicular",
      address: "Panamericana Sur, frente al puente Camaná",
      lat: -16.6122,
      lng: -72.7146,
      severity: "media",
      status: "cerrado",
      source: "telefono116",
      reporterName: "Central 116",
      notes: "Colisión múltiple. Dos heridos atendidos, vía liberada.",
      createdAt: minAgo(180),
      dispatchAt: minAgo(176),
      arrivalAt: minAgo(170),
      closedAt: minAgo(90),
      events: {
        create: [
          { type: "creado", message: "Llamada de emergencia 116", actor: "ciudadano", createdAt: minAgo(180) },
          { type: "despacho", message: "Unidad R-1 despachada por WhatsApp", actor: "operador", createdAt: minAgo(176) },
          { type: "llegada", message: "R-1 llegó a la escena", actor: "unidad", createdAt: minAgo(170) },
          { type: "estado", message: "Incidente controlado", actor: "unidad", createdAt: minAgo(100) },
          { type: "cierre", message: "Incidente cerrado — vía liberada", actor: "operador", createdAt: minAgo(90) },
        ],
      },
    },
  });

  await prisma.incident.create({
    data: {
      title: "Fuga de gas",
      address: "Galería comercial frente a la Plaza de Armas, Camaná",
      lat: -16.623,
      lng: -72.71,
      severity: "critica",
      status: "despachado",
      source: "whatsapp",
      reporterName: "Ciudadano",
      reporterPhone: "+51990145233",
      photoUrl: "/evidencia-incendio.jpg",
      notes: "Olor a gas en galería comercial. Personal evacuado parcialmente.",
      createdAt: minAgo(13),
      dispatchAt: minAgo(9),
      unitId: uCis.id,
      events: {
        create: [
          { type: "creado", message: "Reporte recibido por WhatsApp con foto", actor: "ciudadano", createdAt: minAgo(13) },
          { type: "despacho", message: "Cisterna C-1 despachada por WhatsApp", actor: "operador", createdAt: minAgo(9) },
        ],
      },
    },
  });

  // ---------- Configuración ----------
  await prisma.setting.createMany({
    data: [
      { key: "wa_unit", value: "" },
      { key: "wa_central", value: "" },
      { key: "alert_sound", value: "1" },
      { key: "webhook_token", value: "fuegomap-verifica-2026" },
      { key: "webhook_log", value: "[]" },
    ],
  });

  const n = await prisma.incident.count();
  const u = await prisma.unit.count();
  const h = await prisma.hydrant.count();
  console.log(`✅ Listo: ${n} incidentes, ${u} unidades, ${h} hidrantes.`);
  console.log("   Accede a la central con:  npm run dev");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
