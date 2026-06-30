# AXOS Sheets Governance Status

Run date: 2026-06-29

## User-visible slice

Sheet documents now surface a governance badge in the existing OfficeShell status bar. The badge summarizes review readiness for the current workbook without opening the right inspector, so planners and quality users can see whether a sheet is ready, needs review, or is blocked before export/release.

## Existing implementation inspected

- `apps/web/src/app/dashboard/office/[id]/page.tsx`
- `apps/web/src/components/office/OfficeShell.tsx`
- `apps/web/src/components/office/SheetEditor.tsx`
- `apps/web/src/lib/office/sheetComments.ts`
- `apps/web/src/lib/office/protectionAudit.ts`
- `apps/web/src/lib/office/workbookPublishGate.ts`
- `apps/web/src/lib/office/workbookHealth.ts`
- `apps/web/src/lib/office/xlsxCompatibility.ts`
- `apps/api/src/modules/office/office.controller.ts`
- `apps/api/src/modules/office/office.service.ts`
- `apps/api/src/modules/office/entities/office-comment.entity.ts`

## Existing capability found

Sheets already persisted workbook comments, AXOS range protection, workbook health, publish gates, and XLSX compatibility scanning. These were visible mainly inside `SheetEditor` inspector tabs or export actions.

## What this reuses

- `auditWorkbookProtection()` for sheet locks, connector locks, and unprotected connector ranges.
- `evaluateWorkbookPublishGate()` for workbook health severity and score.
- `scanXlsxCompatibility()` for unsupported/review export risks.
- Existing `OfficeShell` `statusBarRight` slot for mounting status without adding a new editor.

## What this extends

The new `sheetGovernanceSummary` helper produces a compact, testable status model with:

- `ready`, `review`, or `blocked` state.
- Open/resolved/assigned comment counts.
- Protected sheet/range and connector lock counts.
- Unprotected connector and XLSX unsupported counts.
- User-facing review messages.

## What this intentionally does not duplicate

- It does not add another workbook health engine.
- It does not create another comments backend or cell comment model.
- It does not replace the SheetEditor inspector.
- It does not change XLSX import/export fidelity logic.
- It does not edit the active-conflict Sheets files owned by open PRs.

## Limitations

This is a shell-level preflight surface. Detailed jump-to-cell workflows still belong in `SheetEditor` after the open editor PRs settle.
