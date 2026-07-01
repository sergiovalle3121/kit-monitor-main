# Plan de limpieza — Dieta 2: quitar módulos administrativos (FASE 0)

> **Estado:** FASE 0 (mapa de desenredo) completa. **DETENIDO esperando aprobación del owner.**
> No se ha borrado nada. Rama: `claude/remove-office-shells-ncvn0u` (rama designada por el harness;
> la de Office ya se mergeó — se reinició desde `main` para este cambio nuevo).

## Objetivo

Re-enfocar AXOS en el flujo de materiales de piso. Quitar 6 módulos administrativos puros
(RH, CRM, legal, gastos, activos fijos, skills) que no tocan ese flujo y son territorio de SAP.

---

## 0. Resumen ejecutivo + hallazgos que requieren decisión

Los módulos `rh`, `skills`, `legal`, `expenses`, `fixed-assets` son de **borrado limpio**: sus
únicos acoples externos son navegación/búsqueda/chat + `seed-demo`. Pero **CRM tiene un acople
profundo NO contemplado en el prompt** que obliga a una decisión del owner:

### ⚠️ Hallazgo 1 — `customer-insights` (backend del módulo CONSERVADO `customers`) depende de entidades CRM

El prompt asumió que `customers` solo **enlaza** a CRM con un hyperlink. En realidad, el backend
que alimenta la vista 360 de clientes (`customer-insights`, consumido por
`customers/page.tsx` y `customers/[code]/page.tsx` vía `GET /customer-insights[/:code]`)
**inyecta repositorios de CRM** y expone datos comerciales:

- `apps/api/src/modules/customer-insights/customer-insights.service.ts` → inyecta
  `@InjectRepository(CrmAccount|Opportunity|CrmQuote)`, método `commercial()`, expone
  `pipelineValue`/`wonValue`.
- `apps/api/src/modules/customer-insights/customer-insights.module.ts` → `forFeature([CrmAccount, Opportunity, CrmQuote])`.
- Front: `apps/web/src/lib/customer360.ts` tipa `commercial: { pipelineValue, weightedValue, wonValue }`;
  `customers/[code]/page.tsx` pinta una sección **"Comercial (CRM)"** + un link "Cuenta CRM".

Las 6 entidades CRM son **planas** (sin relaciones TypeORM entre sí), así que `customer-insights`
solo necesita 3 (`CrmAccount`, `CrmQuote`, `Opportunity`).

**→ Decisión del owner (D1, ver §5).** No se puede "borrar las 6 entidades CRM" sin decidir qué
pasa con la vista 360 de `customers`.

### ⚠️ Hallazgo 2 — `seed-demo.ts` siembra los 4 backends (obligatorio desenredar)

`apps/api/src/seed/seed-demo.ts` importa y siembra `crm`, `legal`, `expenses`, `fixed-assets`
(~45 referencias: `CrmService`, `AccountsService`, `QuotesService`, `LegalService`,
`ExpensesService`, `FixedAssetsService`, sus entidades, etc.). Si se borran los módulos sin
limpiar esto, **el build del API rompe** (tsc/nest compila `src/seed/`). Hay que quitar ese
bloque de siembra. No es opcional (mandatorio en FASE 1).

### ⚠️ Hallazgo 3 — Búsqueda global: la fuente `person` enlaza a `/dashboard/skills`

`components/searchSources.ts` (línea ~174) mapea cada persona (de `/people/certifications`,
backend **que se queda**) con `href: '/dashboard/skills'`. Al borrar `skills` ese destino muere.
**→ Decisión del owner (D3).** Recomendación: quitar la fuente `person` de la búsqueda (igual
que se quitó `doc`/Office). El módulo `people` (datos) permanece; solo se retira su entrada en
la paleta de búsqueda por falta de página de aterrizaje.

---

## 1. Archivos a BORRAR

**Front (`apps/web/src/app/dashboard/`):**
- `crm/` (3 archivos: `page.tsx`, `accounts/[id]/page.tsx`, `quotes/[id]/page.tsx`)
- `rh/` (6 archivos: page + `plantilla|analitica|reclutamiento|desempeno` + `_components/ui.tsx`)
- `skills/` (1)
- `legal/` (1)
- `expenses/` (2: page + `[id]`)
- `fixed-assets/` (2: page + `[id]`)

**Back (`apps/api/src/modules/`):**
- `crm/` (26 archivos, 6 entidades) — **sujeto a D1** (Opción A conserva 3 entidades)
- `legal/` (8, 1 entidad `Contract`)
- `expenses/` (8, 1 entidad `ExpenseReport`)
- `fixed-assets/` (8, 1 entidad `FixedAsset`)

`rh` y `skills` **no tienen backend**.

---

## 2. Referencias externas a LIMPIAR (desenredar ANTES de borrar)

| # | Archivo:línea | Referencia | Acción |
|---|---|---|---|
| 1 | `lib/dashboardAreas.ts:86,87,101,102,104,105` | 6 entradas de nav (fixed-assets, expenses, rh, skills, legal, crm) | Quitar las 6 filas |
| 2 | `lib/dashboardAreas.ts:114,138` | overrides de rol `/dashboard/crm`, `/dashboard/skills` | Quitar |
| 3 | `components/SearchPalette.tsx:50,54-59,63,64,65` | 10 entradas (legal, skills, rh + 3 subrutas rh, crm, fixed-assets, expenses) | Quitar |
| 4 | `components/searchSources.ts:~174` (+ tipo `person`) | fuente `person` → `/dashboard/skills` | **D3**: quitar la fuente `person` (kind, `RawCert`, `mapPeople`, fetch `/people/certifications`, `ENTITY_ORDER`/buckets) |
| 5 | `lib/chat/toolSources.ts:46,53` | `list_sales_orders → /dashboard/crm`, `list_fixed_assets → /dashboard/fixed-assets` | Quitar ambas entradas (`list_customers → /dashboard/customers` **se queda**) |
| 6 | `app/dashboard/customers/[code]/page.tsx:41-42,61` | link "Cuenta CRM" + sección "Comercial (CRM)" a `/dashboard/crm/accounts/{id}` | **Quitar el link a CRM** (NO borrar customers). Alcance del resto de la sección "Comercial" depende de D1 |
| 7 | `apps/api/src/app.module.ts:17,28,29,30,115,126,127,128` | import + registro de `Legal/Crm/FixedAssets/Expenses`Module | Quitar imports y entradas |
| 8 | `apps/api/src/seed/seed-demo.ts` (~45 refs) | siembra de los 4 backends | Quitar bloque de siembra + imports (Hallazgo 2) |
| 9 | `apps/web/e2e/visual-sweep/evidence3.spec.ts:23` | barrido visual de `/dashboard/rh` | Quitar la entrada `rh` |
| 10 | `customer-insights` (module + service) + `lib/customer360.ts` + `customers/*` | acople comercial CRM (Hallazgo 1) | **Según D1** |

**Enlaces internos que se resuelven solos** (ambos extremos se borran): `rh/page.tsx:48 → skills`,
`skills/page.tsx:599 → rh/plantilla`.

---

## 3. Lo que se CONSERVA (verificado, no se toca)

- **`finance`** (= backends `accounting`, `cost-intelligence`, `cost-rollup`, `product-costing`
  + front `dashboard/finance`). **Grep confirma: NO importa ninguno de los 6.** Intacto.
- **`customers`** (front `dashboard/customers`) y su backend **`customer-insights`**. Se conservan;
  se les quita el link a CRM y (según D1) el enriquecimiento comercial.
- **`people`** (backend `/people/certifications`) — se queda; solo se retira su entrada de búsqueda (D3).
- Todo el flujo de piso, calidad, inventario, MES, torre de control, ERP — intacto.
- Token de diseño `domain:"finance"|"people"|"office"` en nav — se conserva (solo se quitan las filas de los 6).

---

## 4. Backend: tablas huérfanas (NO dropear)

Quitar los backends deja tablas huérfanas. **NO** se escriben migraciones destructivas; se
conservan las migraciones existentes y las tablas quedan sin uso (inofensivo), anotadas aquí:

- **legal:** `contracts` (entidad `Contract`)
- **expenses:** `expense_reports` (entidad `ExpenseReport`)
- **fixed-assets:** `fixed_assets` (entidad `FixedAsset`)
- **crm:** `crm_accounts`, `crm_contacts`, `crm_quotes`, `crm_quote_lines`, `crm_activities`,
  `opportunities` (6 entidades) — **bajo D1**: con Opción A, 3 de estas entidades siguen vivas en
  código (no huérfanas); con Opción B, las 6 tablas quedan huérfanas.

---

## 5. Decisiones del owner (BLOQUEANTES antes de FASE 1)

**D1 — CRM ↔ `customer-insights` (vista 360 de `customers`):**
- **(Recomendado) Opción B — purga total de CRM:** borrar las 6 entidades + módulo CRM, y
  **retirar el enriquecimiento comercial** de `customer-insights` (quitar inyección de repos
  `CrmAccount/Opportunity/CrmQuote`, método `commercial()`, campos `pipelineValue/wonValue`),
  de `lib/customer360.ts` y de la UI de `customers` (sección "Comercial (CRM)"). Coincide con la
  intención estratégica (CRM/ventas = territorio SAP) y con el literal "quitar las 6 entidades".
  `customers` queda funcional con datos de empresa/calidad/operación, sin sección comercial.
- **Opción A — CRM "zombie data-layer":** conservar SÓLO las 3 entidades que usa
  `customer-insights` (`crm-account`, `crm-quote`, `opportunity`); borrar el resto de CRM
  (front, controller, service, services/, dto, 3 entidades restantes). La vista 360 mantiene la
  sección comercial, pero leyendo tablas que ya nadie escribe (quedan estáticas/vacías tras
  limpiar el seed). Contradice parcialmente "quitar las 6 entidades".

**D3 — Fuente de búsqueda `person` (enlaza a `skills`, que se borra):**
- **(Recomendado)** Quitar la fuente `person` de la paleta (como se hizo con `doc`/Office).
- Conservarla repuntando el `href` a otra página (no hay una obvia; `people` no tiene UI propia).

---

## 6. FASE 1 (tras aprobación) — orden

1. Desenredar referencias externas (§2, filas 1-10) según D1/D3.
2. Quitar navegación / command-palette / búsqueda / chat / e2e de los 6.
3. Borrar los 6 módulos (front + back), respetando D1 para CRM.
4. **Gate:** `api build` ✅ · `api test` ✅ · `web lint` ✅ · `web build` ✅ · `typecheck` (señal).
   Verificar que **finance**, **customers** (con/ sin sección comercial según D1) y el **flujo de
   piso** siguen sanos, sin imports rotos ni links muertos. Revertir cualquier auto-fix de lint no
   relacionado (commit limpio).

## 7. "Hecho"

- 6 módulos administrativos eliminados; `finance` + `customers` + flujo de piso intactos; app
  compila y navega sin links muertos.
- Tablas huérfanas anotadas, NO dropeadas.
- Este documento completo. UN PR (draft), sin mergear.
