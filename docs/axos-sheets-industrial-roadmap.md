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
