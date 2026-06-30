# Office Convergence — Closure Plan (FASE 0)

> **Mode: CLOSE-AGGRESSIVE.** The bias of this convergence is to **close**, not integrate.
> AXOS already ships a wide Office suite; what's missing is depth in core flows, not more
> Sheets/Slides presets. When in doubt between integrate and close → **close**.
>
> **Status: APPROVED (owner, 2026-06-30 — "Approve all as-is"). FASE 1 + FASE 3 executed.**
> The one open Office PR (#831) is closed as superseded. The remaining 67 PR-less branches
> (60 CLOSE + 7 of the 8 QUARANTINE that have no PR) await **owner branch-deletion** — SHAs are
> recorded below for recoverability. No branch was force-deleted by automation, and **no
> quarantine branch was merged.** See the Execution log at the end.

## TL;DR

- **68 Office branches** inventoried (Sheets / Slides / Docs-comments / master-prompt docs).
- **Current `main` was force-rewritten to a new, disjoint lineage** (`a1d0d002`) that has
  **already integrated the entire valuable Office feature set** — via PR #901
  ("FASE 3 integration — 8 VALUABLE YELLOW features") plus dozens of individual feature PRs
  (#837 presentation quality, #854 data quality, #840 recalc plan, #883 connector freshness,
  #885 governance, #888 comments review, #881 asset filters, #889 slicer timeline, industrial
  chart/SmartArt presets, …).
- **Result of the audit: every one of the 68 branches is superseded.** There are **0 genuine
  KEEP candidates** — no branch contains a uniquely valuable Office capability that `main`
  lacks.

### Decision counts

| Decision | Count | Meaning |
|----------|-------|---------|
| **CLOSE-STALE** | 35 | Feature already present in `main` (often under a sibling filename / different PR #). |
| **CLOSE-DUPLICATE** | 25 | One of N siblings of a theme already covered in `main`; redundant. |
| **QUARANTINE** | 8 | Touches sensitive zones (entities / migrations). Do **not** merge; needs-human-review before disposal. |
| **KEEP (integrate)** | **0** | Nothing rises to genuinely-valuable-AND-missing. |
| **TOTAL** | **68** | |

**Net effect once approved:** Office backlog drops from 68 branches to 0 carried forward;
`main` is **not** inflated with any new Office surface.

---

## Why "close almost everything" is the correct call (evidence)

Two structural facts drove every decision:

### 1. The disjoint-history wall (≈48 branches)
`origin/main` was **force-updated with an unrelated root**. The older `codex/*` branches
descend from the *pre-rewrite* lineage (they still carry old PRs #726, #734, #742…). A virtual
merge of any of them into today's `main` returns:

```
fatal: refusing to merge unrelated histories
```

These branches **cannot be rebased or merged** onto current `main` without reconciling two
entire disjoint codebases. They are dead weight as branches: any feature worth having would be
a **fresh re-implementation on `main`, not a merge.** Since `main` already contains the
equivalent capability in every case, that re-implementation is unnecessary.

### 2. `main` already converged the recent work (≈20 night-* branches)
The ~20 recent, cleanly-mergeable `night-*` branches were checked file-by-file against `main`:

- **13** add a feature file that **already exists verbatim in `main`** → CLOSE-STALE.
- **7** add a file under a *slightly different name* than the one `main` already shipped
  (e.g. branch `commentReview.ts` vs main `commentsReview.ts`; branch `animationTimeline.ts`
  vs main `slideAnimationTimeline.ts`; branch `layerHealth.ts` vs main `layers.ts`) →
  CLOSE-DUPLICATE.

No `night-*` branch contributes a capability `main` lacks.

### Capability coverage in current `main` (spot-checked)
| Capability | Present in `main` |
|------------|-------------------|
| Sheets editor / workbench v2 | ✅ `office/sheets/` (115 files), `SheetEditor`, `sheetWorkbench` |
| Pivot engine | ✅ `SheetPivot.tsx`, `pivotGovernance.ts` |
| Slicers & timeline | ✅ `SheetSlicer.tsx`, `slicer.ts` (PR #889) |
| Formula engine / compatibility | ✅ `formulaEngine.ts`, `industrialFormulaCatalog.ts`, `sheetFormula.ts` |
| ERP / connectors | ✅ `office-sheet-connectors.service.ts`, `axosConnectors.ts`, freshness #883 |
| Data intelligence / data panel | ✅ `SheetDataTable.tsx`, `docs/axos-sheets-data-intelligence.md` |
| Charts / chart readiness | ✅ `charts.spec.ts`, `templateCharts`, chart readiness audit |
| Approval / sign-off | ✅ `workbookApproval.ts` (rebased #753 → merged #802), governance #885 |
| Slides editor | ✅ `office/slides/` (42 files), `SlidesEditor` |
| Slides: animation / chart / SmartArt / layers / comments / quality | ✅ `slideAnimationTimeline.ts`, `chart.ts`, `smartArtPresets.ts`, `layers.ts`, `commentsReview.ts`, `presentationQuality.ts` |
| Docs comments (cell/range + persistent) | ✅ `office-comment.entity.ts`, `office-document-comment.entity.ts`, `commentsReview` |
| Master-prompt / agent guidance | ✅ `AGENTS.md` (root + `apps/web/`) |

---

## Sensitive-zone handling (QUARANTINE — 8 branches)

Per the golden rule, **no branch touching migrations / `*.entity.ts` / `orm.options` /
`synchronize` / auth / guards / tenancy is merged.** Eight branches touch schema in their own
feature commits:

- `codex/integrate-cell/range-comments-*` ×3 → add `apps/api/src/modules/office/entities/office-comment.entity.ts`
- `codex/design-roadmap-for-axos-docs-evolution*` ×5 → add migration
  `20260627120000-CreateOfficeDocumentComments.ts` + `office-document-comment.entity.ts`

**Both entities already exist in `main`**, so these are very likely stale too — but because
they alter the data model, they are routed to **QUARANTINE (needs-human-review)** rather than
auto-closed. A human confirms `main`'s schema supersedes them, then the branch is disposed.
**They are never merged.**

---

## Per-branch decision table

Legend — **Lineage:** `disjoint` = pre-rewrite, unrelated history (un-mergeable);
`recent` = built on current `main` (mergeable but already-integrated).
**SHA** is recorded for recoverability (branch deletion is reversible from these).

| # | Branch | SHA | Lineage | Cluster | Decision | Sensitive | OpenPR | Superseded by / rationale |
|---|--------|-----|---------|---------|----------|-----------|--------|---------------------------|
| 1 | `codex/create-codex-master-prompt-documentation` | cede689e | disjoint | A·Master-prompt docs | **CLOSE-DUPLICATE** | — | — | Process-doc dup of cluster; main carries AGENTS.md |
| 2 | `codex/create-codex-master-prompt-documentation-3h7nim` | 7ba222e2 | disjoint | A·Master-prompt docs | **CLOSE-DUPLICATE** | — | — | dup of create-codex-master-prompt-documentation |
| 3 | `codex/create-codex-master-prompt-documentation-6aygno` | eb39b65b | disjoint | A·Master-prompt docs | **CLOSE-DUPLICATE** | — | — | dup of create-codex-master-prompt-documentation |
| 4 | `codex/create-codex-master-prompt-documentation-e3kbom` | 2593b420 | disjoint | A·Master-prompt docs | **CLOSE-DUPLICATE** | — | — | dup of create-codex-master-prompt-documentation |
| 5 | `codex/create-codex-master-prompt-documentation-kz21de` | ff284c0c | disjoint | A·Master-prompt docs | **CLOSE-DUPLICATE** | — | — | dup of create-codex-master-prompt-documentation |
| 6 | `codex/create-codex-master-prompt-documentation-x3ipq2` | d283da9c | disjoint | A·Master-prompt docs | **CLOSE-DUPLICATE** | — | — | dup of create-codex-master-prompt-documentation |
| 7 | `codex/create-codex-master-prompt-documentation-xcna09` | 7db07ed2 | disjoint | A·Master-prompt docs | **CLOSE-DUPLICATE** | — | — | dup of create-codex-master-prompt-documentation |
| 8 | `codex/design-roadmap-for-axos-docs-evolution` | 8a426e7b | disjoint | B·Docs roadmap | **QUARANTINE** | ⚠️ | — | migration+office-document-comment.entity.ts; both already in main |
| 9 | `codex/design-roadmap-for-axos-docs-evolution-cq7enl` | d2288c44 | disjoint | B·Docs roadmap | **QUARANTINE** | ⚠️ | — | dup; touches entity/migration; already in main |
| 10 | `codex/design-roadmap-for-axos-docs-evolution-dkdtld` | a255696b | disjoint | B·Docs roadmap | **QUARANTINE** | ⚠️ | — | dup; touches entity/migration; already in main |
| 11 | `codex/design-roadmap-for-axos-docs-evolution-wx0ryc` | d36969fc | disjoint | B·Docs roadmap | **QUARANTINE** | ⚠️ | — | dup; touches entity/migration; already in main |
| 12 | `codex/design-roadmap-for-axos-docs-evolution-y3fxta` | 1a5fe504 | disjoint | B·Docs roadmap | **QUARANTINE** | ⚠️ | — | dup; touches entity/migration; already in main |
| 13 | `codex/evolve-axos-sheets-editor-for-erp-connection-bcp55a` | 1fde405a | disjoint | C·Sheets editor/ERP | **CLOSE-STALE** | — | — | ERP connectors in main (office-sheet-connectors.service.ts, axosConnectors) |
| 14 | `codex/evolve-axos-sheets-editor-for-erp-connection-ii3kns` | acd405c5 | disjoint | C·Sheets editor/ERP | **CLOSE-DUPLICATE** | — | — | dup of evolve-sheets-erp; ERP connectors in main |
| 15 | `codex/evolve-axos-sheets-editor-for-erp-connection-n1xb1g` | e0991a85 | disjoint | C·Sheets editor/ERP | **CLOSE-DUPLICATE** | — | — | dup of evolve-sheets-erp; ERP connectors in main |
| 16 | `codex/evolve-axos-sheets-editor-for-erp-connection-nklz7p` | 99d324fc | disjoint | C·Sheets editor/ERP | **CLOSE-DUPLICATE** | — | — | dup of evolve-sheets-erp; ERP connectors in main |
| 17 | `codex/implement-axos-sheets-workbench-v2-o4unq7` | 56bb0fbb | disjoint | C·Sheets editor/ERP | **CLOSE-STALE** | — | — | Workbench v2 in main (sheetWorkbench, SheetEditor) |
| 18 | `codex/develop-axos-sheets-data-intelligence-workbench` | f742dc58 | disjoint | C·Sheets editor/ERP | **CLOSE-STALE** | — | — | Data intelligence in main (docs/axos-sheets-data-intelligence.md, SheetDataTable) |
| 19 | `codex/enhance-axos-sheets-with-advanced-analytics-features` | 406aee53 | disjoint | C·Sheets editor/ERP | **CLOSE-STALE** | — | — | Analytics covered by main pivot/charts/data-quality |
| 20 | `codex/implementar-motor-de-formulas-y-compatibilidad` | 4ef54dfb | disjoint | C·Sheets editor/ERP | **CLOSE-STALE** | — | — | Formula engine in main (formulaEngine.ts, industrialFormulaCatalog) |
| 21 | `codex/implement-axos-sheets-enterprise-collaboration` | b6989808 | disjoint | C·Sheets editor/ERP | **CLOSE-STALE** | — | — | Collaboration/comments covered in main (office-comment entity, governance) |
| 22 | `codex/add-pivot-engine-v2-features` | df1d9f76 | disjoint | D·Sheets features | **CLOSE-STALE** | — | — | Pivot in main (SheetPivot.tsx, pivotGovernance.ts) |
| 23 | `codex/add-pivot-engine-v2-features-48qv01` | 3796a364 | disjoint | D·Sheets features | **CLOSE-DUPLICATE** | — | — | dup of add-pivot-engine-v2-features |
| 24 | `codex/add-foundation-for-slicers-and-timeline-filters` | b4de3e8a | disjoint | D·Sheets features | **CLOSE-STALE** | — | — | Slicers/timeline in main (SheetSlicer.tsx, slicer.ts; PR #889) |
| 25 | `codex/add-slicers-and-timeline-filters-to-sheets` | 89b69770 | disjoint | D·Sheets features | **CLOSE-DUPLICATE** | — | — | dup of slicers-and-timeline; in main |
| 26 | `codex/add-axos-data-panel-in-sheets` | 74de1faa | disjoint | D·Sheets features | **CLOSE-STALE** | — | — | Data panel covered (SheetDataDialog/SheetDataTable, data-intelligence) |
| 27 | `codex/improve-chart-builder-for-sheets` | 25a14350 | disjoint | D·Sheets features | **CLOSE-STALE** | — | — | Chart builder in main (charts.spec, templateCharts, chart readiness) |
| 28 | `codex/add-approval-signoff-foundation-for-workbooks` | 43e2f192 | disjoint | D·Sheets features | **CLOSE-STALE** | — | — | Approval/signoff in main (workbookApproval.ts; rebased #753->#802) |
| 29 | `rebase/753-approval-signoff` | 7c2fd24c | disjoint | D·Sheets features | **CLOSE-STALE** | — | — | Already in main (rebased #753 -> merged #802) |
| 30 | `codex/night-sheets-approval-health-0629` | f56e5e00 | recent | E·night-sheets | **CLOSE-STALE** | — | — | workbookApproval/workbookHealth in main (#885 governance) |
| 31 | `codex/night-sheets-chart-readiness` | 63d6b236 | recent | E·night-sheets | **CLOSE-STALE** | — | — | charts.ts + AXOS_SHEETS_CHART_READINESS.md in main |
| 32 | `codex/night-sheets-comments-governance-0629` | ab2c78ed | recent | E·night-sheets | **CLOSE-STALE** | — | — | SheetGovernanceBadge/sheetGovernanceSummary in main (#885) |
| 33 | `codex/night-sheets-connector-contract-preview` | cacf0bfb | disjoint | E·night-sheets | **CLOSE-STALE** | — | — | Connector freshness in main (#883, axosConnectorAudit) |
| 34 | `codex/night-sheets-data-quality-issues` | 12cac36e | disjoint | E·night-sheets | **CLOSE-STALE** | — | — | Data quality inspector in main (#854) |
| 35 | `codex/night-sheets-live-refresh` | 9963996c | disjoint | E·night-sheets | **CLOSE-DUPLICATE** | — | — | Connector refresh dup; #883 freshness in main |
| 36 | `codex/night-sheets-recalc-inspector` | f984bae3 | recent | E·night-sheets | **CLOSE-STALE** | — | — | formulaDependencies / recalc plan in main (#840) |
| 37 | `codex/night-sheets-table-quality-rules` | 976feeb0 | recent | E·night-sheets | **CLOSE-STALE** | — | — | sheets/tableRefs.ts in main |
| 38 | `codex/night-sheets-template-readiness` | a8b80eee | recent | E·night-sheets | **CLOSE-STALE** | — | — | templateReadiness.ts in main |
| 39 | `codex/evolve-axos-slides-editor` | 4b0de80d | disjoint | F·Slides editor | **CLOSE-STALE** | — | — | Full slides editor in main (office/slides, SlidesEditor) |
| 40 | `codex/evolve-axos-slides-editor-fq57b6` | 6650be46 | disjoint | F·Slides editor | **CLOSE-DUPLICATE** | — | — | dup of evolve-axos-slides-editor |
| 41 | `codex/evolve-axos-slides-editor-kw1cj2` | 0989febf | disjoint | F·Slides editor | **CLOSE-DUPLICATE** | — | — | dup of evolve-axos-slides-editor |
| 42 | `codex/evolve-axos-slides-editor-rggdqf` | cd32b430 | disjoint | F·Slides editor | **CLOSE-DUPLICATE** | — | — | dup of evolve-axos-slides-editor |
| 43 | `codex/night-slides-animation-timeline` | 30d18590 | recent | G·night-slides | **CLOSE-DUPLICATE** | — | — | animation variant; slideAnimationTimeline.ts in main |
| 44 | `codex/night-slides-animation-workflow` | 21a1eaa9 | recent | G·night-slides | **CLOSE-STALE** | — | — | slideAnimationTimeline.ts in main |
| 45 | `codex/night-slides-chart-preset-gallery` | f29e4b17 | recent | G·night-slides | **CLOSE-DUPLICATE** | — | — | chart-preset variant; chart.ts/industrial presets in main |
| 46 | `codex/night-slides-chart-presets-0629` | 9ca64760 | recent | G·night-slides | **CLOSE-STALE** | — | — | slides/chart.ts in main (industrial chart presets) |
| 47 | `codex/night-slides-industrial-chart-presets` | 3b53a4b7 | recent | G·night-slides | **CLOSE-DUPLICATE** | — | — | chart-preset variant; in main |
| 48 | `codex/night-slides-comments-review` | 7b9c495b | recent | G·night-slides | **CLOSE-STALE** | — | — | commentsReview.ts in main (#888 review queue) |
| 49 | `codex/night-slides-image-readiness-tools` | 0a01a29d | recent | G·night-slides | **CLOSE-STALE** | — | — | ImageEffectsPanel/imageEffects in main (image effect presets) |
| 50 | `codex/night-slides-industrial-table-presets` | 3fc93359 | recent | G·night-slides | **CLOSE-STALE** | — | — | slides/table.ts in main |
| 51 | `codex/night-slides-layer-health` | 5060da1d | recent | G·night-slides | **CLOSE-STALE** | — | — | slides/layers.ts in main |
| 52 | `codex/night-slides-layer-health-0629` | 891d8a29 | recent | G·night-slides | **CLOSE-DUPLICATE** | — | — | layer-health variant; layers.ts in main |
| 53 | `codex/night-slides-layers-filter-health` | 318cc1b1 | recent | G·night-slides | **CLOSE-DUPLICATE** | — | — | layer-health variant; layers.ts in main |
| 54 | `codex/night-slides-navigation-workbench` | 9b413cd6 | disjoint | G·night-slides | **CLOSE-STALE** | — | — | Slide navigation covered in main |
| 55 | `codex/night-slides-outline-find` | 725b37af | disjoint | G·night-slides | **CLOSE-STALE** | — | — | Outline find covered in main slides |
| 56 | `codex/night-slides-presentation-quality-audit` | 904e5a3f | recent | G·night-slides | **CLOSE-STALE** | — | — | presentationQuality.ts in main (#837) |
| 57 | `codex/night-slides-release-quality` | 098de756 | disjoint | G·night-slides | **CLOSE-STALE** | — | — | Presenter readiness in main (#841) |
| 58 | `codex/night-slides-release-readiness-panel` | 5b5da6db | disjoint | G·night-slides | **CLOSE-DUPLICATE** | — | — | release-quality variant; #841 in main |
| 59 | `codex/night-slides-reuse-search-correction` | 4b17f63f | disjoint | G·night-slides | **CLOSE-STALE** | — | #831 | Asset library use-case filters in main (#881). [OPEN PR #831] |
| 60 | `codex/night-slides-smartart-industrial-diagrams` | 20776157 | recent | G·night-slides | **CLOSE-DUPLICATE** | — | — | smartart variant; smartArtPresets.ts in main |
| 61 | `codex/night-slides-smartart-industrial-presets` | dcd5af44 | recent | G·night-slides | **CLOSE-STALE** | — | — | smartArtPresets.ts in main |
| 62 | `codex/night-slides-sorter-search` | 7fc1ed2a | disjoint | G·night-slides | **CLOSE-STALE** | — | — | Slide sorter search covered in main |
| 63 | `codex/integrate-cell/range-comments-from-sheets` | 4e0d1d86 | disjoint | H·Comments | **QUARANTINE** | ⚠️ | — | office-comment.entity.ts (SENSITIVE); already in main |
| 64 | `codex/integrate-cell/range-comments-in-axos-os` | d6ad7ceb | disjoint | H·Comments | **QUARANTINE** | ⚠️ | — | office-comment.entity.ts (SENSITIVE); already in main |
| 65 | `codex/integrate-cell/range-comments-in-axos-os-triilo` | f9d684ef | disjoint | H·Comments | **QUARANTINE** | ⚠️ | — | office-comment.entity.ts (SENSITIVE); already in main |
| 66 | `codex/integrate-persistent-comments-in-docs` | d4db7070 | disjoint | H·Comments | **CLOSE-STALE** | — | — | Docs comments in main (office-document-comment.entity.ts, commentsReview) |
| 67 | `codex/integrate-persistent-review-comments-in-docs` | 959db89a | disjoint | H·Comments | **CLOSE-DUPLICATE** | — | — | dup of persistent-comments; in main |
| 68 | `codex/integrate-persistent-review-comments-in-docs-zeuss3` | 2fa5b5bf | disjoint | H·Comments | **CLOSE-DUPLICATE** | — | — | dup of persistent-comments; in main |

---

## Clusters at a glance

| Cluster | Branches | Theme | Disposition |
|---------|---------:|-------|-------------|
| **A · Master-prompt docs** | 7 | `create-codex-master-prompt-documentation` ×7 | CLOSE (process-doc dups; `AGENTS.md` is canonical) |
| **B · Docs roadmap** | 5 | `design-roadmap-for-axos-docs-evolution` ×5 | QUARANTINE (migration + entity) |
| **C · Sheets editor/ERP** | 9 | evolve-sheets-erp ×4, workbench-v2, data-intelligence, analytics, motor-formulas, enterprise-collab | CLOSE (all in `main`) |
| **D · Sheets features** | 8 | pivot ×2, slicers ×2, data-panel, chart-builder, approval-signoff, rebase/753 | CLOSE (all in `main`) |
| **E · night-sheets** | 9 | approval-health, chart-readiness, comments-governance, connector-contract, data-quality, live-refresh, recalc, table-quality, template-readiness | CLOSE-STALE |
| **F · Slides editor** | 4 | `evolve-axos-slides-editor` ×4 | CLOSE (in `main`) |
| **G · night-slides** | 20 | animation ×2, chart-presets ×3, smartart ×2, layer-health ×3, comments-review, outline-find, sorter-search, release-quality ×2, presentation-quality-audit, navigation, reuse-search, image-readiness, table-presets | CLOSE-STALE/DUPLICATE |
| **H · Comments** | 6 | cell/range-comments ×3 (⚠️ entity), persistent-comments ×3 | 3 QUARANTINE + 3 CLOSE |
| **Total** | **68** | | **60 CLOSE · 8 QUARANTINE · 0 KEEP** |

> Open PRs: only **1** of the 68 branches has an open PR — **#831**
> (`codex/night-slides-reuse-search-correction`). The other 67 are dangling branches whose PRs
> were already merged/closed or never opened; closing them = branch deletion + SHA record.

---

## The KEEP list — empty, by evidence

The brief asked for **at most 1–2 genuinely valuable, unique winners per theme** and for the
owner to confirm them. After auditing all 68 branches against current `main`, **no branch
qualifies**: every Office capability they represent is already shipped in `main`. Presenting a
padded KEEP list would re-introduce surface the owner already has — the opposite of this
convergence's goal.

**Owner override point:** if you know of a *specific* Office capability you want that you
believe `main` is missing, name it and I'll (a) verify it's truly absent and (b) scope a fresh
re-implementation on `main` (these branches can't be merged due to the disjoint history). Two
areas with the *thinnest* coverage, if you want a closer look before sign-off:

1. **Docs "data panel"** (`add-axos-data-panel-in-sheets`) — `main` has data-intelligence
   tables but not a dedicated named "data panel"; low value, still recommend CLOSE.
2. **Connector *contract preview*** (`night-sheets-connector-contract-preview`) — `main` has
   connector *freshness/audit* (#883) but not an explicit contract-preview view; recommend
   CLOSE unless you want that specific view.

Neither is recommended for KEEP.

---

## Execution plan (runs only after approval)

### FASE 1 — Close the bulk (60 branches: CLOSE-STALE + CLOSE-DUPLICATE)
- For the 1 branch with an open PR (**#831**): close the PR with a comment
  (`superseded by main — asset library use-case filters (#881)`) and record its SHA.
- For the 67 PR-less branches: record SHA (table above) and hand to the owner for branch
  deletion (auto-delete / cleanup script). No merges.

### FASE 2 — Integrate the KEEP list
- **No-op.** KEEP list is empty.

### FASE 3 — Quarantine (8 branches: B·Docs roadmap ×5, H·cell/range-comments ×3)
- Tag `needs-human-review`. Risk brief: each alters the Office data model
  (`office-comment.entity.ts` / `office-document-comment.entity.ts` + a migration), and `main`
  already contains those entities. A human confirms equivalence, then disposes. **Never merged.**

### Recoverability
Every SHA is recorded in the table above; deleted branches are restorable via
`git branch <name> <sha>` / `git push origin <sha>:refs/heads/<name>`.

---

## ⛔ STOP — Owner approval required

Per the golden rules, **no branch will be closed, merged, or deleted until you approve.**
Please confirm:

1. **Close all 60** CLOSE-STALE / CLOSE-DUPLICATE branches (and close PR #831)?
2. **0 KEEP** — agreed nothing needs integrating? (Or name any specific capability to re-scope.)
3. **Quarantine the 8** schema-touching branches as needs-human-review (not merged)?

---

## Execution log

**Approval:** Owner approved "Approve all as-is" on 2026-06-30 (close 60, keep 0, quarantine 8).

### FASE 1 — Close (done where a PR exists)
- **PR #831** (`codex/night-slides-reuse-search-correction`) — **CLOSED** with a superseded
  comment (asset library use-case filters, #881). SHA `4b17f63f` recorded.
- **67 remaining CLOSE/QUARANTINE branches have no open PR.** There is no PR to close; the
  disposal action for these is **branch deletion, which is the owner's step** (auto-delete /
  cleanup script) per the golden rules. Every SHA is in the table above for recoverability.

### FASE 2 — Integrate KEEP
- **No-op.** KEEP list is empty (0 branches).

### FASE 3 — Quarantine
- The 8 schema-touching branches (B·Docs roadmap ×5, H·cell/range-comments ×3) are recorded
  here as **needs-human-review**; none has an open PR to label and **none was merged**. A human
  confirms `main`'s `office-comment.entity.ts` / `office-document-comment.entity.ts` +
  migration supersede them, then deletes the branches.

### Owner hand-off — branches to delete (SHAs are restore points)
Run your cleanup script / GitHub branch auto-delete against the 67 PR-less branches in the
table above (every row except PR #831, already closed). To restore any branch later:
`git push origin <sha>:refs/heads/<branch>`.
