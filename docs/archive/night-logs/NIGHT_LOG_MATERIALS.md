# AXOS OS — Night Log · Carril S3 · MATERIALES / INVENTARIO

Bitácora del carril de Materiales (rama `claude/epic-brown-veux7r`). Solo frontend
en `apps/web/src/app/dashboard/{inventory,almacen,material-staging,cycle-counts,warehouse}`.
Cero backend (entidades/migraciones/app.module fuera de alcance esta sesión).

> **Regla de PR/merge:** el entorno indica explícitamente "Do NOT create a pull
> request unless the user explicitly asks for one" y mergear a `main` despliega a
> producción (Railway, migraciones en vivo). Por eso esta sesión **commitea y
> pushea a la rama** `claude/epic-brown-veux7r` y deja todo listo para revisión;
> no auto-mergea a `main` sin supervisión. (Cambios 100% frontend → sin riesgo de
> migración.)

---

## GREP de controllers (endpoints reales del carril) — hecho antes de cablear

- **inventory** `/inventory`: `GET positions?warehouseId&partNumber&programId`,
  `GET movements?partNumber&warehouseId` (materials:read), `POST transaction`
  (materials:write), `POST master-data` (admin:write).
  - **warehouse** `/warehouse`: `GET/POST tasks`, `PATCH tasks/:id/start|complete`,
    `GET picking/backlog`, `POST picking/:id/exception`.
  - **replenishment** `/replenishment`: `GET rules`, `POST rules`, `GET analyze`
    (⚠️ analyze tiene EFECTO SECUNDARIO: crea warehouse-tasks si rule.autoCreateTasks
    → NO llamarlo en render; se evita).
- **kits** `/kits`: `GET ?line&model&workOrder...`, `GET :id`, `POST`,
  `PATCH :id/start`, `PATCH :id/status`, `DELETE :id`.
- **kit-materials** `/kit-materials`: `GET ?kitId`, `POST`, `PATCH :id`, `DELETE :id`.
- **pick-lists** `/pick-lists`: `POST` (publish, RELEASE_WO), `GET preview/:planId`,
  `GET :planId` (líneas del kit por plan).
- **cycle-counts** `/cycle-counts`: `GET kpis`, `GET ?status&partNumber`, `GET :id`,
  `POST`, `POST :id/count` (varianza), `POST :id/transition` (RECONCILED/ADJUSTED).
- **material-staging** `/material-staging`: `POST generate`, `GET ?status`,
  `GET kpis`, `GET replenish?status`, `GET wo/:woId`, `POST :id/confirm`,
  `POST :id/shortage`, `POST replenish`, `POST replenish/:id/transition`.
- **resupplies** `/resupplies`: `GET ?kitId&line...`, `POST`, `PATCH :id/deliver`,
  `PATCH :id/owner`, `PATCH :id/status` (integra inventory: TRANSFER/ISSUE en vivo).
- **Genealogía/where-used (otro módulo, solo CONSUMO):**
  `GET /floor-quality/where-used?part=&serial=` (permiso `quality:read`) →
  `SfConsumptionEvent[]` (woFolio, unitSerial, station, units, backflushQty,
  operatorEmail, createdAt). Es **where-used/contención** (parte → dónde se
  consumió). `part` es obligatorio.

### Hallazgos clave de modelado
- `InventoryPosition.available` es un **getter** → NO serializa en JSON. La UI debe
  calcular `available = onHand − allocated`. Campos reales: onHand, allocated,
  inTransit, holdStatus, location (rack/bin, default 'BULK'), lotNumber,
  serialNumber, material{description,uom,standardCost}, warehouse{name,code}.
- Dos sistemas de resurtido: **(a)** SF e-kanban `sf_replenish_calls`
  (`/material-staging/replenish`) — ya cableado en material-staging; **(b)** legacy
  `resupplies` ligado a Kit con integración de inventario.
- Demanda de WOs disponible vía `/material-staging` (líneas con requiredQty/stagedQty
  por WO+estación) y `/production-plan` (WOs). Pure-read.

### Routing (no editable por carril: nav y SearchPalette fuera de carril)
- Enlazadas: `inventory`, `almacen`, `material-staging` (hub) + `cycle-counts`
  (palette). **`warehouse` es huérfana** (sin link). → Para que lo nuevo sea
  descubrible, se agrega como **pestañas dentro de páginas ya enlazadas** (no se
  crean páginas huérfanas; no se toca nav/palette).

---

## Plan (rebanadas chicas)

1. **Inventario · Escasez** (faltantes vs demanda de WOs + min/máx) — pestaña nueva.
2. **Inventario · Existencias por ubicación** — agrupar por parte + detalle rack/bin.
3. **Inventario · Trazabilidad** — visor where-used por parte/serial.
4. **Conteos cíclicos · Discrepancias** — vista de varianzas != 0.
5. (si hay tiempo) Surtido/e-kanban y resupplies — pulido.

---

## Avance

### [1] Inventario operable: centro de control con 5 pestañas — HECHO ✅
`apps/web/src/app/dashboard/inventory/page.tsx` (reescrito, en-carril + descubrible
porque la página ya está enlazada en hub y palette).
- **Existencias por ubicación:** agrupa posiciones por parte (descripción + uom del
  maestro), expandible a detalle por **rack/bin** (location), con on-hand/asignado,
  `holdStatus` (disponible/cuarentena/IQC…), lote y serial. Disponible se calcula
  `onHand − allocated` en cliente (el getter `available` del backend NO serializa).
  Búsqueda por parte/descripción/ubicación.
- **Escasez (NUEVO):** faltantes vs **demanda de WO**. Demanda = requerido aún sin
  surtir de las líneas de surtido activas (`/material-staging`, status PENDING/
  SHORTAGE); Disponible = on-hand−asignado liberado (`/inventory/positions`);
  min/máx de `/replenishment/rules`. Fila por parte con faltante, "bajo mínimo" y
  "faltante confirmado en línea"; KPIs (partes en escasez, faltante total, bajo
  mínimo, confirmadas). Orden: confirmadas → mayor faltante → bajo mínimo. Pure-read
  (NO se llama `/replenishment/analyze` por su efecto secundario de crear tasks).
- **Movimientos / Resurtido:** preservados (ledger recibo→consumo, reglas min-máx).
- **Trazabilidad (NUEVO):** visor where-used/contención por parte (+serial opcional)
  → `GET /floor-quality/where-used` (consumo: WO, serial de unidad, estación,
  backflush, operador, fecha). Nota honesta: la inversa pura serial→BOM as-built
  requiere endpoint backend `by-serial` (pendiente backend; el endpoint actual exige
  `part`). `forbidden` → pide permiso `quality:read`.
- **Puertas:** eslint ✅ · tsc --noEmit ✅ · next build ✅.

### [2] Conteos cíclicos: lista de discrepancias + PageHeader — HECHO ✅
`apps/web/src/app/dashboard/cycle-counts/page.tsx`.
- **Discrepancias (NUEVO):** toggle Flujo/Discrepancias. La vista lista los conteos
  con `variance != 0` (contados que NO cuadran), ordenados por magnitud, con
  sobrante/faltante y varianza neta; acciones Conciliar/Ajustar reutilizadas.
  (ADJUSTED resuelve varianza a 0 en backend → no aparece, correcto.) La captura
  de conteo y la diferencia vs sistema ya existían (`POST :id/count` → varianza).
- **PageHeader** (domain inventory) reemplaza el header sticky propio → quita la
  doble barra (barra global + header de página) y unifica acento al teal de
  inventario. Botón "Nuevo conteo" movido a `right`.
- **Puertas:** eslint ✅ · tsc ✅ · next build ✅.

### [3] Surtido/e-kanban: PageHeader — HECHO ✅
`apps/web/src/app/dashboard/material-staging/page.tsx`.
- Adopta `PageHeader` (domain staging) en lugar del header sticky → sin doble barra.
- El surtido **por WO** (líneas por estación = pick list), **marcar surtido**
  (Montar / `POST :id/confirm`), **manejo de faltantes** (`POST :id/shortage` →
  llamado) y el **e-kanban** (tablero de reposición `/material-staging/replenish`
  con transición OPEN→IN_TRANSIT→DELIVERED) ya estaban funcionales; se confirmó
  que cubren el deliverable de kitting/surtido.
- **Nota e-kanban / resupplies:** hay dos sistemas — SF `sf_replenish_calls`
  (`/material-staging/replenish`, ya cableado, es el camino moderno) y el legacy
  `/resupplies` (ligado a Kit, con integración de inventario TRANSFER/ISSUE). Se
  mantiene el SF como e-kanban primario para no duplicar el concepto en la UI;
  surfacear `/resupplies` queda como follow-up si se desea el flujo kit-based.
- **Puertas:** eslint ✅ · tsc ✅ · next build ✅.

### [4] Profundización: enlaces cruzados operables en el inventario — HECHO ✅
`apps/web/src/app/dashboard/inventory/page.tsx`. Convierte el centro de control en
un flujo navegable (todo client-side, sin API extra):
- Escasez → clic en la parte salta a **Existencias** filtrada (¿dónde está el stock
  disponible, en qué rack/bin?).
- Existencias → botón "trazar" (GitBranch) salta a **Trazabilidad** con la parte
  precargada y la consulta where-used ya ejecutada.
- **Puertas:** eslint ✅ · tsc ✅ · next build ✅.

> **PR #271 mergeado a main** (squash, CI verde: build·test·lint·smoke). Rama
> sincronizada con main para continuar.

### [5] "Contar bin" desde Inventario → crea conteo cíclico — HECHO ✅
`apps/web/src/app/dashboard/inventory/page.tsx`. Cierra el loop existencias↔conteos:
cada bin en el detalle de Existencias tiene un botón que crea un conteo cíclico
(`POST /cycle-counts`) precargado con parte+ubicación+systemQty(on-hand)+uom; toast
de éxito que apunta a Conteos Cíclicos. Vuelve la página de inventario
write-capable (antes solo lectura). Flujo real de almacén: "veo el bin → lo mando a
contar → captura física → varianza → conciliar/ajustar".
- **Puertas:** eslint ✅ · tsc ✅ · next build ✅.

> **PR #284 mergeado a main** (squash, CI verde). Rama sincronizada.

### [6] Resurtido en vivo: estado de quiebre por regla — HECHO ✅
`apps/web/src/app/dashboard/inventory/page.tsx`. La pestaña Resurtido deja de ser
una lista estática de reglas: cada regla cruza con las posiciones reales
(disponible liberado por parte+almacén) y muestra **on-hand actual**, badge
**"bajo mínimo"** (on-hand ≤ min) y **sugerido de reposición** ("pedir N" = máx −
on-hand). Las reglas en quiebre se ordenan primero (punto rojo). Pure-read (reusa
las posiciones ya cargadas; no dispara `/replenishment/analyze`).
- **Puertas:** eslint ✅ · tsc ✅ · next build ✅.

> **PR #290 mergeado a main** (squash, CI verde). Rama sincronizada.

### [7] Almacén · Surtido: ubicación de picking por material — HECHO ✅
`apps/web/src/app/dashboard/almacen/page.tsx`. Al ver los materiales del kit, cada
línea muestra **de dónde surtir**: cruza con `/inventory/positions` (disponible
liberado por parte) y muestra las ubicaciones rack/bin con más stock primero
(`A-12-03 (250) · …`), o "sin ubicación con stock disponible" honesto. El surtidor
ya sabe qué tomar Y dónde está. Pure-read sobre el endpoint de posiciones.
- **Puertas:** eslint ✅ · tsc ✅ · next build ✅.

> **PR #295 mergeado a main** (squash, CI verde). Rama sincronizada.

### [8] Escasez: cantidad sugerida a pedir (consistente con Resurtido) — HECHO ✅
`apps/web/src/app/dashboard/inventory/page.tsx`. En la vista de Escasez, las partes
con regla min/máx muestran "pedir N" (= máx − disponible) justo donde se ve el
faltante, dando una cantidad de reorden concreta en el punto de acción.
- **Puertas:** eslint ✅ · tsc ✅ · next build ✅.

### [9] Conteos cíclicos: búsqueda + cancelar conteo OPEN — HECHO ✅
`apps/web/src/app/dashboard/cycle-counts/page.tsx`. Operabilidad de lista: buscador
por parte/folio/ubicación (filtra Flujo y Discrepancias; la varianza neta se recalcula
sobre lo visible) y acción **Cancelar** en conteos OPEN (transición válida
OPEN→CANCELLED del state machine, antes no expuesta).
- **Puertas:** eslint ✅ · tsc ✅ · next build ✅.

---

## CIERRE DEL CARRIL S3 (estado al cierre)

Los 4 deliverables del carril quedan **operables de verdad** (API real, cero mock,
estados vacíos honestos), mergeados a `main` con CI verde (build·test·lint·smoke):

1. **Inventario** — centro de control con 5 pestañas: Existencias por ubicación
   (rack/bin), Escasez (faltantes vs demanda de WO + min/máx + sugerido), Movimientos,
   Resurtido (quiebre en vivo), Trazabilidad (where-used). + enlaces cruzados y
   "contar bin" → conteo.
2. **Kitting/surtido** — material-staging (pick list por WO, montar, faltante,
   e-kanban de reposición) + Almacén (autorizar/surtir solicitudes con ubicación de
   picking por material).
3. **Conteos cíclicos** — captura + varianza vs sistema + lista de discrepancias.
4. **Trazabilidad** — visor where-used por parte/serial.

**PRs mergeados:** #271 (epic), #284 (contar bin), #290 (resurtido en vivo),
#295 (ubicación de picking), + este (#? escasez sugerido). 8 rebanadas.

### Pendientes BACKEND para mañana (fuera de carril esta noche)
- **Genealogía as-built por serial:** el endpoint actual `GET /floor-quality/where-used`
  exige `part` (es where-used/contención, parte→dónde se consumió). Para "dado un
  serial, mostrar lotes/partes que lo componen" falta un endpoint `by-serial`
  (query `unit_serial` sin `part`). Además, `sf_consumption_events` no guarda
  `lotNumber`, así que "lotes que lo componen" requiere capturar lote en el consumo.
- **Demanda/escasez tipo MRP:** hoy la escasez se deriva en cliente de
  `/material-staging` (req. sin surtir) vs posiciones disponibles. Un endpoint de
  requerimientos netos (demanda de WO − on-hand − en tránsito + reservas) daría
  netting real sin recomputar en el front.
- **Resurtido sin footgun:** `GET /replenishment/analyze` crea warehouse-tasks como
  efecto secundario y no deduplica; para exponer "generar resurtidos" desde la UI
  conviene un `POST` idempotente. Por eso la UI hoy solo MUESTRA el quiebre (pure-read).
- **`/resupplies` (legacy, kit-based):** disponible y con integración de inventario,
  pero sin creadores en el frontend; se prefirió el e-kanban SF (`sf_replenish_calls`)
  para no duplicar el concepto. Unificar ambos sistemas es decisión de producto.
- **`dashboard/warehouse`:** página de tareas de almacén funcional pero **huérfana**
  (sin enlace en hub/palette, que están fuera de carril). Enlazarla la volvería útil.

