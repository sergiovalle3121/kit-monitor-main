# AXOS Sheets Template Readiness

## MRP Shortages Control Room

The `mrp-shortages-control-room` sheet template is a connected industrial workbook, not a standalone grid. It is visible through the existing Office template gallery and opens with:

- `MRP Dashboard`: decision KPIs for total shortage, critical SKUs, average coverage, expedite actions, and buyer load.
- `MRP Raw`: the existing `mrp_shortages` AXOS connector table in `A1:G5`, plus editable helper formulas in `H:J` that refresh preserves.
- `Actions`: a governed buyer action plan with dropdown validation for priority and status.
- `Assumptions`: honest contract notes that the connector is a governed starter table until the tenant-safe MRP aggregator is live.

## Reused Sheets Foundations

- Connector registry and refresh metadata from `apps/web/src/lib/office/axosConnectors.ts`.
- Range protection metadata consumed by the existing SheetEditor protection hook.
- Named ranges and table metadata consumed by the existing workbook payload.
- Persisted chart metadata consumed by the existing Sheet charts surface.
- Data validation entries from `buildDataVerification`.
- Print layout metadata consumed by the existing print/export workflow.

## Gallery Readiness Badges

The Office template gallery now evaluates every Sheets template with
`apps/web/src/lib/office/templateReadiness.ts` before the user opens it. The
badge is computed from the same workbook payload the template will create:

- formulas
- charts
- pivot definitions
- AXOS connector instances
- table metadata
- validation rules
- protected ranges
- named ranges
- dashboard sheets
- print layout

This makes the visible gallery honest: a user can distinguish a starter grid
from an analysis template, a connected workbook, or a governed control-room
template before creating the document.

## Non-Redundant Next Step

Wire the already existing `SheetConnectorParams` dialog into the AXOS Data panel after the open `SheetEditor.tsx` PRs land. That should route preview/refresh through `apps/web/src/lib/office/axosConnectorApi.ts` and the backend `GET /office-documents/sheets/connectors/:type` contract instead of adding another connector path.
