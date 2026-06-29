# AXOS Sheets Tree Status

Run date: 2026-06-29

## Current Tree

AXOS Sheets is no longer only a helper-backed grid. The current tree has these foundations on `origin/main`:

- `SheetEditor.tsx` mounts Fortune-Sheet inside the Office shell and exposes ribbon tabs, formula/name bar, status bar, right inspector, charts, pivots, comments, protection, XLSX review, and AXOS Data.
- `SheetActions.tsx` owns import/export controls. This PR extends that existing mounted control with XLSX readiness from `xlsxCompatibility.ts`.
- `sheetOps.ts` holds pure spreadsheet operations for formatting, sorting, duplicate removal, text-to-columns, pivots, named ranges, printing, and validation.
- `formulaEngine.ts` patches the Fortune-Sheet parser once and registers Excel/AXOS function fidelity layers.
- `axosConnectors.ts`, `axosConnectorApi.ts`, and the Office connector API expose governed connector metadata and refresh contracts.
- `workbookHealth.ts` and `workbookPublishGate.ts` combine performance, formulas, connectors, comments, approvals, protection, and governance into readiness signals.
- `xlsxCompatibility.ts`, `xlsx.ts`, and `xlsxStyled.ts` provide import/export and compatibility scanning, including table metadata, print-layout review, import warnings, cell notes, filters, and dimensions.
- `templates.ts` ships industrial workbook templates for BOM costing, OEE, inventory ABC, supplier scorecards, capacity/downtime, and pivot analysis.
- `apps/api/src/modules/office` persists Office documents, versions, sharing, lifecycle/audit events, and connector refresh endpoints.

## Phase Status

| Phase | Status | Evidence | Next tree action |
| --- | --- | --- | --- |
| 0. Capability audit + visible fix | Done in this PR | `docs/sheets/AXOS_SHEETS_CAPABILITY_AUDIT.md`, `SheetActions.tsx` XLSX badge | Merge after checks/review. |
| 1. Full-screen Excel-grade shell | strong | `OfficeShell.tsx`, `SheetEditor.tsx` workbench v2 | Avoid editor changes until #765/#762/#753 resolve. |
| 2. Formula bar/name box | usable | `SheetEditor.tsx`, formula bar state, `formulaEngine.ts` | Harden warnings later. |
| 3. Formula engine hardening | strong | `formulaEngine.ts`, many formula specs | Continue targeted parity specs. |
| 4. Dependency graph/recalc UI | partial/usable | `formulaDependencies.ts`, `workbookHealth.ts` | Add visual formula map after editor conflicts clear. |
| 5. Excel tables | seed/partial | `tableRefs.ts`, table registry references | Build table creation UX and metadata export. |
| 6. Power Query-style transforms | seed | `sheetOps.ts` has some data tools | Add transform preview/apply panel. |
| 7. Live AXOS connectors | partial | `axosConnectors.ts`, contracts, Office connector endpoint | Converge catalog and add more real module-backed endpoints. |
| 8. Connector refresh engine | partial | refresh helpers and audit helper exist | Make audit/status visible without fake success. |
| 9. Pivot builder pro | usable | `SheetPivot.tsx`, `pivotGovernance.ts` | Improve diagnostics/field UX. |
| 10. Slicers/timelines | open PR | #765 | Wait for review/merge. |
| 11-12. Charts/dashboard builder | usable/partial | `SheetCharts.tsx`, `charts.ts`, templates | Generate industrial dashboards from real source metadata. |
| 13. XLSX roundtrip fidelity | usable/stronger | `xlsxCompatibility.ts`, `xlsxStyled.ts`, `xlsxCompatibility.spec.ts`, `docs/sheets/AXOS_SHEETS_XLSX_ROUNDTRIP.md` | Native Excel table objects and page setup export remain next. |
| 14. Comments enterprise | open PR | #762 | Wait for review/merge. |
| 15. Protection/governance | usable | protection metadata + XLSX protection | Integrate enterprise audit later. |
| 16. Approval/signoff | open PR | #753 | Wait for review/merge. |
| 17. Print/report export | usable | print layout helpers/dialog | Add export/print readiness checklist. |
| 18. Keyboard productivity | seed/partial | Office shell shortcut help, grid native shortcuts | Add conflict-safe Sheets shortcuts. |
| 19. Large workbook performance | strong foundation | `workbookPerformance.ts`, status telemetry | Memoize/lazy load heavy panels. |
| 20. CIDE contract | pending | no dedicated Sheets CIDE contract doc yet | Create CIDE tools contract after core workflows stabilize. |
| 21. Data quality inspector | pending | validation audit helpers exist | Add issue panel with severity/jump/export. |
| 22. Template expansion | usable baseline | `templates.ts` industrial workbooks | Add MRP/Packing/Quality/Test Yield templates. |
| 23. Office/AXOS integration | partial | Office persistence/search/lifecycle and connectors | Define table/chart handoff contracts. |
| 24. QA harness | strong | `npm run test:office:sheets --workspace=web` | Keep adding focused specs. |
| 25. Documentation | partial | roadmap plus this audit/status | Split connector, XLSX, parity, dashboard, CIDE docs over future PRs. |

## Non-Redundant Next PR Recommendation

After this PR, the safest next mergeable slice is either:

- Add an MRP Shortages or Packing Readiness industrial template with formulas, charts, validations, and tests in `templates.ts`, avoiding open editor PR collisions.
- Emit native Excel table objects or page setup metadata from `xlsxStyled.ts`, backed by focused round-trip specs.

Avoid touching `SheetEditor.tsx`, `workbookHealth.ts`, `sheetComments.ts`, and `slicer.ts` until PRs #765, #762, and #753 are resolved.
