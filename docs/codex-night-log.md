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
