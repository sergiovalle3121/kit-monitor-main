# AXOS OS — Night Log · Carril B4 (FAI + Changeover/SMED)

Bitácora del carril **B4** (backend). Rama `claude/charming-turing-uh9b94`.
Módulos nuevos, 100% aditivos, tablas prefijadas `sf_`: `fai` (`sf_fai`) y
`changeover` (`sf_changeovers`).

> **Reglas que sigo (rieles de seguridad):** ADITIVO o LÓGICA. Solo creé TABLAS
> NUEVAS prefijadas `sf_`; jamás modifiqué/renombré/borré una entidad o columna
> existente, ni le agregué columnas. Inyecto `production-plan` (no lo reescribo).
> Repos tenant-scoped (DECISIONS §11). Eventos al Event Ledger. `app.module.ts`
> tocado solo aditivamente (1 import + 1 entrada por módulo). Puertas antes de
> mergear: build API + unit tests + smoke de bootstrap contra Postgres en verde.

---

## ▶ RETOMAR AQUÍ

Ambas rebanadas verticales están **completas y en verde**. Listas para que el
frontend las consuma. Siguiente hueco de B4 si se profundiza: ver "Pendientes".

**Puertas (verificadas este turno):**
- `npm run build` (apps/api) — **OK**.
- `npm test` (apps/api) — **69 suites / 429 tests OK** (antes 65/403; +4 suites,
  +26 tests de FAI/changeover; cero regresiones).
- `npm run smoke:bootstrap` contra Postgres 16 efímero — **OK** (esquema
  materializa `sf_fai` y `sf_changeovers` sin colisión de tabla/FK/DI).
- `eslint` de mis dirs — 0 errores reales (formato prettier aplicado a mis files).

---

## GREP antes de construir (no-duplicación)

- **production-plan** (`SfWorkOrder`/`sf_work_orders`): el gancho
  `setFaiApproved(woId, bool)` y los flags `faiRequired`/`faiApproved` **ya
  existían**; `runBlockers()` ya bloquea con `faiRequired && !faiApproved`
  ("Primera pieza (FAI) sin aprobar.") y el `operator-terminal` ya lo respeta en
  `confirm`. ⇒ NO toqué production-plan; **inyecto** su servicio y llamo
  `setFaiApproved` al aprobar la FAI. El gate de ejecución ya estaba cableado;
  solo faltaba **quién aprueba** — eso es la FAI.
- **floor-quality** (patrón de captura): copié el patrón hold→MRB (entity
  prefijada `sf_`, `TenantScopedRepository` vía `getTenantRepositoryToken`,
  numbering central, máquina de estados pura `*-state.ts` + spec, Event Ledger
  opcional, KPIs). FAI reusa ese molde.
- **mes-execution** (contrato de downtime de B1): `mes_downtime_events` con
  `DowntimeReason` que **ya incluye `'changeover'`**. Ver "Contrato B1" abajo.
- **numbering.defaults**: agregué (aditivo) `FAI` (`FAI-YYYY-#####`) y
  `CHANGEOVER` (`CO-YYYY-#####`) al registro de defaults — el patrón documentado
  (DECISIONS §3) de cualquier módulo que pide folio.

---

## Rebanada 1 — FAI (primera pieza) · `sf_fai`

Inspección de primera pieza: pass/fail + mediciones + inspector, ligada a una WO.

- **Entity** `SfFai` (`sf_fai`): woId/woFolio/model/line denormalizados, `result`
  (PENDING/PASS/FAIL), `measurements` jsonb (characteristic, nominal, lsl/usl,
  actual, **pass computado**), inspector, serial, folio `FAI-`.
- **Estado** (`fai-state.ts`, puro + spec): `PENDING → PASS | FAIL` (terminales).
  Un fallo abre **un nuevo intento** (historial completo por WO).
- **Regla de calidad:** no se puede **PASS** si alguna medición está **fuera de
  tolerancia** (`allWithinTolerance`) → `400`.
- **Al aprobar:** `plan.setFaiApproved(woId, true)` ⇒ la WO (si `faiRequired`)
  deja de estar bloqueada y puede correr. FAIL la deja bloqueada.
- **Guard:** `quality:report` en todo el controller (es el permiso que portan
  operador/inspector/supervisor de línea).

**Endpoints** (`/fai`, `JwtAuthGuard + PermissionsGuard`, `quality:report`):
- `GET /fai?woId&result&line` — lista.
- `GET /fai/kpis` — first-pass yield, pendientes, mediciones fuera de tolerancia.
- `GET /fai/by-wo/:woId` — historial de intentos de una WO.
- `GET /fai/:id` — detalle.
- `POST /fai` `{ woId, station?, serial?, measurements?, notes? }` — abre FAI
  (PENDING) ligada a la WO (404 si la WO no existe).
- `POST /fai/:id/submit` `{ pass, inspector, measurements?, serial?, station?,
  notes? }` — veredicto. PASS libera la WO.

---

## Rebanada 2 — Changeover / SMED · `sf_changeovers`

Checklist de setup + cronómetro de tiempo de cambio, ligado a la transición de
WO/modelo en la línea.

- **Entity** `SfChangeover` (`sf_changeovers`): line, from/to model, from/to WO
  (toWoFolio/toModel enriquecidos desde production-plan, best-effort), `status`
  (OPEN/IN_PROGRESS/COMPLETED/CANCELLED), `checklist` jsonb (key/label/done/
  doneBy/doneAt), `startedAt`/`completedAt`/`durationSec` (cronómetro),
  `targetMinutes` (objetivo SMED), `downtimeCategory='changeover'`,
  `downtimeReported`, folio `CO-`.
- **Estado** (`changeover-state.ts`, puro + spec): `OPEN → IN_PROGRESS →
  COMPLETED`; `CANCELLED` desde cualquier no-terminal.
- **Cronómetro:** `start` arranca el reloj (línea abajo); `complete` lo detiene y
  calcula `durationSec`. `open` puede arrancar de inmediato con `start:true`.
- **Checklist:** `complete` exige todos los pasos hechos salvo `force:true`.
- **Guard:** `production:write` para escrituras, `production:read` para lecturas.

**Endpoints** (`/changeover`, `JwtAuthGuard + PermissionsGuard`):
- `GET /changeover?line&status` · `GET /changeover/kpis` (tiempo de cambio
  promedio, %en objetivo, downtime total) · `GET /changeover/:id` —
  `production:read`.
- `POST /changeover` `{ line, fromModel?, toModel?, fromWoId?, toWoId?,
  targetMinutes?, checklist?, operator?, start?, notes? }` — `production:write`.
- `POST /changeover/:id/start` · `/checklist` `{ key, done, by? }` · `/complete`
  `{ force?, notes? }` · `/cancel` — `production:write`.

---

## Contrato B1 (downtime de changeover) — **gancho listo**

Tarea: "el tiempo de changeover debe poder registrarse como downtime categoría
`'changeover'` (consume el endpoint de B1 si ya está, o deja el gancho listo)".

**Hallazgo:** B1 = `mes-execution` posee `mes_downtime_events`; su
`DowntimeReason` **ya incluye `'changeover'`**, pero:
1. No hay **endpoint público** de downtime — `openDowntime/closeDowntime` son
   **privados**.
2. Está cableado a `executionId` **entero** (`WorkOrderExecution`, el MES legacy),
   **no** a las `sf_work_orders` (UUID) ni a una transición línea/modelo.

⇒ No hay endpoint consumible para un changeover de sf-WO/línea sin **modificar la
entidad existente** `mes_downtime_events` (prohibido por los rieles). Por eso
**dejé el gancho listo**, 100% aditivo:
- El changeover registra su tiempo como downtime categoría `'changeover'` en el
  **Event Ledger** (`SF_CHANGEOVER_DOWNTIME`, dominio PRODUCTION, `reasonCode:
  changeover`, `durationSec`, line, from/to model, WO) — consultable para
  OEE/availability **hoy**.
- La fila `sf_changeovers` porta `downtimeCategory` + `durationSec` +
  `downtimeReported`.
- `ChangeoverService.reportDowntime()` es la **única costura**: cuando B1 exponga
  un endpoint de downtime keyed por línea/sf-WO, se llama ahí (sin tocar nada más).

> **Para B1:** si exponen `POST` de downtime aceptando `{ line, reason, startedAt,
> endedAt|durationSec, workOrder? }` (no atado a `executionId`), lo cableo en
> `reportDowntime()` en un commit aditivo.

---

## Pendientes / próximos huecos de B4 (sin salir del carril)

- Cablear `reportDowntime()` al endpoint real de B1 cuando exista (arriba).
- FAI: opción de "revocar aprobación" (si se reabre una WO) — hoy PASS es
  terminal por intento; un nuevo intento PASS/FAIL re-evalúa. `setFaiApproved`
  acepta `false` si se necesitara revertir desde otro flujo.
- Changeover: derivar `targetMinutes` automáticamente desde
  `sf_model_lines.changeoverMinutes` (line-engineering) en vez de pedirlo en el
  DTO — requiere inyectar line-engineering (hoy se pasa explícito, decoupled).

---

## Archivos de este turno (todos nuevos salvo 2 aditivos)

**Nuevos:**
- `apps/api/src/modules/fai/**` (entity, dto, fai-state(+spec), service(+spec),
  controller, module).
- `apps/api/src/modules/changeover/**` (entity, dto, changeover-state(+spec),
  service(+spec), controller, module).
- `apps/api/src/migrations/20260616120000-CreateFai.ts`,
  `...130000-CreateChangeovers.ts` (aditivas, idempotentes, `hasTable` guard).

**Aditivos (conservar AMBOS lados si choca):**
- `apps/api/src/app.module.ts` — `FaiModule` + `ChangeoverModule` (1 import + 1
  entrada cada uno).
- `apps/api/src/modules/numbering/numbering.defaults.ts` — defaults `FAI` y
  `CHANGEOVER`.
