# AXOS OS — Triaje y limpieza del backlog de ramas

> **Estado:** documentación + plan de ejecución. **No se mergeó nada** y **no se
> borró ninguna rama** (ver §6: el entorno bloquea el borrado de ramas). La
> **regla de oro** se respetó al 100%: ninguna rama que toque
> migraciones / `*.entity.ts` / `orm.options.ts`·`synchronize` / auth·tenant fue
> mergeada por mí.

## 1. Hallazgo principal

El backlog **ya está siendo consolidado por la tarea de Codex**: `main` recibe
auto-merges en vivo (HEAD de hoy 09:48; merges recientes #764/#768/#769/#776 SON
estas features). De las **127 ramas** `claude/*`+`codex/*`:

| Estado | Ramas | Acción |
|---|---:|---|
| **PR mergeado a `main`** (trabajo YA en main; rama = sobrante) | **91** | 🗑️ Borrar la rama sobrante (cleanup) |
| Rama vacía / ya en main (`ahead=0`) | 1 | 🗑️ Borrar |
| **PR abierto** (Codex trabajando) | 17 | 🟡 Dejar a Codex; 2 son RED → revisión humana |
| PR cerrado sin mergear (descartado/superseded) | 17 | 🗑️ Borrable / 1 recuperable (ver §5) |
| Sólo mergeado a `staging` (no a `main`) | 5 | ⏸️ No borrar hasta confirmar staging→main |
| Sin PR | 2 | Ver §5 |

**Conclusión:** el objetivo "nada huérfano" se logra borrando ~92 ramas sobrantes
(su trabajo ya está en `main`), dejando a Codex sus 17 PRs abiertos, y enviando
**2 PRs RED abiertos** a revisión humana. **No hay ramas verdes limpias y
actuales que mergear yo mismo**: lo bueno ya lo mergeó Codex; el resto está
cerrado o es backend de Codex en vuelo.

## 2. Regla de oro — cumplimiento

`apps/api/src/orm.options.ts` confirma `synchronize: true` activo (Railway). Por
eso **ninguna** rama RED fue mergeada por mí. Clasificación RED (8 ramas):

| Rama (PR) | Toca | Estado | Riesgo verificado |
|---|---|---|---|
| `codex/design-roadmap-…-cq7enl` (#728) | 4 migraciones nuevas + entidad | **mergeado por Codex** | Alto (schema). Ya aplicado por Codex. |
| `codex/improve-operator-terminal-ux-8nj3ym` (#724) | `andon-call.entity.ts` | **mergeado por Codex** | Alto. Ya aplicado. |
| `codex/night-event-ledger-query` (#775) | `TenantScopedRepository`,`getTenantId` | **mergeado por Codex** | Alto (tenant). Ya aplicado. |
| `codex/night-mes-downtime-reason` (#776) | `mes-downtime.entity.ts`,`getTenantId` | **mergeado por Codex** | Alto. Ya aplicado. |
| `codex/integrate-cell/range-comments-from-sheets` (#762) | `office-comment.entity.ts` | **ABIERTO → 🔬 cuarentena** | **Bajo**: sólo amplía un union TS sobre columna `varchar(24)` (no es enum PG → sin ALTER). Revisar y mergear. |
| `codex/integrate-cell/range-comments-in-axos-os` (#759) | idem | cerrado (duplicado de #762) | 🗑️ |
| `codex/integrate-cell/range-comments-in-axos-os-triilo` (#760) | idem | cerrado (duplicado de #762) | 🗑️ |
| `codex/night-packing-passed-readiness` (#786) | `synchronize:true` | **ABIERTO → 🔬 cuarentena** | **Bajo**: el `synchronize:true` está en un `*.spec.ts` (DataSource en memoria de test), no en prod. Backend de packing. Revisar y mergear. |

### 🔬 Cola corta de revisión humana (RED abiertos)

- **PR #762** `integrate-cell/range-comments-from-sheets` — amplía
  `OfficeCommentAnchorType` (+`sheet`,`table`,`pivot`,`chart`) en
  `apps/api/src/modules/office/entities/office-comment.entity.ts:2`. La columna es
  `@Column({ type:'varchar', length:24 })` (`:35`), **no** un enum de Postgres →
  `synchronize` no altera el esquema. **Recomendación: mergear tras revisión rápida.**
- **PR #786** `night-packing-passed-readiness` — `synchronize:true` en
  `apps/api/src/modules/packing/packing.readiness.service.spec.ts:20` (DataSource
  de test en memoria con `entities:[HandlingUnit, DocumentSequence]`), **no** prod;
  el propio diff anota "No new table or migration was added". Toca lógica backend
  de packing (`packing.service.ts`, `packing.controller.ts`).
  **Recomendación: mergear tras revisión rápida (no hay riesgo de esquema).**

## 3. ✅ Mergeadas a `main` — ramas sobrantes a borrar (92)

Su trabajo YA está en `main` (Codex las squash-mergeó). La rama es un ref
sobrante. **Borrables sin riesgo** (ver §6 para el cómo).

<details><summary>Ver las 92 ramas mergeadas (borrables)</summary>

- `claude/aads-bootstrap-structure-0qz6j4` (PR #669)
- `claude/aads-v2-work-packets` (PR #678)
- `claude/axos-accent-unify` (PR #710)
- `claude/axos-ai-system-baef7e` (PR #679)
- `claude/axos-beta-readiness-audit-j23x95` (PR #770)
- `claude/axos-comfort-overlay` (PR #731)
- `claude/axos-dashboard-premium` (PR #708)
- `claude/axos-landing-2` (PR #713)
- `claude/axos-landing-footer` (PR #718)
- `claude/axos-landing-renaissance` (PR #706)
- `claude/axos-login-polish` (PR #715)
- `claude/axos-module-width-pr` (PR #732)
- `claude/axos-module-width` (PR #-)
- `claude/axos-os-design-system-uj8ev2` (PR #676)
- `claude/axos-os-home` (PR #714)
- `claude/axos-responsive-pass` (PR #712)
- `claude/axos-search-premium` (PR #709)
- `claude/axos-sweep-batch3` (PR #742)
- `claude/axos-sweep-batch4` (PR #744)
- `claude/axos-text-token-2` (PR #741)
- `claude/axos-text-token-sweep` (PR #736)
- `claude/axos-ux-fluidity-audit-jqxwmc` (PR #704)
- `claude/axos-ux-fluidity-pr3-module-shell` (PR #705)
- `claude/axos-violet-accent` (PR #745)
- `claude/axos-width-batch2` (PR #733)
- `claude/cad-array-fase73` (PR #666)
- `claude/cad-contracts-67-69` (PR #645)
- `claude/cad-contracts-catalog` (PR #667)
- `claude/cad-copilot-fase72` (PR #659)
- `claude/cad-dimension-format-fase73` (PR #665)
- `claude/cad-dwg-detect-fase74` (PR #671)
- `claude/cad-geom-measure-fase72` (PR #656)
- `claude/cad-intent-backend` (PR #652)
- `claude/cad-intent-fase69` (PR #647)
- `claude/cad-plot-scale-fase70` (PR #653)
- `claude/cad-tool-summary-5d9krp` (PR #644)
- `claude/cad-vision-endpoint-fase71` (PR #661)
- `claude/cad-vision-fase71` (PR #655)
- `claude/codex-pr-audit-merge-yqgnz8` (PR #717)
- `claude/confident-cori-l1pima` (PR #625)
- `claude/npi-launch-visual-7zy21h` (PR #701)
- `claude/npi-model-relation-7zy21h` (PR #688)
- `claude/npi-readiness-extended-7zy21h` (PR #690)
- `claude/npi-release-to-mp-7zy21h` (PR #700)
- `claude/npi-risk-register-7zy21h` (PR #693)
- `claude/npi-tooling-readiness-7zy21h` (PR #691)
- `claude/npi-workflow-redesign-7zy21h` (PR #687)
- `claude/operator-terminal-theme-agkh8o` (PR #686)
- `codex/add-axos-data-panel-in-sheets` (PR #769)
- `codex/add-collapsible-sidebar-for-axos` (PR #763)
- `codex/add-pivot-engine-v2` (PR #768)
- `codex/add-print/export-layout-foundation-for-sheets` (PR #747)
- `codex/add-track-changes-foundation-for-docs` (PR #750)
- `codex/create-codex-master-prompt-documentation-3h7nim` (PR #726)
- `codex/create-codex-master-prompt-documentation-6aygno` (PR #664)
- `codex/create-codex-master-prompt-documentation-e3kbom` (PR #695)
- `codex/create-codex-master-prompt-documentation-kz21de` (PR #672)
- `codex/create-codex-master-prompt-documentation-x3ipq2` (PR #680)
- `codex/create-codex-master-prompt-documentation-xcna09` (PR #684)
- `codex/create-codex-master-prompt-documentation` (PR #649)
- `codex/design-roadmap-for-axos-docs-evolution-cq7enl` (PR #728)
- `codex/design-roadmap-for-axos-docs-evolution-dkdtld` (PR #657)
- `codex/design-roadmap-for-axos-docs-evolution-wx0ryc` (PR #698)
- `codex/design-roadmap-for-axos-docs-evolution-y3fxta` (PR #675)
- `codex/design-roadmap-for-axos-docs-evolution` (PR #650)
- `codex/evolve-axos-sheets-editor-for-erp-connection-bcp55a` (PR #727)
- `codex/evolve-axos-sheets-editor-for-erp-connection-ii3kns` (PR #651)
- `codex/evolve-axos-sheets-editor-for-erp-connection-n1xb1g` (PR #683)
- `codex/evolve-axos-sheets-editor-for-erp-connection-nklz7p` (PR #697)
- `codex/evolve-axos-sheets-editor-for-erp-connection` (PR #646)
- `codex/evolve-axos-slides-editor-fq57b6` (PR #696)
- `codex/evolve-axos-slides-editor-kw1cj2` (PR #725)
- `codex/evolve-axos-slides-editor-rggdqf` (PR #673)
- `codex/evolve-axos-slides-editor` (PR #658)
- `codex/extend-workbook-health-with-governance-features` (PR #752)
- `codex/implement-axos-sheets-workbench-v2` (PR #734)
- `codex/improve-axos-os-public-landing-page-dpergb` (PR #755)
- `codex/improve-chart-builder-for-sheets` (PR #764)
- `codex/improve-operator-terminal-ux-7v9rsf` (PR #694)
- `codex/improve-operator-terminal-ux-8nj3ym` (PR #724)
- `codex/improve-operator-terminal-ux-9rsfb6` (PR #677)
- `codex/improve-operator-terminal-ux-smgy3i` (PR #670)
- `codex/improve-operator-terminal-ux` (PR #660)
- `codex/night-event-ledger-query` (PR #775)
- `codex/night-mes-downtime-reason` (PR #776)
- `codex/night-mes-operator-confirm` (PR #774)
- `codex/redesign-dashboard-for-premium-experience` (PR #682)
- `codex/redesign-dashboard-for-quality-command-center-6zs9sy` (PR #723)
- `codex/redesign-dashboard-for-quality-command-center` (PR #699)
- `codex/review-app-axos-os-3j0qvk` (PR #674)
- `codex/review-app-axos-os-xl83pi` (PR #662)
- `codex/review-app-axos-os` (PR #640)

</details>

## 4. 🟡 PRs abiertos (Codex en vuelo) — NO tocar

Backlog activo de Codex (auto-merge). Se dejan a Codex; los 2 RED (#762, #786) van a §2.

- `claude/axos-os-audit-optimize-90n6bu` (PR #746, FE)
- `codex/add-approval-signoff-foundation-for-workbooks` (PR #753, FE)
- `codex/add-slicers-and-timeline-filters-to-sheets` (PR #765, FE)
- `codex/integrate-persistent-comments-in-docs` (PR #751, BE)
- `codex/night-import-lineage-matrix` (PR #778, BE)
- `codex/night-import-product-models` (PR #783, BE)
- `codex/night-inventory-discrepancy-monitor` (PR #781, BE)
- `codex/night-material-requests-staging` (PR #789, FE)
- `codex/night-mes-confirm-actions` (PR #782, FE)
- `codex/night-mes-stop-confirm` (PR #788, FE)
- `codex/night-planning-safe-cancel` (PR #777, BE)
- `codex/night-platform-envelope-cq019` (PR #785, BE)
- `codex/night-platform-ledger-query` (PR #787, BE)
- `codex/night-platform-response-envelope` (PR #779, BE)
- `codex/night-warehouse-location-visibility` (PR #784, BE)

## 5. 🗑️ PRs cerrados sin mergear (descartados/superseded)

Cerrados por el proceso (normalmente duplicados de una versión ya mergeada).
**Excepción recuperable:** `claude/axos-cad-factory-scale-yd546i` (#743,
cerrado **sin** mergear) — 8 archivos frontend de CAD a escala (ScaleBar,
world-scale, minimap) que **no** se ven en `main`. Si se quiere ese trabajo,
el owner debe reabrir/cherry-pick (no borrar).

- `claude/axos-cad-factory-scale-yd546i` (PR #743)
- `codex/add-collapsible-desktop-sidebar-for-axos` (PR #758)
- `codex/add-collapsible-sidebar-for-desktop-l63qbm` (PR #757)
- `codex/add-collapsible-sidebar-for-desktop` (PR #756)
- `codex/add-foundation-for-slicers-and-timeline-filters` (PR #761)
- `codex/add-pivot-engine-v2-features-48qv01` (PR #767)
- `codex/add-pivot-engine-v2-features` (PR #766)
- `codex/develop-axos-sheets-data-intelligence-workbench` (PR #738)
- `codex/enhance-axos-sheets-with-advanced-analytics-features` (PR #740)
- `codex/implement-axos-sheets-enterprise-collaboration` (PR #739)
- `codex/implement-axos-sheets-workbench-v2-o4unq7` (PR #737)
- `codex/implementar-motor-de-formulas-y-compatibilidad` (PR #735)
- `codex/improve-axos-os-public-landing-page` (PR #754)
- `codex/integrate-persistent-review-comments-in-docs-zeuss3` (PR #749)
- `codex/integrate-persistent-review-comments-in-docs` (PR #748)

## 6. ⚠️ Limitación de permisos — el borrado de ramas requiere al owner

Intenté borrar las 92 ramas sobrantes pero el entorno lo **bloquea**:
`git push origin --delete` → **HTTP 403**, y el servidor GitHub MCP **no expone**
una herramienta de borrado de rama/ref. **No se borró ninguna rama.**

**Acciones del owner (1 vez):**
1. Repo → Settings → General → **"Automatically delete head branches"** (limpia
   las futuras al mergear).
2. Borrar las sobrantes ya existentes (lista §3). Ejemplo en local con permisos:
   ```bash
   # revisa la lista primero
   git push origin --delete claude/axos-accent-unify codex/add-pivot-engine-v2 …
   ```
3. Revisar y mergear los 2 PRs RED de bajo riesgo (#762, #786) — §2.
4. (Opcional) Reabrir/cherry-pick `cad-factory-scale` (#743) si se quiere ese trabajo.

## 7. Listas finales

- **✅ Mergeadas** (entraron, trabajo en `main`): 91 + 1 vacía → §3.
- **🗑️ Cerradas por duplicadas/superseded**: 17 → §5 (defieren a la versión mergeada).
- **🔬 En cuarentena para tu revisión**: **#762** y **#786** (RED abiertos, riesgo
  verificado **bajo**) → §2.
- **🟡 De Codex (en vuelo)**: 15 PRs abiertos no-RED → §4 (no tocar).
- **⏸️ Sólo en staging**: `npi-gate-foundation`, `npi-phase-2`, `pensive-maxwell-ec81j2`,
  `wizardly-carson-ijf144`, `integration/unify-office-into-staging`.
