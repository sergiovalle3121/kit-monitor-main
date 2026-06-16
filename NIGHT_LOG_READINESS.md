# NIGHT_LOG_READINESS — Carril B5 (lógica de plans / production-plan)

Sesión de LÓGICA (no esquema). Área: `plans` y `production-plan`. Regla de
hierro respetada: **0 cambios de esquema** — sólo se LEYERON tablas existentes y
se reusaron servicios exportados. No se modificó, renombró ni amplió ninguna
entidad/columna existente. Smoke de bootstrap contra Postgres en verde.

---

## ✅ Ítem 1 — `plans.calculateReadiness()` deja de mentir (semáforo Clear-to-Build REAL)

**Problema:** `plans.service.ts#calculateReadiness()` devolvía
`materials/quality/shipping = 'green'` HARDCODEADO → el sello de readiness del
release legacy siempre decía "listo". (Ya estaba anotado como mock en
NIGHT_LOG_PLANNING.md.)

**Arreglo (sólo lectura de tablas existentes):**
- **Demanda de la WO** = su BOM surtido persistido (`kit_materials`, vía join
  `km → kit → plan`). Es la demanda real de materiales de esa WO.
- **materials** = demanda vs inventario disponible (`inventory_positions`, sólo
  `holdStatus='available'`, neto de `allocated`). Veredicto: `green` (nada
  corto) / `yellow` (parcial) / `red` (todo corto) / `unknown` (sin BOM/kit).
- **quality** = ¿algún material de la WO con `quality_holds` activo? (se reusa
  `QualityService.findAllActiveHolds()`, servicio ya exportado). `red` si hay
  hold sobre una parte demandada; `green` si no; `unknown` sin demanda.
- **shipping** = criterio real disponible = factibilidad de fecha compromiso
  (`plan.dueDate`, columna existente): `red` (vencida) / `yellow` (vence hoy) /
  `green` (con holgura) / `unknown` (sin fecha).
- El veredicto vive en una función PURA `plans/readiness.ts#deriveReadiness`
  (testeable sin DB). Mismo criterio que el muro de WOs del piso ya usa
  (`web/.../production-plan/wo-board.ts#computeClearToBuild`) → planeación y
  piso coinciden en qué es "listo para construir". `readinessSummary` ahora
  incluye además un `detail` (faltantes ordenados, partes retenidas, días a la
  fecha, razones) — aditivo, no rompe el shape previo.

**Wiring (aditivo, sin tocar esquema):** `PlansService` inyecta
`@InjectRepository(InventoryPosition)` y `@InjectRepository(KitMaterial)`
(ambas entidades ya existían; sólo se registraron en `forFeature` del
`PlansModule`). Se reusa el `QualityService` ya inyectado.

**Specs:**
- `plans/readiness.spec.ts` (nuevo): cobertura pura de los 3 ejes
  (green/yellow/red/unknown, orden de faltantes, posición ausente = 0 disp.).
- `plans/plans.service.spec.ts` (actualizado): el test que afirmaba el `'green'`
  hardcodeado ahora verifica lógica real — sin BOM/fecha = `unknown` (honesto,
  ya no miente verde), y un caso integrado (faltante parcial=`yellow`,
  hold=`red`, fecha vencida=`red`, cubierto=`green`).

## ✅ Ítem 2 — CRP / capacidad por línea para el muro (`production-plan`)

**Objetivo:** exponer **carga vs capacidad por línea** para que el muro pueda
**validar** (no sólo reflejar) la sobreasignación del plan.

**Arreglo (lógica/lectura + endpoint):**
- Nuevo `GET /production-plan/crp?availableMinutes=&line=` (perm `production:read`).
- `ProductionPlanService.capacityLoad()`: toma las **WOs publicadas abiertas**
  (`sf_work_orders`, excluye COMPLETED/CANCELLED), agrupa por `línea → modelo|rev`
  con la demanda restante (`planned − completed`), y **reusa la calculadora de
  capacidad de line-engineering** (`LineEngineeringService.capacity()` — tiempos
  estándar del ruteo/cuello de botella + changeover del modelo↔línea). Suma
  run+changeover por línea y emite veredicto: `utilizationPct`, `feasible`,
  `status` (idle/optimal/warning/**overloaded** >100%), `modelsWithoutStdTime`.
- Math de roll-up en función PURA `production-plan/crp.ts` (testeable).
- `ProductionPlanModule` importa `LineEngineeringModule` (grafo sin ciclos).

**Decisión de diseño (por qué NO se requirió columna nueva):** la "capacidad
disponible" por línea entra como **parámetro** `availableMinutes` (default 1
turno = 480 min). No hay tabla de calendario de capacidad por línea de piso
(string-lines); el legacy `LineCapacity` es sólo para líneas-enteras legacy. Al
parametrizar, el CRP es honesto SIN tocar esquema. *(Mejora futura opcional, si
se desea persistir turnos/min disponibles por línea: sería una **tabla nueva
prefijada** `sf_` — aditivo — NO una columna sobre una entidad existente.)*

**Specs:** `production-plan/crp.spec.ts` (nuevo): helpers puros
(`classifyUtilization`, `rollUpLine`) + `capacityLoad` con calculadora simulada
(agrupa por línea, marca línea sobreasignada vs factible, excluye COMPLETED,
default de turno, modelos sin tiempo estándar, degradación sin calculadora).

---

## Puertas de calidad (todas en verde)
1. `npm run build` (nest/tsc) ✅
2. `npm test` → **67 suites / 426 tests** ✅
3. lint/tsc web: **N/A** (no se tocó ningún archivo de `apps/web`). Lint API:
   los archivos nuevos limpios; se quitó el único `as any` innecesario que
   introduje. (Hallazgos preexistentes de lint API siguen, son no-bloqueantes.)
4. **`npm run smoke:bootstrap` contra Postgres 16 efímero** → OK, grafo
   inicializa limpio (valida el DI nuevo y que no hay colisión de esquema). ✅

## Riesgos / REQUIERE SUPERVISIÓN
- **Ninguno.** No hubo nada que exigiera columna nueva sobre tabla existente; el
  CRP se resolvió con parámetro. Todo fue lectura + reuso de servicios + 2
  funciones puras nuevas + 1 endpoint. Producción con `synchronize:true` no
  corre riesgo: no cambió ninguna entidad.

## Notas / huecos para profundizar (mismo carril)
- `taktTargetSec` no se puebla al publicar (anotado por planning); el CRP no
  depende de él (usa tiempos estándar del ruteo), así que funciona igual.
- El changeover en el CRP se cuenta **una vez por modelo|rev** por línea
  (aproximación honesta); afinar por secuencia real de corridas sería un plus.
- `readinessSummary.detail` ya trae faltantes/holds/razones: el frontend del
  plan legacy podría mostrarlos (hoy sólo se sella; UI = otra sesión).
