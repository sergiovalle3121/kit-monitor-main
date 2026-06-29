# AXOS Sheets Data Intelligence

AXOS Sheets now has a first Power Query-style transform foundation mounted in the existing SheetEditor workbench. It is intentionally scoped to local workbook ranges and does not create simulated ERP/MES connector results.

## Transform model

- Engine: `apps/web/src/lib/office/sheetTransforms.ts`
- UI: `apps/web/src/components/office/SheetTransformDialog.tsx`
- Mount point: the existing Data ribbon and Workbench Data inspector in `SheetEditor.tsx`
- Output: a new `Transform N` sheet or a target cell block in the source sheet

Supported pure steps:

- select columns
- rename columns
- filter rows
- sort rows
- remove blank rows
- remove duplicate rows
- trim and clean text
- normalize numbers
- normalize dates
- add a calculated column with safe arithmetic
- group by with sum, average, count, min, or max

## Safety rules

- Transforms only read the selected workbook range.
- The calculated column mode is a fixed arithmetic contract, not arbitrary JavaScript or imported formula execution.
- Missing columns and invalid ranges are reported as warnings/errors instead of silently succeeding.
- Connector refresh remains owned by the AXOS connector registry and Office connector APIs.

## Next slice

Persist transform recipes in workbook metadata so connector tables can be refreshed and then re-run saved transforms without manually rebuilding the recipe.
