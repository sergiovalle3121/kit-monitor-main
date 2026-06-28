# WP-004 — Platform Foundation (shared primitives)

- **Packet:** WP-004
- **Program:** PLATFORM
- **Queue items:** CQ-016, CQ-017, CQ-018, CQ-019
- **Owns (writable):** `apps/api/src/modules/auth/**`, `apps/api/src/modules/users/**`, `apps/api/src/modules/event-ledger/**`, `packages/contracts/**`
- **Reads (read-only):** consuming modules (for adoption examples only — do not modify them here)
- **Depends on:** none — **this packet lands first**
- **Concurrency:** run **before** the feature wave. Because feature packets *read*
  these primitives, modifying them concurrently with feature work risks conflicts —
  so WP-004 is **serialized ahead** of WP-001/003/006.
- **Status:** PENDING
- **Owner agent:** —

> This packet owns the shared primitives every other packet reads (RBAC, tenant
> scope, Event Ledger, contracts). It is the gating packet: merge it first, then
> the feature wave can read stable APIs. Keep changes additive/backward-compatible
> to avoid breaking in-flight packets. Never merge red — `main` deploys to Railway.

## Scope

Centralize the cross-cutting primitives so feature packets can *read* them without
re-implementing or editing them: a tenant-scope helper, a single RBAC guard, a
ledger query API, and a shared response envelope.

## Items

### CQ-016 — Tenant-scope assertion helper
- **Objective:** Shared helper asserting `tenant_id` on queries.
- **Probable files:** `apps/api/src/modules/**`, `packages/contracts/src/*`
- **Acceptance criteria:** Throws on missing scope; adopted by ≥1 module; unit-tested.

### CQ-017 — Centralized RBAC guard
- **Objective:** One guard/decorator for role checks + a reference adoption.
- **Probable files:** `apps/api/src/modules/{auth,users}/*`
- **Acceptance criteria:** Enforces role; denied → 403; tested.

### CQ-018 — Event Ledger query API with filters
- **Objective:** Read endpoint filtering by actor/domain/reference/date.
- **Probable files:** `apps/api/src/modules/event-ledger/*`
- **Acceptance criteria:** Filters compose; tenant-scoped; paginated.

### CQ-019 — Shared API response envelope
- **Objective:** Consistent success/error envelope in contracts + one adoption.
- **Probable files:** `packages/contracts/src/*`, `apps/api/src/modules/**`
- **Acceptance criteria:** Typed + exported; one endpoint returns it; no breaking change.

## Checks
- `git diff --check`; `npm run build` (contracts + api); helper/guard/ledger tests.
- CI `Build · Test · Lint · Smoke` green before merge.

## Definition of done
- [ ] Items merged via small PR(s); only `Owns:` files modified.
- [ ] Changes additive/backward-compatible; primitives single-sourced.
- [ ] Status → DONE; logged in `../STATUS/DONE.md`.
