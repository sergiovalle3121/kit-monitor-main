# AXOS Sheets Slicers And Timelines

AXOS Sheets reuses the existing Fortune-Sheet workbench and the persisted `slicers` / `timelines` sheet metadata. This slice improves the already-mounted floating filter controls without introducing a parallel spreadsheet surface.

## User-visible behavior

- Slicer cards now show whether all values are visible, no values are selected, or a partial filter is active.
- The visible `Todos` action clears a slicer back to all values through the existing `onClearSlicer` flow.
- Timeline cards now expose quick ranges for 7 days, 30 days, 90 days, month-to-date, and year-to-date.
- Timeline cards include a visible clear action that removes both date bounds.

## Implementation notes

- Pure model: `apps/web/src/components/office/sheets/slicer.ts`
- Visible control: `apps/web/src/components/office/sheets/SheetSlicer.tsx`
- Regression coverage: `apps/web/src/components/office/sheets/slicer.spec.ts`

The timeline preset helper is deterministic under a supplied `Date`, so specs can validate exact industrial reporting windows without relying on the machine clock.
