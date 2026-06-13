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

<!-- Próximos ítems se agregan abajo -->
