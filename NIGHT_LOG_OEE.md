# NIGHT_LOG_OEE — Carril B1 · Módulo `oee` (Bloque H)

Bitácora del módulo de **OEE / métricas de piso** (la métrica que vive el gerente
de planta). Aditivo 100%, tablas prefijadas `sf_`. Corre en paralelo; NO toca
operator-terminal / production-runtime / floor-quality / control-tower (solo
inyecta/lee servicios y entidades existentes).

---

## ▶ ESTADO: entregado y en verde (rama `claude/lucid-galileo-yjzwpb`)

Las 3 puertas obligatorias pasan:
- **Build API** (`npm run build` = nest build / tsc) → OK.
- **Unit tests** (`npm test`) → **67 suites / 422 tests** verdes (incluye las nuevas
  de OEE y rbac).
- **Smoke de bootstrap** contra **Postgres 16 fresco** (`synchronize` materializa
  TODO el esquema) → `OK — application graph initialized cleanly`. Verificado que
  `sf_downtime_events` y `sf_hxh_target` se crean sin colisión junto al resto de
  tablas `sf_`.

> **PR/merge:** NO se abrió PR ni se mergeó (la instrucción dura del entorno es no
> crear PR sin que el usuario lo pida explícitamente). El trabajo queda commiteado
> y pusheado a la rama designada, listo para revisión/merge supervisado.

---

## Qué se entregó (rebanada vertical completa)

Módulo nuevo `apps/api/src/modules/oee/`:

1. **Helper puro `oee.ts` + `oee.spec.ts`** — el corazón. `computeOee()`:
   - Disponibilidad = runTime/plannedTime (runTime = planned − downtime).
   - Rendimiento = (cicloIdeal × piezas)/runTime.
   - Calidad = buenas/total.
   - OEE = D×R×C. Cada factor **clamp [0,1]**; entradas basura se coercionan a 0
     (nunca NaN). `weightedIdealCycleSec()` promedia el ciclo ideal ponderado por
     piezas para que la fórmula valga exacta a nivel línea (mezcla de modelos).
2. **`sf_downtime_events`** (tabla nueva) — paros con **código de razón
   categorizado** (EQUIPMENT, MATERIAL, QUALITY, CHANGEOVER, NO_OPERATOR, OTHER).
   Endpoints **abrir** (`POST /oee/downtime/open`) y **cerrar**
   (`POST /oee/downtime/:id/close`, calcula `durationMinutes` y permite
   recategorizar) + listar. Es la fuente de Disponibilidad.
3. **`sf_hxh_target`** (tabla nueva) — meta **línea/turno/hora**. El **REAL se
   DERIVA** de los eventos de avance existentes (`sf_consumption_events`, lectura
   read-only) — **no se duplica conteo**. `GET /oee/hxh?line=&date=&shift=` devuelve
   **meta vs real por hora + razón del miss** (razón dominante de downtime de esa
   hora, o `PACE_OR_QUALITY` si no hubo paro). `effectiveDate` opcional = override
   por día; null = plantilla estándar. Upsert con `IsNull()` (TypeORM no matchea
   `null` crudo → era un bug, corregido y blindado por test).
4. **OEE endpoints** — `GET /oee/line` (por línea/ventana/turno) y
   `GET /oee/work-order/:woId` (ciclo ideal de la WO + avance + holds). Devuelven el
   desglose completo + downtime por razón.
5. **Feed para Control Tower** — `GET /oee/control-tower`: agregador de **OEE/output
   por línea** (peor OEE primero) + rollup. `OeeService` se **exporta** para que
   `control-tower` lo pueda inyectar y consumir.
6. Migración aditiva idempotente `20260616120000-CreateOeeMetrics.ts` (guard
   `hasTable` → no-op sobre esquema ya materializado).
7. Registro en `app.module.ts`: **1 import + 1 entrada** en el array (aditivo).

### Acoplamiento (servicios/entidades, sin tocar legacy)
- Inyecta `ProductionPlanService` (WO: línea, `taktTargetSec`=ciclo ideal,
  cantidades).
- Lee **read-only** `sf_consumption_events` (avance/output) y `sf_quality_holds`
  (scrap) vía `@InjectRepository` + un segundo `forFeature` (inofensivo) — mismo
  patrón que ya usa floor-quality (F) para `whereUsed`. operator-terminal (D) y
  floor-quality (F) **no se modificaron**.
- Eventos transaccionales (`SF_DOWNTIME_OPENED/CLOSED`) al **Event Ledger**
  (`@Optional`, dominio PRODUCTION).
- Repos tenant-scoped para las tablas propias; QueryBuilder con `applyScope`
  (tenant+plant) en lecturas (igual que el resto del piso). Test anti-fuga incluido.

---

## Decisiones / supuestos (estilo ADR ligero)

1. **`production:report` (permiso NUEVO, aditivo en `rbac.ts`).** La tarea pide
   guards `production:write` / `production:report`; este último **no existía**.
   `rbac.ts` es CONFIG/lógica (no es entidad ni tabla) → agregarlo NO es cambio de
   esquema y no toca `synchronize`. Se siguió el precedente de DECISIONS §12 (los
   permisos de piso se extendieron aditivamente ahí). Otorgado a: `plant_manager`,
   `production_supervisor`, `industrial_engineer`, `planner`, `executive`. `admin`
   lo hereda automático (ALL_PERMISSIONS = unión). `rbac.spec.ts` sigue verde
   (ninguna aserción negativa cubre `production:report`; el superset de admin se
   mantiene). Escrituras (abrir/cerrar paro, fijar meta) → `production:write`;
   lecturas/reportes (OEE, hxh, downtime list, feed torre) → `production:report`.
2. **REAL derivado, no recontado.** El conteo ocurre UNA vez en `confirm()` del
   terminal (ledger inmutable `sf_consumption_events`). OEE/hxh solo **leen y
   agrupan** ese ledger (bucket por hora de `created_at`, igual que el `hourByHour`
   existente de D). No se inyectó `OperatorTerminalService` porque su superficie
   pública (`hourByHour(woId)`) es por-WO y no cubre ventanas línea/turno; leer el
   ledger read-only es el patrón ya bendecido por floor-quality.
3. **Ventana de tiempo / turno.** No existe calendario de turnos en el repo. Se
   modela `shift` como etiqueta denormalizada y la ventana por `from`/`to` (default:
   hoy→ahora; o día completo para hxh). `plannedMinutes` es parámetro (default =
   largo de la ventana) — el gerente puede pasar 480, etc. `effective_date` como
   `varchar(10)` 'YYYY-MM-DD' (portable sqlite/PG, sin líos de timezone).
4. **Filtrado de ventanas en JS, no en SQL.** Las comparaciones de fecha (`created_at`,
   overlap de downtime) se hacen en JS tras filtrar por `wo_id`/`line` en SQL — evita
   las diferencias de comparación de fechas sqlite vs Postgres (los unit tests corren
   en sqlite). Mismo espíritu que `operator-terminal.hourByHour`.
5. **Calidad sin producción → 0.** Si `totalPieces=0` no hay señal de calidad; se
   reporta 0 (el OEE ya es 0 vía rendimiento). Rendimiento se **clampa a 1** si la
   línea corre más rápido que el ciclo ideal.

---

## Cumplimiento de las REGLAS DE HIERRO
- ✅ Solo **TABLAS NUEVAS** prefijadas `sf_` (vacías, aditivas) + **LÓGICA** que
  lee datos existentes.
- ✅ **CERO** modificaciones a entidades/columnas existentes. (No hubo necesidad de
  tocar nada existente → no aplicó el tripwire "REQUIERE SUPERVISIÓN".)
- ✅ Migración aditiva idempotente con el CLI ya arreglado.
- ✅ `app.module.ts` aditivo (1+1). Si choca al `git merge origin/main`: conservar
  AMBOS lados.
- ✅ Smoke de bootstrap contra Postgres en verde (red de seguridad).

---

## Siguiente hueco de MI área (si se profundiza, sin salir del carril)
- **Cablear el feed en Control Tower (1 línea de inyección, aditivo):**
  `control-tower` puede importar `OeeModule` e inyectar `OeeService.controlTowerFeed()`
  para sumar una tarjeta OEE/output a su `GET /summary`. NO se hizo aquí porque toca
  un archivo de OTRA área y la tarea pedía solo **exponer** el endpoint consumible
  (hecho). Es el primer follow-up natural cuando se autorice tocar control-tower.
- **Entrega de turno (shift handover):** resumen OEE + paros abiertos + miss
  acumulado por turno (tabla nueva `sf_shift_handover` si se quiere persistir, o
  derivado read-only). El brief de Bloque H lo menciona.
- **Escalamiento de paros por tiempo** (Bloque G): subir severidad/abrir orden de
  mantenimiento si un downtime OPEN supera N min — extender, no duplicar
  (`maintenance` ya existe).
- **Frontend** `dashboard/oee` (hxh board + semáforo OEE por línea) consumiendo
  estos endpoints (sin prefijo `/api`; lo añade `NEXT_PUBLIC_API_URL`).
