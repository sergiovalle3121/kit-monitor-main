# AXOS CAD Tree Status

Last updated: 2026-06-29

## Current tree state

AXOS CAD is beyond seed state. The active workbench already includes a unified 2D/3D editor, local command dock, command palette, layers, lock enforcement, measurements, symbols, DXF import/export, validation, safety checks, flow scoring, local snapshots, CAD templates, and a release-readiness surface.

## This run

This run adds an editable CAD template workflow:

- `templates.ts` defines industrial starter layouts for EMS mini factory, SMT line, warehouse racks, and packing/shipping cell.
- Templates instantiate existing asset kinds, connectors, annotations, CAD layer assignments, and tags.
- The equipment rail now exposes a compact "Plantillas CAD" launcher.
- Applying a template creates a local snapshot before mutation, selects the generated editable objects, and primes Flow Health from generated connectors.
- Oversized templates scale to the current footprint and report a warning instead of overflowing silently.

The workflow is visible in `Layout3DEditor` and reuses the current editable layout model. It does not introduce a parallel editor, duplicate symbol systems, duplicate flow scoring, or a new persistence path.

## Phase evidence

| Backlog phase | Status | Evidence | Next step |
| --- | --- | --- | --- |
| Phase 0 - Audit plus visible fix | Complete for this run | `AXOS_CAD_CAPABILITY_AUDIT.md` plus a reachable command workflow | Keep audit current as PRs land. |
| Phase 17 - Flow Health | Advanced | `flow-optimization.ts`, Flow Health UI, `arrange_flow_line`, and template-seeded flow health | Add richer flow recommendations and before/after preview cards. |
| Phase 21 - Shortcuts and command line | Advanced | Command dock, parser, registry, palette, shortcuts | Add more industrial command examples and history reconciliation. |
| Phase 23 - CAD project / layout templates | Usable | `templates.ts` plus the equipment-rail template launcher | Add parametric rack/line generators with user inputs. |
| Phase 27 - QA harness | In progress | Pure specs under `apps/web/src/lib/cad` | Add specs for each new command/helper. |

## Next CAD PR

Recommended next phase: add a parametric rack row or SMT line generator with user inputs, building on `templates.ts` and the existing editable asset/connector model.
