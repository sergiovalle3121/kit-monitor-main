# AXOS OS — Visual Fluidity Work Packets

> Plan ejecutable de los próximos PRs de fluidez/visual, por área. Cada packet
> es **pequeño, seguro y verde**, con criterios de aceptación verificables.
>
> Contexto:
> [`AXOS_GLOBAL_UX_FLUIDITY_AUDIT.md`](./AXOS_GLOBAL_UX_FLUIDITY_AUDIT.md) ·
> [`AXOS_SHELL_TAXONOMY.md`](./AXOS_SHELL_TAXONOMY.md) ·
> [`AXOS_DESIGN_LANGUAGE.md`](./AXOS_DESIGN_LANGUAGE.md).
>
> Estado de la serie:
> - **PR 1** ✅ Audit + Shell Taxonomy + `lib/routeChrome` + quick wins.
> - **PR 2** ✅ Route-aware workbench/kiosk chrome (`hideFloatingWidgets`, CAD).
> - **PR 3** ✅ (este) Back-nav cleanup en rutas estándar de alto impacto +
>   estos work packets + prep de landing.
> - **PR 4+** ⏳ Los packets de abajo.

---

## 0. Componentes reutilizables (NO duplicar)

Antes de crear algo nuevo, reusar/extender lo existente. Inventario:

| Componente | Ruta | Rol |
| --- | --- | --- |
| `PageHeader` | `components/ui/PageHeader.tsx` | Encabezado por dominio (IconTile + título + `right`) |
| `IconTile` | `components/ui/IconTile.tsx` | Loseta squircle por dominio |
| `HoverArrow` | `components/ui/HoverArrow.tsx` | Flecha animada para CTAs |
| `Toolbar` | `components/workspace/Toolbar.tsx` | Header de módulo con acciones |
| `KpiRow` / `StatCard` | `components/workspace/` | Fila de KPIs / tarjeta de métrica |
| `FilterBar` | `components/workspace/FilterBar.tsx` | Barra de filtros consistente |
| `DataTable` | `components/workspace/DataTable.tsx` | Tabla con header/hover/densidad |
| `EmptyState` | `components/workspace/EmptyState.tsx` | Estado vacío con CTA |
| `DetailDrawer` | `components/workspace/DetailDrawer.tsx` | Panel de detalle lateral |
| `ExportButton` | `components/workspace/ExportButton.tsx` | Exportar columnas |
| `DashboardWayfinding` | `components/DashboardWayfinding.tsx` | **Back/breadcrumb canónico** (global) |
| `useRouteChrome` | `lib/routeChrome.ts` | Shell Taxonomy por ruta |

**Faltantes a crear (solo cuando un packet los necesite):**
`CommandCenterHero`, `AttentionQueue`. Deben construirse sobre `IconTile` /
`KpiRow` / `glass`, sin un design system paralelo.

**Política de back único (ya vigente):** el `DashboardWayfinding` global provee
miga + "subir un nivel" en toda página `/dashboard/*`. Las páginas **no** dibujan
su propio chip "← Dashboard/Módulo". (PR 3 ya removió los redundantes de 6 rutas
de alto impacto; el resto se barre en WP-04…08.)

---

## 1. Catálogo de packets

### WP-01 · Dashboard Premium 2.0
- **Routes:** `/dashboard`
- **Shell type:** Command Center
- **Problems:** hub con jerarquía mejorable; se siente "grid de tarjetas" más
  que torre de mando; sin cola de atención.
- **Owns:** `app/dashboard/page.tsx`, nuevo `CommandCenterHero`, `AttentionQueue`.
- **Reads:** `lib/dashboardAreas.ts`, `KpiRow`, `IconTile`, design language §8.
- **Acceptance:**
  - Hero editorial (saludo + estado de operación) sobre `max-w` coherente.
  - Fila de KPIs reales (sin inventar datos; estado vacío honesto si no hay).
  - Sección "Qué requiere atención" o señales accionables.
  - Tarjetas de área agrupadas por flujo, hover/active sobrios (lift, sin glow).
  - Claro/oscuro verificado; `prefers-reduced-motion` respetado.
- **Checks:** `tsc`, `eslint`, `build`; revisar `/dashboard` en claro y oscuro.

### WP-02 · Quality Command Center polish
- **Routes:** `/dashboard/quality` (+ submódulos `analytics`, `characteristics`,
  `measurements`, `inspections`, `holds`, `floor-quality`, `rma`)
- **Shell type:** Command Center (hub) + Standard (submódulos)
- **Problems:** hub apunta a Command Center pero comparte cromo estándar; los
  submódulos deben sentirse una **suite** (no listas sueltas); empty states
  austeros.
- **Owns:** `app/dashboard/quality/**`.
- **Reads:** WP-01 (`CommandCenterHero`/`AttentionQueue`), `Toolbar`, `FilterBar`.
- **Acceptance:**
  - Hub con hero + señales de calidad (NCRs abiertas, holds, CTQs fuera de spec).
  - Submódulos enlazados como suite desde el hub.
  - Filtros vía `FilterBar`; tablas vía `DataTable`; empty states con CTA.
  - Sin chip "← Calidad · NCR" redundante (ya removido en analytics/char/meas).
- **Checks:** `tsc`, `eslint`, `build`.

### WP-03 · NPI Launch Center polish
- **Routes:** `/dashboard/npi`, `/dashboard/npi/[id]`, `/dashboard/models`,
  `/dashboard/models/[id]`
- **Shell type:** Command Center (`npi`) + Standard (resto)
- **Problems:** "Launch Center" sin lenguaje de command center; detalles densos.
- **Owns:** `app/dashboard/npi/**`, `app/dashboard/models/**`.
- **Reads:** `PageHeader`, `IconTile` (dominio engineering), `KpiRow`.
- **Acceptance:** breadcrumbs limpios (ya sin back local en `[id]`), PageHeader
  premium, KPIs/CTAs claros, sin sensación CRUD. **Coordinar** si hay trabajo NPI
  en paralelo (no chocar).
- **Checks:** `tsc`, `eslint`, `build`.

### WP-04 · Supply Chain shell pass
- **Routes:** `/dashboard/inventory`, `/materials`(+`[id]`), `/warehouse`,
  `/almacen`, `/receiving`, `/inbound`, `/procurement`, `/suppliers`(+`[id]`),
  `/shipping`, `/outbound`, `/packing`, `/material-staging`
- **Shell type:** Standard
- **Problems:** sensación CRUD; filtros heterogéneos; varios con header sticky
  custom + back integrado (`procurement`, `suppliers/[id]`) en vez de
  `PageHeader`; empty states pobres.
- **Owns:** rutas arriba.
- **Reads:** `PageHeader`, `Toolbar`, `FilterBar`, `DataTable`, `EmptyState`.
- **Acceptance:**
  - Migrar headers sticky custom a `PageHeader` (o `Toolbar`) — al hacerlo, el
    back integrado desaparece y queda el wayfinding global (back único).
  - Acciones agrupadas arriba a la derecha; filtros consistentes; KPIs uniformes.
  - Empty states con CTA al flujo que genera la data.
- **Checks:** `tsc`, `eslint`, `build`; verificar `inventory`, `suppliers/[id]`.
- **Nota:** `inventory` NO tenía back local (los `ArrowLeftRight`/`ArrowDownLeft`
  eran íconos de movimiento — falso positivo del grep inicial).

### WP-05 · Commercial / CRM shell pass
- **Routes:** `/dashboard/crm`(+`accounts/[id]`, `quotes/[id]`),
  `/dashboard/customers`(+`[code]`)
- **Shell type:** Standard (con aspiración a suite comercial)
- **Problems:** se siente tabla/lista; poco contexto por cuenta; back local en
  hub y detalles.
- **Owns:** `app/dashboard/crm/**`, `app/dashboard/customers/**`.
- **Reads:** `PageHeader`, `StatCard`, `DetailDrawer`.
- **Acceptance:** cards con contexto (no solo filas), header premium, back único,
  empty states útiles.
- **Checks:** `tsc`, `eslint`, `build`.

### WP-06 · Finance / ERP shell pass
- **Routes:** `/dashboard/finance`(+`cost-intelligence`, `cost-rollup`),
  `/dashboard/expenses`(+`[id]`), `/dashboard/fixed-assets`(+`[id]`),
  `/dashboard/erp`(+`fin`,`mm`,`pp`,`sd`)
- **Shell type:** Standard
- **Problems:** austeridad; densidad alta; back local en `erp`, `expenses`,
  `fixed-assets`.
- **Owns:** rutas arriba. **No** tocar lógica/datos.
- **Reads:** `PageHeader`, `KpiRow`, `DataTable`.
- **Acceptance:** header + KPIs + cards + empty states; monospace en folios/PO;
  back único.
- **Checks:** `tsc`, `eslint`, `build`.

### WP-07 · Analytics / Control Tower shell pass
- **Routes:** `/dashboard/control-tower`, `/dashboard/line-control-tower`,
  `/dashboard/mission-control`, `/dashboard/intelligence`, `/dashboard/live`,
  `/dashboard/metrics`, `/dashboard/reports/**`
- **Shell type:** Command Center
- **Problems:** tratados como Standard; back local; piden hero + cola de atención.
- **Owns:** rutas arriba.
- **Reads:** WP-01 (`CommandCenterHero`/`AttentionQueue`).
- **Acceptance:** lenguaje command center consistente; señales accionables; back
  único; sin datos inventados.
- **Checks:** `tsc`, `eslint`, `build`.

### WP-08 · Settings / Admin shell pass
- **Routes:** `/dashboard/settings/**`, `/dashboard/admin/**`
- **Shell type:** Standard
- **Problems:** back local en varias (`approvals`, `numbering`, `users`,
  `organization`, `permissions`); headers heterogéneos.
- **Owns:** rutas arriba.
- **Reads:** `PageHeader`, `DataTable`.
- **Acceptance:** PageHeader consistente; back único; tablas/forms ordenados.
- **Checks:** `tsc`, `eslint`, `build`.

### WP-09 · Landing Renaissance (ver §2)
- **Routes:** `/`, `/login`
- **Shell type:** Public / Landing

### WP-10 · Mobile / Tablet shell pass
- **Routes:** transversal (dock, wayfinding, PageHeader, tablas → cards)
- **Shell type:** todos
- **Problems:** densidad en móvil; tablas que no colapsan; dock vs action bars.
- **Owns:** componentes base + responsive de rutas de alto tráfico.
- **Reads:** `DashboardDock`, `DashboardWayfinding`, `DataTable`.
- **Acceptance:** tablas → cards en móvil; targets táctiles; dock sin tapar
  acciones; verificado en breakpoints `sm`/`md`/`lg`.
- **Checks:** `tsc`, `eslint`, `build`; revisar responsive.

---

## 2. WP-09 · Landing Renaissance — prep (Fase 9)

### Estado actual (inspección PR 3)

`/` → `app/page.tsx` (~473 líneas, `"use client"`). **No es un template básico**;
ya tiene infraestructura premium:

- **Fondo:** `AmbientBackground` (aurora + red de nodos en movimiento) detrás del
  hero; `EntranceSweep` de entrada; `Reveal` para revelar secciones al hacer
  scroll; `framer-motion` con `useReducedMotion`.
- **Secciones existentes:**
  1. **Hero** (`pt-32 pb-20`) con título grande + CTA.
  2. **Features** — `FEATURES[]` (Torre de control, etc.) en grid con `Reveal`.
  3. **Solutions** (`#solutions`) — segunda parrilla temática.
  4. **CTA final** centrada.
- **Login** → `app/login/page.tsx` (~442 líneas) ya usa `AmbientBackground calm
  network` y motion; consistente con el hero.

**Diagnóstico:** la base es buena pero la narrativa aún no "vende una plataforma
de clase mundial": las features son genéricas, falta una **galaxia de producto**
que muestre los programas reales (MES, ERP, Office, CAD, AI/CIDE, Quality) como
un sistema operativo, y faltan mockups/capturas de producto.

### Plan para PR 4 (Landing Renaissance)

1. **Hero polish:** titular de producto más afilado (qué es AXOS en una frase),
   sub-CTA, prueba de valor inmediata. Mantener `AmbientBackground` (calmarlo si
   compite con el texto).
2. **Product galaxy:** sección que presenta los programas como constelación de un
   OS industrial — MES · ERP · Office · CAD · AI/CIDE · Quality · Control Tower —
   cada uno con su `IconTile`/firma de dominio y una línea de valor.
3. **Secciones por programa:** MES (piso/terminal), ERP/Supply Chain, Office
   (Docs/Sheets/Slides), CAD (layout 2D⇄3D), AI/CIDE (analista), con
   screenshots/mockups **si existen** (no inventar UI).
4. **Storytelling + motion controlado:** jerarquía editorial, `Reveal`
   escalonado, sin saturación; respeta `prefers-reduced-motion`.
5. **CTA premium** y cierre; consistencia con `/login`.
6. **Responsive** completo (hero, galaxy, secciones).
7. **Sin claims falsos**, sin dependencias nuevas, solo Tailwind + motion
   existentes.

**Acceptance (PR 4):** hero reescrito; product galaxy con los programas reales;
≥2 secciones de programa; motion sobrio + reduced-motion; responsive; `tsc` +
`eslint` + `build` verdes. **No** se hizo en PR 3 para mantener el PR pequeño.

---

## 3. Orden sugerido

`WP-01` (sienta `CommandCenterHero`/`AttentionQueue`) → `WP-09` (landing, alto
impacto de marca) → `WP-02`/`WP-07` (command centers, reúsan WP-01) →
`WP-04`/`WP-05`/`WP-06` (standard shell passes) → `WP-03` (coordinar con NPI) →
`WP-08` → `WP-10` (responsive transversal al final).
