# 🔥 FuegoMap Admin · Central de Mando GIS

Central de operaciones para bomberos: los ciudadanos reportan emergencias por **WhatsApp** (texto, foto y ubicación en vivo) y la central despacha **unidades** con ruta y **hidrantes cercanos** sobre un mapa real. Las tablets de los vehículos reciben los despachos con la PWA hermana **FuegoMap Unidades** (`../unidades`).

> Evolución del prototipo `Firewaze · Central de Mando GIS.html` (HTML único con SVG estático) a una aplicación full-stack con React, base de datos y tiempo real.

![Flujo del sistema](public/img/sistema-fuegomap.jpg)

## ✨ Funcionalidades

- **Recepción de reportes por WhatsApp** — texto, **ubicación en tiempo real** y **fotos**: los mensajes del mismo teléfono se unen al reporte abierto reciente (una foto o una ubicación suelta no crean otro incidente) y las imágenes se descargan con el token de Meta y quedan como **evidencia** del incidente. Modo demo integrado (`Simular reporte`) + webhook real listo para la WhatsApp Cloud API de Meta.
- **Registro manual con búsqueda de dirección** — en *Nuevo reporte* escribe la dirección y pulsa **Buscar** (o Enter): la búsqueda de direcciones (OpenStreetMap · Nominatim, sin API key) devuelve coincidencias reales con sus coordenadas y, al elegir una, **fija la ubicación sola**; también puedes fijarla en el mapa o usar tu ubicación actual. El reporte se puede **editar después** (tipo, dirección, severidad, ubicación, notas y foto) y cada cambio queda registrado en la bitácora del incidente; al editar, la **ventana es arrastrable** y no bloquea el mapa: haz clic en una calle para corregir la ubicación sin cerrarla.
- **Mapa real (MapLibre GL + mapcn)** — muestra **solo los incidentes en curso** (si seleccionas uno de la cola *Historial*/*Todos*, ese aparece también para ubicarlo): incidentes con **direcciones visibles** (capa *Direcciones*), unidades, hidrantes, puntos de riesgo (grifos, colegios, mercados), **tráfico y zonas problemáticas** (Waze en vivo, visor embebido sin key), **terremotos recientes** (USGS: M ≥ 2.5 · últimos 7 días · ≤ 700 km de Camaná) y radio de seguridad de 300 m con líneas a los 3 hidrantes más cercanos. **Registro de hidrantes** con ventana arrastrable (se ubica con clics en el mapa, sin cerrarla) y **foto de la boca**; **situación** por hidrante (operativo / en mantenimiento / fuera de servicio; el marcador cambia de color). **Mini-mapa de hidrantes** en el detalle del incidente (escena + radio de 300 m + líneas a los 3 más cercanos). Tiles vectoriales **sin API key** (OpenFreeMap, datos OpenStreetMap): estilo *dark* (tema oscuro) y *positron* (tema claro), con nombres de calles nítidos a cualquier nivel de zoom.
- **Despacho multi-unidad** — elige **una o varias** unidades con casillas (recomendación de la más cercana disponible) y mensaje de WhatsApp pre-armado con: dirección, coordenadas, **pin de ubicación** (Google Maps), ruta táctica, **foto del reporte**, lista de hidrantes con distancia y presión, y **mapa estático de la escena + hidrantes** (Yandex, sin API key). Cada unidad recibe la misión (push a su tablet) y **acepta por su lado**. Se pueden pedir **refuerzos** mientras el incidente esté despachado o en escena: las unidades ya en misión quedan fijas y solo se suman nuevas. **Solo la central despacha**; las tablets de las unidades reciben, aceptan y actualizan estado, pero no pueden generar despachos. El diálogo muestra la vista previa del mensaje y del mapa antes de confirmar. El botón **«Ruta»** del detalle traza la **ruta vial en el mapa de la central** (OSRM sin key) desde el punto de salida del despacho o el cuartel B-35, con distancia y ETA — sin abrir Google Maps. En el tablero de unidades cada unidad edita su **dotación (efectivos)** en línea.
- **Tiempo real (SSE)** — nuevos reportes, cambios de estado, despachos y configuración se propagan al instante a todas las pantallas conectadas.
- **Alarma sonora** (WebAudio) para nuevos reportes, con interruptor en la barra superior.
- **Parte de emergencia (PDF)** — el botón **«Parte PDF»** del detalle abre `/informe/[id]`: documento A4 con datos del incidente, unidades intervinientes (con horario de despacho y aceptación), evidencia fotográfica, hidrantes de la zona, notas del operador y **bitácora completa**, listo para **imprimir o guardar como PDF** desde el navegador (sin dependencias externas) y con líneas de firma para el jefe de guardia y el operador.

- **Máquina de estados** del incidente: `reportado → despachado → en_escena → controlado → cerrado`, con bitácora completa (timeline) por incidente.
- **Bandeja de incidentes** priorizada por severidad y **panel de unidades** en lista plana con estado, **alta/baja de unidades** desde la central e **inventario de materiales por unidad** (mangueras, extintores, herramientas, rescate, médico, comunicaciones, EPP… con cantidad y condición, y opción de agregar/quitar).
- **Estadísticas del día** — activos, tiempos de respuesta promedio, unidades disponibles.
- **Tema oscuro táctico por defecto** y tema claro con selector; diseño «sala de operaciones» refinado (grafito azulado, rojo reservado a emergencias, ámbar para controles) y mapa despejado con un botón único de «Capas» (capas tácticas + leyenda de estados).
- **Configuración** desde la UI — números de WhatsApp de la unidad y la central, **URL pública** para los enlaces compartidos (foto y mapa abren desde los teléfonos), sonido y tokens del webhook/Meta.

## 🧰 Stack

| Capa | Tecnología |
| --- | --- |
| Framework | Next.js 16 (App Router, Cache Components, Turbopack) |
| UI | React 19 · Tailwind CSS v4 · @phosphor-icons/react · sonner |
| Mapa | MapLibre GL 6 + componentes mapcn (tiles vectoriales OpenFreeMap · datos OSM, sin credenciales) |
| Datos | Prisma 6 + SQLite (migrable a PostgreSQL) |
| Tiempo real | SSE (`/api/events`) con bus en memoria |
| Tipografía | Barlow / Barlow Condensed (next/font) |

## 🚀 Puesta en marcha

Requisitos: Node.js ≥ 20.

> **Windows:** también puedes iniciar todo con doble clic en **`iniciar-central.cmd`** (enciende el servidor y abre el navegador solo). Mantén la ventana negra abierta mientras usas la app; al cerrarla, la central se apaga.

```bash
cd firewaze
npm install

# Variables de entorno (ya incluye valores por defecto)
# .env → DATABASE_URL="file:./dev.db"  y  WA_VERIFY_TOKEN="..."

# Crear la base de datos y sembrar datos de demo (Camaná)
npm run db:migrate     # aplica migraciones
npm run db:seed        # 4 incidentes, 6 unidades, 12 hidrantes

npm run dev            # http://localhost:3000
```

### Scripts

| Script | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm run start` | Compilar / servir producción |
| `npm run db:migrate` | Crear/aplicar migraciones de Prisma |
| `npm run db:seed` | Sembrar datos demo |
| `npm run db:studio` | Explorar la base de datos (Prisma Studio) |
| `npm run db:reset` | Borrar, re-migrar y re-sembrar |

## 🏗️ Arquitectura

```
src/
├── app/
│   ├── page.tsx              # carga inicial (Suspense) → CommandCenter
│   ├── layout.tsx            # fuentes, tema pre-paint, toasts
│   └── api/                  # REST + SSE
│       ├── incidents/        # GET, POST · [id]: GET, PATCH · [id]/dispatch: POST
│       ├── units/, hydrants/, risks/, stats/, activity/, settings/
│       ├── simulate/         # POST: genera un reporte ciudadano demo
│       ├── events/           # GET: flujo SSE de eventos en vivo
│       └── whatsapp/webhook/ # GET verificación Meta · POST mensajes entrantes
├── components/               # CommandCenter (orquestador) + paneles y diálogos
├── hooks/                    # useLiveFeed (SSE + reconexión), useClock
└── lib/
    ├── queries.ts            # TODA la lógica de negocio (crear, despachar, transiciones, ingesta)
    ├── bus.ts                # bus de eventos en memoria para SSE
    ├── wa.ts                 # plantillas de mensajes y enlaces wa.me / Google Maps
    ├── geo.ts                # distancias haversine, hidrantes más cercanos
    ├── meta.ts               # metadatos de estados/severidades (color, icono, etiqueta)
    ├── alarm.ts              # alarma WebAudio
    └── traffic.ts            # tráfico/alertas: tipos, colores y fuente Waze en vivo
prisma/
├── schema.prisma             # Incident, Unit, Hydrant, RiskPoint, IncidentEvent, Setting,
│                             # AppUser, PushSubscription, Operation, MissionReport, EquipmentCheck
└── seed.ts                   # datos de demo (Camaná, Perú) + usuarios de la app
```

Flujo principal: **ciudadano → WhatsApp → webhook/ingesta → incidente + evento SSE → central despacha → mensaje wa.me con ruta + hidrantes + push a la tablet (FuegoMap Unidades) → unidad acepta/actualiza estado → bitácora**.

## 🔌 API

| Método y ruta | Descripción |
| --- | --- |
| `GET /api/incidents` | Lista de incidentes |
| `POST /api/incidents` | Crear reporte (`{ title, address, lat, lng, severity, ... }`) |
| `GET /api/incidents/[id]` | Detalle con bitácora |
| `PATCH /api/incidents/[id]` | Editar el reporte (datos, foto) o cambiar `status`, `severity`, `notes` |
| `POST /api/incidents/[id]/dispatch` | Despachar una o varias unidades (`{ unitIds: number[] }`; `unitId` suelto por compat). Admite refuerzos con el incidente en `despachado`/`en_escena`. **Solo la central** |
| `GET /api/units` · `POST /api/units` | Lista y alta de unidades |
| `PATCH /api/units/[id]` · `DELETE /api/units/[id]` | Cambiar estado, dotación o ubicación (`lat`/`lng`) / dar de baja una unidad |
| `GET/POST /api/units/[id]/items` · `PATCH/DELETE /api/unit-items/[id]` | Inventario de materiales por unidad |
| `GET /api/hydrants` · `POST /api/hydrants` · `PATCH /api/hydrants/[id]` | Hidrantes: listar, registrar y cambiar situación |
| `GET /api/risks` | Puntos de riesgo |
| `GET /api/traffic` | Tráfico en vivo Waze (Google) sin key; `source: "none"` si la red lo bloquea |
| `GET /api/quakes` | Terremotos recientes (USGS, sin key; M ≥ 2.5, 7 días, ≤ 700 km de Camaná) |
| `GET /api/route?from=&to=` | Ruta vial entre dos puntos (OSRM público, sin key; línea recta si OSRM no responde) |
| `GET /api/geocode?q=` | Buscar direcciones (Nominatim/OSM, sin key; sesgado a Camaná) |
| `GET /api/media/[name]` | Evidencias (fotos) guardadas localmente |
| `GET /api/stats` · `GET /api/activity` | Estadísticas del día y bitácora global |
| `GET/PUT /api/settings` | Configuración de la central |
| `POST /api/simulate` | Reporte ciudadano demo (para probar sin WhatsApp) |
| `GET /api/events` | Flujo SSE de eventos en vivo |
| `GET /api/push/key` | Clave pública VAPID para la app de unidades |

### 🚒 API de FuegoMap Unidades (la PWA del vehículo)

Sesión en cookie **httpOnly** (JWT HMAC + `tokenVersion` del usuario y `sessionEpoch` de la unidad — la central puede cerrar la sesión de una tablet a distancia con `POST /api/units/[id]/logout`). Todas las mutaciones aceptan `opId` (**idempotencia**: la cola sin internet reintenta sin duplicar).

| Método y ruta | Descripción |
| --- | --- |
| `POST /api/units/auth/login` | `{ email, password, unitCode }` → cookie de sesión + unidad confirmada |
| `POST /api/units/auth/logout` | Cerrar sesión en la tablet |
| `GET /api/units/me` | Usuario, unidad y misión activa |
| `GET /api/units/me/mission` | Detalle de la misión: incidente, hidrantes y riesgos cercanos, otras unidades (teléfono del ciudadano **enmascarado**) |
| `GET /api/units/me/events` | Flujo SSE filtrado para ESTA unidad (despachos, cambios forzados, cierre remoto) |
| `PATCH /api/units/me/status` | Cambiar estado (`disponible, en_ruta, en_escena, regresando, fuera_servicio`) — conflictos por marca de tiempo: 409 con el estado fresco |
| `POST /api/units/me/location` | Posición GPS (la app la envía cada 5 s en misión / 30 s en reposo) |
| `POST /api/units/me/push-subscription` | Registrar la suscripción Web Push de la tablet |
| `GET /api/units/me/sync` | Datos para trabajar sin señal: hidrantes, checklist del vehículo y configuración — con **ETag** (304 si nada cambió) |
| `PATCH /api/units/me/equipment/[id]` | Marcar un material del checklist diario como revisado |
| `POST /api/units/me/mission/accept` | Aceptar el despacho (si nadie acepta en 60 s, el servidor avisa a la central) |
| `POST /api/missions/[id]/close` | Cierre de misión: `{ result, injured, observations, photoBase64 }` |
| `POST /api/units/[id]/logout` | **Cierre remoto** desde la central (tablet robada o perdida) |

Al despachar, la central además envía un **Web Push** a la tablet de la unidad y programa el aviso de «no aceptada» a los 60 s.

## 📲 Integración con WhatsApp

La app funciona en **modo demo sin cuenta de Meta**: el botón *Simular reporte* inserta un mensaje ciudadano típico y todo el flujo se ejecuta igual (WhatsApp se refleja con enlaces `wa.me` que se abren en el navegador).

### Probar el webhook localmente

```bash
# Verificación (debe devolver el challenge)
curl "http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=fuegomap-verifica-2026&hub.challenge=12345"

# Reporte con texto + ubicación del teléfono
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{"phone":"+51987654321","name":"Maria","text":"Incendio en el mercado","lat":-16.6249,"lng":-72.7083}'

# Ubicación en tiempo real o foto del mismo teléfono:
# se suman al reporte abierto reciente (no crean otro incidente)
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{"phone":"+51987654321","lat":-16.6235,"lng":-72.7091}'
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{"phone":"+51987654321","photoBase64":"data:image/jpeg;base64,..."}'
```

Los mensajes del mismo teléfono dentro de los 15 minutos se unen al reporte abierto: la ubicación actualiza las coordenadas, la descripción ajusta el título/severidad y la foto queda como evidencia. Con la Cloud API, las fotos se descargan con el **token de Meta** (Configuración → Token Meta, o la variable `WA_TOKEN`) y se guardan en `./uploads`; sin token, el incidente se registra igual y la bitácora deja constancia de que llegó una foto.

### Pasar a producción (Meta Cloud API)

1. En [developers.facebook.com](https://developers.facebook.com) crea una app de WhatsApp Business y obtén el **token de acceso** y el **Phone Number ID**.
2. Expón la app con HTTPS (p. ej. `ngrok http 3000` en desarrollo o un dominio real).
3. En Meta → WhatsApp → Configuración → **Webhook**:
   - URL: `https://TU-DOMINIO/api/whatsapp/webhook`
   - Verify token: el de tu `.env` (`WA_VERIFY_TOKEN`) o el definido en **Configuración** de la central.
   - Suscríbete al campo `messages`.
4. Envía un mensaje real al número de prueba: aparecerá en la central con ubicación si el ciudadano la comparte.

El endpoint acepta el **formato oficial de Meta** (texto, imagen y `location`) y también el formato simple de pruebas. Descargar imágenes de Meta requiere el token de la app (extensión documentada en `src/app/api/whatsapp/webhook/route.ts`).

## 🐘 Migrar a PostgreSQL

1. Cambia el provider en `prisma/schema.prisma`:

   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. En `.env`: `DATABASE_URL="postgresql://usuario:clave@localhost:5432/firewaze"`.
3. `npm run db:migrate` → `npm run db:seed`.

El código de negocio no cambia: todo pasa por Prisma.

## ⚠️ Notas y límites del demo

- **Sin credenciales de mapas**: el mapa usa MapLibre GL con componentes de [mapcn](https://mapcn.dev) (MIT) y tiles vectoriales de [OpenFreeMap](https://openfreemap.org) (gratis para siempre, sin key ni límites; atribución OpenStreetMap/OpenMapTiles); el worker de MapLibre se sirve local desde `public/`. Los sismos vienen del catálogo público de USGS. No se necesita cuenta de Google, CARTO ni Earth Engine.
- **Acceso en desarrollo por `127.0.0.1` o IP de red**: Next bloquea por defecto los recursos de desarrollo si no entras por `localhost`; ya están permitidos en `next.config.ts` (`allowedDevOrigins`). Si cambias de red, agrega ahí la nueva IP.
- **SSE con bus en memoria**: el tiempo real funciona con una sola instancia del servidor. Para varias instancias, sustituir `src/lib/bus.ts` por Redis pub/sub (o similar) manteniendo la misma interfaz.
- **SQLite** es para desarrollo; en producción usar PostgreSQL (ver arriba).
- Los enlaces `wa.me` abren WhatsApp Web/app en el equipo del operador; son la vía de salida sin API oficial. WhatsApp solo acepta **texto** por esta vía (no se pueden adjuntar archivos ni pines reales), por eso el despacho lleva enlaces: pin de ubicación, ruta, foto del reporte y mapa estático de la escena + hidrantes. Con la WhatsApp Cloud API se puede enviar el mismo texto además como **imagen** y **ubicación nativas** (`src/lib/wa.ts` ya arma el contenido).
- Para que la **foto del reporte** y el **mapa** abran desde un teléfono, la central debe ser accesible: define la **URL pública** en Ajustes (p. ej. `http://192.168.1.17:3000` en la red local, o el dominio público). Si se deja vacía se usa la dirección actual del navegador (con `localhost` los enlaces solo abren en el mismo equipo).
- **Tráfico y zonas problemáticas**: `/api/traffic` consulta la API pública de Waze (Google, sin key); si la red la bloquea (403) o la zona no tiene datos, responde `source: "none"` —sin datos inventados— y el panel de capas ofrece el **visor embebido oficial de Waze** (`embed.waze.com/es-419/iframe`, sin key) con congestión y alertas en tiempo real. Para datos estructurados con Google Roads API o TomTom basta sustituir `fetchWazeFeed()` en `src/app/api/traffic/route.ts` añadiendo la key.
- **Terremotos**: `/api/quakes` consulta el catálogo público de USGS (sin key) y filtra los sismos M ≥ 2.5 de los últimos 7 días a ≤ 700 km de Camaná (caché 10 min); si USGS no responde, `source: "none"` —sin datos inventados—. El radio se ajusta en `src/lib/quakes.ts` (`QUAKES_RADIUS_KM`).
- **Evidencias (fotos)**: se guardan en `./uploads` (ignorado por git) y se sirven por `/api/media/[name]`. Para producción, sustituir `src/lib/media.ts` por almacenamiento externo (S3/GCS). Las fotos demo usan `public/evidencia-incendio.jpg` (USFS / dominio público).
- **Búsqueda de direcciones**: `/api/geocode` consulta Nominatim (OpenStreetMap) con `User-Agent` propio y caché de 1 hora, según su política de uso; para producción se puede sustituir por Google Geocoding o TomTom con key.
- Los datos sembrados son de ejemplo (Camaná): incidentes (algunos con foto de evidencia), 6 unidades con su inventario de materiales, 12 hidrantes con situación y puntos de riesgo.

## 🎨 Diseño

Tema táctico con tokens CSS (`src/app/globals.css`): grafito azulado profundo, rojo reservado a emergencias (`--red`) y ámbar para controles (`--amber`), esquinas rectas, alta densidad. Colores de estado (`--st-*`) y severidad (`--sev-*`) centralizados; los marcadores del mapa usan estos tokens (se adaptan al tema). El tema claro se activa con `data-theme="light"` y se recuerda en `localStorage` (`fw-theme`). Tipografía Barlow / Barlow Condensed.
