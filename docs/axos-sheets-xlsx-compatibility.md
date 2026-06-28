# AXOS Sheets — Excel compatibility engine v1

AXOS Sheets keeps Fortune-Sheet as the interactive grid, but the compatibility layer now treats workbook data as a durable Excel-like model instead of one-off UI state.

## Workbook model inventory

Persisted sheet documents can contain:

- `sheets`: Fortune-Sheet sheets with `celldata`, formulas in `v.f`, rendered values in `v.v`/`v.m`, styles, merges under `config.merge`, dimensions, filters, validations, comments/notes, and protection metadata.
- `names`: workbook named ranges (`name`, `sheetIndex`, `range`) round-tripped to XLSX defined names.
- `tables`, `pivots`, `charts`, `scenarios`, `comments`, `connectors`: AXOS metadata used by the workbench and industrial templates.

## Address and range engine

`apps/web/src/lib/office/ranges.ts` is the pure A1 utility layer for `A1`, `$A$1`, `A1:C10`, sheet-qualified references such as `Sheet1!A1`, and quoted sheet names. New formula compatibility work should use this helper before adding another parser.

## Formula errors

`apps/web/src/lib/office/formulaErrors.ts` centralizes Excel-style errors (`#DIV/0!`, `#VALUE!`, `#REF!`, `#NAME?`, `#N/A`, etc.) so industrial functions and future import/export checks can normalize failures consistently.

## Dependency graph and recalculation

`apps/web/src/lib/office/formulaDependencies.ts` scans formulas, multi-sheet references, ranges, and named ranges to build a dependency graph. It exposes a safe recalculation plan that orders formulas by precedents and blocks cycles/missing sheets rather than silently producing stale values.

The workbench Formula tab surfaces this through **Auditar fórmulas** and **Plan de recálculo**.

## XLSX fidelity policy

Current XLSX import/export preserves formulas, number formats, styles through ExcelJS, validations, protection, defined names, hyperlinks, comments, merges, row/column dimensions, and autofilters where supported. Unsupported workbook constructs must be reported through health/audit tools instead of being silently treated as supported Excel fidelity.

## Industrial formula policy

`AXOS_*` formulas remain pure and deterministic. They calculate over workbook values or connector-provided tables; they must not fetch ERP/MES data directly from inside formula evaluation.
