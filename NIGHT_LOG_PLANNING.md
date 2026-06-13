# AXOS OS — Night Log · Carril S4 (Planeación / Muro de WOs)

Bitácora del carril de **Planeación como tablero operativo**. Rama
`claude/gracious-archimedes-tss6qb`. Archivos del carril:
`apps/web/src/app/dashboard/planning` y la página del muro de WOs
(`apps/web/src/app/dashboard/production-plan`). Backend solo de lectura
(reusa endpoints existentes de `production-plan`, `plans`, `kits`, `bom`,
`inventory`). **Prohibido** esta sesión: migraciones, entidades TypeORM,
`app.module.ts`, `dashboard/page.tsx` (nav) y componentes compartidos.

> Puertas por ítem (apps/web): `eslint` + `tsc --noEmit` + `next build` en verde.
> CI en `main` además corre build/test/smoke del API (ver `.github/workflows/ci.yml`).

---

## Endpoints reusados (GREP de controllers — sin inventar rutas)

- **production-plan** (`SfWorkOrder`, tabla `sf_work_orders`):
  - `GET /production-plan?line&status&model` · `GET /production-plan/kpis`
  - `GET /production-plan/:id` · `GET /production-plan/:id/blockers`
  - `POST /production-plan/publish` (planning:publish)
  - `PATCH /production-plan/:id/resequence` (planning:write) — `{ sequence, priority? }`
  - `POST /production-plan/:id/transition` (planning:write)
  - `POST /production-plan/:id/authorize` (production:authorize)
- **bom**: `GET /bom/headers?model&status` (incluye `components[]`); estados
  `DRAFT→PENDING_REVIEW→APPROVED→ACTIVE→OBSOLETE`. Componente trae
  `quantity`, `usageFactor`, `componentNumber`, `unit`; header trae `baseQuantity`.
- **inventory**: `GET /inventory/positions?partNumber&warehouseId&programId`
  → `onHand`, `allocated`, `holdStatus` (el getter `available` NO se serializa →
  se calcula en el cliente `onHand − allocated`).
- **plans** (legacy, pág. `planning`): `GET /plans`, `POST /plans`,
  `POST /plans/:id/release`, `DELETE /plans/:id`; surtido vía `/pick-lists`.

---

## Ítem 1 — Muro de WOs por línea/estación + adelantado/atrasado ✅

**Archivos:** `apps/web/src/app/dashboard/production-plan/page.tsx` (+ nuevo
helper puro `wo-board.ts`). Cero backend, cero mock.

- **Vista por línea / estación** (toggle nuevo, default): las WOs se agrupan por
  `line`, ordenadas por `sequence`; cada línea muestra un resumen en vivo
  (WO totales, u hechas/meta de las activas, # en ejecución, # atrasadas). La
  estación/bahía se muestra por WO (`línea / bahía`). Se conserva la vista
  **Por estado** (RELEASED→…→COMPLETED) como segunda pestaña.
- **Adelantado / atrasado** (`computeSchedule`, puro): chip por WO derivado de la
  fecha programada vs hoy — **Atrasada · N d / Vence hoy / Vence en N d /
  Completada / Sin fecha**. Cuando la WO corre con `taktTargetSec > 0` y
  `startedAt`, se añade un sub-chip de **ritmo** (u producidas vs esperadas por
  takt): `+N u vs ritmo` (adelantado) / `−N u vs ritmo` (atrasado) / `a ritmo`.
  Honesto cuando no hay fecha ni takt ("Sin fecha", sin sub-chip).
- **Estado + cantidad hecha vs meta:** ya existían (barra de progreso y
  `hecho/meta u`); se refactorizó la tarjeta a un `WOCard` compartido por ambas
  vistas e incluye el estado como punto de color + etiqueta.

**Puertas:** `tsc` 0 · `eslint` 0/0 · `next build` ✓ (78/78 páginas).

### Notas backend para mañana (fuera de carril, NO tocado)
- `taktTargetSec` casi siempre llega en 0: ni el form del muro ni `publish` lo
  pueblan desde la calificación modelo↔línea (line-engineering tiene takt target).
  Mientras siga en 0, el sub-chip de ritmo no aparece (degradación honesta). Para
  activarlo: arrastrar el takt de la calificación al publicar la WO (backend).
- No hay noción de **capacidad/CRP** (carga vs capacidad de línea) en
  `production-plan`. Queda como tarea backend (CRP) — el muro solo refleja lo
  publicado, no valida capacidad.

---

## Ítem 2 — Semáforo Clear-to-Build por WO ✅

**Archivos:** `production-plan/page.tsx` + `wo-board.ts` (`computeClearToBuild`,
puro). Compone el veredicto desde **endpoints existentes** (cero backend):

- **BOM activo** → `GET /bom/headers?status=ACTIVE` (mapa modelo→BOM con
  componentes). `buildActiveBomMap`.
- **Material disponible** → `GET /inventory/positions` (mapa parte→disponible =
  `onHand − allocated`, solo `holdStatus='available'`; el getter `available` no
  se serializa). `buildInventoryMap`. Explota el BOM activo contra la **cantidad
  por construir** (planeada − hecha): `req/u = quantity × usageFactor /
  baseQuantity`; faltante = `req − disponible`.
- **FAI** → flag de la WO (`faiRequired ? faiApproved : n/a`).
- **Calidad** → `qualityClear` también entra (un hold activo no puede pintar
  verde).

**Veredicto** (`go`/`caution`/`no-go`/`unknown`): verde solo si BOM activo +
todo el material cubierto + FAI ok/na + sin hold. Ámbar si material parcial o
FAI pendiente. Rojo si no hay BOM, faltante total, o hold de calidad.

**UI:** badge-semáforo por WO (clic → detalle expandible) con las 3+1 verificaciones
(ícono+estado+detalle), tabla de **faltantes** (parte · req · disp · falta, top 6)
y deep-links honestos (sin BOM → Modelos; con faltante → Almacén). El resumen por
línea suma `# no listas`. Refresco en vivo (SWR 20s) como el resto del muro.

**Puertas:** `tsc` 0 · `eslint` 0/0 · `next build` ✓.

### Notas backend para mañana (fuera de carril)
- La disponibilidad se agrega **a través de todos los almacenes/programas** (no
  filtra por `programId` de la WO). Afinar a disponibilidad por programa requeriría
  cruzar `programId` (dato hoy mayormente vacío) — mejora futura.
- `production-plan` ya tiene `materialReady` (lo pone staging C); el semáforo no lo
  sustituye, lo **complementa** con la verificación real contra inventario/BOM.

---

## Ítem 3 — Secuencia del plan: ordenar / priorizar + publicar ✅

**Archivos:** `production-plan/page.tsx`. Reusa `PATCH
/production-plan/:id/resequence` (`{ sequence, priority? }`, guard
`planning:write`). Cero backend.

- **Ordenar la secuencia** (vista por línea): cada WO trae flechas ↑/↓ que la
  mueven en la **secuencia de su línea**. `reorderLine` reasigna la secuencia en
  pasos de 10 (deja huecos) y solo PATCHea las WOs cuyo número cambió → robusto
  ante empates de secuencia (todas en 100 por default). Deshabilitadas en los
  extremos. El `#seq` del encabezado refleja el nuevo orden al refrescar.
- **Priorizar:** selector de prioridad por WO (Baja/Media/Alta/Urgente) que
  PATCHea `priority` (conservando `sequence`). El badge de prioridad del
  encabezado y el resumen de línea reaccionan.
- **Publicar:** ya existía (`POST /production-plan/publish`); el form ya quedó
  con dropdown del maestro de Modelo y bahía/estación.
- Los controles de secuencia/prioridad solo aparecen en la **vista por línea**
  (donde hay contexto de orden); la vista por estado queda de lectura/flujo.

**Puertas:** `tsc` 0 · `eslint` 0/0 · `next build` ✓.

### Nota
- La re-secuencia hace varios PATCH en paralelo (uno por WO movida). Para líneas
  muy largas, un endpoint batch de re-secuencia sería más eficiente (tarea
  backend opcional); hoy es correcto y poco frecuente.

---

## Estado del carril (cierre de la lista)

Los 3 ítems del carril S4 quedaron en verde y mergeados a `main` (squash):
- **#270** Ítem 1 · muro por línea/estación + adelantado/atrasado.
- **#276** Ítem 2 · semáforo Clear-to-Build (BOM + material + FAI).
- **Ítem 3** · secuencia (ordenar/priorizar) + publicar.

---

## Ítem 4 — Profundización: carga vs capacidad por línea en `planning` ✅

**Archivos:** `apps/web/src/app/dashboard/planning/page.tsx`. Surfacing del
endpoint **ya existente** `GET /plans/intelligence` (guard `PLANNING_VIEW`), que
no se consumía en la UI. Cero backend.

- **Panel "Carga de líneas" (CRP-lite):** barra por línea con `loadPercent`
  coloreada por `status` (optimal=verde / warning=ámbar / overloaded=rojo) y
  `currentLoad/capacity u`. Encabezado con **backlog** (planes pendientes) y
  **riesgos de readiness** (pendientes críticos). Corrige el supuesto previo de
  "no hay CRP": existe para el plan legacy (tabla `LineCapacity`).
- **Honesto:** si no hay capacidades configuradas, muestra un texto explicativo
  en vez de barras vacías. Si el usuario no tiene `PLANNING_VIEW` (o todo está en
  cero en un sistema limpio), el panel no se renderiza (sin ruido).

**Puertas:** `tsc` 0 · `eslint` 0/0 · `next build` ✓.

### Nota backend para mañana (mock detectado, NO tocado)
- `plans.calculateReadiness()` devuelve `materials/quality/shipping = 'green'`
  hardcodeado; el `readinessSummary` del release legacy es de adorno. El semáforo
  honesto vive en el muro de WOs (Ítem 2, `production-plan`). Unificar readiness
  real en el plan legacy = tarea backend.
- `lineLoad` usa la línea entera del plan legacy (`plans.line`), no las líneas
  string del muro `production-plan`. Unificar ambos modelos de línea = backend.

<!-- Próximos ítems se agregan abajo -->
