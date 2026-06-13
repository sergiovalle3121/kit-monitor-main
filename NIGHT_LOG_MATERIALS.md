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

