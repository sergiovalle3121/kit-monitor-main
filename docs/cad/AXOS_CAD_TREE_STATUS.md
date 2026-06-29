# AXOS CAD Tree Status

Last updated: 2026-06-29

## Current tree state

AXOS CAD is beyond seed state. The active workbench already includes a unified 2D/3D editor, local command dock, command palette, layers, lock enforcement, measurements, symbols, DXF import/export, validation, safety checks, flow scoring, local snapshots, and a release-readiness surface.

## This run

This run hardens the professional DXF export path:

- Layout footprint boxes now export their `text` labels as centered DXF `TEXT` entities.
- The existing `Layout3DEditor.tsx` export modal benefits without a new UI path because it already calls `exportCadLayoutDxf`.
- Exported layer tables now receive deterministic AutoCAD color codes for Layout, Equipment, Flow, Aisles, Measurements, Safety, and Text.
- Entity counts include generated footprint labels, so the existing export toast remains honest.

The workflow does not introduce a parallel exporter, a second export modal, or a new geometry model. It reuses `CadDxfPrimitive.text`, `cadLayoutToDxfExportModel`, and `exportCadDxf`.

## Phase evidence

| Backlog phase | Status | Evidence | Next step |
| --- | --- | --- | --- |
| Phase 0 - Audit plus visible fix | Complete for this run | `AXOS_CAD_CAPABILITY_AUDIT.md` plus a reachable export workflow | Keep audit current as PRs land. |
| Phase 7 - DXF Export Pro Workflow | Advanced | Export modal, `layout-export-adapter.ts`, `dxf-export.ts`, footprint labels, layer colors | Add export preflight warnings and selected-layer export. |
| Phase 17 - Flow Health | Advanced | `flow-optimization.ts`, Flow Health UI, and command workflows | Add richer flow recommendations and before/after preview cards. |
| Phase 21 - Shortcuts and command line | Advanced | Command dock, parser, registry, palette, shortcuts | Add more industrial command examples and history reconciliation. |
| Phase 27 - QA harness | In progress | Pure specs under `apps/web/src/lib/cad` | Add specs for each new command/helper. |

## Next CAD PR

Recommended next phase: add DXF export preflight warnings for empty selection, hidden layers, missing footprint labels, and unsupported converted DXF entities once the active editor PRs settle.
