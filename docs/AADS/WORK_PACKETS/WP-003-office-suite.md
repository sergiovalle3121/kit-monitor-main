# WP-003 — Office Suite Core

- **Packet:** WP-003
- **Program:** OFFICE
- **Queue items:** CQ-011, CQ-012, CQ-015
- **Owns (writable):** `apps/api/src/modules/office/**`, `apps/web/src/app/dashboard/office/**`, `apps/web/src/components/office/**`
- **Reads (read-only):** `apps/api/src/modules/{event-ledger,auth,users}/**`
- **Depends on:** WP-004 (CQ-015 audits to Event Ledger — read only)
- **Concurrency:** safe alongside WP-001, WP-002, WP-005 (disjoint Owns). NOT alongside WP-006 if both touch office at once — sequence WP-006 after.
- **Status:** PENDING
- **Owner agent:** —

> Stay inside `Owns:`. Audit via the Event Ledger by **reading** its write API —
> don't edit the ledger module here. Extend the existing `office` module/route;
> never create a parallel office page. Small, functional, green. Never merge red.

## Scope

Document Library + doc persistence + audit, all inside the existing `office`
module, `dashboard/office` route and `components/office`.

## Items

### CQ-011 — Document Library list view (tenant-scoped)
- **Objective:** List office docs by tenant with title/type/updated-at.
- **Probable files:** `apps/api/src/modules/office/*`, `apps/web/src/app/dashboard/office/*`
- **Acceptance criteria:** Only current tenant's docs; sortable; empty state handled.

### CQ-012 — Doc autosave + version snapshot on idle
- **Objective:** Autosave after idle and store a lightweight snapshot.
- **Probable files:** `apps/api/src/modules/office/*`, `apps/web/src/app/dashboard/office/[id]/*`
- **Acceptance criteria:** Edits persist after idle; snapshot row created; no save on no-change.

### CQ-015 — Audit doc open/edit/share to Event Ledger
- **Objective:** Emit ledger events for open/edit/share.
- **Probable files:** `apps/api/src/modules/office/*` (reads `event-ledger` write API)
- **Acceptance criteria:** Each action writes a ledger event with actor + doc context.

## Checks
- `git diff --check`; `npm run build` (web + api); office tests.
- CI `Build · Test · Lint · Smoke` green before merge.

## Definition of done
- [ ] Items merged via small PR(s); only `Owns:` files modified.
- [ ] No parallel office page; existing module extended.
- [ ] Status → DONE; logged in `../STATUS/DONE.md`.
