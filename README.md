# 🔥 FuegoMap Admin · Central de Mando GIS

Central de operaciones para bomberos: los ciudadanos reportan emergencias por **WhatsApp** (texto, foto y ubicación en vivo) y la central despacha **unidades** con ruta y **hidrantes cercanos** sobre un mapa real. Las tablets de los vehículos reciben los despachos con la PWA hermana **FuegoMap Unidades** (`../unidades`).

> Evolución del prototipo `Firewaze · Central de Mando GIS.html` (HTML único con SVG estático) a una aplicación full-stack con React, base de datos y tiempo real.

![Flujo del sistema](public/img/sistema-fuegomap.jpg)

## ✨ Funcionalidades

- **Recepción de reportes por WhatsApp** — texto, **ubicación en tiempo real** y **fotos**: los mensajes del mismo teléfono se unen al reporte abierto reciente (una foto o una ubicación suelta no crean otro incidente) y las imágenes se descargan con el token de Meta y quedan como **evidencia** del incidente. Modo demo integrado (`Simular reporte`) + webhook real listo para la WhatsApp Cloud API de Meta.
- **Registro manual con búsqueda de dirección** — en *Nuevo reporte* escribe la dirección y pulsa **Buscar** (o Enter): la búsqueda de direcciones (OpenStreetMap · Nominatim, sin API key) devuelve coincidencias reales con sus coordenadas y, al elegir una, **fija la ubicación sola**; también puedes fijarla en el mapa o usar tu ubicación actual. El reporte se puede **editar después** (tipo, dirección, severidad, ubicación, notas y foto) y cada cambio queda registrado en la bitácora del incidente; al editar, la **ventana es arrastrable** y no bloquea el mapa: haz clic en una calle para corregir la ubicación sin cerrarla.
- **Mapa real (MapLibre GL + mapcn)** — muestra **solo los incidentes en curso** (si seleccionas uno de la cola *Historial*/*Todos*, ese aparece también para ubicarlo): incidentes con **direcciones visibles** (capa *Direcciones*), unidades, hidrantes, puntos de riesgo (grifos, colegios, mercados), **tráfico y zonas problemáticas** (Waze en vivo, visor embebido sin key), **terremotos recientes** (USGS: M ≥ 2.5 · últimos 7 días · ≤ 700 km de Camaná) y radio de seguridad de 300 m con líneas a los 3 hidrantes más cercanos. **Registro de hidrantes** con ventana arrastrable (se ubica con clics en el mapa, sin cerrarla) y **foto de la boca**; **situación** por hidrante (operativo / en mantenimiento / fuera de servicio; el marcador cambia de color). **Mini-mapa de hidrantes** en el detalle del incidente (escena + radio de 300 m + líneas a los 3 más cercanos). Tiles vectoriales **sin API key** (OpenFreeMap, datos OpenStreetMap): estilo *dark* (tema oscuro) y *positron* (tema claro), con nombres de calles nítidos a cualquier nivel de zoom. Los **pines se leen de un vistazo**: cada incidente lleva el **icono de su tipo** (incendio 🔥, fuga de gas, rescate vehicular, emergencia médica, derrumbe, eléctrico, inundación, árbol caído, rescate de personas… con sirena genérica si no calza) y color por estado (anillo de pulso mientras nadie atiende); los hidrantes, una gota con color de situación; los puntos de riesgo, triángulo de alerta por nivel (alto/medio/bajo); los preplans, un edificio ámbar; y cada unidad su **icono por tipo de vehículo** (bomba/cisterna/rescate/ambulancia/mando) con el código al lado, coloreado por estado.
- **Despacho multi-unidad** — elige **una o varias** unidades con casillas (recomendación de la más cercana disponible) y mensaje de WhatsApp pre-armado con: dirección, coordenadas, **pin de ubicación** (Google Maps), ruta táctica, **foto del reporte**, lista de hidrantes con distancia y presión, y **mapa estático de la escena + hidrantes** (Yandex, sin API key). Cada unidad recibe la misión (push a su tablet) y **acepta por su lado**. Se pueden pedir **refuerzos** mientras el incidente esté despachado o en escena: las unidades ya en misión quedan fijas y solo se suman nuevas. **Solo la central despacha**; las tablets de las unidades reciben, aceptan y actualizan estado, pero no pueden generar despachos. El diálogo muestra la vista previa del mensaje y del mapa antes de confirmar. El botón **«Ruta»** del detalle traza la **ruta vial en el mapa de la central** (OSRM sin key) desde el punto de salida del despacho o el cuartel B-35, con distancia y ETA — sin abrir Google Maps. En el tablero de unidades cada unidad edita su **dotación (efectivos)** en línea.
- **Tiempo real (SSE)** — nuevos reportes, cambios de estado, despachos y configuración se propagan al instante a todas las pantallas conectadas.
- **Alarma sonora** (WebAudio) para nuevos reportes, con interruptor en la barra superior.
- **Parte de emergencia (PDF)** — el botón **«Parte PDF»** del detalle abre `/informe/[id]`: documento A4 con datos del incidente, unidades intervinientes (con horario de despacho y aceptación), evidencia fotográfica, hidrantes de la zona, notas del operador y **bitácora completa**, listo para **imprimir o guardar como PDF** desde el navegador (sin dependencias externas) y con líneas de firma para el jefe de guardia y el operador.
- **Acceso con cuenta y roles (CAD protegido)** — la central pide **login de operador** (cookie httpOnly, 12 h) con roles `jefe` / `operador` / `lectura`; gestión de operadores y **bitácora del sistema** (auditoría de accesos, despachos, cambios y borrados) en la barra superior — solo el jefe. Toda la API responde 401 sin sesión.
- **Reportes de tiempos de respuesta** — página `/reportes` con P50/P90 por fase (despacho, ACK, llegada a escena, atención total), por severidad y por unidad, más detalle de cierres; periodo 7/30/90 días e **imprimir/PDF**.
- **Preplans de riesgo con auto-ficha en escena** — fichas operativas de edificios (peligros, llaves, puntos de agua, contacto, fotos) con pin en el mapa; al seleccionar un incidente a <300 m de un edificio con ficha, el detalle la muestra arriba automáticamente.

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

> **Toda la API de la central exige sesión de operador** (cookie httpOnly `fm_op` — el proxy de Next 16 responde `401` sin ella; cada endpoint además verifica el rol vigente en la BD). Las excepciones públicas: `/api/app/**`, `/api/units/auth/**`, `/api/units/me/**`, `/api/missions/**`, `/api/whatsapp/**`, `/api/media/**`, `/api/push/key`, `/api/push/subscription` y `/api/operator/login`.

### 🔐 Sesión del operador (CAD)

| Método y ruta | Descripción |
| --- | --- |
| `POST /api/operator/login` | `{ email, password }` → cookie de sesión (12 h). Límite de intentos: 5 fallos → 10 min bloqueado por correo+IP. Todo acceso queda en la auditoría |
| `POST /api/operator/logout` | Cerrar sesión del CAD |
| `GET/PATCH /api/operator/me` | Operador conectado / cambiar la propia clave (exige la actual) |
| `GET/POST /api/operator/users` | Gestión de operadores — **solo jefe** |
| `PATCH/DELETE /api/operator/users/[id]` | Rol, activar/desactivar, restablecer clave, eliminar — **solo jefe** (nunca puede quedar el CAD sin jefe activo) |
| `GET /api/audit?limit=` | Bitácora del sistema (auditoría) — **solo jefe** |

**Roles**: `jefe` (todo: usuarios, bitácora, borrados) · `operador` (opera el CAD: despachos, incidentes, unidades, hidrantes, preplans) · `lectura` (solo observa). El login se colocó como **puerta de la central**: sin sesión, la pantalla de ingreso reemplaza al tablero.

| Método y ruta | Descripción |
| --- | --- |
| `GET/POST /api/preplans` | Fichas operativas de edificios de riesgo: listar y crear (jefe u operador) |
| `PATCH/DELETE /api/preplans/[id]` | Editar ficha o activarla/desactivarla (jefe u operador) / eliminar (**solo jefe**) |
| `GET /api/incidents` | Lista de incidentes |
| `POST /api/incidents` | Crear reporte (`{ title, address, lat, lng, severity, ... }`) |
| `GET /api/incidents/[id]` | Detalle con bitácora |
| `PATCH /api/incidents/[id]` | Editar el reporte (datos, foto) o cambiar `status`, `severity`, `notes` |
| `POST /api/incidents/[id]/dispatch` | Despachar una o varias unidades (`{ unitIds: number[] }`; `unitId` suelto por compat). Admite refuerzos con el incidente en `despachado`/`en_escena`. **Solo la central** |
| `GET /api/units` · `POST /api/units` | Lista y alta de unidades |
| `PATCH /api/units/[id]` · `DELETE /api/units/[id]` | Cambiar estado, dotación o ubicación (`lat`/`lng`) / dar de baja una unidad |
| `GET/POST /api/units/[id]/chat` | Chat central ↔ unidad: historial y enviar mensaje (difundido por SSE) |
| `GET /api/units/[id]/track` | Recorrido GPS grabado de la unidad (GeoJSON + metros; `?since=ISO` para recortar) |
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
| `POST /api/units/me/location` | Posición GPS (la app la envía cada 5 s en misión / 30 s en reposo). En misión también graba el **historial** (`GpsPoint`, dedupe <15 m) |
| `GET/POST /api/units/me/chat` | Chat corto con la central: historial (`?after=ISO`) y enviar mensaje |
| `POST /api/units/me/push-subscription` | Registrar la suscripción Web Push de la tablet |
| `GET /api/units/me/sync` | Datos para trabajar sin señal: hidrantes, checklist del vehículo y configuración — con **ETag** (304 si nada cambió) |
| `PATCH /api/units/me/equipment/[id]` | Marcar un material del checklist diario como revisado |
| `POST /api/units/me/mission/accept` | Aceptar el despacho (si nadie acepta en 60 s, el servidor avisa a la central) |
| `POST /api/missions/[id]/close` | Cierre de misión: `{ result, injured, observations, photoBase64 }` |
| `POST /api/units/[id]/logout` | **Cierre remoto** desde la central (tablet robada o perdida) |

Al despachar, la central además envía un **Web Push** a la tablet de la unidad y programa el aviso de «no aceptada» a los 60 s.

### Señal en vivo del mapa (rendimiento)

Los pings de GPS viajan con una **instantánea de la unidad** en el propio evento SSE, así la central mueve el marcador **sin refetch** de incidentes/unidades/stats por cada ping. El refetch completo queda solo para eventos relevantes (despacho, cambio de estado, reportes) y se **coalesce**: varios eventos en ráfaga disparan un único refetch en cadena, no 5 consultas en paralelo cada uno.

- `UNIT_BROADCAST_MS` (variable de entorno, **4000** por defecto): frecuencia mínima de retransmisión por unidad en `POST /api/units/me/location`, antes fija en 8 s. Súbela si el ancho de banda de la tablet es limitado.
- El marcador de unidad **se interpola** entre su posición anterior y la nueva (3 s, interrumpe si el operador arrastró) — el desplazamiento se ve continuo en lugar de un salto cada ping.
- **Seguir unidad**: botón «Seguir en el mapa» en el popup de cada unidad; la cámara la centra en cada posición nueva. Se cancela arrastrando el mapa o con la ✕ del chip «Siguiendo…».
- `GET /api/events` hace un `SELECT 1` cada 60 s para mantener caliente el compute de Neon (evita el arranque en frío de 1-3 s en las primeras respuestas del tablero tras inactividad).

### Herramientas de la tanda «benchmark Bryx/First Due»

- **Chat central ↔ unidad** (`ChatPanel` sobre el mapa; pestaña «Chat» en la tablet): hilo persistente en `ChatMessage`, difusión por SSE (sin polling) y aviso toast + punto de «no leído» en la tablet.
- **Ver recorrido (GPS)**: botón del popup de unidad — dibuja el historial `GpsPoint` (se graba solo con misión activa, dedupe <15 m) como línea violeta en el mapa.
- **Regla de medición** («Medir» en el panel del mapa): clic añade vértices, línea magenta con distancia total por superficie geodésica; Esc termina, clic en un vértice lo quita.
- **ETA por unidad**: chip `~N min · X km` en el detalle (fila «Unidad» y píldoras «Asignadas») calculado de la posición actual a la escena vía `/api/route` (caché 10 min, refresco 90 s).
- **Ruta desde donde está la unidad**: el origen preferente de la ruta es la posición viva de la unidad despachada si ya se alejó >60 m del punto de salida; si no, el punto de despacho o el cuartel.
- **Banner de severidad crítica** en el detalle (se apaga al cerrar el incidente).

### Tanda «seguridad + métricas» (roadmap ×10: saltos 1-3)

- **CAD protegido con roles y auditoría**: login de operador (scrypt + JWT en cookie httpOnly, 12 h), roles `jefe`/`operador`/`lectura`, gestión de usuarios en la barra (solo jefe) y **bitácora del sistema** (`AuditLog`: accesos, despachos, cambios de estado, borrados, preplans, configuración) con refresco en vivo cada 30 s. El candado vive en `src/proxy.ts` (proxy Next 16, antes «middleware») — toda la API responde `401` sin sesión.
- **Reportes de tiempos de respuesta** (`/reportes`): del histórico real de la BD calcula por fase —despacho, ACK de la unidad, llegada a escena y atención total— los percentiles **P50/P90** (más honestos que el promedio), distribución por severidad, ACK p50 por unidad y detalle de los últimos 30 cierres. Selector de 7/30/90 días y botón **Imprimir/Guardar PDF** (el navegador lo exporta a PDF; sin dependencias externas).
- **Preplans de riesgo** (estilo First Due): fichas operativas de edificios (pisos/distribución, peligros, llaves de acceso, puntos de agua, contacto, fotos por URL) con pin ámbar en el mapa, directorio con búsqueda y — lo más valioso — **auto-ficha en escena**: al seleccionar un incidente a <300 m de un edificio con ficha, el panel de detalle despliega la ficha completa arriba, sin que el operador tenga que buscarla.
- **Aviso de ficha a la unidad**: la misión que recibe la tablet (`/api/units/me/mission`) incluye ahora el preplan cuando la escena cae a ≤300 m (misma regla First Due), con distribución, peligros, llaves, agua, contacto llamable y fotos. El Web Push del despacho añade «Con ficha de edificio» para que el conductor la busque al entrar a la misión.
- **Todas las ventanas movibles**: hook compartido `useDraggablePanel` — los 12 diálogos y el chat se arrastran por su cabecera (posición limitada al viewport y botón *Centrar*), y el z-index quedó unificado en `z-[1000]`: se acaban los casos en que una ventana abierta quedaba detrás de otra.

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

## ☁️ Despliegue en Vercel

| App | Producción | Repo |
| --- | --- | --- |
| Central (Next.js) | https://b35-central.vercel.app | `jhoedmon21/centralBomberos` |
| Tablet (PWA Vite) | https://b35-unidades.vercel.app | `jhoedmon21/b35-unidades` |

- **Doble entrada de la tablet**: su propio dominio (proxy `/api → central` vía `unidades/vercel.json`) **y** `https://b35-central.vercel.app/app` — la misma PWA servida bajo el dominio central (rewrite con `TABLET_APP_URL`): **mismo origen**, cookies httpOnly y SSE sin CORS. Los assets/manifest/SW de la PWA son **relativos** (`base: "./"`), por eso funciona en ambos contextos.
- **Variables de entorno (Vercel → Production)**: `DATABASE_URL` (Neon agrupada), `DATABASE_URL_UNPOOLED`, `JWT_SECRET`, `WA_VERIFY_TOKEN`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `OSRM_BASE_URL`, `NEON_BRANCH`, `TABLET_APP_URL`. Ojo: el `webhook_token` guardado en **Configuración** de la central tiene prioridad sobre el env.
- **Build del central**: `npx prisma generate && next build` (vercel.json). La sesión del CAD es cookie httpOnly `fm_op` (12 h).
- **Desplegar**: `vercel --prod` en cada carpeta (o conecta GitHub en Vercel → Settings → Login Connections y cada `git push` despliega solo).
- **Nota (plan Hobby)**: las conexiones SSE se cortan al llegar al tope de duración de función; la app reconecta sola y los avisos críticos llegan por Web Push.

## 🎨 Diseño

Tema táctico con tokens CSS (`src/app/globals.css`): grafito azulado profundo, rojo reservado a emergencias (`--red`) y ámbar para controles (`--amber`), esquinas rectas, alta densidad. Colores de estado (`--st-*`) y severidad (`--sev-*`) centralizados; los marcadores del mapa usan estos tokens (se adaptan al tema). El tema claro se activa con `data-theme="light"` y se recuerda en `localStorage` (`fw-theme`). Tipografía Barlow / Barlow Condensed.
