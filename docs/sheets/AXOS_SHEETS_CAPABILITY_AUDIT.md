# AXOS Sheets Capability Audit

Run date: 2026-06-29

This audit records what exists on `origin/main` before the current Sheets PR and identifies the next non-redundant improvements. It is intentionally scoped to AXOS Sheets and the Office persistence/connectors layer.

## Files Inspected

- `AGENTS.md`
- `README.md`
- `AXOS_OS_ARCHITECTURE.md`
- `docs/axos-sheets-industrial-roadmap.md`
- `apps/web/src/components/office/SheetEditor.tsx`
- `apps/web/src/components/office/SheetActions.tsx`
- `apps/web/src/components/office/OfficeShell.tsx`
- `apps/web/src/components/office/sheets/formulaEngine.ts`
- `apps/web/src/components/office/sheets/tableRefs.ts`
- `apps/web/src/components/office/sheets/slicer.ts`
- `apps/web/src/lib/office/sheetOps.ts`
- `apps/web/src/lib/office/axosConnectors.ts`
- `apps/web/src/lib/office/axosConnectorAudit.ts`
- `apps/web/src/lib/office/workbookHealth.ts`
- `apps/web/src/lib/office/workbookPublishGate.ts`
- `apps/web/src/lib/office/xlsxCompatibility.ts`
- `apps/web/src/lib/office/xlsx.ts`
- `apps/web/src/lib/office/xlsxStyled.ts`
- `apps/web/src/lib/office/templates.ts`
- `apps/api/src/modules/office/office.controller.ts`
- `apps/api/src/modules/office/office.service.ts`
- `apps/api/src/modules/office/office-sheet-connectors.service.ts`
- `apps/api/src/modules/office/entities/office-document.entity.ts`
- `packages/contracts/src/office-sheets-connectors.ts`

## Open PR Collision Map

| PR | Area | Collision risk for this run |
| --- | --- | --- |
| #765 `feat(sheets): add slicers and timeline filters` | `SheetEditor.tsx`, slicer model/spec, roadmap | High for editor/slicer edits. Avoided. |
| #762 `feat(sheets): add cell and range comments` | `SheetEditor.tsx`, `sheetComments.ts`, API comment entity, roadmap | High for comments/editor edits. Avoided. |
| #753 `feat(sheets): add approval signoff foundation` | `SheetEditor.tsx`, `workbookHealth.ts`, roadmap | High for approval/health edits. Avoided. |

## Capability Audit

| Capability | Exists? | Files | Maturity | Gap | Next non-redundant PR | Owner files | Collision risk with open PRs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Full-screen workbook shell | Yes | `OfficeShell.tsx`, `SheetEditor.tsx` | strong | Shell is strong, but top actions did not surface export readiness. | Continue workbench polish outside `SheetEditor` when possible. | `SheetEditor.tsx`, `OfficeShell.tsx`, `SheetActions.tsx` | High if touching `SheetEditor`; low for `SheetActions`. |
| Formula bar and name box | Yes | `SheetEditor.tsx`, `formulaEngine.ts` | usable | Formula edit is connected but still constrained by Fortune-Sheet APIs. | Harden protected-cell and external-reference messaging after open editor PRs merge. | `SheetEditor.tsx`, `formulaEngine.ts` | High. |
| Formula engine fidelity | Yes | `formulaEngine.ts`, `components/office/sheets/*.ts` | strong | Many Excel functions exist; remaining parity needs targeted registry audit. | Add missing-function report with tests, without duplicating parser patch. | `components/office/sheets/*`, formula specs | Medium. |
| Formula audit and dependency graph | Yes | `formulaAudit.ts`, `formulaDependencies.ts`, `workbookHealth.ts` | strong | Dependency details are mostly summarized through health, not a full visual graph. | Add formula map panel after editor PRs settle. | `SheetEditor.tsx`, `workbookHealth.ts` | High due #753. |
| AXOS connector registry | Yes | `axosConnectors.ts`, `packages/contracts/src/office-sheets-connectors.ts` | usable | Frontend catalog and shared contract overlap; live coverage is still partial/sample-backed. | Converge frontend catalog toward contracts and expose contract-pending states consistently. | `axosConnectors.ts`, contracts, Office connector service | Medium. |
| Connector refresh/audit | Yes | `axosConnectorAudit.ts`, `axosConnectorApi.ts`, `SheetEditor.tsx`, API connector service | partial | Audit helpers exist, but UI visibility depends on editor wiring. | Add refresh audit sheet/status after avoiding editor conflicts. | `SheetEditor.tsx`, `axosConnectorAudit.ts` | High if editor. |
| Workbook health | Yes | `workbookHealth.ts`, `workbookPublishGate.ts`, `SheetEditor.tsx` | strong | Health is visible in inspector/status; export action did not reuse XLSX readiness. | Keep adding preflight surfaces that reuse health/publish gate. | `workbookHealth.ts`, `SheetEditor.tsx`, `SheetActions.tsx` | High for `workbookHealth`; low for this PR. |
| XLSX compatibility scanner | Yes | `xlsxCompatibility.ts`, `SheetEditor.tsx`, `SheetActions.tsx` | usable | Scanner was visible in inspector but not in the export decision path. | Expand scanner with tables/print layout/macros import warnings. | `xlsxCompatibility.ts`, `SheetActions.tsx` | Low. |
| XLSX import/export fidelity | Yes | `xlsx.ts`, `xlsxStyled.ts`, xlsx specs | usable | Charts/pivots/comments remain metadata or partial fidelity. | Add explicit table metadata export review once tables phase starts. | `xlsx.ts`, `xlsxStyled.ts` | Low. |
| Pivot engine/governance | Yes | `sheetOps.ts`, `pivotGovernance.ts`, `SheetPivot.tsx` | usable | Pivot builder is present but can improve diagnostics and refresh UX. | Improve pivot source diagnostics without touching slicer/comment work. | `SheetPivot.tsx`, `pivotGovernance.ts` | Medium. |
| Charts/dashboard builder | Yes | `charts.ts`, `SheetCharts.tsx`, templates | usable | Advanced builder exists; dashboard generation remains manual. | Add industrial dashboard generator that consumes connector/pivot metadata. | `SheetCharts.tsx`, `charts.ts`, templates | Low/medium. |
| Slicers/timelines | Yes/open PR | `slicer.ts`, `SheetSlicer.tsx`, #765 | partial | Active open PR owns this area. | Do not touch until #765 resolves. | `slicer.ts`, `SheetEditor.tsx` | High. |
| Comments | Yes/open PR | `sheetComments.ts`, `SheetEditor.tsx`, API comment models, #762 | partial | Open PR owns range comments. | Converge Docs/Slides/Sheets comments later; no third model. | comments files, API Office comments | High. |
| Protection/governance | Yes | `SheetEditor.tsx`, `xlsxStyled.ts`, `workbookHealth.ts` | usable | Local metadata enforcement exists; enterprise audit is partial. | Add protection summary/export blockers after #753. | `SheetEditor.tsx`, `workbookHealth.ts`, `xlsxStyled.ts` | High. |
| Approval/signoff | Yes | `workbookApproval.ts`, `workbookHealth.ts`, `SheetEditor.tsx` | usable foundation | Local signoff now detects review/approval content drift; backend signature persistence remains pending. | Map sheet approval to Office electronic signatures and tenant-scoped audit events. | approval/health/editor files, Office signatures | Medium. |
| Print/export layout | Yes | `sheetOps.ts`, `SheetPrintDialog.tsx`, `SheetActions.tsx` | usable | Browser print foundation exists; PDF/native layout is contract-level. | Add print readiness checklist in export menu/panel. | print helpers, `SheetActions.tsx` | Low. |
| Industrial templates | Yes | `templates.ts`, template specs | usable | Core templates exist; backlog templates remain. | Add MRP Shortages or Packing Readiness template with charts/validations. | `templates.ts`, template specs | Low. |
| Performance/autosave | Yes | `workbookPerformance.ts`, `SheetEditor.tsx` | strong | Status telemetry exists; large-panel lazy loading can improve later. | Memoize heavy inspector scans after editor PRs merge. | performance helpers, `SheetEditor.tsx` | High if editor. |

## Current PR Visible Fix

The current PR extends the existing approval/signoff foundation with deterministic content snapshots and Workbook Health drift findings. Users now see `Firma vs contenido` in the mounted Workbook Health inspector, and the existing `Send for review` action records the current workbook snapshot instead of only changing the local approval status.

This is non-redundant because it reuses `workbookApproval.ts`, `workbookHealth.ts`, and the already-mounted `SheetEditor.tsx` signoff card instead of creating a second approval workflow or a backend shortcut.
