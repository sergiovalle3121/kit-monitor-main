# Inventory Discrepancy Monitor

## Scope

The inventory discrepancy monitor is the operational view for cycle-count
variances. It does not introduce a new discrepancy table or workflow. It reuses
the existing `cycle_counts` state machine:

- `OPEN`: physical count not captured yet.
- `COUNTED`: physical count captured and still actionable.
- `RECONCILED`: variance accepted as-is.
- `ADJUSTED`: inventory corrected to the count.

## API contract

`GET /api/cycle-counts/discrepancies?limit=25`

Returns only `COUNTED` cycle counts with a non-zero variance, scoped by the
current tenant and plant through `CycleCountsService.applyScope`.

The response includes:

- `summary`: total open discrepancies, severity buckets, shortage/overage counts,
  total absolute variance, and net variance.
- `items`: actionable discrepancy rows ordered by severity and absolute variance.

Severity is deterministic because the monitor has no material-cost data yet:

- `HIGH`: absolute variance >= 100, relative variance >= 20%, or system quantity
  is 0 while counted quantity is non-zero.
- `MEDIUM`: absolute variance >= 10 or relative variance >= 5%.
- `LOW`: all other non-zero variances.

## UI integration

`/dashboard/inventory` has a `Discrepancias` tab that reads this endpoint, shows
the current open variances, and links operators back to `/dashboard/cycle-counts`
to reconcile or adjust. The inventory page stays read-only for discrepancy
resolution to avoid duplicating the cycle-count workflow.
