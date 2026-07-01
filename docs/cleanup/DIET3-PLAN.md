# Plan de limpieza — Dieta 3: quitar cascarones muertos + erp/fin + erp/sd

> **Estado:** FASE 0 (mapa) + FASE 1 (ejecución) **COMPLETAS**, según las decisiones del owner (abajo).
> Rama: `claude/remove-dead-shells-erp-jkn05y` (rama designada por el harness para esta tarea;
> el prompt sugería `chore/diet3-remove-erp-fin-sd`, pero se respeta la rama asignada, igual que
> en la Dieta anterior `REMOVE-OFFICE-PLAN.md`).
> Método: mismo probado en `docs/cleanup/REMOVE-OFFICE-PLAN.md` — desenredar ANTES de borrar, un solo PR draft, sin mergear.

## Decisiones del owner (aplicadas)

- **Q1 (FASE 1):** **GO** — ejecutar el plan tal cual.
- **Q2 (backend erp-core):** **dejar todo intacto** (frontend-only). No se toca ningún controller/service/entidad de `erp-core`.
- **Q3 (T-codes SAP simulados):** **quitarlos también** — se eliminaron los handlers mock de **Ventas (SD)** (`VA0*`,`VF0*`,`VL0*N`,`VK11`), **Finanzas (FI)** (`FB01`,`FB50`,`FBL1N`,`FBL3N`,`FBL5N`,`F-53`,`F-28`,`FS10N`,`FB60`,`FB70`,`FD32`) y **maestro de clientes** (`XD01/02/03`) en `tcode.service.ts`, además de los 6 navigate T-codes `FIN01–03`/`SD01–03`. Se conservan los T-codes de MM/Compras/Producción/Sistema/Pagos y los customs `Z*` (incl. `ZFIN`) + `XK*` (maestro de proveedores).

**Gate FASE 1 (verde):** `api build` ✅ · `api test` ✅ (166 suites / 1173 tests) · `web lint` ✅ (0 errores) · `web build` ✅. Rutas borradas ausentes del manifest; `finance`/`erp/mm`/`erp/pp`/`customers` compilan. `smoke:bootstrap` no afectado (no se agregó/quitó módulo, provider, entidad ni controller; el grafo DI y el esquema no cambian). Nota: `apps/api` `tsc --noEmit` (que incluye specs) arrastra errores **preexistentes** en 3 archivos `*.spec.ts` ajenos a este cambio; no es parte del CI (`ci.yml` usa build+test+lint+smoke) y ningún archivo que toqué produce errores de tipos.

## ⚠️ Distinción crítica (no confundir) — `finance` ≠ `erp/fin`

| | Qué es | Backend | Destino |
|---|---|---|---|
| **`erp/fin`** (`app/dashboard/erp/fin`) | Contabilidad doble-entrada tipo SAP (asientos, débito/crédito, balanza, facturas AR/AP, centros de costo). AXOS imitando a SAP. Vacía en producción. | `/erp/fin/*` (erp-core) | **SE BORRA (front)** |
| **`finance`** (`app/dashboard/finance` + `modules/accounting`) | Inteligencia financiera de piso (COGS, costeo por orden, movimientos). Usa `/accounting/transactions`. | `/accounting/*` (módulo **independiente** de erp-core) | **SE CONSERVA — NO SE TOCA** |

`finance` solo pierde **una tarjeta** (el link a `erp/fin`) y se le actualiza **una descripción**. Su KPIs, sus tools reales (`cost-intelligence`, `cost-rollup`), su tabla de movimientos y su backend `/accounting` quedan **intactos**.

---

## 1. Archivos a BORRAR (SOLO frontend — ver §4 para por qué el backend NO se toca)

| Ruta | Líneas | Qué es | Confirmado |
|---|---|---|---|
| `apps/web/src/app/dashboard/lab/` (`page.tsx`) | 36 | Hub `DepartmentWorkspace` (solo tiles a `quality`/`engineering`/`mission-control` + KPIs `/ncr`). Cascarón agregador. | Owner lo declara muerto |
| `apps/web/src/app/dashboard/industrial-engineering/` (`page.tsx`) | 44 | Hub `DepartmentWorkspace` (tiles a `line-engineering`/`engineering`/`production`/`forecast`/`finance/cost-rollup` + KPIs `/line-engineering/kpis`). Cascarón agregador. | Owner lo declara muerto |
| `apps/web/src/app/dashboard/erp/fin/` (`page.tsx`) | 153 | Contabilidad SAP (balanza, asientos, facturas, centros de costo). | Vacía |
| `apps/web/src/app/dashboard/erp/sd/` (`page.tsx`) | 167 | Ventas/pedidos de cliente SAP (pedidos, facturas AR, clientes). Primo del CRM ya borrado. | Vacía |

Los tiles a los que apuntaban `lab`/`industrial-engineering` (quality, engineering, mission-control, line-engineering, production, forecast, finance/cost-rollup) **siguen existiendo**; solo se elimina el agregador.

---

## 2. Referencias a DESENREDAR (editar ANTES de borrar) — grep exhaustivo

| # | Archivo:línea | Referencia | Acción |
|---|---|---|---|
| 1 | `apps/web/src/lib/dashboardAreas.ts:41` | Área "Ing. Industrial" → `/dashboard/industrial-engineering` | **Quitar la fila** |
| 2 | `apps/web/src/lib/dashboardAreas.ts:73` | Área "Pruebas / Lab" → `/dashboard/lab` | **Quitar la fila** |
| 3 | `apps/web/src/lib/dashboardAreas.ts:116` | `EXTRA_ROLE_GRANTS["/dashboard/lab"] = ["test_engineer"]` | **Quitar la entrada** |
| 4 | `apps/web/src/lib/dashboardAreas.ts:86` | Área "Axos ERP" desc `"FIN · MM · PP · SD · T-Codes"` (ruta `/dashboard/erp` **se queda**) | Actualizar desc → `"MM · PP · T-Codes"` |
| 5 | `apps/web/src/app/dashboard/erp/page.tsx` | Hub ERP: `ROUTES` FIN01–03 (52–54) + SD01–03 (61–63); tarjeta `MODULES` fin (67–75) + sd (94–102); KPIs "Utilidad neta"/"Activos" + chart "Resultado del periodo" que consumen `/erp/fin/reports/income-statement` y `/balance-sheet` (108–118, 174–194, 220–240); imports `Landmark`,`ShoppingCart` | **Reescribir el hub a solo MM/PP**: quitar T-Codes FIN/SD, quitar tarjetas fin/sd, quitar los 2 KPIs financieros + el chart de resultado, quitar imports/consultas fin no usados. Quedan KPIs "Valor de inventario" (MM) + "Última corrida MRP" (PP) y tarjetas MM+PP |
| 6 | `apps/web/src/app/dashboard/finance/page.tsx:26` | TOOLS "Contabilidad (FIN)" → `/dashboard/erp/fin` | **Quitar esa tarjeta** (el nudo `finance → erp/fin`). `finance` sigue sano |
| 7 | `apps/web/src/app/dashboard/finance/page.tsx:28` | TOOLS "Consola ERP · T-Codes" desc `"FIN · MM · PP · SD en una sola consola"` (link `/dashboard/erp` **se queda**) | Actualizar desc → `"MM · PP en una sola consola"` |
| 8 | `apps/web/src/components/erp/ErpUI.tsx:56–58,65–67` | `ERP_ROUTES` T-Codes FIN01–03/SD01–03 (compartido por el `ErpHeader` de mm/pp) | **Quitar las entradas FIN/SD** (mm/pp siguen usando el resto) |
| 9 | `apps/web/src/components/SearchPalette.tsx:60` | Dest "Axos ERP" sub `"FIN · MM · PP · SD · T-Codes"` + keywords `fin ... sd` | Actualizar sub → `"MM · PP · T-Codes"`, quitar `fin`/`sd` de keywords |
| 10 | `apps/web/src/components/SearchPalette.tsx:61` | Dest "ERP · Finanzas (FIN)" → `/dashboard/erp/fin` | **Quitar la entrada** |
| 11 | `apps/web/src/components/SearchPalette.tsx:64` | Dest "ERP · Ventas (SD)" → `/dashboard/erp/sd` | **Quitar la entrada** |
| 12 | `apps/api/src/modules/auth/services/tcode.service.ts:24–26,33–35` | `registerErpTCodes()`: navigate T-codes FIN01–03 y SD01–03 → apuntan a las rutas frontend que se borran | **Quitar esas 6 entradas** (dejarían de navegar a páginas muertas). Mantener `ERP`, `MM01–03`, `PP01–03` |
| 13 | `apps/web/e2e/visual-sweep/evidence3.spec.ts:24` | `SURFACES` incluye `{ slug:"industrial-engineering", path:"/dashboard/industrial-engineering" }` (barrido visual) | **Quitar la entrada** (si no, hace screenshot de una página borrada) |

No hay otros callers: `erp/sd/page.tsx` consumía `/erp/fin/invoices?kind=AR` pero se borra con la página; el hub del ERP era el único frontend que llamaba `/erp/fin/reports/*` y se reescribe.

---

## 3. NO TOCAR — conservar explícitamente

- **`finance`** (`app/dashboard/finance`, `finance/cost-intelligence`, `finance/cost-rollup`) y su backend **`apps/api/src/modules/accounting/`** → intactos (solo las 2 ediciones cosméticas #6/#7). Es inteligencia de piso, **NO** SAP.
- **`erp/mm`** y **`erp/pp`** (front) → intactos. Se transformarán después en vistas del ledger.
- **Todo `apps/api/src/modules/erp-core/`** (backend fin+sd+mm+pp: servicios, controladores, entidades) → intacto. Ver §4.
- **Flujo de piso, `customers`, torres de control, reportes** → intactos.
- **T-codes SAP simulados** (`VA01`,`FB01`,`FB70`,`XD01`… en `tcode.service.registerStandardTCodes()`) → **fuera de alcance**. Son un simulador de command-palette con handlers mock; no son las pantallas `erp/fin`/`erp/sd`. Se anotan; no se tocan salvo que el owner lo pida.

---

## 4. ⚠️ Hallazgo central — el backend fin/sd NO es separable (por eso NO se borra)

Grafo de inyección de NestJS en `erp-core` (X inyecta Y):

```
  mm ──▶ fin
  sd ──▶ fin, mm
  pp ──▶ mm, sd
```

Los módulos que **se conservan** (`mm`, `pp`) dependen transitivamente de `fin` **y** de `sd`:

- `apps/api/src/modules/erp-core/services/erp-mm.service.ts:61,502,588` — MM inyecta `ErpFinService` y llama `this.fin.postByRule(...)` (postea asientos contables en **cada recepción/movimiento de materiales**). Borrar FIN **rompe MM**.
- `apps/api/src/modules/erp-core/services/erp-pp.service.ts:66,151` — PP inyecta `ErpSdService` y llama `this.sd.openDemand()` (el MRP lee la **demanda de pedidos de venta**). Borrar SD **rompe PP**.

**Conclusión (regla §1/§3 del prompt):** como fin/sd comparten backend con mm/pp de forma **no separable**, **NO se borra backend — solo el frontend.** Todo `erp-core` (los 4 controllers, los 4 services, todas las entidades) queda **intacto**.

Consecuencia positiva: **NO quedan tablas huérfanas** ni hace falta migración alguna. Las tablas siguen cableadas y en uso por los servicios que se quedan. Los endpoints HTTP `/erp/fin/*` y `/erp/sd/*` quedan vivos pero sin UI que los consuma (inofensivo; reutilizables cuando mm/pp pasen a "vistas del ledger").

> **Opción secundaria para el owner (§6, Q2):** se podrían podar solo los *controllers* HTTP `erp-fin.controller.ts` y `erp-sd.controller.ts` (nadie los inyecta; los services se quedan intactos porque mm/pp los necesitan). Recomendación: **dejarlos** por ahora — quitar rutas no aporta y complica la reutilización futura.

### Tablas que quedan sin UI propia (informativo — **NO dropear**, siguen en uso vía servicios)

```
FIN: erp_accounts · erp_cost_centers · erp_fiscal_periods · erp_posting_rules
     erp_journal_entries · erp_journal_lines · erp_invoices · erp_invoice_lines · erp_payments
SD:  erp_customers · erp_sales_orders · erp_sales_order_lines
```

Ninguna migración se toca (historia aplicada). Cero migración destructiva.

---

## 5. Referencias solo-documentación (NO rompen build; se dejan como historia)

Auditorías históricas que mencionan las rutas borradas — informativas, no bloqueantes:
`docs/UX-POLISH-REPORT.md:329`, `docs/design/AXOS_GLOBAL_UX_FLUIDITY_AUDIT.md:127`,
`docs/BETA-READINESS-AUDIT.md`, `docs/BETA-READINESS-REPORT.md`, `docs/landing/LANDING-HONESTY-AUDIT.md`.
Se dejan intactas (son reportes con fecha).

---

## 6. Decisiones del owner — resueltas

Ver **"Decisiones del owner (aplicadas)"** al inicio del documento. Resumen: Q1 = GO · Q2 = backend intacto · Q3 = quitar T-codes SAP simulados de Ventas/Finanzas/maestro-de-clientes.

---

## 7. FASE 1 — ejecutada

1. ✅ **Desenredadas** las 13 referencias §2 (nav, búsqueda, hub ERP, finance, ErpUI, tcode backend, e2e).
2. ✅ **Reescrito** `erp/page.tsx` a solo MM/PP (quitados KPIs financieros, chart de resultado, tarjetas fin/sd, T-codes FIN/SD).
3. ✅ **Borrados** los 4 dirs frontend: `lab/`, `industrial-engineering/`, `erp/fin/`, `erp/sd/`.
4. ✅ **Backend `erp-core` intacto** (Q2). Además se limpiaron los T-codes SAP simulados SD/FI/XD (Q3).
5. ✅ **Gate verde:** `api build` · `api test` (166/1173) · `web lint` (0 err) · `web build`. (`tsc --noEmit` con specs: errores preexistentes ajenos — ver nota arriba; `smoke:bootstrap` no afectado.)
6. ✅ **Sanos verificados:** `finance`, `erp/mm`, `erp/pp`, `customers` compilan y están en el manifest; sin links muertos.

---

## 8. "Hecho" (entregable)

- `lab`, `industrial-engineering`, `erp/fin`, `erp/sd` (front) eliminados.
- `finance` + `erp/mm` + `erp/pp` + `customers` + flujo de piso **intactos**.
- Backend `erp-core` intacto (no separable); tablas anotadas, **NO dropeadas**; sin migración destructiva.
- T-codes SAP simulados de Ventas/Finanzas/maestro-de-clientes eliminados de `tcode.service.ts` (Q3).
- App compila y navega sin links muertos. Este documento. **UN PR (draft), sin mergear.**
