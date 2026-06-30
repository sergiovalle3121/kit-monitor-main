# Fix proposal — align production-runtime consume to the shared LINE-<n> tank

> **Status: DRAFT · NEEDS HUMAN REVIEW · DO NOT MERGE.**
> Completes the consume side of the loop opened in #910 / #915. Branch
> `fix/runtime-consume-line-tank`, separate from other work; must not ride the
> auto-merge cascade.

## 1. Why — the loop's last consume path still missed the tank

#910 and #915 made **supply** fill the line tank `LINE-<n>` (at the shared
`LINE_STOCK_LOCATION`) on both the shortage path (`material-requests.fulfill`)
and the primary staging path (`stageLine` / `stageAllForPlan`). #910 also aligned
the **MES execution** consume (`/operador` step events) to drain that same tank.

But there are **two** runtime consume paths, and one was still misaligned.
`ProductionRuntimeService.registerBayEvent` (the bay-enter production event) read
from a different, never-filled location:

```
supply (staging / fulfill)   →  ISSUE  → LINE-<n> @ LINE_STOCK_LOCATION   ✅
mes-execution  /operador     →  CONSUME ← LINE-<n> @ LINE_STOCK_LOCATION   ✅ (#910)
production-runtime bay event →  CONSUME ← LINE-<n> @ BAY-<bayId>           ❌ wrong location
```

Because supply never deposits at `BAY-<bayId>`, that position never existed, so the
decrement always failed. Worse, the failure was **silently swallowed**:

```ts
await this.inventory.recordTransaction({ ... fromLocation: `BAY-${bayId}` ... })
  .catch(() => {
    console.warn(`Inventory decrement failed for ${state.partNumber} ...`);
  });
```

`.catch(() => console.warn(...))` hides that the formal ledger never moved — the
exact anti-pattern #902 removed elsewhere.

## 2. What this change does

In `production-runtime.service.ts`, the formal consumption inside
`registerBayEvent`:

- **Targets the shared line tank.** `fromWarehouseId` is now
  `lineStockWarehouse(kit.plan.line)` (= `LINE-<línea>`) and `fromLocation` is
  `LINE_STOCK_LOCATION` — the same key supply deposits into and `mes-execution`
  drains. The bay is preserved as human context in `reason`
  (`Production Consumption · WO <wo> · BAY-<bayId>`), not as the position key.
- **Surfaces failures instead of swallowing them.** The `.catch(() => console.warn)`
  is replaced with a `try/catch` that logs through the Nest `Logger`
  (`this.logger.warn(...)`) with part, qty, warehouse, WO and request id — fail-soft
  (production is never blocked) but **visible**, matching #902's stance.
- **Logs the no-line skip explicitly.** When `kit.plan.line` is null/empty there is
  no valid source tank; the formal decrement is skipped and the skip is logged
  (it is never sent to a phantom `LINE-undefined`).

Local material-state bookkeeping (`state.consumedQty` / `state.availableQty`) and
WIP progress are unchanged — only the formal inventory leg is corrected.

Net: the **last** consume path on the surtir → operador loop now drains the same
`LINE-<n>` tank that supply fills. Both runtime consume paths (MES execution and
production runtime) are consistent.

## 3. Tests

- `production-runtime-consume.spec.ts` (new): exercises `registerBayEvent` over a
  stub `EntityManager` and asserts the emitted `CONSUME` targets
  `LINE-<plan.line>` at `LINE_STOCK_LOCATION` (with `bayId` deliberately ≠ line),
  **not** `BAY-<bayId>`; that a failing decrement is **logged, not thrown**
  (production still completes); and that a line-less plan **skips and logs**.
- Existing `supply-consume-loop.spec.ts` still proves the end-to-end balance
  (surtir N → consume M → N−M) through the real `recordTransaction`.

Gates: full API suite **1211 passing** (175 suites). Build ✅. Typecheck clean on
changed files (the 5 pre-existing errors live in unrelated `erp-pp` /
`event-ledger` spec files). New spec is prettier-clean; the service file keeps its
existing single-line-import style (the repo's pre-existing, non-blocking lint debt
on that file is left untouched to avoid a whole-file reformat).

## 4. Scope / safety

- **No migration** — `recordTransaction` auto-creates the destination position;
  this only changes which existing key the consume reads. No `synchronize`/auth/
  guards/**tenancy** changes; no DROP/rename/NOT NULL.
- **No silent error swallowing** — the swallowing `.catch` is removed; failures are
  logged via `Logger`, no-line is a visible skip.
- **No behavior change to finished-goods movement.** The separate `TRANSFER` at
  `registerFgDeclaration` (`LINE-<line>` / `FINISHED_STAGING` → `WH-FG` / `STAGING`)
  is untouched — it is not a line-tank consume.

## 5. Open questions for the Lead Engineer

1. **Conservation (carried from #910/#915).** Both runtime consumes now *debit*
   `LINE-<n>`, and supply *credits* it (destination-only ISSUE). There is still no
   source-warehouse debit on supply, so the tank is not conserved against a real
   stockroom. Decide whether supply should `TRANSFER` from a pinned source.
2. **Double-fill risk (carried from #915).** Routine staging and a later shortage
   `fulfill` both credit the tank; confirm no flow over-credits the same line/part.
3. **`recordTransaction` tenancy (pre-existing).** Position lookup/creation inside
   `recordTransaction` is not tenant-scoped.
4. **Backflush consume is intentionally separate.** `routing-backflush.commit`
   consumes from a **user-supplied** `warehouseId`/`location` (an explicit, sourced
   backflush), not the line tank — left as-is by design. Flag if it should also be
   tank-aware.

## 6. Why a draft

Moves the formal inventory ledger on the production-runtime consume path. The
alignment is proven by test and is additive (no schema change), but the
conservation and double-fill questions (§5) are the inventory owner's call. Hence
**draft + needs-human-review, not merged.**
