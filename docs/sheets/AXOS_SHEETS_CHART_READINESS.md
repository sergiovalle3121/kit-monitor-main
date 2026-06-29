# AXOS Sheets Chart Readiness

AXOS Sheets now analyzes persisted chart metadata before a chart is saved or rendered in the existing `SheetCharts` workbench panel.

## Scope

- Engine: `apps/web/src/lib/office/charts.ts`
- UI: `apps/web/src/components/office/SheetCharts.tsx`
- Focused test: `apps/web/src/components/office/sheets/charts.spec.ts`

## What It Checks

- Invalid A1 ranges or missing source sheets.
- Ranges without header/data rows.
- Missing numeric series or type-specific columns, including bubble charts requiring X/Y/size.
- Nonnumeric values that the chart renderer would coerce to zero.
- Blank category labels.
- Gauge values outside 0-100.
- Single-series behavior for pie, doughnut, and polar charts.
- Large ranges where preview/rendering caps the first 1000 data rows.

## User Impact

The mounted chart panel now shows a readiness badge, score, series count, numeric point count, and the top chart issues. Blocked charts cannot be created or saved until the data source is corrected. Warning-level charts can still be created, but the user sees honest diagnostics before using them in an industrial dashboard or export workflow.

## Non-Goals

- No new chart engine.
- No duplicate dashboard builder.
- No XLSX chart drawing export changes.
- No fake ERP/MES data generation.
