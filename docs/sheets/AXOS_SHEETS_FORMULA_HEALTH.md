# AXOS Sheets Formula Health

AXOS Sheets uses one visible formula-risk source for Workbook Health and publish
preflight: `apps/web/src/lib/office/workbookHealth.ts`.

## Current contract

- `formulaErrorAudit.ts` remains the pure scanner for visible spreadsheet error
  values such as `#REF!`, `#NAME?`, `#DIV/0!`, `#VALUE!`, `#N/A`, `#NUM!`, and
  `#NULL!`.
- Workbook Health consumes that scanner and emits scored findings. `#REF!` and
  `#NAME?` are critical because they usually mean broken references or missing
  functions. Other visible formula errors require review.
- `workbookPublishGate.ts` consumes the enriched Workbook Health report instead
  of running its own formula-error scan. This keeps the SheetEditor inspector,
  generated health sheet, and publish preflight aligned.

## Visible user impact

The existing SheetEditor Workbook Health inspector already renders the top
health findings. Workbooks with broken industrial formulas now surface visible
formula error findings without adding another editor surface or duplicating the
formula audit system.
