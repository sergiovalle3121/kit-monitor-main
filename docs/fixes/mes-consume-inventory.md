# Fix proposal — MES consumption does not decrement formal inventory

> **Status: DRAFT · NEEDS HUMAN REVIEW · DO NOT AUTO-MERGE.**
> Prepared for review by the Owner and Lead Engineer. This branch
> (`fix/mes-consume-inventory`) is intentionally separate from the i18n /
> readability work and must not ride the auto-merge cascade.

## 1. Symptom

Confirming production at `/operador` (MES) advances the station and decrements
the **kit** (`KitMaterial`) and the **step WIP** (`ExecutionStepMaterial`), but
the **formal warehouse inventory** (`InventoryPosition.onHand`) does **not** go
down. Operations sees "consumed" units on the kit while warehouse stock stays
flat — so inventory drifts high and never reflects real consumption.

## 2. Root cause

`MesExecutionService.confirmAdvance()` records the formal consumption like this
(original code, `mes-execution.service.ts` ~L623–635):

```ts
await this.inventory
  .recordTransaction({
    type: 'CONSUME',
    partNumber: m.partNumber,
    quantity: consume,
    fromWarehouseId: `LINE-${execution.line ?? 0}`, // (a)
    fromLocation: step.name,
    actorName: operator,
    referenceType: 'MES_EXECUTION_EVENT',
    referenceId: clientRequestId,
    reason: `MES consumo · WO ${execution.workOrder} · ${step.name}`,
  })
  .catch(() => undefined); // (b)
```

Two compounding defects:

- **(a) Source warehouse may not exist / hold the stock.**
  `InventoryService.recordTransaction` looks up an `InventoryPosition` for
  `fromWarehouseId = LINE-<line>`. If that virtual line warehouse has no
  position for the part (the demo seed and the staging/resupply flow do not
  reliably populate `LINE-<n>` positions), `sourcePos` is `null`, so
  `recordTransaction` records an `INVENTORY` exception and **throws**
  `BadRequestException('Insufficient stock …')`. When `execution.line` is
  `null` the id degrades to the meaningless `LINE-0`.

- **(b) The throw is swallowed silently.** `.catch(() => undefined)` discards
  the error with no log, no metric, no flag. The line keeps running (correct —
  the floor should not stop), but the failure is **invisible**, so the formal
  decrement silently never happens. This is *why the bug went unnoticed*: the
  best-effort call was failing on every event.

## 3. What this change does (minimal, safe, reviewable)

The patch is deliberately conservative because the "correct source warehouse"
is an inventory-architecture decision (see §5). It fixes the **invisible-failure
half** definitively and makes the **wrong-warehouse half** observable and
actionable, without guessing the warehouse model and risking a worse bug
(double decrement / wrong warehouse).

In `confirmAdvance()`:

1. **Resolve the line warehouse once, explicitly.** `lineWarehouseId =
   execution.line != null ? \`LINE-${execution.line}\` : null`. A WO with no
   line has no valid formal source, so the decrement is skipped and recorded
   rather than aimed at a bogus `LINE-0`.
2. **Stop swallowing the error.** Replace `.catch(() => undefined)` with a
   `try/catch` that collects each failure (part, qty, warehouse, error
   message) into `inventorySyncFailures`.
3. **Surface failures.** After the materials loop, if any consumption failed,
   emit a structured `logger.warn` (WO, step, request id, and per-part reason).
   The line is **never blocked** — fail-soft behavior is preserved on purpose.

No data model, migration, entity, tenancy, guard, or transactional-control
change. Behavior on the happy path (warehouse position exists) is unchanged: it
decrements exactly as before.

## 4. Impact

### Inventory
- **No new decrement is introduced.** When the position exists, the decrement
  is identical to today. When it does not, today's behavior (no decrement) is
  preserved — but now it is **logged** instead of hidden. So this change cannot
  over-consume or double-decrement; it only adds visibility.
- Once the warehouse-resolution question (§5) is settled, the formal
  `onHand` decrement will actually apply and inventory will stop drifting.

### Tenancy
- This patch does **not** alter tenant scoping. Note for the reviewer:
  `recordTransaction`'s position lookup is **not** tenant-scoped
  (`queryRunner.manager.findOne(InventoryPosition, …)` filters by
  part/warehouse/location/program/lot/serial but not `tenant_id`). That is a
  **pre-existing** concern, surfaced here for awareness; fixing it is out of
  scope for this draft and should be a separate, deliberate change.

## 5. Open questions for the Lead Engineer (the real decision)

The remaining question is **where line-side stock physically lives** so the
`CONSUME` transaction targets the right position:

1. **Is `LINE-<line>` the intended source warehouse?** `production-runtime`
   uses the same `LINE-${kit.plan.line}` convention, and `resupplies` issues
   into warehouses whose id contains `LINE`. If yes, the gap is that
   staging/resupply (and the demo seed) must **guarantee** a `LINE-<line>`
   position exists for every kitted part before consumption.
2. **Or should consumption resolve the warehouse from the kit/staging
   record?** `KitMaterial` currently has **no** warehouse/location field, so
   there is no direct kit→warehouse link. Adding one (a schema change → its own
   migration, owner-approved) would let MES consume from exactly where the
   material was staged.
3. **Position lookup is over-constrained?** `recordTransaction` matches on
   `programId/lotNumber/serialNumber`. Confirm staged line positions are
   created with values consistent with what MES passes (MES passes none).

Recommended next step: decide (1) vs (2); if (1), make staging/resupply
populate `LINE-<line>` positions and add an integration test that asserts
`onHand` drops after a `confirmAdvance`. If (2), spec the `KitMaterial`
staged-warehouse field + migration.

## 6. How to verify (once §5 is decided)

1. Seed demo; stage/kit a WO so its parts have positions in the chosen source
   warehouse.
2. Confirm an advance at `/operador`.
3. Assert: `ExecutionStepMaterial.availableQty` ↓, `KitMaterial.quantityConsumed`
   ↑ (unchanged today), **and** `InventoryPosition.onHand` ↓ by the consumed qty.
4. Negative path: confirm an advance for a part with no source position →
   line still advances, and a `warn` log lists the part/warehouse/reason.

## 7. Why a draft

This touches the formal inventory ledger. The observability fix is safe to
ship as-is, but the warehouse-resolution decision (§5) determines whether the
decrement actually applies and must be made by someone who owns the inventory
model. Hence: **draft + needs-human-review, not merged.**
