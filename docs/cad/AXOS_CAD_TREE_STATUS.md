# AXOS CAD Tree Status

Last updated: 2026-06-29

## Current tree state

AXOS CAD is beyond seed state. The active workbench already includes a unified 2D/3D editor, local command dock, command palette, layers, lock enforcement, measurements, symbols, DXF import/export, validation, safety checks, flow scoring, local snapshots, and a release-readiness surface.

## This run

This run upgrades the existing object properties inspector:

- A pure `object-properties` helper derives object bounds, area, center, source metadata, safety classification, warnings, and multi-selection summaries.
- The right inspector now shows local object notes, DXF/source metadata, safety classification, object center, and lock/visibility warnings.
- Multi-selection now shows group bounds, area, station/equipment split, layer spread, and locked/hidden object counts.
- The helper is covered by a pure smoke spec.

The workflow is visible through the existing `Layout3DEditor` properties panel. It does not introduce a parallel inspector, object model, layer model, or DXF metadata path.

## Phase evidence

| Backlog phase | Status | Evidence | Next step |
| --- | --- | --- | --- |
| Phase 0 - Audit plus visible fix | Complete for this run | `AXOS_CAD_CAPABILITY_AUDIT.md` plus reachable inspector improvements | Keep audit current as PRs land. |
| Phase 9 - Object Properties Pro | Advanced | `object-properties.ts`, properties panel metadata, notes, multi-selection summaries | Persist notes/tags/source metadata through the layout API contract. |
| Phase 6 - Editable DXF Import Workflow | Partial | DXF import tags now surface in the inspector as source metadata | Add layer-selective editable DXF import review. |
| Phase 27 - QA harness | In progress | `object-properties.spec.ts` covers metadata and selection summaries | Add specs for each new helper. |

## Next CAD PR

Recommended next phase: persist object notes/tags/source metadata through the layout API after the object metadata contract is reviewed, or move to editable connector actions if `Layout3DEditor.tsx` churn remains high.
