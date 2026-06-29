# Import Data Capability Matrix

## Context

The existing `import-data` module is the SAP/import lane for AXOS master data.
It already reuses the canonical services for:

- Material Master through `MaterialMasterService`.
- BOM through `BomTreeService`.
- Routing through `RoutingService`.
- Audit evidence through `EventLedgerService` on commit.

## Capability Endpoint

`GET /api/import-data/capabilities` returns the real coverage matrix used by the
`/dashboard/import` UI. It is additive and does not commit data.

The matrix reports:

- Supported sources: CSV, Excel, SQL staging, and SAP IDoc/API.
- Supported import targets: Material Master, BOM, and Routing.
- Required fields per target, derived from `FIELD_SPECS`.
- Downstream AXOS routes and services touched by commit.
- Honest gaps, including the current lack of a configured live SAP connector and
  the absence of a direct Product Model import target.

## Current SAP State

The SAP IDoc/API adapter contract exists, but credentials and endpoints are not
stored in this repo. Until a deployment wires a real adapter, IDoc/API cells are
reported as `CONFIG_REQUIRED`; CSV, Excel, and SQL staging remain ready and use
the same validation/preview/commit path.

