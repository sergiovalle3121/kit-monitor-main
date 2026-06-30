# AXOS Sheets Data Transform Contract

AXOS Sheets uses the existing Data Transform dialog mounted in `SheetEditor.tsx` to run pure, local Power Query-style transformations over a selected workbook range. The transform engine lives in `apps/web/src/lib/office/sheetTransforms.ts`; the dialog lives in `apps/web/src/components/office/SheetTransformDialog.tsx`.

## Supported Steps

- Select columns.
- Rename columns.
- Filter rows.
- Sort rows.
- Remove blank rows.
- Remove duplicate rows.
- Trim and clean text.
- Normalize numbers.
- Normalize dates.
- Add a calculated column using the fixed safe arithmetic contract.
- Group by with sum, average, count, min, or max.
- Split a text column into multiple columns by delimiter.
- Unpivot selected measure columns into a long industrial analysis table.

## Safety Rules

- Transforms only read the selected workbook range and never call ERP/MES APIs.
- Split and unpivot steps report missing columns through preview warnings instead of silently succeeding.
- Calculated columns do not evaluate arbitrary JavaScript or imported spreadsheet formulas.
- Output is applied through the existing `SheetEditor` transform handler as a new sheet or target cell block.

## Industrial Use

- Split part numbers, lots, or supplier codes into family/model/revision columns.
- Unpivot weekly demand, shortage buckets, scorecard periods, or OEE shift columns into long tables that are easier to pivot, chart, or feed into dashboard builders.
