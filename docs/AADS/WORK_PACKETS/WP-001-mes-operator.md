# WP-001 — MES Operator Core

- **Packet:** WP-001
- **Program:** MES / SHOP FLOOR
- **Queue items:** CQ-001, CQ-002, CQ-003, CQ-004, CQ-005
- **Owns (writable):** `apps/api/src/modules/operator-terminal/**`, `apps/api/src/modules/material-requests/**`, `apps/api/src/modules/defect-codes/**`, `apps/api/src/modules/alerts/**`, `apps/web/src/app/dashboard/operador/**`
- **Reads (read-only):** `apps/api/src/modules/{event-ledger,notifications,mes-execution,visual-aids}/**`, `apps/web/src/app/dashboard/live/**`
- **Depends on:** WP-004 (uses Event Ledger + notifications primitives — read only)
- **Concurrency:** safe alongside WP-002, WP-003, WP-005 (disjoint Owns)
- **Status:** PENDING
- **Owner agent:** —

> Stay inside `Owns:`. Audit/notify by **reading** the shared primitives, never
> editing them here. Inspect before create. Small, functional, green. Never merge
> red — `main` deploys to Railway.

## Scope

Operator-terminal interaction hardening: confirm-on-action, downtime capture,
material request, andon, and the pinned work-instruction viewer. All within the
existing `operator-terminal` module and `dashboard/operador` route — no parallel
operator screen.

## Items

### CQ-001 — Confirm dialog on unit start/stop
- **Objective:** Large scanner-friendly confirm before start/stop mutates state.
- **Probable files:** `apps/web/src/app/dashboard/operador/*`, `apps/api/src/modules/operator-terminal/*`
- **Acceptance criteria:** Start/stop requires confirm; cancel = no-op; tenant-scoped.

### CQ-002 — Downtime reason-code capture on stop
- **Objective:** Prompt for a reason code on stop and persist it.
- **Probable files:** `apps/api/src/modules/{operator-terminal,defect-codes}/*`, `apps/web/src/app/dashboard/operador/*`
- **Acceptance criteria:** Stop records a reason; queryable; ledger entry written (read API).

### CQ-003 — Material request button from terminal
- **Objective:** One-tap material request for the active WO/line.
- **Probable files:** `apps/api/src/modules/material-requests/*`, `apps/web/src/app/dashboard/operador/*`
- **Acceptance criteria:** Creates a request with WO+line context; tenant-scoped.

### CQ-004 — Andon raise + acknowledge
- **Objective:** Raise/ack andon routed through notifications.
- **Probable files:** `apps/api/src/modules/alerts/*`, `apps/web/src/app/dashboard/operador/*`
- **Acceptance criteria:** Raise creates alert; ack updates status+actor; audited.

### CQ-005 — Work instruction viewer pinned to active WO
- **Objective:** Show the active WO's instruction inside the terminal.
- **Probable files:** `apps/web/src/app/dashboard/operador/*` (reads `visual-aids`)
- **Acceptance criteria:** Loads instruction for active WO; read-only; graceful empty state.

## Checks
- `git diff --check`; `npm run build` (web + api); operator-terminal tests.
- CI `Build · Test · Lint · Smoke` green before merge.

## Definition of done
- [ ] Items merged via small PR(s); only `Owns:` files modified.
- [ ] No duplicate operator screen; existing module extended.
- [ ] Status → DONE; logged in `../STATUS/DONE.md`.
