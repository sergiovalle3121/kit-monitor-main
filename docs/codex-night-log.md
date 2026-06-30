# Codex Night Log

## 2026-06-27 — CAD command-bar scaffold

- Read the repository/AXOS agent rules and frontend architecture docs.
- Confirmed `docs/codex-night-brief.md` did not exist in the checkout, then created a concise self-contained brief from the Claude prompt summary.
- Added an additive CAD command dock in `Layout3DEditor.tsx` behind the existing CAD tab.
- Kept implementation UI-only and local: no backend endpoint, no OpenAI/CIDE network call, no pure CAD module ownership change.
- Commands currently map to deterministic editor actions so a future OpenAI-compatible function-calling layer can call the same operations.

## 2026-06-27 — Command registry PR 1

- Added the pure command-engine folder at `apps/web/src/lib/cad/commands/`.
- Added typed command contracts, registry, parser, executor, history helpers, and validators without React, three.js, backend, or model dependencies.
- Registered the initial eight command ids requested by the CAD Copilot roadmap.
- Added a pure `registry.spec.ts` smoke test for parser detection, registry uniqueness, validation, executor safety, and history undo/redo.
- Added `docs/cad-copilot-command-contract.md` to document the OpenAI-compatible/CIDE function-calling boundary.
- Follow-up completed in PR 2: `Layout3DEditor.tsx` now consumes the registry preview/confirm path.

## 2026-06-27 — Dock preview integration PR 2

- Wired the existing CAD dock to the pure command parser/preview/executor path.
- Replaced immediate inline command application with a preview-first flow: interpret → show affected objects/issues/operations → explicit Apply.
- Added a visible local command history in the dock for previewed/applied/failed commands.
- Commands still apply through the existing editor primitives and memento undo stack; no backend or model calls were added.
- Follow-up completed in PR 3: command-level undo/redo controls were added; richer visual ghost previews remain pending.

## 2026-06-27 — Command undo/redo PR 3

- Added command-level undo/redo controls in the CAD Copilot dock, backed by the editor's existing memento undo/redo stack.
- Added operation detail rows to the textual preview so users can inspect move/connect/measure/focus/report operations before applying.
- Kept the implementation UI-only and additive: no backend, no AI calls, no persistence changes.
- Pending: true visual ghost geometry for previews and tighter command-history reconciliation when users mix toolbar undo with command undo.

## 2026-06-27 — Snapping helpers PR 4

- Added pure CAD snapping helpers in `apps/web/src/lib/cad/snapping.ts` for grid, edge, center, and connector anchors.
- Added a smoke spec covering grid rounding, anchor collection, connector anchors, and box snapping.
- This prepares the existing 3D editor snapping UI for a cleaner extraction path without changing backend or persistence.
- Pending: wire these helpers into `Layout3DEditor.tsx` drag math and expose per-kind snap toggles beyond the current grid/object toggles.

## 2026-06-27 — Snap helper wiring PR 5

- Wired the 3D editor's grid snap scalar to the new pure `snapScalarToGrid` helper.
- This is intentionally tiny: it proves the extraction path without rewriting the existing mature drag/object-snap code in one risky PR.
- Pending: move object/center/edge/connector snap math from `Layout3DEditor.tsx` onto the pure snapping helpers.

## 2026-06-27 — Measurement helpers PR 6

- Added pure CAD measurement helpers for direct, horizontal, and vertical distances between points/objects.
- Added unit formatting for mm/m and human-readable labels suitable for previews or permanent annotations.
- Wired the command registry's `measure_distance` preview to the measurement helper so command output uses the shared math.
- Pending: integrate these helpers into the interactive measure tool preview before creating permanent annotations.

## 2026-06-27 — Layer model PR 7

- Added a pure local layer model with default CAD layers: Layout, Equipment, Flow, Aisles, Measurements, and Safety.
- Added helpers for show/hide, lock/unlock, object assignment, fallback lookup, and visibility/lock checks.
- Added the first CAD Layers panel inside the existing view menu: visibility, lock state, and assign-selection actions.
- Pending: enforce locks during drag/property edits and persist layer assignments with layout saves once the backend contract is approved.

## 2026-06-27 — Object properties PR 8

- Extended the right properties panel with selected object type, id, layer selector, and local tags.
- Layer assignment now works both from the CAD Layers panel and from the single-object properties panel.
- Kept tags and layer assignment local-only for now to avoid changing persistence without a backend contract.
- Pending: enforce layer lock in edit/drag operations and persist object metadata through the layout API after contract approval.

## 2026-06-27 — CAD toolbar PR 9

- Added a pure toolbar action registry with select, pan, measure, aisle, connector, zone, equipment, text, fit view, undo, and redo.
- Added a smoke spec for toolbar uniqueness, groups, and shortcuts.
- Added a compact in-canvas CAD toolbar that calls existing editor actions instead of introducing new backend or persistence paths.
- Pending: replace text-only buttons with icon affordances and add richer modes for rectangle/connector drawing.

## 2026-06-27 — DXF import baseline PR 10

- Added a pure DXF import baseline that maps LINE, LWPOLYLINE/POLYLINE, axis-aligned rectangles, TEXT/MTEXT, and layers into internal CAD primitives.
- Unsupported or malformed entities now produce warnings instead of throwing.
- Added smoke coverage for line, rectangle inference, text, and unsupported entity warnings.
- Pending: wire this richer primitive import into the existing DXF upload/backdrop workflow and expose warnings in the UI.

## 2026-06-27 — DXF export baseline PR 11

- Added a pure DXF exporter that writes R12-compatible HEADER/TABLES/ENTITIES sections for CAD primitives.
- Export supports layers, lines, polylines, equipment rectangles, text labels, and measurement lines/labels without backend changes.
- Added smoke coverage for headers, layer tables, primitives, measurements, entity counting, and EOF termination.
- Pending: map live editor stations/assets/connectors/measurements into this exporter and add an explicit UI download action.

## 2026-06-27 — Symbols, collisions, and flow helpers PR 12

- Added the requested industrial symbol library: SMT line, inspection, AOI, warehouse rack, packing, forklift path, operator station, ESD area, safety zone, conveyor, test station, and rework station.
- Added pure collision and clearance helpers for bounding-box collision lists, overlap area, edge distance, and friendly clearance issues.
- Added pure flow optimization helpers for total flow distance, crossing detection, backtracking detection, simple reorder suggestions, and a layout score.
- Added smoke coverage for symbol lookup/placement, collision/clearance detection, and flow scoring/reordering.
- Pending: wire these helpers into the CAD toolbar/library panel and use collision/flow scores in command previews.

## 2026-06-27 — Safety, snapshots, palette, and copilot contract PR 13

- Added pure safety-zone helpers for aisles, no-go/restricted zones, safety clearance checks, and user-facing violation messages.
- Added versioned local layout snapshot helpers with stable hashing, diffing, push history, and restore operations.
- Added a CAD command palette index that unifies command registry entries, toolbar actions, and industrial symbols with deterministic search ranking.
- Added CIDE/OpenAI-compatible contract helpers for safe context redaction, tool schema exposure, and tool-call validation without making model calls.
- Added smoke coverage for safety zones, snapshots, palette search, and copilot contract validation.
- Pending: wire safety warnings into command previews, expose snapshots in the UI, and add Cmd-K palette interaction.

## 2026-06-27 — Annotation, export adapter, shortcuts, and validation report PR 14

- Added permanent annotation primitives for text notes and measurement annotations with bounds and layer filtering.
- Added a layout-to-DXF export adapter that maps generic CAD boxes, connectors, labels, and measurements into the DXF exporter.
- Added a deterministic keyboard shortcut registry/matcher for Cmd-K, select, measure, fit view, undo, redo, and cancel.
- Added a combined validation report that aggregates collisions, clearance issues, safety-zone violations, and flow scoring into a severity.
- Added smoke coverage for annotations, export mapping, shortcuts, and aggregate validation reports.
- Pending: wire annotations into the measure tool, expose export download in the editor, and connect shortcuts/palette to the UI.

## 2026-06-27 — Cmd-K CAD palette UI PR 15

- Wired the pure command palette and keyboard shortcut helpers into `Layout3DEditor.tsx`.
- Ctrl/Cmd-K now opens a local CAD palette for registered commands, toolbar actions, and symbols.
- Tool entries execute existing toolbar actions; command entries load an example into the Copiloto CAD dock for preview-first execution; symbol entries route the user to the equipment/symbol area.
- Kept behavior local and additive: no backend calls, no model calls, no persistence changes.
- Pending: richer symbol insertion and palette-driven preview execution after the symbol placement contract is finalized.

## 2026-06-27 — Local DXF export wiring PR 16

- Replaced the editor DXF export button's backend dependency with the local pure `exportCadLayoutDxf` adapter.
- The editor now serializes stations, equipment, connectors, text notes, and dimension annotations directly into an AutoCAD-compatible DXF download.
- Export remains local/offline and additive: no backend endpoint or CIDE/OpenAI call is required.
- Pending: include richer symbol metadata/layers once symbol placement is wired into the editor model.

## 2026-06-27 — DXF import warning wiring PR 17

- Wired the pure `importDxfPrimitives` baseline into the existing DXF upload path in `Layout3DEditor.tsx`.
- The editor now previews unsupported/malformed DXF entities locally and surfaces a warning count before preserving the existing backdrop upload flow.
- Kept import behavior compatible with the current backend-backed DXF backdrop persistence while adding local validation.
- Pending: render a detailed warning panel and convert imported primitives into editable CAD objects.

## 2026-06-27 — Shared collision command PR 18

- Rewired the `find_collisions` command to use the shared pure collision detector instead of its inline overlap loop.
- Collision command previews now return affected object ids and report overlap area in the textual rows.
- Added registry smoke coverage for collision preview warnings and affected ids.
- Pending: highlight collision pairs visually in the viewport.

## 2026-06-27 — Flow metrics in command previews PR 19

- Wired shared flow optimization helpers into `connect_flow` and `arrange_line` command previews.
- Flow commands now include report operations with score, total distance, crossing count, and backtracking count.
- Added registry smoke coverage to ensure flow commands emit metric reports.
- Pending: show flow report cards in the viewport and use scores to suggest automatic reordering.

## 2026-06-27 — Command report rows in dock PR 20

- Upgraded the Copiloto CAD dock so `report` operations render compact row details instead of only the report title.
- Flow metrics and collision report previews now show the first report rows directly inside the preview card before apply.
- Kept the UI additive and preview-only; no command execution behavior or backend path changed.
- Pending: expand report rows into a richer viewport side panel with visual highlighting.

## 2026-06-27 — Industrial symbol insertion PR 21

- Wired the pure industrial symbol library into the equipment panel in `Layout3DEditor.tsx`.
- The editor now exposes quick symbol buttons for SMT line, AOI, inspection, racks, packing, forklift path, ESD/safety zones, conveyor, test, and rework stations.
- Symbol insertion maps each symbol to an existing editor asset archetype while preserving symbol label and default footprint dimensions.
- Pending: replace archetype mapping with native symbol rendering/ports once the symbol placement model is persisted.

## 2026-06-27 — Layer lock enforcement PR 22

- Enforced CAD layer locks in the editor instead of leaving them as visual metadata only.
- Dragging now selects locked objects but refuses to start movement when every selected object is on a locked layer, and skips locked members in mixed selections.
- Destructive/edit operations now filter locked objects before delete, rotate, duplicate, array, mirror, offset, nudge, align, distribute, property edits, and command-engine move application.
- Added pure layer helpers for checking object-level locks and filtering editable object ids, plus smoke coverage.
- Pending: persist layer assignments/locks with the layout once the backend contract is approved, and apply layer visibility directly to per-object rendering rather than only coarse legacy groups.

## 2026-06-27 — DXF warning detail panel PR 23

- Added a deterministic DXF warning summarizer so repeated unsupported/malformed entities are grouped by code, type, layer, and message.
- The editor now stores warnings from the latest local DXF import preview instead of only showing a transient toast count.
- Added a compact toolbar badge and an in-viewport detail panel listing the top warning groups with counts, entity type, and layer.
- Clearing or removing the DXF also clears the local warning panel; backend DXF backdrop behavior remains unchanged.
- Pending: convert supported DXF primitives into editable CAD objects after the import-object mapping UX is reviewed.

## 2026-06-27 — Local session snapshots PR 24

- Wired the pure CAD snapshot helpers into the Versions modal as local, browser-session restore points.
- Users can save a quick local snapshot with the same name field as backend versions, inspect the last 20 session snapshots, restore one, or delete it.
- Restoring a local snapshot pushes the current layout onto the existing undo stack before applying the snapshot, so recovery remains reversible.
- Backend versions/scenarios remain unchanged; local snapshots are explicitly session-only and do not add persistence or API calls.
- Pending: auto-create local snapshots before high-risk DXF conversions/import-object operations once editable DXF object mapping lands.

## 2026-06-29 - CAD shortcut workbench hardening

- Inspected the required CAD docs, `Layout3DEditor.tsx`, `apps/web/src/lib/cad/**`, `apps/web/src/lib/cad/commands/**`, route chrome, and open CAD PRs #799/#796/#746.
- Avoided command-registry expansion, DXF conversion, layers, validation-center internals, viewport/minimap helpers, and workbench shell extraction because open CAD PRs already touch nearby concerns.
- Expanded the pure CAD keyboard shortcut registry with real workbench actions: aisle, connector, zone, equipment, text, fit view, grid visibility, object snap, validation, and DXF export.
- Wired `Layout3DEditor.tsx` so matched shortcuts reuse existing toolbar actions, validation, export, grid, and object-snap behavior rather than adding a parallel dispatcher.
- Added shortcut hints to the toolbar registry and the in-editor help overlay, plus pure shortcut/toolbar smoke coverage.
- Pending: Enter-to-confirm command previews, clipboard copy/paste, and richer validation issue quick actions after editor-conflict PRs settle.
## 2026-06-29 - DXF export readiness preflight

- Inspected the required CAD docs, `Layout3DEditor.tsx`, `apps/web/src/lib/cad/**`, command helpers, route chrome, design docs, and open CAD PRs.
- Avoided shortcuts, layer lock/quick actions, validation clearances, and rack-row command work because open PRs already own those concerns.
- Reused the existing `exportCadLayoutDxf` adapter and the current DXF export modal instead of adding another exporter.
- Added `dxf-export-readiness.ts` to evaluate selected/all scope, hidden-layer exclusions, dimensions, labels, validation warnings, and active DXF import warnings before download.
- Wired the existing `Layout3DEditor.tsx` DXF modal to show ready/blocked state, included layer package, preflight issues, and true empty-export blockers.
- Added a pure smoke spec for DXF export readiness.
## 2026-06-29 - CAD object inspector properties

- Inspected the existing CAD properties panel, CAD layers/tags, DXF import tags, command registry, validation helpers, and open CAD PRs #805, #804, #801, #799, and #796 before choosing a panel-scoped object inspector slice.
- Added `apps/web/src/lib/cad/object-properties.ts` to derive object area, bounds, center, source metadata, safety classification, lock/visibility warnings, and multi-selection summaries without creating a parallel editor model.
- Wired the existing `Layout3DEditor` right inspector to show local notes, DXF/source metadata, safety classification, object center, multi-selection bounds, layer spread, and locked/hidden object counts.
- Added `object-properties.spec.ts` for source metadata, safety tag parsing, single-object properties, and multi-selection summaries.
- Pending: notes/tags/source metadata remain local-only until the layout API metadata contract is approved.
## 2026-06-29 - DXF footprint label export

- Reused the existing `exportCadLayoutDxf` path that the `Layout3DEditor.tsx` DXF modal already calls.
- Extended `exportCadDxf` so non-text primitives with `text` export a centered DXF `TEXT` label after valid geometry.
- Added deterministic layer color definitions in `layout-export-adapter.ts` for Layout, Equipment, Flow, Aisles, Measurements, Safety, and Text.
- Added smoke coverage for primitive labels, layout box labels, layer colors, and updated entity counts.
- Pending: add export preflight warnings for empty selection, hidden-layer exports, and unlabeled critical footprints.
## 2026-06-29 - Validation center clearance wiring

- Inspected the existing CAD workbench, command engine, validation report, collisions, safety zones, flow optimization, DXF, layers, symbols, measurements, snapshots, route chrome, and design docs.
- Confirmed no open CAD PRs were present in `gh pr list` during the run.
- Reused `buildCadValidationReport` instead of adding a second validation path in `Layout3DEditor.tsx`.
- The design-check modal now shows a CAD validation summary and actionable clearance warning rows.
- Release readiness and the bottom status bar now include CAD validation severity and clearance counts.
- Added coverage for clearance warnings in `validation-report.spec.ts`.
- Added `docs/cad/AXOS_CAD_CAPABILITY_AUDIT.md` and `docs/cad/AXOS_CAD_TREE_STATUS.md`.
- Pending: add viewport issue badges and zoom-to-issue behavior from the same shared validation report.
## 2026-06-29 — Editable CAD layout templates

- Added pure CAD layout templates for EMS mini factory, SMT line, warehouse racks, and packing/shipping cell.
- Wired templates into the existing `Layout3DEditor` equipment rail as "Plantillas CAD".
- Applying a template creates editable assets, connectors, text annotations, layer assignments, object tags, and a local snapshot before mutation.
- Template-generated flow connectors prime the existing Flow Health panel without adding another flow model.
- Pending: parametric generators for rack rows, supermarket lanes, SMT variants, and assembly/test cells.

## 2026-06-29 - Flow Health reorder preview

- Inspected the required CAD docs, `Layout3DEditor.tsx`, `apps/web/src/lib/cad/**`, command helpers, route chrome, design docs, and open CAD PRs #844, #839, and #838.
- Avoided warehouse/rack generators, command-registry expansion, layers, DXF, validation internals, and shell extraction because open PRs already touch those concerns.
- Extended the existing `flow-optimization.ts` helper with a deterministic reorder preview instead of adding a second flow engine.
- Wired the existing Flow Health modal to show before/after score, distance, crossing, and backtracking deltas.
- Added an apply action that moves current station placements into the suggested physical order using the existing local snapshot, undo, lock-guard, selection, snap, and rebuild paths.
- Added pure smoke coverage for the reorder preview.
- Pending: from-to table, operator walking path, and richer flow recommendation categories.
## 2026-06-29 - CAD line balance command

- Inspected the required CAD docs, `Layout3DEditor.tsx`, `apps/web/src/lib/cad/**`, command helpers, route chrome, design docs, automation memory, and open PR #746 before selecting a command-dock-only slice.
- Avoided `Layout3DEditor.tsx`, minimap, scale bar, DXF, layers, validation center, and template UI because main/open PRs already own those areas.
- Added `apps/web/src/lib/cad/line-balance.ts` to derive cycle-time metadata from explicit command input or station labels such as `CT=42s`.
- Registered `analyze_line_balance` in the existing CAD command registry/parser so the current command dock and palette can preview takt load, bottleneck, overloads, missing metadata, balance efficiency, and score through existing report rows.
- Added pure smoke coverage in `line-balance.spec.ts` and command-registry coverage for parser routing and over-takt warnings.
- Pending: visual Yamazumi/load overlay in the analysis panel after active `Layout3DEditor.tsx` conflicts settle.
## 2026-06-29 - Parametric warehouse rack generator

- Inspected open CAD PR #838 and avoided its command-registry/line-balance files.
- Reused the existing `Layout3DEditor` asset, annotation, layer, tag, snapshot, selection, validation, and DXF export paths.
- Added `warehouse-generators.ts` to generate editable rack bays, forklift aisles, and labels from rows, bays, bay width, rack depth, aisle width, orientation, and prefix.
- Wired the generator into the existing equipment rail so users can create warehouse rack rows without leaving CAD.
- Added pure smoke coverage for horizontal racks, vertical rack aisles, footprint bounds, scaling warnings, and large-layout caps.
- Pending: add supermarket lane and receiving/shipping dock generators using the same output contract.
## 2026-06-29 - CAD plot package metadata

- Inspected the required CAD docs, `Layout3DEditor.tsx`, `plot-sheet.ts`, `plot-scale.ts`, `apps/web/src/lib/cad/**`, command helpers, route chrome, design docs, automation memory, and open CAD PRs #839, #838, and #746.
- Avoided generator, command-registry, validation-center, minimap/scale-bar, layer-manager, and DXF internals because active PRs own those areas.
- Reused the existing `Layout3DEditor` PDF export button and `plotSheetModel` title-block helper instead of adding another plot/export workflow.
- Extended exported CAD PDF title blocks with connectors, dimensions, labels, layer visibility/locks, active layer, validation severity, DXF warnings, package target, and approval state.
- Added `plot-sheet.spec.ts` for default package rows, warning metadata, layer summaries, and defensive clamping.
- Pending: vector paper-space output using `plot-scale.ts` after viewport/minimap PRs settle.
## 2026-06-29 - CAD validation quick fixes

- Inspected the required CAD docs, `Layout3DEditor.tsx`, `apps/web/src/lib/cad/**`, command helpers, route chrome, design docs, and open CAD PRs #853/#850/#847/#844/#839/#838.
- Avoided active template, flow-reorder, plot package, warehouse/rack generator, DXF, and command-registry ownership areas.
- Reused the existing `buildCadValidationReport`, collision/clearance/safety/flow helpers, editor validation state, selection/rebuild path, and Flow Health modal.
- Extended `CadValidationReport` with normalized issue rows that include severity, affected objects, action labels, and suggested fixes.
- Wired the existing design-check modal in `Layout3DEditor.tsx` to show top validation quick fixes and select affected objects from those rows.
- Added focused validation-report coverage for collision, clearance, and safety issue rows.
## 2026-06-29 — Edge clearance dimensions

- Inspected required CAD docs, `Layout3DEditor.tsx`, existing measurement/annotation/DXF helpers, CAD docs, route chrome, and open CAD PRs #850/#847/#844/#839/#838.
- Avoided active flow, plot package, warehouse/rack generator, and command-registry ownership areas.
- Extended the existing `measurements.ts` helper with `edge-horizontal` and `edge-vertical` clearance dimensions, including overlap labeling.
- Wired the existing two-object dimension panel in `Layout3DEditor.tsx` with `Borde H` and `Borde V` actions that create saved `dim` annotations.
- Reused current undo history, editable measurement labels, layer visibility, and DXF export instead of creating another dimension model.
- Added focused smoke coverage in `measurements.spec.ts`.
## 2026-06-29 - DXF critical label preflight

- Inspected the required CAD docs, `Layout3DEditor.tsx`, `apps/web/src/lib/cad/**`, command helpers, route chrome, design docs, and open CAD PRs #858/#853/#850/#847/#844/#839/#838.
- Avoided active dimensions, generator/template, flow, plot metadata, warehouse, rack-row, and command-registry ownership areas.
- Reused the existing `dxf-export-readiness.ts` helper and the existing `Layout3DEditor.tsx` Exportar DXF modal instead of adding another exporter or panel.
- Extended readiness entities with optional labels and a critical-label marker so the modal warns when included industrial footprints have no visible user label.
- Wired station names and asset user labels into the existing DXF export summary builder; hidden/unselected objects only warn if export options include them.
- Added focused readiness coverage for included, hidden, and selection-scoped missing-label cases.
## 2026-06-29 - Manufacturing CAD symbol blocks

- Inspected the required CAD docs, `Layout3DEditor.tsx`, `asset-catalog.ts`, `symbols.ts`, command palette/export helpers, route chrome, design docs, and open CAD PRs #864/#861/#858/#853/#850/#847/#844/#838.
- Avoided active `Layout3DEditor.tsx`, DXF preflight, validation, dimensions, flow, template, warehouse generator, and command-registry ownership areas.
- Extended the existing `CAD_SYMBOL_LIBRARY` with manufacturing blocks for SMT front-end, placement, reflow, X-ray, ICT, functional test, coating, depaneling, assembly, quality gate, label print, and calibration.
- Reused the existing symbol rail and Cmd-K palette wiring; inserted symbols become editable CAD assets and flow through existing layer, selection, validation, and DXF export paths.
- Added symbol spec coverage for manufacturing availability, search, Equipment-layer assignment, flow ports, normalized port bounds, and placement metadata.
- Pending: native block instances and richer warehouse/EHS utility symbols after the persistence contract and editor conflict queue settle.
## 2026-06-29 - Supermarket kitting template

- Inspected automation memory, open CAD PRs #847/#844/#839/#838, required CAD docs, `Layout3DEditor.tsx`, route chrome, design docs, and the full `apps/web/src/lib/cad/**` tree.
- Avoided `Layout3DEditor.tsx`, command registry, plot package files, and warehouse generator files because active CAD PRs own those areas.
- Reused the existing `CAD_LAYOUT_TEMPLATES` launcher and `instantiateCadLayoutTemplate` path instead of creating another generator or editor surface.
- Added a visible "Supermarket + kitting" editable template with receiving drop, incoming QC, kanban lanes, kitting carts, FIFO WIP, line-side delivery, aisles, ESD boundary, quarantine, annotations, tags, and material/flow connectors.
- Added pure template spec coverage for kitting/kanban tags, safety/aisle layers, and connector kinds.
- Pending: parametric supermarket lane/cart generator after active warehouse generator PRs settle.
## 2026-06-29 - CAD EHS and utilities asset blocks

- Inspected the required CAD docs, `Layout3DEditor.tsx`, `apps/web/src/lib/cad/**`, `apps/web/src/lib/cad/commands/**`, route chrome, design docs, the shared `asset-catalog.ts`, and open CAD PRs #870/#869/#864/#861/#858/#853/#850/#847/#844/#838/#746.
- Avoided active `Layout3DEditor.tsx`, `symbols.ts`, `templates.ts`, DXF, layers, commands, validation, flow, measurements, plot, and warehouse-generator ownership areas.
- Reused the existing shared asset catalog plus the current Equipment rail rendering of `ASSET_CATEGORIES`; no new editor, renderer, symbol system, block model, or export path was introduced.
- Added Safety/EHS blocks for fire extinguisher, eyewash, emergency exit path, first aid, spill kit, and PPE station.
- Added Utilities blocks for power panel, compressed-air drop, network drop, maintenance area, tool crib, and calibration station.
- Added `asset-catalog.spec.ts` coverage for unique kinds, category grouping, positive footprints/heights, and reuse of existing mesh archetypes.
- Pending: add native block-instance/default-layer metadata after active symbol/template PRs settle.
