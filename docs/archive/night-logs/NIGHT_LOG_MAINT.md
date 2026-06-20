# AXOS OS — Night Log · Carril G2 (Mantenimiento / TPM)

Bitácora del carril de **Mantenimiento (CMMS / TPM)** (G2). Rama
`claude/affectionate-mendel-ts6tfo`. Alcance de archivos: **SOLO**
`apps/web/src/app/dashboard/maintenance/**` y sus componentes locales. Backend
**reutilizado, cero cambios** este turno: módulo `maintenance` (`kpis`, `assets`
GET/POST/PATCH, `orders` GET/POST/PATCH + `transition`).

> **Reglas que sigo:** trabajo solo en mi carril; cero mock (toda lista del API
> real, estado vacío con CTA honesto, hueco de backend marcado **REQUIERE
> BACKEND** en vez de inventar datos); reuso endpoints existentes (grep del
> controller antes de cablear); NO toco backend (entidades, DTOs, servicio,
> migraciones), ni `app.module.ts`, ni `dashboard/page.tsx` (nav), ni
> componentes compartidos (PageHeader, IconTile, glass/motion, ToastContext).
> Puertas antes de cerrar: `eslint` + `tsc --noEmit` + `next build` en verde.

---

## Mapa del backend de mi carril (grep de `maintenance.controller.ts`)

`/maintenance` (con `JwtAuthGuard + PermissionsGuard`):

- **KPIs** · `GET /maintenance/kpis` → `{ ordersOpen, ordersInProgress,
  ordersOverdue, ordersCompleted, pmCompliance|null, mttrHours|null,
  totalDowntimeMinutes, assetsTotal, assetsDown }`. MTTR sale del paro registrado
  al completar; **MTBF NO existe** en el endpoint.
- **Activos** · `GET /maintenance/assets` (orden por nombre) ·
  `POST /maintenance/assets` (alta con `name, code, category, location,
  criticality, manufacturer, model, serialNumber`; nace `RUNNING`) ·
  `PATCH /maintenance/assets/:id` (**sólo** `name, category, location,
  criticality, status` — code/fabricante/modelo/serie son inmutables vía PATCH).
  Estados de activo: `RUNNING | IDLE | DOWN | RETIRED`.
- **Órdenes** · `GET /maintenance/orders?status&type&assetId` ·
  `GET /maintenance/orders/:id` (la lista ya trae la entidad completa, incluido
  `description`, `startedAt`, `completedAt`) · `POST /maintenance/orders`
  (folio `MO-…` del servicio de numeración) · `PATCH /maintenance/orders/:id`
  (`title, description, type, priority, assignedTo, dueDate`) ·
  `POST /maintenance/orders/:id/transition` `{ status, downtimeMinutes? }`.
- **Máquina de estados** (`order-state.ts`, espejada en la UI):
  `OPEN → {IN_PROGRESS, CANCELLED}`, `IN_PROGRESS → {COMPLETED, OPEN, CANCELLED}`,
  `COMPLETED`/`CANCELLED` terminales. El backend re-valida con `assertTransition`.

**Hallazgos clave de no-duplicación:**
- La página previa de `maintenance` ya cableaba lo básico (lista plana de órdenes
  por estado, alta de orden, alta de activo por nombre, transición con
  `window.prompt` para el downtime). La **rehíce** como cockpit por pestañas sin
  tocar backend ni inventar endpoints.
- El **gancho B1** (andon/avería del piso) ya vive en `operator-terminal`
  (`ANDON_MACHINE` → rol Mantto) y `operador`. No dupliqué andon: **consumo** el
  estado `DOWN` del activo y enlazo conceptualmente a la terminal de piso.

---

## Arquitectura del carril (al estilo `quality/*`)

Co-loco archivos en la carpeta del área (no rutas; Next sólo enruta `page.tsx`):

- `maintenance.types.ts` — espejo de entidades/DTOs del backend (cero `any`).
- `maintenance.utils.ts` — helpers puros: metadata de estado/tipo/prioridad/
  criticidad, **máquina de estados espejada**, KPIs derivados (backlog, órdenes
  abiertas por activo, mezcla por tipo), **bucketing de agenda preventiva** por
  vencimiento, formateo de fechas/minutos. Side-effect free → testeable.
- `maintenance.ui.tsx` — átomos presentacionales (Kpi, Field, Empty, Modal,
  pills de estado/tipo/prioridad/criticidad, TabBtn, MiniBar, estilos `.m-input`).
- `maintenance.actions.tsx` — widgets que **pegan al backend** y se reusan en
  varias vistas: `OrderFormModal` (POST orden), `TransitionControls` (botones
  **solo de transiciones válidas** + modal de downtime al completar),
  `AssetStatusSelect` (PATCH estado del activo).
- `maintenance.overview.tsx` · `maintenance.assets.tsx` · `maintenance.orders.tsx`
  · `maintenance.preventive.tsx` — las cuatro pestañas.
- `page.tsx` — shell: fetch (`useApi` orders/assets/kpis), tabs, modal global de
  alta de orden, `MInputStyle` global (para que filtros y drawer tengan estilos).

---

## Ítem 1 — Registro de ACTIVOS (lista + alta/edición + estado) ✅

`maintenance.assets.tsx`:
- **Lista** con buscador (nombre/código/ubicación/fabricante/modelo/serie) y
  filtros por **estado** y **criticidad**.
- **Alta** con el DTO completo (`CreateAssetDto`).
- **Edición** honesta: el `PATCH` sólo acepta `name/category/location/
  criticality/status`, así que el modal de edición deja esos editables y muestra
  `code/fabricante/modelo/serie` **read-only** (se fijan al dar de alta) — sin
  prometer lo que el backend no actualiza.
- **Control de estado** in-situ (`AssetStatusSelect`): Operativo / Inactivo /
  **Avería** / Retirado, con PATCH inmediato. Los activos en avería se resaltan
  (ring rojo) y muestran su conteo de órdenes abiertas.

## Ítem 2 — ÓRDENES: lista + filtros + detalle + máquina de estados ✅

`maintenance.orders.tsx`:
- **Lista** ordenada por prioridad → vencimiento → creación, con **buscador**,
  filtro **segmentado de estado con conteos**, y filtros por **tipo** y **activo**
  (cliente; la lista ya viene completa). Estado vencido resaltado en rojo.
- **Alta** (`OrderFormModal`, compartido) con tipo/prioridad/activo/responsable/
  vencimiento/notas.
- **Detalle** en drawer lateral: tipo/prioridad, activo (con código/ubicación),
  responsable, vencimiento, paro, **descripción** y **línea de tiempo**
  (creada/iniciada/completada). Edición vía `PATCH`.
- **Máquina de estados**: `TransitionControls` ofrece **solo transiciones
  válidas** (espejo de `order-state.ts`); al **Completar** abre modal para
  capturar **minutos de paro** (alimenta MTTR / paro total). Reabrir = `OPEN`.

## Ítem 3 — Tablero de KPIs ✅

`maintenance.overview.tsx`:
- Tarjetas: **Backlog** (`ordersOpen + ordersInProgress`), **Vencidas**, **MTTR**
  (con paro total), **MTBF** = `—` + nota **Requiere backend** (no se inventa),
  **% PM cumplido**, **Activos parados** (`assetsDown/assetsTotal`).
- **Órdenes abiertas por activo** (derivado en vivo del listado): barras por
  activo, marcando los que están en avería.
- **Carga por tipo** (preventivo/correctivo/predictivo) + accesos rápidos.

## Ítem 4 — Mantenimiento PREVENTIVO (estado honesto) ✅

`maintenance.preventive.tsx`:
- Callout **REQUIERE BACKEND**: el API expone activos/órdenes/KPIs pero **no hay
  programador/calendario ni recurrencia de PM**. Se enumera lo que falta
  (plantillas por activo, recurrencia por días/horas-máquina/ciclos,
  auto-generación al cerrar, disparo por medidor/condición).
- Lo **real y usable hoy**: **agenda** de las órdenes tipo `PREVENTIVE` agrupadas
  por vencimiento (Vencidas / Próximos 7 días / Más adelante / Sin fecha /
  Completadas), KPIs de PM (`pmCompliance`, planeadas, vencidas, completadas), y
  alta directa de preventiva.

## Ítem 5 — Gancho con downtime/andon del piso (B1) ✅

- En **Resumen**, banner rojo de **activos en avería** (`status === 'DOWN'`):
  explica que en el piso una máquina caída dispara un **andon de Mantto
  (`ANDON_MACHINE`)**, enlaza a la **terminal de piso** (`/dashboard/
  operator-terminal`), y por cada activo ofrece **levantar orden correctiva**
  (prefill prioridad alta + título "Avería: …") y **marcar operativo**.
- Resalte coherente en la lista de activos (ring rojo) y en "órdenes por activo".
- **Sin tocar backend**: sólo consumo `assets.status` y la lista de órdenes; el
  vínculo es conceptual/operativo, no un endpoint nuevo.

---

## Huecos honestos (REQUIERE BACKEND, no inventados)

- **MTBF** por equipo (no hay historial de fallas por activo en el endpoint).
- **Programación/recurrencia de PM**: plantillas por activo, frecuencia,
  auto-generación de la siguiente orden, disparo predictivo por medidor.
- **Vínculo duro andon↔orden**: hoy es conceptual (estado `DOWN` + correctiva
  manual); un endpoint que ligue el andon de piso con la orden lo cerraría.

## Puertas (verde)

- `npx tsc --noEmit` → **0 errores** (todo el web).
- `npx eslint` sobre los 9 archivos del carril → **limpio**.
- `npm run build` (web) → **Compiled successfully**; `/dashboard/maintenance`
  prerenderizado sin warnings.
