# Plan de limpieza — Dieta 3: quitar cascarones muertos + erp/fin + erp/sd

> **Estado:** FASE 0 (mapa) COMPLETA. **DETENIDO esperando aprobación del owner** antes de FASE 1.
> Rama: `claude/remove-dead-shells-erp-jkn05y` (rama designada por el harness para esta tarea;
> el prompt sugería `chore/diet3-remove-erp-fin-sd`, pero se respeta la rama asignada, igual que
> en la Dieta anterior `REMOVE-OFFICE-PLAN.md`).
> Método: mismo probado en `docs/cleanup/REMOVE-OFFICE-PLAN.md` — desenredar ANTES de borrar, un solo PR draft, sin mergear.

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

## 6. Decisiones del owner (BLOQUEANTES antes de FASE 1)

**Q1 — ¿GO para FASE 1 tal como está el plan?** (borrar los 4 frontends + desenredar §2, backend intacto)
- **(Recomendado)** Sí, ejecutar §7 tal cual.
- Ajustar algo antes.

**Q2 — Backend erp-core:** ¿cómo tratarlo?
- **(Recomendado)** Dejar **todo** `erp-core` intacto (frontend-only). Cero riesgo, reutilizable.
- Además, podar los 2 *controllers* HTTP `erp-fin.controller.ts` + `erp-sd.controller.ts` (services se quedan). Quita rutas muertas pero no aporta funcionalidad.

**Q3 — T-codes SAP simulados** (`VA01`,`FB01`,`FB70`,`XD01`…, ~40 handlers mock en `tcode.service`):
- **(Recomendado)** Dejarlos (fuera de alcance; es otro feature).
- Quitarlos también (limpieza extra de "AXOS imitando SAP").

---

## 7. FASE 1 (tras aprobación) — orden de ejecución

1. **Desenredar** referencias §2 filas 1–13 (nav, búsqueda, hub ERP, finance, ErpUI, tcode backend, e2e).
2. **Reescribir** `erp/page.tsx` a solo MM/PP (quitar KPIs/chart/cards/T-codes de fin/sd).
3. **Borrar** los 4 dirs frontend: `lab/`, `industrial-engineering/`, `erp/fin/`, `erp/sd/`.
4. **Backend intacto** (salvo lo que apruebe Q2).
5. **Gate:** `api build` ✅ · `api test` ✅ · `web lint` ✅ · `web build` ✅ · `typecheck` ✅.
   Revertir auto-fixes de lint no relacionados (commit limpio).
6. **Verificar sanos:** `finance`, `erp/mm`, `erp/pp`, `customers` y el flujo de piso; sin links muertos.

---

## 8. "Hecho" (entregable)

- `lab`, `industrial-engineering`, `erp/fin`, `erp/sd` (front) eliminados.
- `finance` + `erp/mm` + `erp/pp` + `customers` + flujo de piso **intactos**.
- Backend `erp-core` intacto (no separable); tablas anotadas, **NO dropeadas**; sin migración destructiva.
- App compila y navega sin links muertos. Este documento. **UN PR (draft), sin mergear.**
