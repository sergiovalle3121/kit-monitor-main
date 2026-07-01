# Plan de limpieza — Quitar maintenance + ehs (fuera del flujo de materiales SAP/MES)

> **Estado:** FASE 0 (mapa) COMPLETA. **DETENIDO esperando aprobación del owner** antes de FASE 1.
> Rama: `claude/remove-dead-shells-erp-jkn05y` (rama designada por el harness, reiniciada desde
> `origin/main` que ya trae las dietas anteriores mergeadas; el prompt sugería
> `chore/remove-maintenance-ehs`, pero se respeta la rama asignada, igual que en dietas previas).
> Método: mismo probado en `REMOVE-OFFICE-PLAN.md` / `DIET3-PLAN.md` — desenredar ANTES de borrar, un PR draft, sin mergear.

## 0. Criterio

AXOS reconcilia SAP + MES + piso del **flujo de materiales**. `maintenance` (CMMS: activos, órdenes, preventivos) y `ehs` (seguridad/medio ambiente) **no** son SAP, ni MES, ni operación de materiales — son otro dominio/sistema. Se quitan para mantener AXOS enfocado.

---

## 1. Archivos a BORRAR

**Frontend:**
- `apps/web/src/app/dashboard/maintenance/` — 9 archivos (`page.tsx` + `maintenance.{actions,assets,orders,overview,preventive}.tsx` + `maintenance.{types,ui,utils}.ts`)
- `apps/web/src/app/dashboard/ehs/` — 2 archivos (`page.tsx`, `[id]/page.tsx`)

**Backend:**
- `apps/api/src/modules/maintenance/` — 16 archivos (controller, service, module, dto, **3 entidades** `asset`/`maintenance-order`/`pm-plan`, `maintenance-pm.task.ts`, lógica `order-state`/`pm-frequency`/`reliability` + specs)
- `apps/api/src/modules/ehs/` — 8 archivos (controller, service, module, dto, **1 entidad** `safety-incident`, `incident-state` + specs)

---

## 2. ⚠️ Desenredo — 3 acoples (uno crítico + DOS que el prompt no mencionaba)

### 2A. La IA (CIDE) — el desenredo crítico (como `list_fixed_assets` en la dieta admin)

`ai.module.ts` **no** importa estos módulos (resuelve servicios vía `ModuleRef` perezoso), pero varios archivos de IA sí los referencian por tipo/registro:

| Archivo | Líneas | Acción |
|---|---|---|
| `modules/ai/ai-actions.service.ts` | imports 3,7; `case create_maintenance_order` 79-89; `case assign_ehs_incident_owner` 123-132; `case set_maintenance_order_status` 133-139; `case create_safety_incident` 140-143 | Quitar los 2 imports y los 4 `case`. Conservar `release_quality_hold`, `create_purchase_requisition`, `create_production_plan` |
| `modules/ai/ai-actions.ts` | consts `MO_TYPES`/`MO_PRIORITIES` 48-49; defs `create_maintenance_order` 53-100, `assign_ehs_incident_owner` 193-218, `set_maintenance_order_status` 220-239, `create_safety_incident` 241-267 | Quitar las 4 acciones + los 2 consts (solo los usaba `create_maintenance_order`). `ACTION_KEYS` (270) se re-deriva solo |
| `modules/ai/ai-tools.service.ts` | imports 19-20; tools `maintenance_orders` 808-834, `maintenance_assets` 835-846, `maintenance_pm_plans` 847-869, `safety_incidents` 870-900; descripción de `propose_action` 1049-1059 | Quitar los 2 imports y los 4 tools; recortar la descripción. **Conservar `list_tools`** (Herramentales; reutiliza el permiso `maintenance:read`) |
| `modules/ai/ai-insights.service.ts` | 61-68 | Quitar fuentes `maintenance_orders`/`safety_incidents` → `const [kpiAlerts, qualityHolds] = …`; `buildSituationReport({ kpiAlerts, qualityHolds })` |
| `modules/ai/ai-insights.ts` | `maintenanceToInsights` 66-86; `ehsToInsights` 104-127; `buildSituationReport` 130-148 | Quitar los 2 transformadores; quitar `maintenance`/`ehs` (y el param `now`) de `buildSituationReport`. Conservar `kpiAlertsToInsights`, `qualityHoldsToInsights` |
| `modules/ai/ai.service.ts` | 689 (system prompt) | Recorte de prosa: quitar `"mantenimiento (órdenes, activos, preventivos),"` y `"EHS/seguridad,"` de la lista de módulos |
| `modules/ai/ai.controller.ts` | 101 (comentario) | Recorte: quitar `"overdue maintenance"` y `"EHS"` del JSDoc |

**Specs de IA (para que `api test` siga verde):**
- `ai-actions.spec.ts` — quitar `describe` de `create_maintenance_order` (3-42), `assign_ehs_incident_owner` (91-101), `set_maintenance_order_status` (103-113), `create_safety_incident` (115-130). Conservar los 3 restantes.
- `ai-actions.service.spec.ts` — el `setup()`/exemplar usa `create_maintenance_order`; **reescribir** para usar `create_purchase_requisition` como acción de ejemplo; quitar el test de EHS (119-133).
- `ai-insights.spec.ts` — quitar `describe` de `maintenanceToInsights` (27-41) y `ehsToInsights` (56-67); reescribir el test de `buildSituationReport` para usar solo `kpiAlerts`+`qualityHolds`; limpiar imports y consts `NOW/PAST/FUTURE`.

### 2B. ⚠️ Control Tower (KEPT — el prompt lo conserva, pero **inyecta** estos servicios)

`control-tower` es una torre de control que **se conserva**, pero usa **inyección por constructor** (no perezosa): si se borran los módulos sin limpiar esto, **rompe el arranque (DI) de la torre.**

| Archivo | Líneas | Acción |
|---|---|---|
| `modules/control-tower/control-tower.module.ts` | imports 5,6; array 19,20 | Quitar `EhsModule`/`MaintenanceModule` |
| `modules/control-tower/control-tower.service.ts` | imports 3,4; ctor 37,38; `Promise.all` 51-59; card `ehs` 63-85; card `maintenance` 125-140 | Quitar los 2 imports, params, llamadas `.kpis()` y las 2 tarjetas. **Conservar** las tarjetas quality/procurement/testing/improvement |
| `modules/control-tower/control-tower.service.spec.ts` | `build()` (args posicionales), mocks `ehs`/`maintenance`, tests de card `ehs` | Actualizar `build()` (quitar 2 args), quitar mocks y asserts de ehs/maintenance |

### 2C. ⚠️ Seed demo (KEPT — **rompería `api build`** por imports muertos)

Los seeds están en `src/` (los compila `nest build`): imports muertos = build roto.

| Archivo | Líneas | Acción |
|---|---|---|
| `seed/seed-demo.ts` | imports 62-66 (`EhsService`, `SafetyIncident`, `MaintenanceService`, `Asset`, `MaintenanceOrder`); bloque EHS 1479-1486; bloque maintenance 1488-1501; `DEMO_MAINT_ASSETS`/`DEMO_MAINT_ORDERS` + `seedMaintenanceDepth` 1685-~1780; llamada 2326 | Quitar imports, bloques de seed y la función + su llamada |
| `seed/seed-demo-clear.ts` | imports 47-48 (`Asset`, `MaintenanceOrder`); `removeBy` 179-180 | Quitar imports y las 2 limpiezas |

### 2D. Navegación / búsqueda / chat (simple)

| Archivo | Líneas | Acción |
|---|---|---|
| `web/src/lib/dashboardAreas.ts` | 65 (área "Mantenimiento · TPM"), 97 (área "EHS · Seguridad"), 127 (`EXTRA_ROLE_GRANTS "/dashboard/ehs"`) | Quitar las 2 filas + el grant |
| `web/src/components/SearchPalette.tsx` | 48 (dest EHS), 49 (dest Mantenimiento) | Quitar los 2 dests |
| `web/src/lib/chat/toolSources.ts` | 27-32 (`maintenance_orders`/`_assets`/`_pm_plans`), 35 (`safety_incidents`) | Quitar las 4 entradas (conservar `list_tools`) |

### 2E. Registro de módulos

`apps/api/src/app.module.ts` — imports 15,16 + array 109,110 → quitar `EhsModule`/`MaintenanceModule`.

---

## 3. NO TOCAR — conservar explícitamente

- **`suppliers`, `procurement`, `forecast`** (front + back) — arrancan el plan / alimentan planeación. Intactos.
- **Permisos `maintenance:read` / `maintenance:write`** en `auth/rbac.ts` (66,157,158) — **los usa Tooling** (`tooling.controller.ts`, 8× `@RequirePermissions('maintenance:write')`) y el AI tool `list_tools`. **NO se quitan** (romperían Tooling).
- **Roles `maintenance_tech`** (rbac.ts 23,156) y **`ehs_specialist`** (rbac.ts 31,216) — se **conservan** (roles seedeables; `ehs_specialist` solo pierde el acceso de navegación). Ver Q2.
- IA (CIDE), torres de control, finance y **todo el flujo de piso** — intactos (quedan sanos tras el desenredo).

---

## 4. Backend: tablas huérfanas (NO dropear — regla #3) + migraciones (se quedan)

**4 tablas huérfanas** (inofensivas; sin migración destructiva):
```
maintenance:  assets · maintenance_orders · maintenance_pm_plans
ehs:          safety_incidents
```
**Migraciones (historia aplicada — se quedan):**
```
20260607140000-CreateSafetyIncidents.ts
20260607150000-CreateMaintenance.ts
20260623120000-CreateMaintenancePmPlans.ts
```

---

## 5. Decisiones del owner (BLOQUEANTES antes de FASE 1)

**Q1 — ¿GO para FASE 1?** (desenredar IA + control-tower + seed + nav, borrar ambos módulos front+back, tablas huérfanas anotadas)
- **(Recomendado)** Sí, ejecutar §6 tal cual.
- Ajustar algo antes.

**Q2 — Rol `ehs_specialist`** (queda sin módulo propio tras quitar ehs; sus permisos son genéricos `reports:read`/`production:read`):
- **(Recomendado)** Conservarlo (huérfano inofensivo; evita romper usuarios ya seedeados con ese rol).
- Quitarlo también de `rbac.ts` (limpieza; riesgo si hay usuarios con ese rol).

> `maintenance_tech` se conserva **siempre** — Tooling depende de sus permisos `maintenance:*`.

> **Nota:** los acoples 2B (control-tower) y 2C (seed) **no** estaban en el prompt pero son **obligatorios**: sin limpiarlos, el `api build` y el arranque DI se rompen. Se desenredan como parte de FASE 1 dejando control-tower y el seed sanos.

---

## 6. FASE 1 (tras aprobación) — orden de ejecución

1. **Desenredar la IA** (2A: services + registros + prosa + 3 specs).
2. **Desenredar control-tower** (2B: module + service + spec) y **seed** (2C).
3. **Quitar** nav/búsqueda/chat (2D) y el registro en `app.module.ts` (2E).
4. **Borrar** `maintenance` + `ehs` (front + back).
5. **Gate:** `api build` ✅ · `api test` ✅ · `web lint` ✅ · `web build` ✅ · `typecheck`. Revertir auto-fixes ajenos.
6. **Verificar sanos:** IA (CIDE) arranca y responde; control-tower, `suppliers`/`procurement`/`forecast` y el flujo de piso; sin links muertos.

---

## 7. "Hecho" (entregable)

- `maintenance` + `ehs` eliminados (front + back).
- IA (CIDE) sana sin ellos; control-tower, `suppliers`/`procurement`/`forecast` + flujo de piso intactos; app compila sin links muertos.
- 4 tablas huérfanas anotadas, **NO dropeadas**; 3 migraciones se quedan. Sin migración destructiva.
- Este documento. **UN PR (draft), sin mergear.**
