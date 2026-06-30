# Fix proposal — close the loop for the PRIMARY staging path (stageLine / stageAllForPlan)

> **Status: DRAFT · NEEDS HUMAN REVIEW · DO NOT MERGE.**
> Continues #910. Branch `fix/staging-fills-line`, separate from other work;
> must not ride the auto-merge cascade.

## 1. Why — the loop only half-closed

#910 closed the material loop for the **shortage** path: `material-requests.fulfill`
now deposits into the line tank `LINE-<n>`. But the **primary** way material reaches
a line is the plan pick-list staging — `MaterialStagingMesService.stageLine` /
`stageAllForPlan` (carril 1). Those methods marked staging (`sf_mes_staging`) and
emitted an event, but **never deposited inventory**:

```
stageLine / stageAllForPlan  →  upsert MesStagingLine + record event   ❌ no inventory move
operator /operador           →  CONSUME from LINE-<plan.line>          ✅ but tank still empty
```

So for the normal plan→operator flow, the tank stayed empty and the formal
decrement still failed (now visibly, thanks to #902). #910's deposit only fired
when someone raised+fulfilled a shortage request — not on the routine stage.

## 2. What this change does

- **Extract the shared deposit** into `InventoryService.issueToLine(...)` — the
  single point that maps a line to `LINE-<line>` / `LINE_STOCK_LOCATION` and does
  the `recordTransaction` ISSUE (creates the destination position on demand; no
  migration). It returns `{ deposited, warehouseId }`, **skips** (visible `warn`,
  no phantom warehouse) when there's no line or non-positive qty, and **propagates**
  any inventory error. `material-requests.fulfill` is refactored to delegate to it
  (no behavior change — same tests, now DRY).
- **`stageLine`** and **`stageAllForPlan`** now call `issueToLine` after marking a
  line staged, depositing the staged qty into the plan's line tank. Line resolved
  from the **plan** (`plan.line`) — the same value the execution consumes from.
- Tenant context: actor from `tenantCtx.getUserEmail()`, consistent with the rest
  of the staging service.

Net: the routine `surtir` now fills `LINE-<n>`, so the operator's later CONSUME has
real stock — the loop closes for the **primary** flow, not just shortage requests.

## 3. Tests

- `material-staging-mes.service.spec.ts`: `stageLine` deposits the staged qty into
  `LINE-<plan.line>` (`issueToLine`, ref `MES_STAGING`); `stageAllForPlan` deposits
  for **every** line. Existing staging/blocking tests still pass.
- `supply-consume-loop.spec.ts`: new `issueToLine` unit tests (deposits into
  `LINE-<line>`; skips with no line; skips with non-positive qty), alongside the
  existing end-to-end loop proof (surtir N → consume M → N−M).
- `material-requests.service.spec.ts`: updated to assert delegation to `issueToLine`.

Full API suite: **1208 passing**. Build ✅ · typecheck clean on changed files.

## 4. Scope / safety

- **No migration** (destination position auto-created). No `synchronize`/auth/
  guards/**tenancy** changes; no DROP/rename/NOT NULL.
- **No silent error swallowing** — deposit failures propagate; no-line is a visible
  `warn`.
- Module wiring: `MaterialStagingMesModule` now imports `InventoryModule`. Verified
  no circular dependency (`InventoryModule` imports the *plain* `MaterialStagingModule`,
  not the MES one; the two staging modules don't cross-import).

## 5. Open questions for the Lead Engineer

1. **Conservation (carried over from #910).** The staging deposit is a
   destination-only ISSUE — it fills `LINE-<n>` without decrementing the source
   warehouse the stock check read from (`assertStockAvailable*` aggregates
   availability across all warehouses, so there's no single pinned source to debit).
   Decide whether staging should instead `TRANSFER` from a specific source. Note the
   stock *check* and the *deposit* are currently independent.
2. **Double-fill risk.** Routine staging now fills the tank; a later shortage
   `fulfill` also fills it. That's intended (both are physical moves to the line),
   but confirm there's no flow that stages AND fulfills the same qty for the same
   line/part such that the tank is over-credited.
3. **`production-runtime` consume** still reads `LINE-<line>` at `BAY-<bayId>`
   (separate path) — align to the shared line-level location if it should drain the
   same tank.
4. **`recordTransaction` tenancy** (pre-existing): position lookup/creation is not
   tenant-scoped.

## 6. Why a draft

Moves the formal inventory ledger on the primary staging path. The loop close is
proven by test and the change is additive, but the conservation and double-fill
questions (§5) are calls the inventory owner should make. Hence **draft +
needs-human-review, not merged.**
