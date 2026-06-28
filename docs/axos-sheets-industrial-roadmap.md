# AXOS Sheets — Industrial ERP/MES spreadsheet roadmap

AXOS Sheets is the spreadsheet surface inside Office (`/dashboard/office`) and must evolve without duplicating the existing Fortune-Sheet editor, autosave/versioning, XLSX/CSV import-export, formulas, pivots, charts, validations, and advanced `sheetOps` layer.

## Current extension points

- Frontend editor: `apps/web/src/components/office/SheetEditor.tsx`.
- Pure sheet operations: `apps/web/src/lib/office/sheetOps.ts`.
- Formula extensions: `apps/web/src/components/office/sheets/formulaEngine.ts` and companion modules in `apps/web/src/components/office/sheets`.
- Office persistence/sharing/versioning: `apps/api/src/modules/office`.
- New-document and in-gallery templates: `apps/web/src/lib/office/templates.ts`.

## Industrial priorities

1. Formula and recalc robustness: keep extending the parser wrapper with deterministic compatibility tests before exposing a function in the ribbon.
2. XLSX compatibility: preserve workbook metadata where possible and make unsupported constructs visible instead of silently dropping them.
3. Fidelity for pivots, charts, and validations: prefer pure transforms in `sheetOps` so import/export, UI commands, and generated templates share one implementation.
4. Cell/range comments: store review annotations in workbook content metadata and keep document-level comments separate from spreadsheet cell notes. The editor now persists review comments at workbook level (`comments`) with range, sheet, timestamp, and resolved state.
5. Protection: represent workbook, sheet, and range locks in workbook content first, then wire enforcement through editor hooks and backend audit logs for critical unlock/share actions. The editor now stores `axosProtection` on sheets and blocks direct edits to protected sheets/ranges.
6. AXOS connectors: expose ERP/MES datasets through governed workbook actions for inventory, BOM, MRP, costs, quality, and OEE.
7. Templates: ship industrial workbooks for BOM Costing, OEE Calculator, Downtime Pareto, Inventory ABC, Capacity Plan, and Supplier Scorecard.

## Template baseline added

The sheet gallery now includes industrial starter workbooks that are formula-backed and ready to connect to AXOS modules:

- **BOM Costing**: component quantity, scrap, standard cost, extended cost, and target margin.
- **OEE Calculator**: availability, performance, quality, and OEE from shift inputs.
- **Inventory ABC**: annual usage value, cumulative percentage, and ABC class.
- **Supplier Scorecard**: weighted OTD, quality, cost, response, and supplier status.

Existing templates already cover **Capacity Plan** and **Downtime/Andon** use cases; they remain in the same Manufacturing/MES category for continuity.

## Review and protection baseline added

The Review ribbon now separates quick cell notes from workbook-level comments. Comments are stored in the saved document payload with the selected range, active sheet index, author, timestamp, and resolved flag so future collaboration work can attach users, mentions, and audit events without changing the spreadsheet cell model.

Sheet and range protection starts as document metadata (`axosProtection`) on the Fortune-Sheet sheet object. Direct cell edits are rejected through the editor hook when a sheet is locked or when the target cell falls inside a protected range. This keeps the first protection layer local to the existing editor while leaving room for backend audit logs and permission checks around critical unlock/share actions.

## Fase 1 — Excel-like UX baseline

Implemented in the editor layer without replacing Fortune-Sheet:

- Excel-like ribbon organization now includes `Inicio`, `Insertar`, `Fórmulas`, `Datos`, `Revisar`, `Vista`, `Diseño de página`, and `AXOS` tabs.
- The sheet surface has a name box, formula bar, selection-aware status bar, zoom controls, and a right-click range menu for common cell operations.
- Quick actions cover clipboard commands, number formats, currency/percentage, clear formatting, row/column insert/delete, freeze panes, and starter AXOS connector placeholders.

Known limitation: the AXOS connector tab is intentionally placeholder-only in this phase; live ERP/MES data insertion belongs to the connector phase and must reuse existing tenant-safe modules/endpoints.

## Fase 2 — Industrial formula baseline

Implemented as pure, registered spreadsheet functions (no ERP/MES fetch side effects):

- `AXOS_OEE(availability, performance, quality)` for line/shift OEE.
- `AXOS_YIELD(good, total)` and `AXOS_SCRAP_RATE(scrap, total)` for quality and scrap dashboards.
- `AXOS_CPK(values, lowerSpec, upperSpec)` for process capability analysis.
- `AXOS_INVENTORY_TURNS(cogs, avgInventory)` and `AXOS_ABCD_CLASS(value, thresholds...)` for supply-chain analytics.
- `AXOS_MARGIN(price, cost)`, `AXOS_MARKUP(price, cost)`, and `AXOS_COST_ROLLUP(qtyRange, costRange, scrapRange?)` for BOM costing.
- `AXOS_SUPPLIER_SCORE(otd, quality, cost, response, weights?)`, `AXOS_CAPACITY_UTILIZATION(demandHours, capacityHours)`, `AXOS_SHORTAGE(required, available, incoming?)`, and `AXOS_SUM_VISIBLE(values)` for industrial operating models.

These functions are registered through the existing Fortune-Sheet formula parser patch so formulas can be used directly in cells while remaining unit-testable outside the UI.

## Fase 3 — XLSX links/comments fidelity baseline

The XLSX bridge now preserves lightweight cell hyperlinks and comments in both directions:

- Fortune cell metadata `hl`/`hyperlink`/`link` exports to XLSX hyperlinks.
- Fortune cell metadata `comment`/`noteText` exports to XLSX cell notes/comments.
- SheetJS import maps workbook hyperlinks/comments back into Fortune cell metadata.
- ExcelJS styled import/export also carries hyperlinks/comments alongside styles, validation, filters, protection, merges, dimensions, formulas, and number formats.

Known limitation: workbook-level AXOS review threads remain in the document JSON (`comments`) and are not yet exported as threaded Excel comments; this phase covers cell-level XLSX comments/notes for round-trip compatibility.

## Fase 4 — Industrial chart templates baseline

Industrial sheet templates now open with persisted chart definitions in the workbook payload (`{ sheets, charts }`) so dashboards survive autosave/reload through the existing `SheetEditor` chart model:

- BOM Costing includes cost breakdown and extended-cost charts.
- OEE Calculator includes an OEE component chart.
- Inventory ABC includes annual-value and cumulative-ABC charts.
- Supplier Scorecard includes supplier score and capability radar charts.

Known limitation: these are starter workbook charts generated from template ranges; exporting embedded chart drawings back into XLSX/PDF remains a later fidelity step.

## Fase 5 — Industrial pivot analysis baseline

A dedicated **Industrial Pivot Analysis Pack** template now ships with raw data tabs and generated pivot result tabs for core MES/ERP analysis cases:

- Scrap by defect and line.
- Purchasing spend and OTD by supplier/commodity.
- Inventory value and turns by category/ABC class.
- OEE by line and shift.
- BOM cost and quantity by commodity.

The template stores pivot definitions in the workbook payload (`pivots`) so the existing refresh action can rebuild the result sheets from the raw source data after edits or imports.

## Fase 6 — Data validation hardening baseline

The validation layer now includes enterprise-grade required-field and safe custom formula rules on top of the existing dropdown, number, date, text, and length checks:

- `required` rejects blank/whitespace values and can mark existing empty cells as invalid for critical industrial fields such as lot, station, supplier, quantity, or defect reason.
- `custom_formula` supports a safe non-eval predicate syntax over the current cell value (`VALUE`) with comparisons, `LEN(VALUE)`, `ISNUMBER(VALUE)`, `ISTEXT(VALUE)`, `AND`, `OR`, and `NOT`.
- The Data Validation panel exposes both new rules with AXOS-oriented guidance and continues to use the shared `sheetOps` validation model so UI, pure checks, and XLSX export stay aligned.
- XLSX export maps supported custom formulas to ExcelJS `custom` validations when the expression can be represented without executing workbook code.

Known limitation: AXOS safe custom formulas intentionally do not evaluate arbitrary Excel expressions or cross-cell references yet; that keeps validation deterministic and avoids executing imported workbook code.

## Fase 7 — AXOS connector insertion baseline

The `AXOS` ribbon tab now inserts governed, read-only connector tables into the selected range and persists connector metadata in the workbook payload (`connectors`):

- Inventory snapshot starter table for SKU/location/on-hand/reserved/in-transit/value/ABC analysis.
- BOM cost rollup starter table for parent/component/commodity/quantity/standard cost/scrap/extended cost.
- OEE by line starter table for availability, performance, quality, and OEE dashboards.

Each inserted connector stores connector type, label, inserted range, sheet index, params placeholder, read-only flag, and `lastRefreshedAt`. This is intentionally a frontend metadata baseline: live tenant-safe API refreshes must reuse existing ERP/MES modules or add small audited aggregator endpoints rather than duplicate domain logic.

## Fase 8 — Performance and autosave baseline

AXOS Sheets now has a deterministic workbook performance utility layer for medium/large workbook handling:

- Stable workbook signatures hash sorted workbook payloads so the editor can skip redundant autosave emissions when Fortune-Sheet reports the same content repeatedly.
- Workbook statistics estimate sheets, cells, formulas, styled cells, validations, comments, charts, pivots, connectors, and approximate JSON size for future telemetry and optimization gates.
- Performance labels (`small`, `medium`, `large`, `industrial`) provide a shared threshold vocabulary for lazy-loading, compression, and warning UX in later slices.

The editor now builds a single workbook payload shape and only calls `onChange` when that payload signature changes, reducing unnecessary autosave pressure without changing the persisted JSON schema.

### Fase 8 follow-up — visible workbook telemetry

The status bar now surfaces workbook size telemetry derived from the same performance helper: current performance label, populated cell count, and approximate serialized payload size. This gives operators and support teams an immediate signal when a workbook is entering large/industrial territory before adding heavier features such as live connector refreshes, charts, or pivots.

## Fase 7 expansion — connector registry and governed starter tables

The AXOS connector layer has been expanded from hardcoded editor actions into a reusable registry shared by the ribbon and tests. The first connector catalog now covers all planned read-only starter domains:

- Inventory snapshot.
- BOM cost rollup.
- Work orders.
- OEE by line.
- Supplier scorecard.
- NCR / scrap.
- Purchase orders.
- MRP shortages.

Each connector definition includes domain, refresh policy, user-facing description, headers, sample rows, and a deterministic table builder that writes a rectangular Fortune-Sheet `celldata` block at the selected range. The editor still persists connector instances in workbook JSON (`connectors`) with range, sheet index, refresh timestamp, params placeholder, and read-only flag; live refresh remains reserved for tenant-safe backend aggregator endpoints.

### Fase 7 expansion — connector refresh loop

Persisted connector instances can now be refreshed from workbook metadata. The editor rebuilds each connector table from its stored type and range, overwrites the governed data block, updates `lastRefreshedAt`, and preserves the rest of the sheet so formulas, pivots, charts, and user analysis around the connector range can remain in place. This prepares the UX contract for live API refreshes while keeping the current implementation deterministic and offline-safe.

## Fase 9 — Industrial formula discoverability

The formula wizard now exposes an **AXOS Industrial** category backed by a dedicated catalog for every registered `AXOS_*` function. Each catalog entry includes syntax, description, arguments, and an insertable example so OEE, yield, scrap, Cpk, inventory turns, ABC classification, margin/markup, cost rollup, supplier score, capacity utilization, shortages, and visible sums are discoverable from the spreadsheet UI instead of only being available to users who know the function names.

## Fase 9 — Automated industrial QA runner

The web app now includes `npm run test:office:sheets`, a focused AXOS Sheets regression runner that executes the industrial formula, formula catalog, connector registry/refresh, workbook performance, template chart/pivot, validation, and XLSX links/comments/validation specs in sequence. This gives each future PR a single command for the industrial spreadsheet quality gate before broader app build/lint checks.

### Fase 7 expansion — protected connector ranges

Connector data blocks now create/update protection metadata for their inserted ranges. The editor marks each connector range as locked with connector id/type/reason metadata, so the existing protection hook blocks accidental manual edits while refresh operations can still rebuild the governed data block programmatically.

## Fase 6 expansion — threaded range comments

Workbook comments now have a pure threaded model with replies, resolve/reopen lifecycle, deletion, selection filtering, and summaries. The Review ribbon exposes reply, resolve, reopen, and delete actions for comments anchored to the selected sheet range, while the saved workbook payload remains compatible with the existing `comments` metadata array.

## Fase 2 expansion — Formula audit and governance

The Formula ribbon now includes a formula audit action backed by a pure workbook scanner. The audit extracts formulas, referenced function names, volatile formulas, external workbook/web references, AXOS formula usage, and unknown `AXOS_*` functions. This gives industrial users and support teams a quick governance check before sharing, exporting, or connecting workbook data to ERP/MES workflows.

## Fase 4 expansion — connector dashboard chart suggestions

AXOS connector insert/refresh now creates stable chart suggestions tied to connector metadata. Each connector type maps to a chart suited to its domain (inventory bars, BOM cost breakdown, OEE combo, supplier radar, MRP shortages, etc.), and refresh keeps the chart range synchronized with the governed connector range.

## Fase 9 expansion — Workbook health check

The Review ribbon now includes a workbook health check that combines performance telemetry, formula audit findings, unresolved comments, stale connectors, external references, and unknown AXOS functions into a scored report. This gives users a pre-publish/pre-export readiness check for industrial workbooks before they are shared or connected to live ERP/MES data.

## Fase 3/6 expansion — XLSX protection fidelity

AXOS range protection now survives export as real Excel sheet protection semantics. When a workbook stores `axosProtection` with locked connector or governed ranges, the styled XLSX exporter protects the worksheet, leaves cells outside range-only locks editable, and marks protected ranges as locked. This keeps read-only connector blocks and controlled industrial input zones recognizable when users round-trip files through Excel, while preserving the existing in-editor `beforeUpdateCell` enforcement.

## Fase 5 expansion — Pivot governance and safe refresh

Persisted pivot definitions now have a pure governance layer that can dry-run stored pivots, classify missing source sheets, missing target sheets, empty results, warnings, and successful refreshes, and rebuild target sheets without mutating the source workbook object. The editor refresh action uses this shared layer so users get a clear summary of updated versus skipped pivots instead of silent failures when industrial analysis sheets are renamed or deleted.

## Fase 2 expansion — Formula dependency graph

AXOS Sheets now has a pure formula dependency graph that extracts formula nodes, local and cross-sheet precedents, formula-to-formula edges, missing sheet references, external references, and circular dependency cycles. Workbook Health consumes this graph to flag cycles and missing formula references before users publish or connect industrial workbooks to ERP/MES workflows.

### Fase 2 expansion — Recalculation plan

The dependency graph now also produces a deterministic recalculation plan for formulas that are not blocked by circular references. The plan orders dependencies before dependents, reports formulas blocked by cycles, carries missing references forward, and is consumed by Workbook Health to distinguish fully blocked workbooks from partially recalculable industrial models.

## Fase 9 expansion — What-if and pivot regression gate

The focused AXOS Sheets QA runner now includes the existing pure specs for the pivot engine, Scenario Manager, Goal Seek, and Solver in addition to the new industrial governance specs. This protects the Excel-like what-if analysis layer while the industrial formula, connector, validation, XLSX, and performance work continues in smaller PRs.

## Fase 7 expansion — Connector freshness policies

AXOS connector instances now have a pure freshness model derived from connector refresh policy. Scheduled-ready connectors become due after one hour and stale after 24 hours, while manual connectors become due after 24 hours and stale after seven days. Workbook Health consumes these reports to distinguish due refreshes, stale data, and invalid connector metadata before industrial workbooks are published or used for decisions.

## Delivered slice — AXOS Sheets Workbench v2

AXOS Sheets now exposes an Excel-grade workbench surface without replacing Fortune-Sheet: a persistent formula/name bar, selection intelligence, large-sheet status polish, and a right-side inspector that organizes workbook health, selected-cell statistics, data tools, charts, pivots, comments, protection, XLSX compatibility, and AXOS ERP/MES data connectors. The inspector launches existing dialogs/helpers instead of duplicating engines, and the XLSX review is best-effort metadata scanning only; macros are never executed.

The new pure helper layer derives selection statistics, workbook summaries, health counters, and XLSX compatibility signals from persisted workbook JSON so autosave/export flows can surface risks before sharing or Excel round-trip review.

## Delivered slice — server-backed cell and range comments

AXOS Sheets now reuses the existing Office anchored comments backend for spreadsheet review threads when a document id is available. Sheet comments can target sheet, cell, range, table, pivot, and chart anchors through the generic `office_comments` model, with optimistic workbook-local fallback only when the backend is unavailable. The Workbench comments panel adds open, resolved, and assigned filters, displays backend/fallback state, and surfaces selection badges in the cell inspector and status area so reviewers can find unresolved comments without duplicating a Sheets-only comment service.
