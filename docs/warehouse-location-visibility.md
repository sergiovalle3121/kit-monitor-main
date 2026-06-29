# Warehouse Location Visibility

## Scope

The warehouse location view is a read-only snapshot for warehouse supervisors and
material handlers. It reuses existing inventory positions and warehouse pull
tasks; it does not introduce a new location table, a parallel warehouse module,
or a migration.

## API

`GET /api/warehouse/locations`

The endpoint is protected by `materials:read` and uses the existing tenant and
building scope already applied by `InventoryService.findAllPositions()` and
`WarehouseService.findAllTasks()`.

Each row is grouped by `warehouseId + location` and includes:

- inventory quantities: `onHand`, `allocated`, `available`, `inTransit`
- quality status quantities: `holdQty`, `quarantineQty`, `qualityBlockQty`
- open material flow: inbound/outbound pull counts and quantities
- visible programs, part count, lot count, top positioned parts
- deterministic signal: `blocked`, `busy`, `available`, or `empty`

## UI

`/dashboard/warehouse` now has a `Locaciones` tab next to Pull Monitor,
Devoluciones, and Analitica. The tab shows KPIs, filters, export, empty states,
and location cards based on the endpoint above.

## Follow-up

A later slice can add scan-to-location actions or bin capacity/master data once
there is a canonical location master. This PR intentionally avoids creating that
model.
