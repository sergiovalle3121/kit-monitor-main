# AXOS Sheets Tree Status

Last updated: 2026-06-29

## Current run status

This run added an export-time data quality preflight for AXOS Sheets without editing `SheetEditor.tsx`, because open PRs #762 and #753 both touch that file. The new workflow is mounted through `SheetActions.tsx`, which is already rendered in the Sheets ribbon/Office shell action group.

## Delivered in this branch

| Area | Status | Files |
| --- | --- | --- |
| Data quality preflight helper | Added | `apps/web/src/lib/office/sheetQualityPreflight.ts` |
| Helper regression coverage | Added | `apps/web/src/lib/office/sheetQualityPreflight.spec.ts`, `apps/web/scripts/run-office-sheets-specs.mjs` |
| Visible workflow | Added | `apps/web/src/components/office/SheetActions.tsx` |
| Capability evidence | Added | `docs/sheets/AXOS_SHEETS_CAPABILITY_AUDIT.md`, `docs/sheets/AXOS_SHEETS_TREE_STATUS.md` |

## User-visible behavior

- A `Preflight` button appears beside the existing Sheets import/export actions.
- The dropdown shows export readiness, score, formula error count, invalid data-validation count, total findings, and sample issues.
- The export dropdown now repeats the preflight status before XLSX/CSV choices.
- Export still runs, but blocked/review preflight states emit honest warnings so users do not share risky industrial workbooks silently.
- Users can copy a preflight summary for review or audit handoff.

## Reused foundations

- `workbookPublishGate.ts` for pre-publish risk scoring.
- `formulaErrorAudit.ts` for visible spreadsheet errors such as `#REF!`.
- `dataValidationAudit.ts` for invalid required/dropdown/number/date/custom rules.
- Existing `SheetActions.tsx` placement in the Sheets ribbon/Office shell action area.

## Next non-redundant Sheets PR

Once the open `SheetEditor.tsx` PRs land, the next low-overlap improvement is a full inspector tab for data quality that can jump to affected cells and optionally insert/update the existing `AXOS Validation Audit` and formula error report sheets from the same pure audit helpers.

## Collision notes

- Avoided `SheetEditor.tsx` due to open PRs #762 and #753.
- Avoided `workbookHealth.ts` due to open PR #753.
- Avoided comments and approval workflows due to open PRs #762 and #753.
