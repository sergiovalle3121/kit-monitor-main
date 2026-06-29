# AXOS CAD Tree Status

Last updated: 2026-06-29

## Current tree state

AXOS CAD is beyond seed state. The active workbench already includes a unified 2D/3D editor, local command dock, command palette, layers, lock enforcement, measurements, symbols, DXF import/export, validation, safety checks, flow scoring, local snapshots, and a release-readiness surface.

## This run

This run hardens the existing CAD layer workflow:

- `layers.ts` now exposes reusable layer summaries and presentation helpers.
- The CAD Layers panel now has quick actions for show all, hide empty, and unlock all.
- Layer rows show object count, assigned count, rough occupied area, visible/hidden state, and lock state.
- The bottom status bar shows the active layer object count plus hidden/locked layer counts.
- `Layout3DEditor.tsx` now applies CAD layer visibility to assigned station and asset geometry in the viewport, so visibility dots and `Solo` produce an immediate visual result.

The workflow reuses the existing layer model, active-layer state, assignment controls, and lock enforcement. It does not introduce a second layer manager or a new persistence path.

## Phase evidence

| Backlog phase | Status | Evidence | Next step |
| --- | --- | --- | --- |
| Phase 0 - Audit plus visible fix | Complete for this run | `AXOS_CAD_CAPABILITY_AUDIT.md` plus a reachable command workflow | Keep audit current as PRs land. |
| Phase 8 - Layers Pro | Advanced | `layers.ts`, `layers.spec.ts`, `Layout3DEditor.tsx` CAD Layers panel | Persist assignments/visibility once the backend contract is approved. |
| Phase 17 - Flow Health | Advanced | `flow-optimization.ts`, Flow Health UI, and command registry flow workflows | Add richer flow recommendations and before/after preview cards. |
| Phase 21 - Shortcuts and command line | Advanced | Command dock, parser, registry, palette, shortcuts | Add more industrial command examples and history reconciliation. |
| Phase 27 - QA harness | In progress | Pure specs under `apps/web/src/lib/cad` | Add specs for each new command/helper. |

## Next CAD PR

Recommended next phase: persist CAD layer assignments/visibility after the layout API contract is reviewed, or add validation issue actions after PR #796 lands.
