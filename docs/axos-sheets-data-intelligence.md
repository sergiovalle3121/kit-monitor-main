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

## Data quality inspector

AXOS Sheets now exposes a first industrial Data Quality panel from the existing sheet action bar in the Office shell. It reuses existing validation and formula-error audits, then adds focused ERP/MES heuristics without creating a second editor or a fake connector workflow.

- Engine: `apps/web/src/lib/office/dataQuality.ts`
- Existing validation foundation reused: `apps/web/src/lib/office/dataValidationAudit.ts`
- Existing formula-error foundation reused: `apps/web/src/lib/office/formulaErrorAudit.ts`
- UI mount: `apps/web/src/components/office/SheetActions.tsx`
- Report output: generated workbook sheet named `AXOS Data Quality`

Checks included:

- data validation violations, including required fields
- visible formula errors such as `#REF!` and `#NAME?`
- inferred blank industrial key fields
- duplicate industrial keys such as SKU, lot, WO, NCR, PO, supplier, model, and revision
- negative inventory or quantity values
- invalid dates in date/ETA/need/date-like columns
- stale, due, invalid, or failed AXOS connector metadata
- unsupported XLSX import warnings already stored in workbook metadata

The panel is intentionally honest: it only reports issues visible in workbook JSON and connector metadata. It does not call ERP/MES APIs, does not mutate source data, and does not claim connector success. Users can create the `AXOS Data Quality` sheet to review severity, affected cell or range, message, and suggested remediation inside the workbook before sharing or exporting.
