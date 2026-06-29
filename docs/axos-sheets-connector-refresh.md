# AXOS Sheets connector refresh contract

AXOS Sheets uses the existing Office connector endpoint as the frontend refresh boundary:

- `GET /office-documents/sheets/connectors/:type`
- Connector definitions and parameter validation come from `packages/contracts/src/office-sheets-connectors.ts`.
- `apps/web/src/lib/office/axosConnectorApi.ts` builds the request and rejects invalid params before network calls.

## Workbook metadata

Inserted connector tables persist these fields on `content.connectors[]`:

- `params`: validated connector params used for preview or refresh.
- `lastStatus`: `ok`, `fallback`, `failed`, or `contract-pending`.
- `rowCount`, `source`, `asOf`, and `warnings`.
- `lastError` only when no safe refresh path exists.

Refresh attempts append entries to `content.connectorRefreshAudit[]`. The SheetEditor AXOS panel can materialize that history into an `AXOS Connector Audit` sheet through the existing `axosConnectorAudit` helper.

## Safety rule

When the API contract is unavailable, invalid, or missing required params, the editor does not fake live success. It rebuilds the existing governed starter table, marks the connector as `fallback`, and records the warning in the audit history. A true failure is stored only when neither API refresh nor local starter rebuild is possible.
