# AXOS CAD Factory Scale Plan

Last updated: 2026-06-30

## Purpose

The CAD workbench must represent a real plant, not a small editing table. Phase 0 establishes plant footprint scale as a first-class CAD concept while reusing the existing `Layout3DEditor` footprint model, grid, snapping, layers, validation, and export paths.

## Implemented in this slice

- Plant footprint presets are available in the existing View/Layers popover:
  - Small cell: 10 m x 8 m
  - SMT line: 30 m x 12 m
  - Warehouse: 60 m x 40 m
  - Full factory: 120 m x 80 m
- Presets apply directly to the current layout state and update the existing custom width/height/grid controls; the existing Save action persists the new footprint.
- The preset grid is scale-aware: 0.5 m for cells, 1 m for SMT, 2.5 m for warehouses, 5 m for full factories.
- The same popover exposes `Auto grid`, `Plant`, `All`, and `Sel` view actions.
- The plant boundary is now a separate visible scene layer from the grid.
- `Plant Boundary` is a protected system layer: it stays locked and does not accept editable object assignments.
- A 0,0 origin marker is rendered at the plant origin.
- The bottom CAD status bar shows plant size in meters and warns when objects are outside the plant bounds.

## Files

- `apps/web/src/lib/cad/plant-scale.ts`
- `apps/web/src/lib/cad/plant-scale.spec.ts`
- `apps/web/src/components/line-engineering/Layout3DEditor.tsx`
- `apps/web/src/lib/cad/index.ts`

## Existing foundations reused

- `Layout3DEditor` footprint persistence (`data.footprint`)
- existing view/layers popover
- existing Three.js scene rebuild lifecycle
- existing grid/snap controls
- existing bottom status bar
- existing local CAD helper/spec pattern

## Limitations

- The unit selector remains read-only; this slice displays mm/m consistently but does not convert a saved layout between unit systems.
- Plant presets update the current editable layout state but still depend on the existing Save action to persist to the backend.
- The bounds warning is viewport/status-level; validation-center issue rows and zoom-to-issue can reuse the same helper in a later PR.

## Next

The next non-redundant scale phase should add saved views/bookmarks and zoom-to-validation-issue once the active viewport/minimap PRs settle.
