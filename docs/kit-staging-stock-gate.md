# Kit staging stock gate

## Scope

The MES kitting lane (`/api/material-staging/mes`) now validates stock before a
material handler marks plan pick-list lines as staged. It reuses existing
`inventory_positions`; no new warehouse, kit, or inventory table is introduced.

## Contract

- `GET /api/material-staging/mes/plans/:planId` returns each pick-list line with
  `availableQty`, `shortageQty`, and `stockStatus`.
- `availableQty` is calculated from tenant-scoped inventory positions where
  `holdStatus = available`, using `onHand - allocated`.
- `POST /api/material-staging/mes/plans/:planId/lines/:kitMaterialId/stage`
  rejects when the requested staged quantity, plus already staged sibling lines
  for the same part, is greater than available stock.
- `POST /api/material-staging/mes/plans/:planId/stage-all` rejects when any
  pick-list part is short after aggregating repeated lines for that part.

## UI

`/dashboard/material-staging` shows the stock gate for the selected plan, displays
per-line availability, disables stage-all when the plan is short, and prevents a
line stage request that already exceeds available stock. The backend remains the
authoritative guard.
