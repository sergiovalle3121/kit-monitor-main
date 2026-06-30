# AXOS Sheets Tables

AXOS Sheets already stores formatted tables through the existing SheetEditor table registry and resolves structured references through `apps/web/src/components/office/sheets/tableRefs.ts`.

This slice adds a visible readiness preflight to the existing "Dar formato como tabla" dialog instead of creating another table system.

## What Exists

- `SheetTableStyle.tsx` is the mounted dialog for formatting a selected range as a table.
- `sheetOps.ts` applies header styling, banded rows, borders, total-row styling, and the native Fortune-Sheet autofilter.
- `SheetEditor.tsx` persists table metadata as `{ name, sheetIndex, range }`.
- `tableRefs.ts` rebuilds `TableDef` entries from the saved ranges and expands formulas such as `Tabla1[Columna]`.

## Added Readiness Contract

`analyzeTableRangeReadiness()` checks the requested range before the style operation runs:

- valid A1 range
- row, column, and data-row counts
- whether structured references will be available
- no-header warnings
- autofilter-without-header warnings
- total-row-without-body warnings
- large-range performance notice
- optional Excel-like table-name validation

`analyzeTableDefReadiness()` checks registered table metadata after headers are known:

- invalid or duplicate table names
- missing data rows
- header count mismatch
- blank headers
- duplicate headers

## User Impact

Industrial users now see whether a selected range is ready for Excel-like table behavior before applying table formatting. Invalid table ranges are blocked, while review warnings explain when autofilter or structured references will not behave like Excel.

## Non-Duplication Note

This does not add a new table registry, editor, export path, or parser. It reuses the existing table styling dialog, existing `sheetOps.ts` style application, and existing `tableRefs.ts` structured-reference expansion.
