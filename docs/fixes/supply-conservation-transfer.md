# Fix proposal — conserving supply: debit a real source warehouse into LINE-<n>

> **Status: DRAFT · NEEDS HUMAN REVIEW · DO NOT MERGE.**
> Closes open question #1 ("conservation") carried across #910 / #915 / #917.
> Branch `fix/supply-conservation-transfer`, separate from other work; must not
> ride the auto-merge cascade.

## 1. Why — supply created stock from nowhere

The loop now closes (#910/#915 fill `LINE-<n>`, #917 drains it on every consume
path). But the deposit was a **destination-only `ISSUE`** (`issueToLine`): it
*credited* the line tank without *debiting* any source, so each surtido **inflated
global on-hand** — material appeared at the line out of thin air. The availability
check (`availableByPart`) also counted the `LINE-<n>` tanks themselves, so already
staged stock was double-counted as "available" for the next stage.

```
issueToLine  →  ISSUE  → LINE-<n> += N        (global on-hand += N, not conserved)
availableByPart counts LINE-<n> tanks too     (already-staged stock recounted)
```

## 2. What this change does — greedy TRANSFER from real warehouses

- **`InventoryService.transferToLine(...)`** (new): the conserving deposit. It
  picks **real** source stock for the part — `available` positions, *plain* (no
  `programId` / `lotNumber` / `serialNumber`), **excluding the `LINE-*` tanks** —
  in **FIFO** order (`createdAt`, then `id`), and `TRANSFER`s greedily across them
  into `LINE-<n>` / `LINE_STOCK_LOCATION` until the qty is covered. On-hand is
  conserved (source down, line up). If real stock can't cover it, it **throws**
  (no phantom inventory). No line / non-positive qty → logs and skips, exactly like
  `issueToLine`. Source positions are read through the **tenant-scoped** repo.
  Returns `{ deposited, warehouseId, sources[] }`.
- **`material-requests.fulfill`** and **`material-staging` (`stageLine` /
  `stageAllForPlan`)** now deposit via `transferToLine` instead of `issueToLine`
  (one-line swap in each wrapper). Behavior for callers is unchanged except that an
  impossible supply now fails loudly instead of inventing stock.
- **`availableByPart`** (staging) now **excludes `LINE-*` tanks**, so the
  pre-deposit stock check and the conserving transfer agree on "real source stock"
  (no more recounting already-staged tank stock).
- **`line-stock.ts`**: adds `isLineStockWarehouse(id)` (+ `LINE_STOCK_WAREHOUSE_PREFIX`)
  — the single predicate both the transfer and the check use to exclude tanks.
- `issueToLine` is **kept** as the non-conserving primitive (still unit-tested); it
  simply no longer has production callers. It can be removed later if the team
  prefers.

Atomicity: each per-source `TRANSFER` is one atomic `recordTransaction`
(debit+credit together). The common single-source case is fully atomic; a
multi-source split is a sequence of atomic transfers (see §5).

## 3. Tests

- `supply-consume-loop.spec.ts` (rewritten over a stateful store with a real
  `positionRepo`): fulfill now **TRANSFERs N from a seeded source** into `LINE-<n>`,
  the **source drains to 0**, and **global on-hand is conserved** through both the
  surtido and the later consume (N → N−M). New cases: fulfill with **no real source
  throws** and does not mark fulfilled; `transferToLine` **splits FIFO** across
  positions; **never sources from a `LINE-*` tank**; throws on insufficient real
  stock without creating the tank; skips with no line / non-positive qty.
- `material-requests.service.spec.ts` / `material-staging-mes.service.spec.ts`:
  updated to assert delegation to `transferToLine`.
- Full API suite: **1217 passing** (175 suites). Build ✅ · typecheck clean on
  changed files · new/edited code prettier-clean (the file's pre-existing import/
  format debt is left untouched to avoid a whole-file reformat).

## 4. Scope / safety

- **No migration** — only existing positions are debited/credited; the destination
  tank position is still auto-created by `recordTransaction`. No `synchronize` /
  auth / guards / **tenancy** changes; no DROP/rename/NOT NULL.
- **No silent error swallowing** — shortfalls propagate; no-line is a visible skip.
- Source reads are **tenant-scoped** (`positionRepo`). The write path inside
  `recordTransaction` remains the pre-existing, documented non-tenant-scoped gap.

## 5. Open questions for the inventory owner

1. **Source-selection policy.** Greedy FIFO across *plain* available positions is a
   sensible default, but the "right" source may be policy-driven (a designated RM/
   central warehouse, nearest to the line, cost layer, allocations). Confirm FIFO is
   acceptable or specify the rule.
2. **Program / lot / serial-tagged stock is not auto-sourced.** To keep source and
   the plain `LINE-<n>` tank on the same atomic position key, only untagged stock is
   pulled. A part whose only stock is program/lot/serial-tagged will **fail loud**
   (never silently create). Handling tagged stock needs `recordTransaction` to accept
   independent source vs destination keys — deliberately out of scope here.
3. **Multi-source atomicity.** A split across N source positions is N atomic
   transfers, not one umbrella transaction. With the up-front availability check a
   mid-split failure only happens under concurrent depletion; it would leave a
   partial (still-conserved) deposit and a thrown fulfill. A single batched
   transaction (or idempotency key) is a possible follow-up.
4. **Behavior change for demos/fixtures.** Flows that fulfilled/staged without any
   seeded source now throw. Seed real source stock (e.g. `WH-RM`) for those paths.
5. **`recordTransaction` tenancy** (pre-existing): position lookup/creation inside
   the transaction is not tenant-scoped.

## 6. Why a draft

This changes inventory *semantics* — supply now consumes real stock and can fail
when stock is absent. The conservation is proven by test and is additive (no schema
change), but the source-selection policy (§5.1) and the tagged-stock / atomicity
trade-offs (§5.2–5.3) are the inventory owner's call. Hence **draft +
needs-human-review, not merged.**
