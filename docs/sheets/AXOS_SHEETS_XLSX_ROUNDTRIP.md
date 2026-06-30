# AXOS Sheets XLSX Roundtrip

Run date: 2026-06-29

## Current Contract

AXOS Sheets uses the existing XLSX bridge and compatibility scanner:

- `apps/web/src/lib/office/xlsx.ts` maps Fortune-Sheet cells, formulas, dimensions, merges, hyperlinks, comments, and defined names through SheetJS.
- `apps/web/src/lib/office/xlsxStyled.ts` writes styled XLSX files with ExcelJS for styles, validations, protection, frozen panes, filters, row heights, column widths, hyperlinks, and cell comments.
- `apps/web/src/lib/office/xlsxCompatibility.ts` provides the visible readiness model consumed by `SheetActions.tsx` and the SheetEditor XLSX inspector.

## This Slice

The compatibility scanner now reports more export-relevant workbook signals:

- AXOS structured tables stored in workbook metadata.
- Custom print layout settings that need review after opening in Excel.
- Import warnings carried forward from XLSX ingestion.
- Cell notes separately from hyperlinks, so Fortune popover notes are not misclassified.
- Autofilters and row/column dimensions as supported fidelity signals.

This is scanner/UI hardening. It does not add a second XLSX exporter or a parallel spreadsheet editor.

## Remaining Gaps

- AXOS table metadata is not emitted as native Excel `Table` objects yet.
- Print layout is used by AXOS browser print/export readiness; native Excel page setup still needs a focused exporter slice.
- Workbook-level AXOS review threads are not native threaded Excel comments.
- Macros/VBA remain unsupported and must never execute inside AXOS.
