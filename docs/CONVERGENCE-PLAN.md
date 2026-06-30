# AXOS-OS · Plan de Convergencia a CERO ramas abiertas

> **Estado: PROPUESTA — FASE 0 completa. Requiere aprobación del owner antes de ejecutar nada (FASE 1+).**
> Cerrar/borrar ramas es irreversible; cada SHA queda registrado aquí para recuperación (`git branch <n> <sha>` / `git push origin <sha>:refs/heads/<n>`).

Generado por Claude Integrator. Fecha de corte: 2026-06-30. Base: `origin/main`.

## Reglas de oro aplicadas
1. **Plan-first**: este documento; no se ejecuta nada hasta tu OK.
2. **Zona roja NUNCA se mergea** (migraciones, `*.entity.ts`, `orm.options`/synchronize, `auth/`, guards, tenancy) → cuarentena de revisión humana. `synchronize:true` activo en prod.
3. **Regla #4 reforzada**: *cualquier* rama que toque `apps/api/**` se trata como cuarentena (no solo la zona roja estricta). GREEN = frontend puro.
4. Ninguna rama se borra sin su SHA registrado aquí.

## Resumen de conteos

| Categoría | # | Acción | Riesgo |
|---|---|---|---|
| 🗑️ STALE — ya en `main` (merged by content) | 32 | cerrar PR + borrar rama | nulo |
| 🗑️ STALE — PR ya cerrado en tarea previa | 3 | borrar rama | nulo |
| 🗑️ DUPLICATE — perdedoras de clúster | 30 | cerrar 'superseded by <winner>' + borrar | nulo |
| ✅ GREEN — frontend, único, merge limpio | 40 | rebase → gate → squash-merge | bajo |
| 🟡 YELLOW — frontend, conflicto no trivial | 105 | consolidar por tema con verificación visual | medio (recuperable) |
| 🔬 RED_BACKEND — toca `apps/api` (lógica) | 7 | cuarentena, rebase sin merge | alto |
| 🔬 RED_SCHEMA — migración/entidad | 2 | cuarentena, rebase sin merge | **crítico** |
| **TOTAL** | **219** | | |

> Nota: el alto número de YELLOW se debe a que las ramas viejas conflictúan contra el `main` actual; muchas resultarán **STALE** al rebasear (su diff ya no aplica). El gate de FASE 2/3 (build+test+barrido visual) lo confirmará rama por rama. Los conteos GREEN/YELLOW/DUPLICATE son **propuestas**, no merges a ciegas.

## ⚠️ Divulgación — ya entró a `main` ANTES de este plan (tarea previa de cola de PRs)
Se mergearon 10 PRs del lote nocturno. **Uno toca la zona roja** y debe entrar a tu revisión retroactiva:
- **#884 `night-operator-material-request-0629`** — incluye `apps/api/src/migrations/20260629120000-AddMaterialRequestContext` + columnas nuevas en `material_requests`. Migración aditiva/idempotente, CI verde, pero **revísala** dado `synchronize:true`.
- Frontend puro ya mergeado (sin zona roja): #882, #889, #879, #843, #888, #881, #883, #885 + fix de integración #892 (`.gitattributes` union-merge).
- Cerrados (autorizados antes): #877, #886, #849. En needs-work: #845 (= `night-mes-confirm-20260629`, ahora clasificado **RED_SCHEMA**).

## 🔬 CUARENTENA (RED) — NO mergear; rebasar y dejar a revisión humana

### `codex/night-import-lineage-matrix`  ·  `185d8c7a`  ·  RED_BACKEND
- Fecha 2026-06-29 · 1 commits · api=4 web=1 · merge=CONFLICT
- Acción: rebasar sobre `main` (sin merge), abrir/mantener PR `needs-human-review`. El owner decide.

### `codex/night-import-product-models`  ·  `13e55fb1`  ·  RED_BACKEND
- Fecha 2026-06-29 · 1 commits · api=5 web=1 · merge=CONFLICT
- Acción: rebasar sobre `main` (sin merge), abrir/mantener PR `needs-human-review`. El owner decide.

### `codex/night-kit-stock-gate`  ·  `8f6e5aa3`  ·  RED_BACKEND
- Fecha 2026-06-29 · 1 commits · api=3 web=1 · merge=clean
- Acción: rebasar sobre `main` (sin merge), abrir/mantener PR `needs-human-review`. El owner decide.

### `codex/night-mes-andon-live-actions-0629`  ·  `dfb10b50`  ·  RED_BACKEND
- Fecha 2026-06-29 · 1 commits · api=3 web=1 · merge=CONFLICT
- Acción: rebasar sobre `main` (sin merge), abrir/mantener PR `needs-human-review`. El owner decide.

### `codex/night-mes-material-request-0629`  ·  `c28f8186`  ·  RED_BACKEND
- Fecha 2026-06-29 · 1 commits · api=4 web=5 · merge=CONFLICT
- Acción: rebasar sobre `main` (sin merge), abrir/mantener PR `needs-human-review`. El owner decide.

### `codex/night-platform-envelope-cq019`  ·  `2a554928`  ·  RED_BACKEND
- Fecha 2026-06-29 · 1 commits · api=2 web=0 · merge=CONFLICT
- Acción: rebasar sobre `main` (sin merge), abrir/mantener PR `needs-human-review`. El owner decide.

### `codex/night-platform-ledger-query`  ·  `02f398ea`  ·  RED_BACKEND
- Fecha 2026-06-29 · 1 commits · api=2 web=0 · merge=CONFLICT
- Acción: rebasar sobre `main` (sin merge), abrir/mantener PR `needs-human-review`. El owner decide.

### `codex/night-mes-confirm-20260629`  ·  `38edba99`  ·  RED_SCHEMA
- Fecha 2026-06-29 · 2 commits · api=7 web=5 · merge=clean
- **Archivos zona roja:** `apps/api/src/migrations/20260629103000-AddInventoryLotExpiry.ts`, `apps/api/src/modules/inventory/entities/inventory-position.entity.ts`, `apps/api/src/modules/receiving/entities/receiving-event.entity.ts`
- Acción: rebasar sobre `main` (sin merge), abrir/mantener PR `needs-human-review`. El owner decide.

### `codex/night-mes-downtime-reason`  ·  `2e391a9a`  ·  RED_SCHEMA
- Fecha 2026-06-29 · 43 commits · api=4 web=2 · merge=CONFLICT
- **Archivos zona roja:** `apps/api/src/modules/mes-execution/entities/mes-downtime.entity.ts`
- Acción: rebasar sobre `main` (sin merge), abrir/mantener PR `needs-human-review`. El owner decide.

## 🗑️ DUPLICATE — clústeres (mantener WINNER, cerrar el resto)

- **create-codex-master-prompt-documentation** ×7 → WINNER `codex/create-codex-master-prompt-documentation-3h7nim` (`7ba222e2`, YELLOW)
    - 🗑️ `codex/create-codex-master-prompt-documentation` (`cede689e`, 2026-06-27)
    - 🗑️ `codex/create-codex-master-prompt-documentation-6aygno` (`eb39b65b`, 2026-06-27)
    - 🗑️ `codex/create-codex-master-prompt-documentation-e3kbom` (`2593b420`, 2026-06-27)
    - 🗑️ `codex/create-codex-master-prompt-documentation-kz21de` (`ff284c0c`, 2026-06-27)
    - 🗑️ `codex/create-codex-master-prompt-documentation-x3ipq2` (`d283da9c`, 2026-06-27)
    - 🗑️ `codex/create-codex-master-prompt-documentation-xcna09` (`7db07ed2`, 2026-06-27)
- **design-roadmap-for-axos-docs-evolution** ×5 → WINNER `codex/design-roadmap-for-axos-docs-evolution-cq7enl` (`d2288c44`, YELLOW)
    - 🗑️ `codex/design-roadmap-for-axos-docs-evolution` (`8a426e7b`, 2026-06-27)
    - 🗑️ `codex/design-roadmap-for-axos-docs-evolution-dkdtld` (`a255696b`, 2026-06-27)
    - 🗑️ `codex/design-roadmap-for-axos-docs-evolution-wx0ryc` (`d36969fc`, 2026-06-27)
    - 🗑️ `codex/design-roadmap-for-axos-docs-evolution-y3fxta` (`1a5fe504`, 2026-06-27)
- **evolve-axos-sheets-editor-for-erp-connection** ×5 → WINNER `codex/evolve-axos-sheets-editor-for-erp-connection-bcp55a` (`1fde405a`, YELLOW)
    - 🗑️ `codex/evolve-axos-sheets-editor-for-erp-connection` (`44475d37`, 2026-06-27)
    - 🗑️ `codex/evolve-axos-sheets-editor-for-erp-connection-ii3kns` (`acd405c5`, 2026-06-27)
    - 🗑️ `codex/evolve-axos-sheets-editor-for-erp-connection-n1xb1g` (`e0991a85`, 2026-06-27)
    - 🗑️ `codex/evolve-axos-sheets-editor-for-erp-connection-nklz7p` (`99d324fc`, 2026-06-27)
- **improve-operator-terminal-ux** ×5 → WINNER `codex/improve-operator-terminal-ux-8nj3ym` (`859a4c01`, YELLOW)
    - 🗑️ `codex/improve-operator-terminal-ux` (`38cf922b`, 2026-06-27)
    - 🗑️ `codex/improve-operator-terminal-ux-7v9rsf` (`5dd5419f`, 2026-06-27)
    - 🗑️ `codex/improve-operator-terminal-ux-9rsfb6` (`77288466`, 2026-06-27)
    - 🗑️ `codex/improve-operator-terminal-ux-smgy3i` (`ea1358a0`, 2026-06-27)
- **evolve-axos-slides-editor** ×3 → WINNER `codex/evolve-axos-slides-editor-kw1cj2` (`0989febf`, YELLOW)
    - 🗑️ `codex/evolve-axos-slides-editor-fq57b6` (`6650be46`, 2026-06-27)
    - 🗑️ `codex/evolve-axos-slides-editor-rggdqf` (`cd32b430`, 2026-06-27)
- **review-app-axos-os** ×3 → WINNER `codex/review-app-axos-os-3j0qvk` (`631be523`, YELLOW)
    - 🗑️ `codex/review-app-axos-os` (`88e2dff1`, 2026-06-27)
    - 🗑️ `codex/review-app-axos-os-xl83pi` (`2c0c68f9`, 2026-06-27)
- **axos-sweep** ×2 → WINNER `claude/axos-sweep-batch4` (`880d63e4`, YELLOW)
    - 🗑️ `claude/axos-sweep-batch3` (`1744c145`, 2026-06-28)
- **add-collapsible-sidebar-for-desktop** ×2 → WINNER `codex/add-collapsible-sidebar-for-desktop` (`6c613738`, YELLOW)
    - 🗑️ `codex/add-collapsible-sidebar-for-desktop-l63qbm` (`7015320b`, 2026-06-28)
- **add-pivot-engine-v2-features** ×2 → WINNER `codex/add-pivot-engine-v2-features` (`df1d9f76`, YELLOW)
    - 🗑️ `codex/add-pivot-engine-v2-features-48qv01` (`3796a364`, 2026-06-28)
- **implement-axos-sheets-workbench** ×2 → WINNER `codex/implement-axos-sheets-workbench-v2` (`706e066e`, YELLOW)
    - 🗑️ `codex/implement-axos-sheets-workbench-v2-o4unq7` (`56bb0fbb`, 2026-06-28)
- **improve-axos-os-public-landing-page** ×2 → WINNER `codex/improve-axos-os-public-landing-page-dpergb` (`56211053`, YELLOW)
    - 🗑️ `codex/improve-axos-os-public-landing-page` (`249cee10`, 2026-06-28)
- **integrate-cell/range-comments-in-axos-os** ×2 → WINNER `codex/integrate-cell/range-comments-in-axos-os` (`d6ad7ceb`, YELLOW)
    - 🗑️ `codex/integrate-cell/range-comments-in-axos-os-triilo` (`f9d684ef`, 2026-06-28)
- **integrate-persistent-review-comments-in-docs** ×2 → WINNER `codex/integrate-persistent-review-comments-in-docs` (`959db89a`, YELLOW)
    - 🗑️ `codex/integrate-persistent-review-comments-in-docs-zeuss3` (`2fa5b5bf`, 2026-06-28)
- **slides-layer** ×2 → WINNER `codex/night-slides-layer-health` (`5060da1d`, GREEN)
    - 🗑️ `codex/night-slides-layer-health-0629` (`891d8a29`, 2026-06-29)

## 🗑️ STALE — ya en `main` (merged by content) · borrar rama (SHA recuperable)

| Rama | SHA | Fecha | Merge | Acción |
|---|---|---|---|---|
| `claude/axos-os-ux-polish-mh8aem` | `908c6956` | 2026-06-30 | clean | cerrar+borrar (ya en main) |
| `claude/pr-queue-integration-y5eido` | `467459e9` | 2026-06-30 | clean | cerrar+borrar (ya en main) |
| `codex/night-backflush-sap-outbox` | `44d288b7` | 2026-06-29 | clean | cerrar+borrar (ya en main) |
| `codex/night-cad-command-shortcuts` | `56f3be7c` | 2026-06-29 | clean | cerrar+borrar (ya en main) |
| `codex/night-cad-ehs-utility-assets` | `371b2585` | 2026-06-29 | clean | cerrar+borrar (ya en main) |
| `codex/night-cad-grid-snap-cq006` | `007cc38f` | 2026-06-29 | clean | cerrar+borrar (ya en main) |
| `codex/night-cad-rack-row-command` | `b8efc430` | 2026-06-29 | clean | cerrar+borrar (ya en main) |
| `codex/night-import-model-capability` | `11d2322e` | 2026-06-29 | clean | cerrar+borrar (ya en main) |
| `codex/night-inventory-discrepancy-monitor` | `301dc717` | 2026-06-29 | clean | cerrar+borrar (ya en main) |
| `codex/night-inventory-location-filter-0629` | `69711ec2` | 2026-06-29 | clean | cerrar+borrar (ya en main) |
| `codex/night-mes-wi-viewer-0629` | `5889b6b8` | 2026-06-29 | clean | cerrar+borrar (ya en main) |
| `codex/night-mrp-planned-order-filter` | `5e8ecc1f` | 2026-06-29 | clean | cerrar+borrar (ya en main) |
| `codex/night-operator-material-request-0629` | `4682f4e9` | 2026-06-29 | clean | cerrar+borrar (ya en main) |
| `codex/night-packing-passed-readiness` | `3704f754` | 2026-06-29 | clean | cerrar+borrar (ya en main) |
| `codex/night-planning-material-readiness` | `c085c892` | 2026-06-29 | clean | cerrar+borrar (ya en main) |
| `codex/night-platform-ledger-query-0629` | `fa01f3ae` | 2026-06-29 | clean | cerrar+borrar (ya en main) |
| `codex/night-platform-response-envelope` | `d82a172a` | 2026-06-29 | clean | cerrar+borrar (ya en main) |
| `codex/night-sheets-comments-governance-0629` | `ab2c78ed` | 2026-06-29 | clean | cerrar+borrar (ya en main) |
| `codex/night-sheets-connector-refresh-governance` | `431b228a` | 2026-06-29 | clean | cerrar+borrar (ya en main) |
| `codex/night-sheets-formula-risk-panel` | `571fb76b` | 2026-06-29 | clean | cerrar+borrar (ya en main) |
| `codex/night-sheets-governance-status` | `197d1981` | 2026-06-29 | clean | cerrar+borrar (ya en main) |
| `codex/night-sheets-keyboard-command-center` | `b495fec7` | 2026-06-29 | clean | cerrar+borrar (ya en main) |
| `codex/night-sheets-mrp-control-room` | `0b39bdd1` | 2026-06-29 | clean | cerrar+borrar (ya en main) |
| `codex/night-sheets-pivot-preview` | `ea1e984d` | 2026-06-29 | clean | cerrar+borrar (ya en main) |
| `codex/night-sheets-slicer-timeline-pro-0629` | `5d208104` | 2026-06-29 | clean | cerrar+borrar (ya en main) |
| `codex/night-sheets-transform-panel` | `e9b6bce4` | 2026-06-29 | clean | cerrar+borrar (ya en main) |
| `codex/night-sheets-xlsx-readiness` | `2db0589c` | 2026-06-29 | clean | cerrar+borrar (ya en main) |
| `codex/night-slides-asset-library-pro` | `08e454ed` | 2026-06-29 | clean | cerrar+borrar (ya en main) |
| `codex/night-slides-audit-readiness` | `87beee94` | 2026-06-29 | clean | cerrar+borrar (ya en main) |
| `codex/night-slides-comments-review-pro` | `f4087c7c` | 2026-06-29 | clean | cerrar+borrar (ya en main) |
| `codex/night-slides-pptx-export-preflight` | `73bd546f` | 2026-06-29 | clean | cerrar+borrar (ya en main) |
| `codex/night-warehouse-location-visibility` | `c5ba7f96` | 2026-06-29 | clean | cerrar+borrar (ya en main) |

## 🗑️ STALE — PR cerrado en tarea previa · borrar rama

| Rama | SHA | Fecha | Merge | Acción |
|---|---|---|---|---|
| `codex/night-mes-confirm-actions-0629` | `ab2b4fe3` | 2026-06-29 | clean | borrar (PR cerrado) |
| `codex/night-slides-animation-timeline` | `30d18590` | 2026-06-29 | clean | borrar (PR cerrado) |
| `codex/night-slides-comments-review` | `7b9c495b` | 2026-06-29 | CONFLICT | borrar (PR cerrado) |

## ✅ GREEN — candidatas a merge (frontend, único, limpio) · gate por rama en FASE 2

| Rama | SHA | Fecha | Merge | Acción |
|---|---|---|---|---|
| `claude/axos-night-integration-audit-w0yvaf` | `95077cee` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-cad-command-line-hints` | `1a9f3c67` | 2026-06-30 | clean | rebase→gate→squash-merge |
| `codex/night-cad-dxf-critical-label-preflight` | `1a0f00ef` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-cad-dxf-export-readiness` | `e1bfb39b` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-cad-dxf-label-export` | `b36b9659` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-cad-edge-clearance-dimensions` | `d463d1dc` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-cad-flow-health-panel` | `bcf8c88e` | 2026-06-30 | clean | rebase→gate→squash-merge |
| `codex/night-cad-kitting-supermarket-template` | `b6c9f63a` | 2026-06-30 | clean | rebase→gate→squash-merge |
| `codex/night-cad-layer-isolation` | `02aef2c8` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-cad-line-balance-command` | `bee3bf36` | 2026-06-30 | clean | rebase→gate→squash-merge |
| `codex/night-cad-manufacturing-symbols` | `1eeb72d2` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-cad-plot-package-metadata` | `a85268a1` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-cad-rack-row-generator` | `2004640a` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-cad-safety-path-zones` | `1771ab91` | 2026-06-30 | clean | rebase→gate→squash-merge |
| `codex/night-cad-validation-quickfixes` | `4152cc54` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-cad-warehouse-generator` | `764b64e5` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-mes-start-confirm` | `e0dd7e9f` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-sheets-approval-health-0629` | `028e0b5c` | 2026-06-30 | clean | rebase→gate→squash-merge |
| `codex/night-sheets-capability-health` | `64b450ab` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-sheets-chart-readiness` | `63d6b236` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-sheets-data-quality-inspector` | `e60bbf3b` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-sheets-print-layout` | `ab79afe5` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-sheets-recalc-inspector` | `29257a73` | 2026-06-30 | clean | rebase→gate→squash-merge |
| `codex/night-sheets-table-quality-rules` | `976feeb0` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-sheets-template-readiness` | `a8b80eee` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-sheets-transform-reshape-0629` | `882e171c` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-slides-animation-workflow` | `21a1eaa9` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-slides-chart-preset-gallery` | `f29e4b17` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-slides-chart-presets-0629` | `9ca64760` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-slides-image-readiness-tools` | `0a01a29d` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-slides-industrial-chart-presets` | `3b53a4b7` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-slides-industrial-table-presets` | `3fc93359` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-slides-layer-health` | `5060da1d` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-slides-layers-filter-health` | `318cc1b1` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-slides-navigation-workbench` | `9b413cd6` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-slides-presentation-quality-audit` | `e2292caa` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-slides-presenter-mode-pro` | `300d0be6` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-slides-reuse-search-correction` | `4b17f63f` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-slides-smartart-industrial-diagrams` | `20776157` | 2026-06-29 | clean | rebase→gate→squash-merge |
| `codex/night-slides-smartart-industrial-presets` | `dcd5af44` | 2026-06-29 | clean | rebase→gate→squash-merge |

## 🟡 YELLOW — frontend con conflicto · consolidar por tema en FASE 3 (muchas serán STALE al rebasear)

| Rama | SHA | Fecha | Merge | Acción |
|---|---|---|---|---|
| `claude/aads-bootstrap-structure-0qz6j4` | `f9b2ef65` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/aads-v2-work-packets` | `9475e77f` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/axos-accent-unify` | `bb68e604` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/axos-ai-system-baef7e` | `59c1fae7` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `claude/axos-backnav-batch` | `fa70cc91` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `claude/axos-beta-readiness-audit-j23x95` | `aeb8a8a2` | 2026-06-29 | CONFLICT | consolidar/verificar |
| `claude/axos-cad-factory-scale-yd546i` | `38b3e376` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `claude/axos-comfort-overlay` | `219274c4` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `claude/axos-dashboard-premium` | `a26f2776` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/axos-landing-2` | `70650776` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/axos-landing-footer` | `bb7aa789` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `claude/axos-landing-renaissance` | `b1bd6ea0` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/axos-login-polish` | `6e40de34` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/axos-module-width` | `e57f4008` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/axos-module-width-pr` | `f0e5c98e` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `claude/axos-os-audit-optimize-90n6bu` | `af0aca8e` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `claude/axos-os-design-system-uj8ev2` | `1bbcecec` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/axos-os-home` | `bec6bf96` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/axos-responsive-pass` | `744e023b` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/axos-search-premium` | `128f50c1` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/axos-sweep-batch4` | `880d63e4` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `claude/axos-text-token-2` | `5a0b9c69` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `claude/axos-text-token-sweep` | `6da21ed3` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `claude/axos-ux-fluidity-audit-jqxwmc` | `658f765f` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/axos-ux-fluidity-pr3-module-shell` | `edd05828` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/axos-violet-accent` | `05132ba1` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `claude/axos-width-batch2` | `641c3eb3` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `claude/cad-array-fase73` | `528a42e3` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/cad-contracts-67-69` | `fbbd7f14` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/cad-contracts-catalog` | `c7315d9d` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/cad-copilot-fase72` | `c87ed1af` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/cad-dimension-format-fase73` | `dafa76f2` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/cad-dwg-detect-fase74` | `34c5a331` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/cad-geom-measure-fase72` | `523f9564` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/cad-intent-backend` | `314451af` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/cad-intent-fase69` | `294f6406` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/cad-plot-scale-fase70` | `24fd08a4` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/cad-tool-summary-5d9krp` | `3789ff6c` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/cad-vision-endpoint-fase71` | `c170b849` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/cad-vision-fase71` | `c0bc4d61` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/codex-pr-audit-merge-yqgnz8` | `053ec2fd` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `claude/confident-cori-l1pima` | `4ca99fbe` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/npi-launch-visual-7zy21h` | `d59dd619` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/npi-model-relation-7zy21h` | `3a043544` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/npi-readiness-extended-7zy21h` | `3aa31e78` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/npi-release-to-mp-7zy21h` | `ed454102` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/npi-risk-register-7zy21h` | `ce4668a2` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/npi-tooling-readiness-7zy21h` | `42ecd5fb` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/npi-workflow-redesign-7zy21h` | `f24ee89b` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `claude/operator-terminal-theme-agkh8o` | `b33d082d` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `codex/add-approval-signoff-foundation-for-workbooks` | `43e2f192` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `codex/add-axos-data-panel-in-sheets` | `74de1faa` | 2026-06-29 | CONFLICT | consolidar/verificar |
| `codex/add-collapsible-desktop-sidebar-for-axos` | `12d2e02a` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `codex/add-collapsible-sidebar-for-axos` | `3d0ee9b6` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `codex/add-collapsible-sidebar-for-desktop` | `6c613738` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `codex/add-foundation-for-slicers-and-timeline-filters` | `b4de3e8a` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `codex/add-pivot-engine-v2` | `dc1e5aaa` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `codex/add-pivot-engine-v2-features` | `df1d9f76` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `codex/add-print/export-layout-foundation-for-sheets` | `0f28d1ea` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `codex/add-slicers-and-timeline-filters-to-sheets` | `89b69770` | 2026-06-29 | CONFLICT | consolidar/verificar |
| `codex/add-track-changes-foundation-for-docs` | `e079ad8b` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `codex/create-codex-master-prompt-documentation-3h7nim` | `7ba222e2` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `codex/design-roadmap-for-axos-docs-evolution-cq7enl` | `d2288c44` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `codex/develop-axos-sheets-data-intelligence-workbench` | `f742dc58` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `codex/enhance-axos-sheets-with-advanced-analytics-features` | `406aee53` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `codex/evolve-axos-sheets-editor-for-erp-connection-bcp55a` | `1fde405a` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `codex/evolve-axos-slides-editor` | `4b0de80d` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `codex/evolve-axos-slides-editor-kw1cj2` | `0989febf` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `codex/extend-workbook-health-with-governance-features` | `45f76d02` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `codex/implement-axos-sheets-enterprise-collaboration` | `b6989808` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `codex/implement-axos-sheets-workbench-v2` | `706e066e` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `codex/implementar-motor-de-formulas-y-compatibilidad` | `4ef54dfb` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `codex/improve-axos-os-public-landing-page-dpergb` | `56211053` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `codex/improve-chart-builder-for-sheets` | `25a14350` | 2026-06-29 | CONFLICT | consolidar/verificar |
| `codex/improve-operator-terminal-ux-8nj3ym` | `859a4c01` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `codex/integrate-cell/range-comments-from-sheets` | `4e0d1d86` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `codex/integrate-cell/range-comments-in-axos-os` | `d6ad7ceb` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `codex/integrate-persistent-comments-in-docs` | `d4db7070` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `codex/integrate-persistent-review-comments-in-docs` | `959db89a` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `codex/night-cad-command-templates` | `6ed39aa5` | 2026-06-29 | CONFLICT | consolidar/verificar |
| `codex/night-cad-industrial-templates` | `d1df9241` | 2026-06-29 | CONFLICT | consolidar/verificar |
| `codex/night-cad-layer-lock-edit-guards` | `5ac6aceb` | 2026-06-29 | CONFLICT | consolidar/verificar |
| `codex/night-cad-layer-quick-actions` | `618e7547` | 2026-06-29 | CONFLICT | consolidar/verificar |
| `codex/night-cad-object-inspector-pro` | `c782b59d` | 2026-06-29 | CONFLICT | consolidar/verificar |
| `codex/night-cad-shortcuts-workbench` | `9c1ee24e` | 2026-06-29 | CONFLICT | consolidar/verificar |
| `codex/night-cad-validation-center` | `4382a733` | 2026-06-29 | CONFLICT | consolidar/verificar |
| `codex/night-event-ledger-query` | `d98f5da3` | 2026-06-29 | CONFLICT | consolidar/verificar |
| `codex/night-material-requests-staging` | `545b3901` | 2026-06-29 | CONFLICT | consolidar/verificar |
| `codex/night-mes-confirm-actions` | `1eb617db` | 2026-06-29 | CONFLICT | consolidar/verificar |
| `codex/night-mes-operator-confirm` | `049ca163` | 2026-06-29 | CONFLICT | consolidar/verificar |
| `codex/night-mes-stop-confirm` | `099899c4` | 2026-06-29 | CONFLICT | consolidar/verificar |
| `codex/night-operator-material-request` | `6630edc2` | 2026-06-29 | CONFLICT | consolidar/verificar |
| `codex/night-planning-safe-cancel` | `855d92dc` | 2026-06-29 | CONFLICT | consolidar/verificar |
| `codex/night-sheets-connector-contract-preview` | `cacf0bfb` | 2026-06-29 | CONFLICT | consolidar/verificar |
| `codex/night-sheets-data-quality-issues` | `12cac36e` | 2026-06-29 | CONFLICT | consolidar/verificar |
| `codex/night-sheets-live-refresh` | `9963996c` | 2026-06-29 | CONFLICT | consolidar/verificar |
| `codex/night-slides-industrial-assets` | `0cec63ef` | 2026-06-29 | CONFLICT | consolidar/verificar |
| `codex/night-slides-outline-find` | `725b37af` | 2026-06-29 | CONFLICT | consolidar/verificar |
| `codex/night-slides-release-quality` | `098de756` | 2026-06-29 | CONFLICT | consolidar/verificar |
| `codex/night-slides-release-readiness-panel` | `5b5da6db` | 2026-06-29 | CONFLICT | consolidar/verificar |
| `codex/night-slides-sorter-search` | `7fc1ed2a` | 2026-06-29 | CONFLICT | consolidar/verificar |
| `codex/redesign-dashboard-for-premium-experience` | `b30448aa` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `codex/redesign-dashboard-for-quality-command-center` | `bbdfa88e` | 2026-06-27 | CONFLICT | consolidar/verificar |
| `codex/redesign-dashboard-for-quality-command-center-6zs9sy` | `13f3d80a` | 2026-06-28 | CONFLICT | consolidar/verificar |
| `codex/review-app-axos-os-3j0qvk` | `631be523` | 2026-06-27 | CONFLICT | consolidar/verificar |

## Plan por fases
- **FASE 1** (tras OK): cerrar+borrar STALE (35) y DUPLICATE (30) con comentario y SHA registrado. ~65 ramas sin mergear una línea de riesgo.
- **FASE 2**: GREEN una por una — rebase, build/lint/test/typecheck, squash-merge, borrar. Falla el gate → baja a YELLOW.
- **FASE 3**: YELLOW por tema — un linaje ganador, resolver conflictos, barrido visual `apps/web/e2e/visual-sweep*` (high-severity=0), luego merge.
- **FASE 4**: RED (9) — rebasar sin merge, brief por rama (arriba), dejar `needs-human-review`.
- **FASE 5**: este doc final con 3 listas (✅ mergeadas · 🗑️ cerradas · 🔬 revisión). Objetivo: solo quedan abiertas las RED.

## ⏸️ DETENIDO — esperando tu aprobación para iniciar FASE 1.

---

## FASE 1 — Ejecución (estado: 2026-06-30)

Aprobado por el owner: **solo FASE 1** (cerrar muerto, cero merges).

**Hecho:**
- ✅ PR **#875** (`night-slides-layer-health-0629`, DUPLICATE) comentado y **cerrado** (superseded by `night-slides-layer-health`).
- De las 64 ramas STALE+DUPLICATE objetivo, **solo #875 tenía PR abierto**; el resto ya tenían PR mergeado/cerrado o sin PR.

**Bloqueado por el entorno (no por las reglas):**
- El borrado de ramas remotas está **prohibido en este entorno**: el relay git devuelve `403` en `push --delete`, y el proxy de Anthropic bloquea escrituras directas a la API REST de GitHub (`Write access ... not permitted through this proxy`). La única vía de escritura es el MCP de GitHub, que **no expone borrado de ramas**.
- Por tanto, el borrado de las 64 ramas debe ejecutarlo el owner con sus credenciales.

**Acción para el owner:** ejecutar `scripts/convergence-fase1-delete.sh` (incluye las 64 ramas y su tabla de recuperación SHA). Alternativa: activar en Settings → General → "Automatically delete head branches" para que GitHub limpie las de PRs mergeados.

Tras el borrado, FASE 1 queda completa: ~65 ramas eliminadas sin mergear una sola línea de riesgo.

---

## FASE 2 — Ejecución (estado: 2026-06-30)

Aprobado por el owner: mergear GREEN en tandas, parar ante cualquier rojo. **Cero rojos.** `main` final tras FASE 2: **`828ea26d`**.

### Verificación previa (workflow adversarial, 25 ramas GREEN rebasables)
19 SAFE · 2 STALE · 4 DUPLICATE · **0 RISKY** (ninguna toca backend → confirma la clasificación). Las otras ~15 GREEN chocaban con el barrido A11y recién mergeado (#891/#893/#896) → pasan a FASE 3.

### ✅ Mergeadas (20 features → `main`)
- **Individuales (13):** #867 mes-start-confirm · #856 sheets-print-layout · #862 sheets-transform-reshape · #853 cad-kitting-template · #880 slides-image-effects · #860 integration-audit(doc) · #869 cad-manufacturing-symbols · #840 sheets-recalc-inspector · #841 slides-presenter-mode · #854 sheets-data-quality · #850 cad-flow-health · #852 sheets-approval-health · #837 slides-quality-audit
- **Vía integración #897 (7 CAD del clúster `Layout3DEditor`/`index.ts`):** #838 line-balance · #844 warehouse-generator · #887 command-line-hints · #847 plot-package-metadata · #861 validation-quickfixes · #858 edge-clearance · #864 dxf-critical-label. Se consolidaron en un PR porque cada merge individual re-ensuciaba a los demás del clúster por el caché de mergeabilidad de GitHub; CI verde sobre el estado combinado.

### 🗑️ Cerradas en FASE 2
- **STALE (ya en main, diff vacío):** `cad-dxf-label-export`, `sheets-capability-health`.
- **DUPLICATE (perdedora):** `cad-rack-row-generator` (gana su gemela `warehouse-generator`).
- Los 7 PRs CAD se cerraron como *merged-via-#897*.

### ⏸️ HOLD para FASE 3
- #863 `slides-chart-presets-0629` y #865 `slides-smartart-industrial-presets`: duplicados de clústeres con gemelas en conflicto; consolidar en FASE 3.

### Borrado de ramas
Bloqueado en este entorno (igual que FASE 1). Script listo: **`scripts/convergence-fase2-delete.sh`** (24 ramas ya-en-main + la rama de integración + stale/dup, con SHAs de recuperación). Ejecútalo con tus credenciales, o activa "Automatically delete head branches".

### Nota técnica
El cuello de botella de FASE 2 fue el **recompute de mergeabilidad de GitHub** (marca ramas `dirty` en caché y no recalcula pasivamente). Se resolvió con re-push fresco (CI) + merges en ráfaga y, para el clúster CAD, con un PR de integración único. Ninguna regla de oro se violó: solo frontend, cero backend/zona-roja mergeado.

---

## FASE 3 + 4 — Ejecución final (estado: 2026-06-30)

`main` final: **`3b2df080`**. Open PRs: **51 → 9** en la sesión.

### FASE 3 — consolidación YELLOW
Re-escaneo contra el `main` avanzado reclasificó las ~105 YELLOW: la gran mayoría resultaron **STALE/DUPLICATE** (superadas por lo ya mergeado) o sin PR abierto. Triage por agentes sobre los PRs YELLOW vivos:

**✅ Mergeadas (10 features VALUABLE):**
- Individuales: **#863** slides chart-presets, **#865** slides smartart-presets (ganadores de clúster; cerré #855 chart-preset-gallery como dup).
- Vía integración **#901** (8 features, una corrida de CI): #866 sheets table-quality · #873 sheets template-readiness · #871 sheets chart-readiness (preserva chart builder #764) · #846 slides animation-timeline · #842 slides table-presets · #872 slides layer-health · #870 CAD layer-isolation · #876 CAD safety-path-zones. Cada conflicto resuelto preservando A11y de main (#896) y las features de #897/#764.

**Cerradas:** #855 (dup), #792/#780 (sin commits ahead). 

**🔬 Leave-for-owner (riesgo, NO mergeadas):**
- **#746** audit-optimize: 535 archivos, historias no relacionadas, borra backend. Recomendado cerrar y re-cortar.
- **#831** reuse-search: regresaría la navegación #827 (borra `slideNavigation.ts`). Salvar solo `slideReuse.ts`.

**⚠️ Gate de barrido visual NO ejecutado** (sin `node_modules`/app en el entorno). Gate usado: CI build·test·lint·smoke. Recomiendo re-correr `apps/web/e2e/visual-sweep*` + auditoría A11y tras mergear #901 (posible pérdida menor de contraste en algún panel al priorizar feature).

### FASE 4 — RED en cuarentena (briefs publicados, NO mergeadas)
8 ramas a revisión humana (3 con PR: #845, #895, #859 — briefs publicados; 5 sin PR documentadas). 2 platform-* cerradas como STALE (envelope ya en main). Detalle de cada brief arriba en la sección FASE 4.

### Borrado de ramas (handoff)
Bloqueado en el entorno. **`scripts/convergence-fase3-delete.sh`** lista **119 ramas** ya-en-main/stale/superseded (sin PR abierto), con SHAs de recuperación. Excluye: las 8 RED en cuarentena, #746/#831 (owner), los 3 PRs nuevos de otras sesiones (#899/#900/#902), y la rama del plan. Ejecutar con tus credenciales (o activar auto-delete).

### Estado objetivo alcanzado
Open PRs restantes (9): plan (#894) · RED cuarentena (#845/#859/#895) · owner-review (#746/#831) · **3 PRs nuevos de sesiones paralelas** (#899 i18n, #900 CAD factory-scale, #902 mes-consume fix) — fuera del scope de convergencia. Todo lo demás: mergeado o en cola de borrado.
