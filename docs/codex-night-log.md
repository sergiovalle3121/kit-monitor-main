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

## 2026-06-27 — CAD workbench validation and flow PR 25

- Added tangible workbench UX instead of another isolated helper: validation now computes local collision pairs and displays a selectable collision list in the report panel.
- Added Flow Health from the existing flow optimization helper, with score, total distance, crossings, backtracking, recommendations, and a preview-first handoff to `arrange_line`.
- Added an AutoCAD-style status strip with active tool, selection count, units, snap state, validation state, flow score, DXF warning count, and local snapshot count.
- Kept the implementation UI-only and additive: no backend endpoints, no AI calls, and no changes to the existing DXF backdrop persistence flow.
- Created `docs/cad-industrial-workbench.md` to document the usable workbench surface, DXF support matrix, validation, layers, flow behavior, and future CIDE/OpenAI path.

## 2026-06-27 — DXF export workbench options PR 26

- Replaced the one-click DXF download affordance with an export workbench modal that previews scope and options before download.
- Added DXF export options for all vs selection, include hidden layers, include measurements, include labels, unit selection, and filename.
- The export summary now shows objects, connectors, measurements, labels, and layer count before generating the client-side DXF.
- Export remains fully local and uses the existing `exportCadLayoutDxf` adapter; no backend or DXF backdrop behavior changed.

## 2026-06-27 — Selection measurement workbench PR 27

- Connected the pure measurement helpers to visible editor UX: selecting exactly two objects now exposes direct/horizontal/vertical center-to-center cotas in the properties panel.
- Created measurements are persisted as existing dimension annotations, display their human label in the viewport, participate in undo/redo, and export through the existing DXF measurement path.
- This complements the point-click measure tool with a faster industrial workflow for answering distance questions like SMT → AOI or AOI → empaque.

## 2026-06-27 — Actionable Cmd-K palette PR 28

- Made Cmd-K entries execute real work instead of only navigating users to panels.
- Symbol entries now insert the industrial symbol directly, select it, and keep the existing symbol insertion/undo path.
- Command entries now parse and generate a Copilot preview immediately, keeping the preview-first safety contract intact.
- Tool entries continue switching to real tool modes/actions, and the palette now shows shortcuts plus a small recent-actions strip.

## 2026-06-27 — Aisles and safety authoring PR 29

- Added visible safety/aisle authoring instead of another helper-only slice.
- Selecting two objects now exposes a configurable-width aisle/clearance creator that generates an editable AGV/path asset between the selected centers, assigns it to the Aisles layer, tags it, selects it, and keeps undo/redo support.
- The equipment panel now includes No-go and Restricted safety zone buttons that create editable zone assets on the Safety layer with safety tags.
- These workflows are local/UI-only and reuse existing asset rendering, layer assignment, tags, snapshots/undo, and export paths.


## 2026-06-27 — DXF editable conversion PR 30

- Turned the DXF import warning card into an actionable import panel with supported primitive counts, layer count, warnings, and a conversion CTA.
- Added guarded conversion from scanned DXF primitives into editable AXOS objects: LINE/POLYLINE segments become wall assets, inferred rectangles become zone assets, and TEXT/MTEXT becomes note annotations.
- Conversion reuses the same footprint transform as the DXF backdrop, pushes undo history, assigns local CAD layers/tags, selects created objects, and keeps unsupported entities as warnings.
- No backend endpoints or persistence contracts changed; the existing DXF backdrop upload/remove flow remains intact.


## 2026-06-27 — Professional layer management PR 31

- Upgraded the CAD layer menu from simple visibility/lock toggles into a workbench layer control surface.
- Added active CAD layer state; newly inserted generic assets inherit the active layer, while industrial symbols still override to their symbol default layer when available.
- Each CAD layer now shows object counts and exposes quick actions: set active, show/hide, lock/open, select objects, isolate layer, and assign current selection.
- The CAD status strip now shows the active layer so operators know where new objects will land.


## 2026-06-27 — CAD editor lint hardening PR 32

- Removed the remaining React lint warnings from the CAD editor path instead of accepting warnings as permanent technical debt.
- Moved load-reset state updates out of the synchronous effect body while keeping refs reset immediately for the loader lifecycle.
- Added a render-safe `cellsView` state for the Cells/Zones modal so rendering no longer reads `cellsRef.current` directly.
- Cell create/delete/rename now keep `cellsRef` and `cellsView` synchronized, preserving save/export behavior while making the editor lint-clean.


## 2026-06-27 — Safety validation panel PR 33

- Connected the existing pure safety-zone evaluator to the visible design review modal.
- No-go and Restricted zone assets now participate in validation: AXOS detects station/equipment invasions and shows a dedicated Safety section in the report.
- Safety issues include a CTA that selects both the violating object and the safety zone so users can immediately move or resize the problem geometry.
- The CAD status strip now surfaces the active safety issue count after validation.


## 2026-06-27 — Validation viewport highlighting PR 34

- Added visible viewport highlighting for validation findings so collision/safety problems are not only listed in modal rows.
- Running design review now builds a highlighted object set from collision pairs and safety-zone violations, then rebuilds the scene with red alert outlines/tints.
- The validation modal and CAD status strip both expose an action to clear highlights after issues are reviewed.
- Highlights remain local/session-only and do not alter saved layout geometry.


## 2026-06-27 — Flow Health sequence panel PR 35

- Made Flow Health more actionable by showing the exact station sequence used for scoring.
- Added route selection and per-station selection controls directly inside the Flow Health modal so users can locate the flow path without leaving CAD.
- Stored flow nodes/segments locally after analysis; no backend or model calls were added.
- The existing arrange_line handoff remains preview-first through the Copilot command dock.


## 2026-06-27 — Auto safety snapshots PR 36

- Added reusable local snapshot recording for high-risk CAD edits.
- DXF editable conversion, arrange_line-style layout changes, server flow optimization, and command-engine apply operations now create session-local snapshots before mutating layout state.
- Manual snapshot behavior remains unchanged, but it now uses the same snapshot writer as auto checkpoints.
- This improves rollback safety without backend persistence changes or new API calls.


## 2026-06-27 — Snapshot compare UX PR 37

- Connected the pure snapshot diff helper to the visible Versions/Snapshots modal.
- Local snapshots now expose a Compare action that hashes the saved snapshot against the current in-memory layout and shows whether anything changed.
- The compare result is displayed inline before restore, helping users decide whether a rollback is needed.
- Scope remains local/session-only with no backend or persistence changes.


## 2026-06-27 — Searchable symbol palette PR 38

- Upgraded the equipment panel's industrial symbol library from a fixed button grid to a searchable/filterable palette.
- Added category chips, free-text search by label/id/layer/category/tags, result counts, footprint dimensions, layer and tag metadata.
- Symbol insertion still reuses the existing real asset insertion path with default dimensions/layer behavior.
- No backend, persistence, or AI calls were added.

## Object properties authoring PR 39

- Upgraded the single-selection properties panel so industrial assets can be renamed, tagged, assigned to the active layer, centered, and reset to zero rotation without leaving the CAD Workbench.
- Kept station names read-only and routed all quick actions through existing layer-lock, undo, dirty-state, snap-refresh and rebuild paths.

## Measurement manager PR 40

- Added a no-selection measurement manager to the right CAD rail so saved cotas can be reviewed, relabeled, focused, or deleted without hunting for tiny viewport labels.
- Reused the existing annotation/ref, dimension rebuild, dirty-state, undo snapshot, and DXF export paths; no backend or persistence contract changed.

## Release readiness PR 41

- Added a release-readiness gate to the CAD validation modal and status strip, aggregating design-check errors, collision hits, safety-zone invasions, Flow Health, and DXF warnings.
- Kept the gate deterministic/local and connected it to the existing validation action; no backend release workflow or approval persistence changed.

## Layer presentation editing PR 42

- Added local label/color editing for the fixed CAD layer model directly in the view/layer menu.
- Added a reset action that restores AXOS default layer presentation without changing object assignments, locks, or backend persistence.

## Layer take-off PR 43

- Added CAD-layer area/count breakdown to the local quantities panel so engineers can review how much footprint each workbench layer consumes.
- Extended the copied CSV with a layer section while keeping all quantities computed locally from existing placements/assets/layer assignments.

## Flow critical segments PR 44

- Added a longest-segments list to Flow Health so route legs with the highest travel distance are visible and selectable.
- Selecting a segment now selects both endpoint stations and rebuilds the viewport selection, keeping the analysis deterministic and local.
