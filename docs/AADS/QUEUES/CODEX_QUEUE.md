# CODEX QUEUE — what Codex builds next

This is the **active build queue** for Codex. The Architect (ChatGPT) fills it from
the program backlogs in [`../PROGRAMS/`](../PROGRAMS/). Codex takes the top
`PENDING` item, **inspects before building**, opens one small PR, and updates the
item's status. Claude then reviews and merges (see
[`CLAUDE_QUEUE.md`](CLAUDE_QUEUE.md)).

**Rules of the queue**
- Take items top-down. One PR per item. Keep it small, functional and green.
- **Inspect first** — never assume a module/screen is missing; extend, don't duplicate.
- If blocked, set `BLOCKED`, log it in [`../STATUS/BLOCKED.md`](../STATUS/BLOCKED.md), take the next item.
- When merged, move the item to [`../STATUS/DONE.md`](../STATUS/DONE.md).
- `main` deploys to Railway — never merge red.

**Item states:** `PENDING` → `IN PROGRESS` → `IN REVIEW` → `DONE` / `BLOCKED`.

> **Running Codex in parallel?** Don't have multiple agents edit this single file.
> Use the [`../WORK_PACKETS/`](../WORK_PACKETS/) layer (AADS v2): each parallel
> Codex run owns its own packet file and a disjoint set of writable paths, so the
> queue never has a merge race and PRs don't conflict. This linear queue stays the
> human-readable backlog; packets are the concurrency layer on top of it.

Initial queue: **20 items** — 5 MES Operator, 5 CAD, 5 Office, 5 Platform/Quality.

---

## MES — Operator

### CQ-001
- **Programa:** MES / SHOP FLOOR
- **Título:** Operator terminal — confirm dialog on unit start/stop
- **Objetivo:** Add a large scanner-friendly confirm step before starting or stopping a unit so accidental taps don't mutate production state.
- **Archivos probables:** `apps/web/src/app/dashboard/operador/*`, `apps/api/src/modules/operator-terminal/*`
- **Criterios de aceptación:** Start/stop requires explicit confirm; cancel leaves state unchanged; action is tenant-scoped.
- **Checks:** `git diff --check`; `npm run build` (web + api); operator-terminal tests pass.
- **Estado:** PENDING

### CQ-002
- **Programa:** MES / SHOP FLOOR
- **Título:** Downtime reason-code capture on stop
- **Objetivo:** When an operator stops a unit, prompt for a downtime reason code from `defect-codes`/downtime catalog and persist it.
- **Archivos probables:** `apps/api/src/modules/{operator-terminal,defect-codes}/*`, `apps/web/src/app/dashboard/operador/*`
- **Criterios de aceptación:** Stop records a reason code; reason is queryable; written to Event Ledger.
- **Checks:** `git diff --check`; `npm run build`; new unit test for reason persistence.
- **Estado:** PENDING

### CQ-003
- **Programa:** MES / SHOP FLOOR
- **Título:** Material request button from terminal
- **Objetivo:** Add a one-tap "request material" action on the operator terminal that creates a `material-requests` record for the active WO/line.
- **Archivos probables:** `apps/api/src/modules/material-requests/*`, `apps/web/src/app/dashboard/operador/*`
- **Criterios de aceptación:** Button creates a request with WO + line context; appears in material-requests list; tenant-scoped.
- **Checks:** `git diff --check`; `npm run build`; material-requests test.
- **Estado:** PENDING

### CQ-004
- **Programa:** MES / SHOP FLOOR
- **Título:** Andon raise + acknowledge flow
- **Objetivo:** Let an operator raise an andon alert and a supervisor acknowledge it, routed through the existing notifications channel.
- **Archivos probables:** `apps/api/src/modules/{alerts,notifications}/*`, `apps/web/src/app/dashboard/{operador,live}/*`
- **Criterios de aceptación:** Raise creates an alert; ack updates status + timestamp + actor; both audited.
- **Checks:** `git diff --check`; `npm run build`; alerts test.
- **Estado:** PENDING

### CQ-005
- **Programa:** MES / SHOP FLOOR
- **Título:** Work instruction viewer pinned to active WO
- **Objetivo:** Show the current WO's work instruction / visual aid inside the operator terminal without leaving the screen.
- **Archivos probables:** `apps/api/src/modules/{mes-execution,visual-aids}/*`, `apps/web/src/app/dashboard/operador/*`
- **Criterios de aceptación:** Viewer loads the instruction for the active WO; read-only; falls back gracefully when none exists.
- **Checks:** `git diff --check`; `npm run build`; component test.
- **Estado:** PENDING

---

## CAD

### CQ-006
- **Programa:** CAD
- **Título:** Grid + snap-to-grid toggle on 2D canvas
- **Objetivo:** Add a grid overlay and a snap-to-grid toggle to the 2D layout canvas.
- **Archivos probables:** `apps/web/src/lib/cad/*`, `apps/web/src/components/line-engineering/*`
- **Criterios de aceptación:** Grid renders; toggle snaps new points to grid; off-state unchanged.
- **Checks:** `git diff --check`; `npm run build`; cad `.spec` tests.
- **Estado:** PENDING

### CQ-007
- **Programa:** CAD
- **Título:** Snap-to-endpoint/midpoint for line tools
- **Objetivo:** While drawing, snap the cursor to existing entity endpoints and midpoints within a tolerance.
- **Archivos probables:** `apps/web/src/lib/cad/*`, `apps/web/src/components/line-engineering/cad-command.ts`
- **Criterios de aceptación:** Cursor snaps within tolerance; snap respects units; covered by a unit test.
- **Checks:** `git diff --check`; `npm run build`; cad-command spec.
- **Estado:** PENDING

### CQ-008
- **Programa:** CAD
- **Título:** Layer panel (create/rename/toggle visibility)
- **Objetivo:** Add a layers panel to manage CAD layers and toggle their visibility on the canvas.
- **Archivos probables:** `apps/web/src/components/line-engineering/*`, `apps/web/src/lib/cad/*`
- **Criterios de aceptación:** Create/rename/hide a layer; hidden layers don't render; state persists in the layout model.
- **Checks:** `git diff --check`; `npm run build`; component test.
- **Estado:** PENDING

### CQ-009
- **Programa:** CAD
- **Título:** Undo/redo stack for the command engine
- **Objetivo:** Make CAD commands reversible with an undo/redo history so the copilot's actions can be trusted.
- **Archivos probables:** `apps/web/src/components/line-engineering/cad-command.ts`, `apps/web/src/lib/cad/*`
- **Criterios de aceptación:** Undo reverts the last command; redo reapplies; stack covered by tests.
- **Checks:** `git diff --check`; `npm run build`; cad-command spec.
- **Estado:** PENDING

### CQ-010
- **Programa:** CAD
- **Título:** CAD Copilot intent — "draw a conveyor of length N"
- **Objetivo:** Add a CIDE/OpenAI-compatible intent that draws a parametric conveyor via the existing intent pipeline.
- **Archivos probables:** `apps/web/src/components/line-engineering/cad-intent.ts`, `apps/api/src/modules/line-engineering/cad-intent.service.ts`
- **Criterios de aceptación:** Intent parses length param; emits canvas entities through the command engine; spec covers parsing.
- **Checks:** `git diff --check`; `npm run build`; cad-intent spec.
- **Estado:** PENDING

---

## Office

### CQ-011
- **Programa:** OFFICE
- **Título:** Document Library list view (tenant-scoped)
- **Objetivo:** Add a list view of office documents filtered by tenant with title, type and updated-at.
- **Archivos probables:** `apps/api/src/modules/office/*`, `apps/web/src/app/dashboard/office/*`
- **Criterios de aceptación:** Lists only current tenant's docs; sortable by updated-at; empty state handled.
- **Checks:** `git diff --check`; `npm run build`; office test.
- **Estado:** PENDING

### CQ-012
- **Programa:** OFFICE
- **Título:** Doc autosave + version snapshot on idle
- **Objetivo:** Autosave the active doc after an idle interval and store a lightweight version snapshot.
- **Archivos probables:** `apps/api/src/modules/office/*`, `apps/web/src/app/dashboard/office/[id]/*`
- **Criterios de aceptación:** Edits persist after idle; a snapshot row is created; no save on no-change.
- **Checks:** `git diff --check`; `npm run build`; office test.
- **Estado:** PENDING

### CQ-013
- **Programa:** OFFICE
- **Título:** Office search wired into global SearchPalette
- **Objetivo:** Register office documents as a source in the global `SearchPalette` so docs are findable everywhere.
- **Archivos probables:** `apps/web/src/components/{SearchPalette.tsx,searchSources.ts}`, `apps/api/src/modules/office/*`
- **Criterios de aceptación:** Typing a doc title surfaces it; selecting opens the doc; tenant-scoped.
- **Checks:** `git diff --check`; `npm run build`; search source test.
- **Estado:** PENDING

### CQ-014
- **Programa:** OFFICE
- **Título:** Document share dialog reusing platform RBAC
- **Objetivo:** Add a share dialog that grants access using existing platform roles — no parallel permission model.
- **Archivos probables:** `apps/api/src/modules/{office,users,auth}/*`, `apps/web/src/components/office/*`
- **Criterios de aceptación:** Share grants/revokes by role; access enforced on read; reuses RBAC, not a new ACL.
- **Checks:** `git diff --check`; `npm run build`; office permissions test.
- **Estado:** PENDING

### CQ-015
- **Programa:** OFFICE
- **Título:** Audit doc open/edit/share to Event Ledger
- **Objetivo:** Emit Event Ledger entries for document open, edit and share actions.
- **Archivos probables:** `apps/api/src/modules/{office,event-ledger}/*`
- **Criterios de aceptación:** Each action writes a ledger event with actor + doc context; visible in activity.
- **Checks:** `git diff --check`; `npm run build`; ledger integration test.
- **Estado:** PENDING

---

## Platform / Quality

### CQ-016
- **Programa:** PLATFORM
- **Título:** Tenant-scope assertion helper for repositories
- **Objetivo:** Add a shared helper that asserts `tenant_id` is present on queries to prevent cross-tenant leaks.
- **Archivos probables:** `apps/api/src/modules/**/`, `packages/contracts/src/*`
- **Criterios de aceptación:** Helper throws on missing tenant scope; adopted by at least one module; unit-tested.
- **Checks:** `git diff --check`; `npm run build`; helper unit test.
- **Estado:** PENDING

### CQ-017
- **Programa:** PLATFORM
- **Título:** Centralized RBAC guard
- **Objetivo:** Provide a single guard/decorator for role checks and apply it to one module as the reference implementation.
- **Archivos probables:** `apps/api/src/modules/{auth,users}/*`
- **Criterios de aceptación:** Guard enforces required role; denied requests return 403; covered by tests.
- **Checks:** `git diff --check`; `npm run build`; auth guard test.
- **Estado:** PENDING

### CQ-018
- **Programa:** PLATFORM
- **Título:** Event Ledger query API with filters
- **Objetivo:** Add a read endpoint to query ledger events by actor, domain, reference and date range.
- **Archivos probables:** `apps/api/src/modules/event-ledger/*`
- **Criterios de aceptación:** Filters work and compose; tenant-scoped; paginated.
- **Checks:** `git diff --check`; `npm run build`; event-ledger test.
- **Estado:** PENDING

### CQ-019
- **Programa:** PLATFORM
- **Título:** Shared API response envelope
- **Objetivo:** Introduce a consistent success/error response envelope in `packages/contracts` and adopt it in one controller.
- **Archivos probables:** `packages/contracts/src/*`, `apps/api/src/modules/**/`
- **Criterios de aceptación:** Envelope typed and exported; one endpoint returns it; no breaking change to consumers.
- **Checks:** `git diff --check`; `npm run build` (contracts + api).
- **Estado:** PENDING

### CQ-020
- **Programa:** PLATFORM (CI/Quality)
- **Título:** Cache build in CI to speed the gate
- **Objetivo:** Add dependency/build caching to the `Build · Test · Lint · Smoke` workflow without changing the Railway deploy path.
- **Archivos probables:** `.github/workflows/*`
- **Criterios de aceptación:** Cache hit on unchanged deps; CI still green; deploy path untouched.
- **Checks:** `git diff --check`; CI run is green end-to-end.
- **Estado:** PENDING
