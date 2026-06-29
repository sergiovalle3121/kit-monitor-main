# AXOS CAD Tree Status

Last updated: 2026-06-29

## Current tree state

AXOS CAD is beyond seed state. The active workbench already includes a unified 2D/3D editor, local command dock, command palette, layers, lock enforcement, measurements, symbols, DXF import/export, validation, safety checks, flow scoring, local snapshots, and a release-readiness surface.

## This run

This run hardens the existing DXF export workflow:

- `dxf-export-readiness.ts` evaluates the export package before download.
- The existing DXF export modal now shows a ready/blocked state, entity counts, included layers, hidden-layer exclusions, validation warnings, and active DXF import warnings.
- Selection exports now block only when nothing is selected or no entities match the options.
- Hidden Flow/Measurements/Text visibility is reflected in the modal and in the actual downloaded DXF.

The workflow is visible through the existing `Layout3DEditor.tsx` DXF export action. It does not introduce a second exporter, a parallel editor, or a new DXF model; it reuses `exportCadLayoutDxf` and the current modal.

## Phase evidence

| Backlog phase | Status | Evidence | Next step |
| --- | --- | --- | --- |
| Phase 0 - Audit plus visible fix | Complete for this run | `AXOS_CAD_CAPABILITY_AUDIT.md` plus a visible export modal improvement | Keep audit current as PRs land. |
| Phase 7 - DXF Export Pro Workflow | Advanced | `dxf-export.ts`, `layout-export-adapter.ts`, `dxf-export-readiness.ts`, and the visible DXF export modal | Add optional validation report attachment/package metadata after export contract review. |
| Phase 17 - Flow Health | Advanced | `flow-optimization.ts`, Flow Health UI, and command-registry flow workflows | Add richer flow recommendations and before/after preview cards. |
| Phase 21 - Shortcuts and command line | Advanced | Command dock, parser, registry, palette, shortcuts | Add more industrial command examples and history reconciliation. |
| Phase 27 - QA harness | In progress | Pure specs under `apps/web/src/lib/cad` | Add specs for each new command/helper. |

## Next CAD PR

Recommended next phase: add a layer-selective DXF import review or a validation-report attachment option for DXF packages, depending on which open CAD PRs land first.
