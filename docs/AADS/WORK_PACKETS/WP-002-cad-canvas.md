# WP-002 — CAD Canvas & Command Engine

- **Packet:** WP-002
- **Program:** CAD
- **Queue items:** CQ-006, CQ-007, CQ-008, CQ-009, CQ-010
- **Owns (writable):** `apps/web/src/lib/cad/**`, `apps/web/src/components/line-engineering/**`, `apps/web/src/app/dashboard/line-engineering/**`, `apps/api/src/modules/line-engineering/**`
- **Reads (read-only):** `apps/api/src/modules/bay-layout/**`, `docs/cad-*.md`
- **Depends on:** none
- **Concurrency:** safe alongside WP-001, WP-003, WP-004, WP-005 (disjoint Owns)
- **Status:** PENDING
- **Owner agent:** —

> Stay inside `Owns:`. Persist layouts via the existing `bay-layout` API surface
> (read its contract; if it must change, that's a separate platform packet).
> Inspect the existing `cad-command`/`cad-intent`/`cad-vision` pipeline before
> building. Small, functional, green. Never merge red.

## Scope

Grow the existing CAD pipeline: grid/snapping, layers, undo/redo, and one copilot
intent — all extending `lib/cad` and the `line-engineering` cad-* modules. No new
canvas.

## Items

### CQ-006 — Grid + snap-to-grid toggle
- **Objective:** Grid overlay + snap toggle on the 2D canvas.
- **Probable files:** `apps/web/src/lib/cad/*`, `apps/web/src/components/line-engineering/*`
- **Acceptance criteria:** Grid renders; toggle snaps new points; off-state unchanged.

### CQ-007 — Snap-to-endpoint/midpoint
- **Objective:** Snap cursor to endpoints/midpoints within tolerance.
- **Probable files:** `apps/web/src/lib/cad/*`, `components/line-engineering/cad-command.ts`
- **Acceptance criteria:** Snaps within tolerance; unit-aware; spec covered.

### CQ-008 — Layer panel
- **Objective:** Create/rename/toggle-visibility for layers.
- **Probable files:** `components/line-engineering/*`, `apps/web/src/lib/cad/*`
- **Acceptance criteria:** Hidden layers don't render; state persists in layout model.

### CQ-009 — Undo/redo stack
- **Objective:** Reversible commands via undo/redo history.
- **Probable files:** `components/line-engineering/cad-command.ts`, `apps/web/src/lib/cad/*`
- **Acceptance criteria:** Undo reverts last command; redo reapplies; tested.

### CQ-010 — Copilot intent "draw conveyor length N"
- **Objective:** CIDE intent drawing a parametric conveyor via the pipeline.
- **Probable files:** `components/line-engineering/cad-intent.ts`, `apps/api/src/modules/line-engineering/cad-intent.service.ts`
- **Acceptance criteria:** Parses length; emits entities through command engine; spec covers parsing.

## Checks
- `git diff --check`; `npm run build` (web + api); cad `.spec` tests.
- CI `Build · Test · Lint · Smoke` green before merge.

## Definition of done
- [ ] Items merged via small PR(s); only `Owns:` files modified.
- [ ] Existing cad-* pipeline extended; no parallel canvas.
- [ ] Status → DONE; logged in `../STATUS/DONE.md`.
