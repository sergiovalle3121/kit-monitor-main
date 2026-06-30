# Fix proposal — close the inventory loop (supply fills `LINE-<n>`, consume drains it)

> **Status: DRAFT · NEEDS HUMAN REVIEW · DO NOT MERGE.**
> Prepared for the Owner and Lead Engineer to review together. Branch
> `fix/supply-moves-inventory`, separate from the i18n/readability work; must not
> ride the auto-merge cascade.

This continues PR #902 (which made the consume-side failure *visible*). #902
proved the formal decrement was silently failing because the `LINE-<n>` tank was
empty. This change **fills the tank**: surtir now moves inventory in, so consume
has real stock to take out, and existencias cuadran de punta a punta.

## 1. The loop — BEFORE (broken at the middle)

```
material request ──fulfill──>  (status flip + socket only)         ❌ no inventory move
                                  material-requests.service.ts:171  (decide())
kit / pick-list   ──stage──>   KitMaterial reconcile                ✅ kit only
consume /operador ──CONSUME──> recordTransaction(from LINE-<n>)     ✅ but tank is empty
                                  mes-execution.service.ts (confirmAdvance)
resupplies        ──delivered─> recordTransaction(to LINE..., ISSUE) ✅ knows how — but no
                                  resupplies.service.ts:215-228           screen / not wired to surtido
```

Concretely:
- **`fulfill` never touched inventory.** `MaterialRequestsService.fulfill` → `decide()`
  only set `status = 'fulfilled'`, broadcast a socket event and wrote the ledger.
  No `recordTransaction`. (`material-requests.service.ts`, `decide()` ~L186-214.)
- **Consume drains a tank nobody fills.** `mes-execution` (and `production-runtime`)
  `CONSUME` from the virtual line warehouse `LINE-<line>`. Nothing deposited there →
  `recordTransaction` finds no `InventoryPosition` → throws `Insufficient stock`
  (now logged visibly thanks to #902, but the decrement still can't happen).
- **`resupplies` already knows the move** (`updateStatus` on `delivered` does an
  `ISSUE` to the `LINE` destination, `resupplies.service.ts:215-228`) — but it has
  no screen and the surtido flow never calls it. The piece that would close the
  loop exists, disconnected.

### The subtle gap: the position **key** didn't line up
A position is keyed by `(part, warehouse, location, programId)`
(`@Unique` on `InventoryPosition`). The consumers read `LINE-<line>` at a
**per-station / per-bay** location (`fromLocation: step.name` in mes-execution,
`BAY-<id>` in production-runtime). A line-level supply can't know the station, so
even a deposit wouldn't be found. Because `LINE-<n>` had **no** positions at all,
that per-station location never actually worked — so unifying it to a line-level
location is strictly an improvement, not a behavior change.

## 2. AFTER — what this change connects

A shared convention + the supply deposit + a key alignment:

1. **Shared tank convention** — `apps/api/src/modules/inventory/line-stock.ts`
   (new): `lineStockWarehouse(line)` → `LINE-<line>` (same convention as
   production-runtime / mes-execution — not a new one), and `LINE_STOCK_LOCATION`
   = `'LINE'` (a **line-level** location, not per-station).
2. **Surtir deposits into the tank** — `MaterialRequestsService.fulfill` now, on
   fulfilling a request, calls `recordTransaction({ type: 'ISSUE', toWarehouseId:
   'LINE-<line>', toLocation: 'LINE', ... })`, reusing the exact pattern
   `resupplies` uses for line destinations. `recordTransaction` **creates the
   destination position on demand**, so no warehouse seed/migration is needed.
   - The line is resolved from the **plan** (`kit.plan.line`) — the same value the
     execution inherits and consumes from — not the free-text `request.line`.
   - **No line → no move.** A request with no plan/line does **not** deposit to a
     phantom `LINE-0`; it logs a visible `warn` and skips (the fulfill still
     completes).
   - **Errors propagate.** A failed deposit throws *before* the status flips — we
     don't mark "fulfilled" what we couldn't supply (same stance as `resupplies`).
     No `.catch(() => undefined)`.
3. **Consume reads the same key** — `mes-execution` `CONSUME` now uses
   `fromLocation: LINE_STOCK_LOCATION` (was `step.name`; `step.name` is preserved
   in the movement `reason`). Supply and consume now hit the **same**
   `InventoryPosition`.

## 3. The loop CLOSES — proven by test

`apps/api/src/modules/inventory/supply-consume-loop.spec.ts` drives the **real**
`MaterialRequestsService.fulfill` (supply) and the **real**
`InventoryService.recordTransaction` CONSUME (the call `mes-execution` makes), over
a stateful in-memory position store:

```
surtir 50 → LINE-2/LINE onHand = 50 → consumir 30 → onHand = 20   (= N − M)  ✅
consume from an unfilled tank → throws "Insufficient stock"        (surfaced) ✅
```

Plus `material-requests.service.spec.ts`: fulfill ISSUEs to `LINE-<plan.line>` /
`LINE`; no-line warns + skips; inventory failure propagates and does **not** mark
fulfilled.

## 4. Scope / safety

- **No** DROP/rename/NOT NULL migration; **no** migration at all (destination
  position is auto-created by `recordTransaction`). `orm.options`/synchronize,
  auth, guards and the tenancy layer are untouched.
- **No silent error swallowing** — deposit failures propagate; the no-line case is
  a visible `warn`.
- Reuses `resupplies`' inventory-movement convention (`ISSUE` → `LINE`), does not
  reimplement it.
- Files: `inventory/line-stock.ts` (new), `material-requests.service.ts` (+module
  wiring to `InventoryModule`), `mes-execution.service.ts` (consume location), and
  two specs. Gates green: API build ✅ · jest (1195) ✅ · typecheck (my files) ✅.

## 5. Open questions for the Lead Engineer

1. **Conservation across warehouses.** Like `resupplies`' `delivered` step, the
   supply deposit is a destination-only `ISSUE` (it *adds* to `LINE-<n>` without
   decrementing a central/staging warehouse). That's enough for the line tank to
   balance (surtir +N, consumir −M), but it does not conserve global inventory. If
   you want true conservation, the deposit should be a `TRANSFER` from the part's
   staging/central warehouse — which requires knowing that source (not currently on
   the request/kit). Recommend deciding whether to (a) keep deposit-only parity
   with `resupplies`, or (b) add a source-warehouse reference.
2. **`production-runtime` consume** still reads `LINE-<line>` at `BAY-<bayId>`
   (`production-runtime.service.ts:197`). The `/operador` (mes-execution) path is
   aligned here; production-runtime should get the same `LINE_STOCK_LOCATION`
   alignment if it's meant to drain the same tank. Left out to keep this change
   focused; flagging for a follow-up.
3. **`recordTransaction` tenancy (pre-existing).** As noted in #902, the position
   lookup/creation inside `recordTransaction` is not tenant-scoped (positions are
   created tenant-null). This change reads its context via the already
   tenant-scoped material-requests repos, but the inventory-core scoping is a
   separate, deliberate change — not made here.
4. **Which surtido entry points should deposit?** This wires `fulfill` (the
   diagnosed gap). The plan pick-list staging (`material-staging-mes.service.ts`
   `stageLine` / `stageAllForPlan`) is another "surtir-a-línea" path that could use
   the same `depositToLine` helper — decide whether staging-confirm should also
   fill the tank, or only request fulfillment.

## 6. Why a draft

It moves the formal inventory ledger. The loop is proven to close by test and the
change is minimal and additive, but the conservation model (Q1) and the
production-runtime / tenancy questions (Q2-Q3) are calls the inventory owner should
make. Hence **draft + needs-human-review, not merged.**
