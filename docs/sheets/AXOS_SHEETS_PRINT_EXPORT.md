# AXOS Sheets Print And Report Export

AXOS Sheets uses the existing browser-print preview path for sheet reports. This
slice does not add a PDF engine or a second export system. It hardens the
existing print workflow with a deterministic readiness preflight that is visible
inside the current `SheetPrintDialog`.

## Print Readiness Model

Owner helper: `apps/web/src/lib/office/sheetOps.ts`

The `analyzeSheetPrintReadiness()` helper returns:

- `status`: `ready`, `review`, or `blocked`.
- `score`: 0-100 report-readiness score.
- `range`, `rows`, and `columns`: resolved print area summary.
- `populatedCells` and `omittedPopulatedCells`: data coverage signals.
- `issues`: stable warnings with severity, key, label, note, and optional count.

The checks cover:

- invalid or missing print area
- implicit full-used-range printing
- populated cells outside the print area
- wide reports without landscape or fit-to-width
- tall reports compressed to one page
- visible gridlines on controlled reports
- missing title/header and footer context
- formula errors inside the print area
- merged-cell layout fidelity warnings

## UI Contract

Owner UI: `apps/web/src/components/office/SheetPrintDialog.tsx`

The existing print preview dialog now shows the readiness score and top warnings
above the print action. The dialog still uses the persisted `printLayout` model
and `buildPrintHtml()` preview path from `sheetOps.ts`; there is no parallel
print/export implementation.

Because an open Sheets PR currently owns `SheetEditor.tsx`, this slice avoids
editing the editor. The dialog computes visible layout readiness from its current
print area and the default used-range hint already provided by the editor.

## Current Limits

- The print path is browser-printable HTML, not a native PDF renderer.
- The dialog can flag used-range coverage without inspecting live sheet cells
unless a caller provides a sheet object to the helper.
- Excel merged-cell pagination is reported as a fidelity warning rather than
emulated exactly in browser print.

## Next Slice

Once the active `SheetEditor.tsx` PRs land, pass the active sheet object into the
dialog so the visible readiness card can also show exact formula-error and
omitted-cell counts for the current sheet.
