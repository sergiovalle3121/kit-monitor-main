# AXOS OS — Night Log · Carril B3 (Cost Intelligence / COGS)

Bitácora del carril **Finanzas — COGS en vivo** (Bloque M del backlog de piso).
Rama `claude/amazing-dijkstra-ul2s1a`.

> **Reglas que seguí (no negociables):**
> - **ADITIVO O LÓGICA.** Una sola tabla nueva, prefijada `fin_`
>   (`fin_wo_cost_snapshot`), vacía e inofensiva. Todo lo demás es **lógica** que
>   lee datos existentes y calcula. **CERO** modificación/rename/cambio de tipo o
>   columna sobre entidades existentes.
> - **No toqué `cost-rollup`.** Lo GREPié e **inyecté su servicio exportado**
>   (`CostRollupService`) para reusar los actuales de labor/overhead.
> - **`app.module.ts`:** una línea de import + una entrada en el array (aditivo).
> - Repos tenant-scoped; eventos al Event Ledger; referencias denormalizadas.
> - **Puertas en verde** antes de cerrar: build API · `npm test` · **smoke de
>   bootstrap contra Postgres**. (Sin tocar web → no aplica lint/tsc web.)

---

## Qué entregué (rebanada vertical completa)

Módulo **nuevo** `apps/api/src/modules/cost-intelligence/` — el puente piso↔dinero,
en vivo. Prefijo `fin_`. Se apoya en el `SecurityModule` global para los guards.

- **`cogs-math.ts`** (+ spec, 15 tests) — matemática **pura** y testeable sin DB:
  costo de material real desde backflush, costo de material plan (BOM×qty),
  variancia de uso por parte, scrap desde holds, horas estándar de labor, y el
  ensamblado de COGS (material + labor + overhead) con sus fuentes.
- **`entities/fin-wo-cost-snapshot.entity.ts`** — la **única tabla nueva**. Foto
  congelada del costeo de una WO al cierre de periodo (`period` = `YYYY-MM`).
  Extiende `TenantBaseEntity`; dinero en `double precision` (DECISIONS §4);
  índices por (tenant,plant,period), (program,period), period y wo_id.
- **`dto/cost-intelligence.dto.ts`** — `CostingRatesDto` (laborRate/overheadRate
  parametrizables) + `CreateSnapshotDto` (period `YYYY-MM`, woId | programId,
  force, notes).
- **`cost-intelligence.service.ts`** — inyecta los servicios exportados
  `ProductionPlanService`, `LineEngineeringService`, `CostRollupService`; lee
  **read-only** `SfConsumptionEvent` (backflush), `SfQualityHold` (scrap/NCR) y
  `MaterialMaster` (standardCost). Escribe los snapshots vía repo tenant-scoped.
- **`cost-intelligence.controller.ts`** — endpoints (abajo). `finance:read` en las
  lecturas, `finance:write` en el cierre de periodo.
- **`cost-intelligence.module.ts`** — `forFeature` de la tabla nueva + 3 repos
  read-only; importa los 3 módulos de servicios + EventLedger; exporta el servicio.
- **Migración aditiva idempotente** `migrations/20260616000000-CreateCostIntelligence.ts`
  (`if (hasTable) return;`, prefijada, columnas nullable/defaulted).
- Registro aditivo en `app.module.ts` (import + entrada).

### Endpoints (todos bajo `/cost-intelligence`, `JwtAuthGuard + PermissionsGuard`)
- `GET /cogs?woId=&laborRate=&overheadRate=` → **COGS en vivo de una WO**
  (`finance:read`).
- `GET /cogs/program?programId=&laborRate=&overheadRate=` → **COGS agregado de un
  programa** (`finance:read`).
- `GET /variance?woId=` → **variancia de uso de material** (plan BOM×qty vs
  backflush) **+ scrap** desde holds/NCR (`finance:read`).
- `GET /snapshots?period=&programId=&woId=` → histórico **congelado** (`finance:read`).
- `GET /snapshots/kpis?period=&programId=` → roll-up del periodo desde snapshots
  (`finance:read`).
- `POST /snapshots` `{ period, woId|programId, laborRate?, overheadRate?, force?, notes? }`
  → **cierra el periodo** congelando el costeo (`finance:write`).

---

## Cómo se calcula (mapa del backend reusado, GREP antes de inventar)

- **Material REAL (la parte viva del puente):** `Σ(backflushQty × standardCost(part))`
  leyendo `sf_consumption_events` (operator-terminal, Bloque D) y `material_master`
  (inventory). Cada confirmación del operador mueve el dinero en vivo.
- **Material PLAN (BOM × cantidad):** el **ruteo de línea** es el BOM aquí —
  `LineEngineeringService.stationRequirements(model,rev)` da `npExpected` + `useFactor`
  por estación (la MISMA fuente contra la que el operador backflushea). Plan por
  unidad = `Σ(useFactor × stdCost(np))`; × `quantityPlanned`.
- **Variancia de uso de material:** `actual(backflush) − plan(BOM×qty)`, absoluta,
  % y **desglose por parte** ordenado por |variancia|.
- **Scrap:** desde `sf_quality_holds` (floor-quality, Bloque F): `scrapQty` (o la
  qty completa si la disposición es `SCRAP` sin scrapQty aún) × stdCost.
- **Labor:** **no existe fichaje (clocked time) en el sistema** (grep confirmó 0
  resultados de clock/timesheet/attendance). Por eso: si `cost-rollup` tiene un
  costo de labor real para la WO (categoría LABOR) se usa ése; si no, se estima
  como **horas estándar ganadas** (`Σ units × stdTimeSec / 3600`) × **tarifa
  parametrizable** (`laborRate`, default 45 USD/h). La respuesta marca `laborSource`
  = `ROLLUP_ACTUAL` | `STANDARD_TIME_ESTIMATE`.
- **Overhead:** si `cost-rollup` tiene OVERHEAD (+ENERGY) real, se usa; si no,
  **absorción** = `overheadRate` (default 0.18) × (material + labor). `overheadSource`
  = `ROLLUP_ACTUAL` | `RATE_ABSORPTION`.
- **COGS** = material + labor + overhead; **unitCost** = COGS / quantityCompleted.

---

## Decisiones / supuestos (registrados para continuar)

1. **Sin fichaje → tarifa parametrizable + estimación por tiempo estándar.** Es la
   regla del brief ("tiempo fichado × tarifa si el dato existe; si no, tarifa
   parametrizable"). El gancho para labor real ya está: si Finanzas carga cost
   items de labor por WO en `cost-rollup`, COGS los prefiere automáticamente.
2. **"Reusa cost-rollup".** `CostRollupService.getRollup({workOrderId: folio})` no
   es un rollup de BOM (es actuales por categoría), así que se reusa para **labor
   y overhead reales** (no para el plan de material). El plan de material reusa el
   ruteo de IE (línea = BOM del piso), que es exactamente contra lo que se
   backflushea → variancia coherente.
3. **Variancia honesta.** Como el backflush se **calcula** (`units × useFactor`), la
   variancia significativa con los datos de hoy es **plan(BOM×qty) vs actual(backflush
   al volumen completado) + scrap**, no una variancia de cantidad medida
   independientemente. Se expone transparente y por parte. (Mejora futura: capturar
   consumo real medido por parte para una variancia de uso pura por unidad.)
4. **Snapshot = histórico congelado.** `POST /snapshots` por (WO, periodo) es
   **idempotente**: si ya existe NO se recalcula (`force` para re-cerrar). "No
   recalcular histórico" cumplido: las lecturas históricas salen del snapshot.
5. **Sin dominio FINANCE en el Event Ledger.** El enum `EventDomain` legacy no lo
   tiene y **no se toca**; los eventos de snapshot se registran como `PRODUCTION`
   (COGS deriva del piso). Mejora futura supervisada: agregar `FINANCE` al enum.
6. **Dinero como `double precision`** (consistente con las entidades sf_ y
   DECISIONS §4): cifras de gestión/reporte, no asientos contables.

---

## Puertas (todas verdes este turno)

- **Build API** (`npm run build` = nest build/tsc): ✅
- **Unit tests** (`npm test`): ✅ **67 suites / 426 tests** (incluye **23 nuevos**:
  15 de `cogs-math` + 8 de integración del servicio en sqlite).
- **Smoke de bootstrap contra Postgres 16** (`npm run smoke:bootstrap`): ✅
  "application graph initialized cleanly" — el esquema completo materializó por
  synchronize **sin colisiones** y la tabla `fin_wo_cost_snapshot` quedó con sus
  columnas/índices correctos. (Receta del Postgres efímero: ver `NIGHT_LOG.md`.)

---

## ▶ RETOMAR AQUÍ (profundizar el siguiente hueco de B3, sin salir del carril)

- **Frontend de Finanzas/COGS:** página `dashboard/finance/cogs` que consuma
  `/cost-intelligence/cogs` (por WO/programa), `/variance` (waterfall plan→real→scrap)
  y un botón de **cierre de periodo** (`POST /snapshots`) con la tabla de snapshots
  congelados. El backend ya está listo (cero cambios de backend para cablear la UI).
- **Variancia de uso pura por unidad:** si se agrega captura de consumo real medido
  por parte (hoy el backflush es calculado), separar variancia de **uso** (qty/unidad
  vs estándar) de la de **volumen** (unidades completadas vs plan).
- **Snapshot programado de cierre mensual:** job (`@nestjs/schedule`, ya en el repo)
  que al fin de mes cierre todas las WOs completadas del periodo por programa.
- **Dominio `FINANCE` en el Event Ledger** (supervisado, aditivo al enum): hoy se
  loguea como `PRODUCTION`.
- **Energy como línea propia:** hoy ENERGY de `cost-rollup` se pliega en overhead;
  podría exponerse como cuarto componente del COGS si Finanzas lo pide.
