# AXOS Sheets Capability Audit

Last updated: 2026-06-29

This audit records the non-redundancy scan for the Sheets automation run that added the data quality preflight workflow.

| Capability | Exists? | Files | Maturity | Gap | Next non-redundant PR | Owner files | Collision risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Excel-grade workbench shell | Yes | `apps/web/src/components/office/SheetEditor.tsx`, `apps/web/src/components/office/OfficeShell.tsx` | strong | Open PRs are changing `SheetEditor.tsx`; avoid shell edits this run. | Refine inspector only after PR #762/#753 land. | `SheetEditor.tsx`, `OfficeShell.tsx` | High |
| File import/export actions | Yes | `apps/web/src/components/office/SheetActions.tsx`, `apps/web/src/lib/office/xlsx.ts` | usable | Export warned about slicers/charts but not workbook data quality. | Add visible preflight before XLSX/CSV export. | `SheetActions.tsx` | Low |
| Workbook health | Yes | `apps/web/src/lib/office/workbookHealth.ts`, `apps/web/src/lib/office/workbookPublishGate.ts` | strong | Health existed but was not summarized in the file action export flow. | Reuse publish gate in export preflight. | `workbookHealth.ts`, `workbookPublishGate.ts` | Medium; PR #753 touches `workbookHealth.ts` |
| Formula error audit | Yes | `apps/web/src/lib/office/formulaErrorAudit.ts`, `apps/web/src/lib/office/formulaErrorSheet.ts` | usable | Pure audit existed but users had to generate/read separate reports. | Surface counts and sample findings in mounted UI. | `formulaErrorAudit.ts`, `SheetActions.tsx` | Low |
| Data validation audit | Yes | `apps/web/src/lib/office/dataValidationAudit.ts`, `apps/web/src/lib/office/dataValidationSheet.ts` | usable | Pure audit existed but no export preflight visibility. | Surface invalid data-validation cells before export. | `dataValidationAudit.ts`, `SheetActions.tsx` | Low |
| AXOS connectors | Yes | `apps/web/src/lib/office/axosConnectors.ts`, `apps/web/src/components/office/SheetEditor.tsx` | usable | Live connector coverage is still limited to supplier scorecard. | Add tenant-safe live endpoints one domain at a time. | `axosConnectors.ts`, backend domain modules | Medium |
| XLSX compatibility scanner | Yes | `apps/web/src/lib/office/xlsxCompatibility.ts` | usable | Scanner is visible in inspector, but export action needed quality context too. | Fold scanner summary into export preflight later. | `xlsxCompatibility.ts`, `SheetActions.tsx` | Low |
| Comments and approval | Yes | `apps/web/src/lib/office/sheetComments.ts`, open PR #762, open PR #753 | partial | Open PRs are active; avoid comment/approval edits this run. | Consolidate after those PRs land. | `SheetEditor.tsx`, comments helpers | High |

## Existing Sheets implementation inspected

- `AGENTS.md`
- `README.md`
- `AXOS_OS_ARCHITECTURE.md`
- `docs/axos-sheets-industrial-roadmap.md`
- `apps/web/src/components/office/SheetEditor.tsx`
- `apps/web/src/components/office/SheetActions.tsx`
- `apps/web/src/components/office/OfficeShell.tsx`
- `apps/web/src/components/office/sheets/*`
- `apps/web/src/lib/office/sheetOps.ts`
- `apps/web/src/lib/office/axosConnectors.ts`
- `apps/web/src/lib/office/workbookHealth.ts`
- `apps/web/src/lib/office/xlsxCompatibility.ts`
- `apps/web/src/lib/office/templates.ts`
- `apps/api/src/modules/office/*`

## Existing capability found

The repo already had formula error audits, data validation audits, workbook publish gates, workbook health, XLSX warnings, and a mounted `SheetActions` import/export control. This run reused those foundations instead of adding another scanner or editor surface.

## What this run intentionally did not duplicate

- No new SheetEditor.
- No new OfficeShell.
- No new Fortune-Sheet wrapper.
- No new formula engine.
- No new validation engine.
- No new workbook health engine.
- No backend tables or migrations.
