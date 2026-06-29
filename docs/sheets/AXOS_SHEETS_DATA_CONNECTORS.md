# AXOS Sheets Data Connectors

AXOS Sheets uses one connector model for ERP/MES-style tables:

- Frontend catalog and table writing: `apps/web/src/lib/office/axosConnectors.ts`.
- Shared parameter and endpoint contract: `packages/contracts/src/office-sheets-connectors.ts`.
- Frontend API request builder: `apps/web/src/lib/office/axosConnectorApi.ts`.
- Office backend route: `GET /office-documents/sheets/connectors/:type`.
- Visible UI: `apps/web/src/components/office/SheetEditor.tsx`, AXOS Data inspector.

## Current behavior

The AXOS Data inspector now opens `SheetConnectorParams` for contract parameters,
validates them with the shared contract, previews rows through the Office backend
contract, and inserts the returned rows into the selected range as a governed
read-only connector table.

Inserted connector metadata stores:

- `params`
- `lastStatus`
- `lastRefreshedAt`
- `rowCount`
- `source`
- `warnings`

This keeps previews and inserts auditable in workbook JSON and visible in the
AXOS Data panel after autosave.

## Honest limitation

The Office connector route is currently a read-only contract endpoint backed by
sample rows from the shared connector definitions. It is not yet a domain live
aggregator for Inventory, BOM, MRP, Quality, OEE, or Procurement. The UI surfaces
`source` and `warnings` so users do not mistake sample contract rows for live
ERP/MES execution data.

Future live work should replace the Office connector service internals with
tenant-safe aggregators from the owning AXOS modules instead of adding a second
Sheets connector system.
