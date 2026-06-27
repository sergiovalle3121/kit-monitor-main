# CAD — Program Backlog

This program covers the AXOS AI-assisted 2D CAD and factory-layout tool: a canvas-based drawing surface driven by a CIDE (OpenAI-compatible) copilot that turns natural-language commands into deterministic geometry and layout edits. The objective is an incremental, copilot-first 2D CAD experience for line engineering and factory planning, where every action is undoable, unit-aware, and tenant-scoped.

> **Inspect before you build.** A CAD pipeline already exists. Before any item, read the existing command/intent/vision stack — `apps/web/src/components/line-engineering/cad-command.ts`, `cad-intent.ts`, `cad-vision.ts` (and their `.spec.ts`), the geometry helpers under `apps/web/src/lib/cad`, and the backend `apps/api/src/modules/line-engineering/cad-intent.service.ts` + `cad-intent-tools.ts`. Persist layouts through `apps/api/src/modules/bay-layout` (always with `tenant_id`) and reuse `apps/api/src/modules/visual-aids` where symbols/aids overlap. Read `docs/cad-copilot-command-contract.md`, `docs/cad-tool-summary.md`, and `docs/cad-roadmap-fase-66-69.md` first. Never create a parallel CAD screen, never duplicate the command engine — extend it. Keep every PR small, functional, and green.

## Epics

- **CAD Copilot** — the conversational copilot surface that accepts CIDE commands and renders results.
- **Command Engine** — the deterministic command parser/executor (`cad-command.ts`) and its dispatch.
- **2D Layout** — the drawing canvas, entities, and the core 2D editing model.
- **Snapping/Grid** — grid, snap-to-point, and alignment guides.
- **Layers** — layer model, visibility, locking, and ordering.
- **Measurements** — dimensions, distances, areas, and unit handling.
- **DXF Import/Export** — interchange with external CAD via DXF.
- **Symbols** — reusable symbol/block library (shared with visual-aids).
- **Factory Layout** — bay/line layout placement persisted to `bay-layout`.
- **Flow Optimization** — material-flow analysis and layout suggestions.
- **CIDE/OpenAI-compatible commands** — the CIDE command contract, tool schemas, and intent mapping.

## Backlog

### CAD Copilot

#### CAD-001 — Copilot command input panel
- **Epic:** CAD Copilot
- **Objective:** Add a single command-input panel that submits a CIDE command string to the existing intent pipeline.
- **Probable files:** `apps/web/src/components/line-engineering/cad-command.ts`, `apps/web/src/app/dashboard/line-engineering`
- **Acceptance criteria:** Typing a command and pressing enter dispatches through `cad-intent.ts`; empty input is ignored.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-002 — Copilot result toast
- **Epic:** CAD Copilot
- **Objective:** Show a non-blocking toast summarizing the result of the last copilot command.
- **Probable files:** `apps/web/src/app/dashboard/line-engineering`, `apps/web/src/components/line-engineering/cad-command.ts`
- **Acceptance criteria:** A successful command shows a success toast; a failed parse shows an error toast with the message.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-003 — Copilot command history list
- **Epic:** CAD Copilot
- **Objective:** Render a read-only list of the last N submitted commands in the copilot panel.
- **Probable files:** `apps/web/src/app/dashboard/line-engineering`, `apps/web/src/components/line-engineering/cad-command.ts`
- **Acceptance criteria:** Submitting commands appends them to the visible history (capped at N entries).
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-004 — Re-run last command shortcut
- **Epic:** CAD Copilot
- **Objective:** Add a button/shortcut to re-submit the most recent command unchanged.
- **Probable files:** `apps/web/src/app/dashboard/line-engineering`, `apps/web/src/components/line-engineering/cad-command.ts`
- **Acceptance criteria:** Activating it re-dispatches the last command; disabled when history is empty.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-005 — Copilot busy/loading state
- **Epic:** CAD Copilot
- **Objective:** Disable the command input and show a spinner while a CIDE command is being resolved.
- **Probable files:** `apps/web/src/components/line-engineering/cad-command.ts`, `apps/web/src/app/dashboard/line-engineering`
- **Acceptance criteria:** Input is disabled during an in-flight command and re-enabled on resolution.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

### Command Engine

#### CAD-006 — Parse a single "draw rectangle" command
- **Epic:** Command Engine
- **Objective:** Extend the command parser to recognize one `rectangle x y w h` command and emit a draw intent.
- **Probable files:** `apps/web/src/components/line-engineering/cad-command.ts`, `apps/web/src/components/line-engineering/cad-command.spec.ts`
- **Acceptance criteria:** Parser returns a structured rectangle intent; malformed args return a parse error.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-007 — Parse a single "draw line" command
- **Epic:** Command Engine
- **Objective:** Add a line-segment command (`line x1 y1 x2 y2`) to the existing parser.
- **Probable files:** `apps/web/src/components/line-engineering/cad-command.ts`, `apps/web/src/components/line-engineering/cad-command.spec.ts`
- **Acceptance criteria:** Valid input emits a line intent; missing coordinates fail cleanly.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-008 — Parse a single "delete <id>" command
- **Epic:** Command Engine
- **Objective:** Add a delete-by-id command to the parser that maps to a remove intent.
- **Probable files:** `apps/web/src/components/line-engineering/cad-command.ts`, `apps/web/src/components/line-engineering/cad-command.spec.ts`
- **Acceptance criteria:** Known id resolves to a delete intent; unknown id returns a not-found error.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-009 — Command help/usage listing
- **Epic:** Command Engine
- **Objective:** Add a `help` command that returns the list of supported commands and their syntax.
- **Probable files:** `apps/web/src/components/line-engineering/cad-command.ts`, `apps/web/src/components/line-engineering/cad-command.spec.ts`
- **Acceptance criteria:** `help` returns a stable, sorted list of command signatures.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-010 — Unknown-command error message
- **Epic:** Command Engine
- **Objective:** Standardize the error returned when the parser sees an unrecognized command keyword.
- **Probable files:** `apps/web/src/components/line-engineering/cad-command.ts`, `apps/web/src/components/line-engineering/cad-command.spec.ts`
- **Acceptance criteria:** Unknown keyword yields a single typed error with the offending token.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-011 — Intent-to-executor dispatch table
- **Epic:** Command Engine
- **Objective:** Introduce a single dispatch map from intent type to its executor function.
- **Probable files:** `apps/web/src/components/line-engineering/cad-intent.ts`, `apps/web/src/components/line-engineering/cad-intent.spec.ts`
- **Acceptance criteria:** Each known intent routes to exactly one executor; unmapped intents throw a clear error.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

### 2D Layout

#### CAD-012 — Entity model for rectangle
- **Epic:** 2D Layout
- **Objective:** Add a minimal rectangle entity type to the 2D model in `lib/cad`.
- **Probable files:** `apps/web/src/lib/cad`, `apps/web/src/components/line-engineering/cad-intent.ts`
- **Acceptance criteria:** A rectangle entity carries id, position, size, and layer; serialization round-trips.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-013 — Render entities on the canvas
- **Epic:** 2D Layout
- **Objective:** Draw the current entity list onto the 2D canvas surface.
- **Probable files:** `apps/web/src/lib/cad`, `apps/web/src/app/dashboard/line-engineering`
- **Acceptance criteria:** Each entity in the model renders once; clearing the model clears the canvas.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-014 — Select a single entity by click
- **Epic:** 2D Layout
- **Objective:** Add hit-testing so clicking an entity marks it selected in the model.
- **Probable files:** `apps/web/src/lib/cad`, `apps/web/src/app/dashboard/line-engineering`
- **Acceptance criteria:** Clicking inside an entity selects it; clicking empty space clears selection.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-015 — Move selected entity
- **Epic:** 2D Layout
- **Objective:** Allow dragging the selected entity to a new position, respecting units.
- **Probable files:** `apps/web/src/lib/cad`, `apps/web/src/app/dashboard/line-engineering`
- **Acceptance criteria:** Drag updates entity position in model units; one undo restores the original position.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-016 — Undo/redo stack for geometry edits
- **Epic:** 2D Layout
- **Objective:** Add a single undo/redo stack covering create/move/delete operations.
- **Probable files:** `apps/web/src/lib/cad`
- **Acceptance criteria:** Undo reverses the last edit and redo reapplies it; stack survives consecutive edits.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-017 — Pan and zoom the canvas
- **Epic:** 2D Layout
- **Objective:** Add pan (drag) and zoom (wheel) to the canvas viewport without mutating entities.
- **Probable files:** `apps/web/src/lib/cad`, `apps/web/src/app/dashboard/line-engineering`
- **Acceptance criteria:** Pan/zoom change the view transform only; entity coordinates are unchanged.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-018 — Duplicate selected entity
- **Epic:** 2D Layout
- **Objective:** Add a duplicate action that clones the selected entity with a small offset and new id.
- **Probable files:** `apps/web/src/lib/cad`, `apps/web/src/components/line-engineering/cad-intent.ts`
- **Acceptance criteria:** Duplicate creates a new entity with a unique id; one undo removes the clone.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

### Snapping/Grid

#### CAD-019 — Render background grid
- **Epic:** Snapping/Grid
- **Objective:** Draw a configurable spacing grid behind entities on the canvas.
- **Probable files:** `apps/web/src/lib/cad`, `apps/web/src/app/dashboard/line-engineering`
- **Acceptance criteria:** Grid spacing follows the configured unit value; grid renders behind all entities.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-020 — Snap-to-grid on move
- **Epic:** Snapping/Grid
- **Objective:** Snap a dragged entity's position to the nearest grid point when snapping is enabled.
- **Probable files:** `apps/web/src/lib/cad`
- **Acceptance criteria:** With snap on, drops land on grid points; with snap off, free positioning is preserved.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-021 — Snap-to-grid toggle control
- **Epic:** Snapping/Grid
- **Objective:** Add a toggle in the canvas toolbar to enable/disable grid snapping.
- **Probable files:** `apps/web/src/app/dashboard/line-engineering`, `apps/web/src/lib/cad`
- **Acceptance criteria:** Toggle state drives snapping behavior and is reflected in the control's UI.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-022 — Snap to entity endpoints
- **Epic:** Snapping/Grid
- **Objective:** Add endpoint snapping so a moved point snaps to nearby entity vertices within a threshold.
- **Probable files:** `apps/web/src/lib/cad`
- **Acceptance criteria:** Points within the threshold snap to the nearest vertex; outside threshold they do not.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-023 — Alignment guide lines
- **Epic:** Snapping/Grid
- **Objective:** Show temporary horizontal/vertical guide lines when a dragged entity aligns with another.
- **Probable files:** `apps/web/src/lib/cad`, `apps/web/src/app/dashboard/line-engineering`
- **Acceptance criteria:** Guides appear only during alignment and disappear on drop.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

### Layers

#### CAD-024 — Layer model and default layer
- **Epic:** Layers
- **Objective:** Add a layer type and assign new entities to a default layer.
- **Probable files:** `apps/web/src/lib/cad`
- **Acceptance criteria:** Every entity references a layer id; a default layer exists on an empty document.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-025 — Layer visibility toggle
- **Epic:** Layers
- **Objective:** Add per-layer visibility that hides/shows that layer's entities on the canvas.
- **Probable files:** `apps/web/src/lib/cad`, `apps/web/src/app/dashboard/line-engineering`
- **Acceptance criteria:** Hiding a layer removes its entities from render; showing restores them.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-026 — Layer lock toggle
- **Epic:** Layers
- **Objective:** Add per-layer locking that prevents selecting/editing entities on that layer.
- **Probable files:** `apps/web/src/lib/cad`
- **Acceptance criteria:** Entities on a locked layer cannot be selected or moved.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-027 — Layer panel list
- **Epic:** Layers
- **Objective:** Render a panel listing layers with their visibility and lock state.
- **Probable files:** `apps/web/src/app/dashboard/line-engineering`, `apps/web/src/lib/cad`
- **Acceptance criteria:** Panel lists all layers and reflects live visibility/lock state.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-028 — Assign selected entity to a layer
- **Epic:** Layers
- **Objective:** Add an action to move the selected entity to a chosen layer.
- **Probable files:** `apps/web/src/lib/cad`, `apps/web/src/components/line-engineering/cad-intent.ts`
- **Acceptance criteria:** Reassigning updates the entity's layer id; one undo restores the prior layer.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

### Measurements

#### CAD-029 — Unit configuration (mm/cm/m)
- **Epic:** Measurements
- **Objective:** Add a document-level unit setting used by display and snapping.
- **Probable files:** `apps/web/src/lib/cad`
- **Acceptance criteria:** Changing the unit converts displayed values consistently; stored geometry stays canonical.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-030 — Distance measurement tool
- **Epic:** Measurements
- **Objective:** Add a tool to measure the distance between two clicked points in the current unit.
- **Probable files:** `apps/web/src/lib/cad`, `apps/web/src/app/dashboard/line-engineering`
- **Acceptance criteria:** Two clicks display the distance in the active unit; measurement does not add an entity.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-031 — Linear dimension annotation
- **Epic:** Measurements
- **Objective:** Add a linear dimension entity that labels the length between two points.
- **Probable files:** `apps/web/src/lib/cad`, `apps/web/src/components/line-engineering/cad-intent.ts`
- **Acceptance criteria:** A dimension renders with a unit-aware label; one undo removes it.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-032 — Area readout for rectangle
- **Epic:** Measurements
- **Objective:** Compute and display the area of the selected rectangle entity.
- **Probable files:** `apps/web/src/lib/cad`, `apps/web/src/app/dashboard/line-engineering`
- **Acceptance criteria:** Selecting a rectangle shows its area in squared current units.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

### DXF Import/Export

#### CAD-033 — Export current document to DXF
- **Epic:** DXF Import/Export
- **Objective:** Serialize the entity model to a minimal DXF file (lines + rectangles).
- **Probable files:** `apps/web/src/lib/cad`
- **Acceptance criteria:** Export produces valid DXF containing all supported entities; round-trips re-import unchanged.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-034 — Import lines from DXF
- **Epic:** DXF Import/Export
- **Objective:** Parse DXF LINE entities into the model on import.
- **Probable files:** `apps/web/src/lib/cad`
- **Acceptance criteria:** Importing a DXF with lines creates matching line entities; unsupported entities are skipped.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-035 — DXF unit mapping
- **Epic:** DXF Import/Export
- **Objective:** Map DXF drawing units to the document unit on import/export.
- **Probable files:** `apps/web/src/lib/cad`
- **Acceptance criteria:** Imported coordinates convert to the document unit; export writes the matching DXF unit header.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-036 — DXF import error handling
- **Epic:** DXF Import/Export
- **Objective:** Return a clear error when DXF parsing fails instead of partially mutating the model.
- **Probable files:** `apps/web/src/lib/cad`
- **Acceptance criteria:** A malformed DXF leaves the current document unchanged and surfaces one error.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

### Symbols

#### CAD-037 — Symbol/block definition type
- **Epic:** Symbols
- **Objective:** Add a reusable symbol definition (named group of entities) to the model, reusing visual-aids where possible.
- **Probable files:** `apps/web/src/lib/cad`, `apps/api/src/modules/visual-aids`
- **Acceptance criteria:** A symbol stores a name and its child entities; definitions serialize and reload.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-038 — Insert symbol instance
- **Epic:** Symbols
- **Objective:** Place an instance of a defined symbol at a point with a unique instance id.
- **Probable files:** `apps/web/src/lib/cad`, `apps/web/src/components/line-engineering/cad-intent.ts`
- **Acceptance criteria:** Inserting renders the symbol's children at the target point; one undo removes the instance.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-039 — Symbol library panel
- **Epic:** Symbols
- **Objective:** Show a panel listing available symbol definitions for insertion.
- **Probable files:** `apps/web/src/app/dashboard/line-engineering`, `apps/web/src/lib/cad`
- **Acceptance criteria:** Panel lists all defined symbols; selecting one arms the insert tool.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-040 — Detect symbol via cad-vision
- **Epic:** Symbols
- **Objective:** Extend the vision pipeline to map a detected element to a known symbol definition.
- **Probable files:** `apps/web/src/components/line-engineering/cad-vision.ts`, `apps/web/src/components/line-engineering/cad-vision.spec.ts`
- **Acceptance criteria:** A recognized element resolves to a symbol id; unrecognized elements return no match.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

### Factory Layout

#### CAD-041 — Persist layout to bay-layout
- **Epic:** Factory Layout
- **Objective:** Save the current entity document to `bay-layout` scoped by `tenant_id`.
- **Probable files:** `apps/api/src/modules/bay-layout`, `packages/contracts`
- **Acceptance criteria:** Save writes a layout row with the active `tenant_id`; another tenant cannot read it.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-042 — Load layout from bay-layout
- **Epic:** Factory Layout
- **Objective:** Load a saved layout by id (tenant-scoped) into the canvas model.
- **Probable files:** `apps/api/src/modules/bay-layout`, `apps/web/src/lib/cad`
- **Acceptance criteria:** Loading restores all entities for the requesting tenant; cross-tenant ids return not-found.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-043 — Place a bay block
- **Epic:** Factory Layout
- **Objective:** Add a bay block entity sized in real units for the factory layout.
- **Probable files:** `apps/web/src/lib/cad`, `apps/api/src/modules/bay-layout`
- **Acceptance criteria:** A bay block carries dimensions in current units and persists with the layout.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-044 — Place a workstation marker
- **Epic:** Factory Layout
- **Objective:** Add a workstation marker entity positioned within a bay.
- **Probable files:** `apps/web/src/lib/cad`, `apps/api/src/modules/bay-layout`
- **Acceptance criteria:** A workstation references its bay and snaps to grid; one undo removes it.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-045 — Layout save contract
- **Epic:** Factory Layout
- **Objective:** Define the layout save/load DTO in `packages/contracts`.
- **Probable files:** `packages/contracts`, `apps/api/src/modules/bay-layout`
- **Acceptance criteria:** Web and API share one typed contract for layout payloads; build passes both sides.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

### Flow Optimization

#### CAD-046 — Define material-flow edges
- **Epic:** Flow Optimization
- **Objective:** Add directional flow edges between workstations in the layout model.
- **Probable files:** `apps/web/src/lib/cad`, `apps/api/src/modules/bay-layout`
- **Acceptance criteria:** A flow edge references source/target workstations; edges persist with the layout.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-047 — Compute total flow distance
- **Epic:** Flow Optimization
- **Objective:** Sum the Euclidean distance of all flow edges in the current unit.
- **Probable files:** `apps/web/src/lib/cad`
- **Acceptance criteria:** Total distance matches the sum of edge lengths; updates when stations move.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-048 — Highlight longest flow edge
- **Epic:** Flow Optimization
- **Objective:** Visually mark the single longest flow edge to surface the worst path.
- **Probable files:** `apps/web/src/lib/cad`, `apps/web/src/app/dashboard/line-engineering`
- **Acceptance criteria:** The longest edge is highlighted; ties pick one deterministically.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-049 — Suggest swap to reduce flow distance
- **Epic:** Flow Optimization
- **Objective:** Suggest a single station swap that lowers total flow distance, as a non-destructive recommendation.
- **Probable files:** `apps/web/src/lib/cad`, `apps/web/src/components/line-engineering/cad-intent.ts`
- **Acceptance criteria:** Suggestion only proposes a swap (no auto-edit) and reports the projected reduction.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

### CIDE/OpenAI-compatible commands

#### CAD-050 — CIDE tool: draw rectangle
- **Epic:** CIDE/OpenAI-compatible commands
- **Objective:** Add a CIDE tool schema for drawing a rectangle that maps to the existing rectangle intent.
- **Probable files:** `apps/api/src/modules/line-engineering/cad-intent-tools.ts`, `apps/api/src/modules/line-engineering/cad-intent.service.ts`
- **Acceptance criteria:** The tool schema validates args and produces the same intent as the manual command.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-051 — CIDE tool: move entity
- **Epic:** CIDE/OpenAI-compatible commands
- **Objective:** Add a CIDE tool to move an entity by id, mapped to the move intent.
- **Probable files:** `apps/api/src/modules/line-engineering/cad-intent-tools.ts`, `apps/api/src/modules/line-engineering/cad-intent.service.ts`
- **Acceptance criteria:** Valid id/offset produce a move intent; unknown id returns a tool error.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-052 — CIDE tool: place workstation
- **Epic:** CIDE/OpenAI-compatible commands
- **Objective:** Add a CIDE tool to place a workstation in a bay, mapped to the layout intent.
- **Probable files:** `apps/api/src/modules/line-engineering/cad-intent-tools.ts`, `apps/api/src/modules/bay-layout`
- **Acceptance criteria:** The tool persists a workstation under the active `tenant_id`; missing bay returns an error.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-053 — CIDE command contract alignment
- **Epic:** CIDE/OpenAI-compatible commands
- **Objective:** Update `docs/cad-copilot-command-contract.md` and `cad-tool-summary.md` to list newly added CIDE tools.
- **Probable files:** `docs/cad-copilot-command-contract.md`, `docs/cad-tool-summary.md`
- **Acceptance criteria:** Each implemented CIDE tool appears once in the contract with matching arg names.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-054 — CIDE tool result schema
- **Epic:** CIDE/OpenAI-compatible commands
- **Objective:** Standardize a single OpenAI-compatible result envelope returned by all CAD CIDE tools.
- **Probable files:** `apps/api/src/modules/line-engineering/cad-intent.service.ts`, `packages/contracts`
- **Acceptance criteria:** Every tool returns the shared envelope (status, message, affected ids); tested on one tool.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING

#### CAD-055 — CIDE intent validation guard
- **Epic:** CIDE/OpenAI-compatible commands
- **Objective:** Reject CIDE tool calls whose args fail schema validation before they reach the executor.
- **Probable files:** `apps/api/src/modules/line-engineering/cad-intent.service.ts`, `apps/api/src/modules/line-engineering/cad-intent-tools.ts`
- **Acceptance criteria:** Invalid args return a validation error without mutating any layout.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant `.spec` tests
- **Status:** PENDING
