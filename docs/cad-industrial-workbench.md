# AXOS CAD Industrial Workbench

## Purpose

AXOS CAD is the factory-layout and line-engineering workbench inside AXOS OS. It is not a generic drawing canvas: it is optimized for station placement, industrial equipment, material flow, safety review, DXF exchange, and release-readiness validation.

## Current editable surfaces

- Stations placed from the model routing tray.
- Equipment and industrial symbols inserted from the CAD equipment/symbol palette.
- Text notes and measurement annotations stored as local layout annotations.
- Flow connectors between stations.
- Local CAD layers, locks, tags, and session snapshots.
- DXF-derived walls through the existing wall-trace conversion flow.

## DXF support matrix

| DXF capability | Current behavior |
| --- | --- |
| Backdrop upload | Existing API-backed backdrop upload remains supported. |
| Local import scan | `importDxfPrimitives` scans LINE, POLYLINE/LWPOLYLINE, inferred rectangles, TEXT and MTEXT. |
| Warning panel | Unsupported/malformed entities are grouped and shown in the viewport after import. |
| Editable conversion | Wall tracing remains supported; the import panel can also convert supported LINE/POLYLINE segments to editable walls, inferred rectangles to editable zones, and TEXT/MTEXT to note annotations. |
| Export | Client-side DXF export serializes stations, equipment, connectors, notes and measurements. |

## Workbench UX added in this phase

- Validation now computes local CAD collision pairs with the shared collision engine and shows a selectable collision list in the validation modal.
- Flow Health analyzes placed stations by routing sequence and shows score, total distance, crossings, backtracking, and recommendations.
- A bottom CAD status strip exposes active tool, selection count, units, snap state, validation state, flow score, DXF warnings, and local snapshot count.
- Flow Health can hand off to the preview-first Copilot command flow by preparing `arrange_line` without applying it automatically.

## Measurement workflow

The workbench supports point-to-point measurement and a faster industrial center-to-center workflow: select exactly two objects and create direct, horizontal, or vertical cotas from the properties panel. Saved cotas are normal annotations and export through the DXF measurement path.

## DXF editable import workflow

After upload, the workbench shows supported primitive counts, DXF layer count, grouped warnings, and a **Convertir entidades soportadas** action. Conversion is guarded by a hard cap, creates editable assets/notes through the existing undo and layer paths, and leaves unsupported entities as warnings instead of failing the import.

## DXF export options

The workbench export modal supports all vs selected objects, hidden-layer inclusion, measurement inclusion, note/label inclusion, mm/m units, custom filename, and a pre-download entity summary. Export is still local/client-side and uses the existing DXF adapter.


## Industrial symbol palette

The equipment panel includes a searchable/filterable industrial symbol library. Symbols can be filtered by category, searched by label/tag/layer, and inserted with their default footprint, layer, and tags.

## Aisles and safety zones

Select two objects to create a configurable-width editable aisle/clearance between their centers. The workbench also creates local No-go and Restricted zones as editable Safety-layer zone assets with safety tags. These objects use the existing asset, layer, undo and export paths.

## Layer behavior

Layer locks are enforced locally in the editor. Drag, delete, property edits, nudges, command-engine moves, and other destructive operations skip or refuse locked-layer objects. The layer panel now shows object counts, active-layer selection, quick select, isolate, show/hide, lock/unlock, and assign-selection actions. Layer assignments and locks are local until a backend persistence contract is approved.

## Validation behavior

The current validation stack combines the existing design-check panel with local collision highlighting/listing, viewport highlights, and safety-zone invasion checks. No-go and Restricted zones created in the workbench are evaluated against station/equipment boxes, and the report can select both the violating object and the safety zone for correction. Collision geometry is axis-aligned and intentionally ignores rotation for now, matching the existing lightweight validation model.

## Flow behavior

Flow Health uses placed station centers ordered by routing sequence. It reports total distance, crossing count, backtracking count, a 0-100 score, and a clickable station sequence so engineers can locate or select the route being scored. Recommendations are deterministic and local; applying a reorder remains preview-first through the CAD Copilot.


## Local safety snapshots

The Workbench stores local session snapshots manually from the Versions panel and automatically before high-risk local edits such as DXF conversion, line arrangement, flow optimization, and command-engine apply operations. Local snapshots can be compared against the current in-memory layout using stable hashes before restoring. These snapshots remain browser/session-local and do not change backend persistence.

## Command palette behavior

Cmd-K entries are actionable: tools switch modes/actions, symbols insert real industrial symbols, and command entries open the Copilot dock with an immediate deterministic preview. Recent palette actions are shown locally to speed repeat work.

## Future CIDE/OpenAI-compatible integration

The workbench continues to use the deterministic command registry and tool schemas. A future CIDE/OpenAI-compatible model should request commands only through the existing preview/validate/apply pipeline, never mutate layout state directly.

## Object property authoring

The single-object properties panel is now an authoring surface, not only a coordinate inspector. Editable assets can be renamed, tagged, assigned to the active CAD layer, centered in the footprint, and reset to 0° rotation from one place. Stations keep their process name read-only, while all quick actions still respect layer locks before mutating geometry or metadata.

## Measurement management

When no objects are selected, the right properties rail becomes a measurement manager. Engineers can review saved dimensions, rename labels for release drawings, focus the camera on a specific cota, or delete obsolete measurements. The same annotation objects continue to render in the viewport and export through the DXF measurement option.

## Release readiness

The validation modal now includes a deterministic Release Readiness gate. It aggregates base design-check errors, active collision highlights, safety-zone invasions, Flow Health, and DXF import warnings into a clear `Listo`, `Con avisos`, `Bloqueado`, or `Sin validar` status. The bottom status bar exposes the same gate as a one-click validation entry point.

## Layer presentation editing

CAD layers remain the fixed local safety model (`layout`, `equipment`, `flow`, `aisles`, `measurements`, `safety`), but the Workbench now lets users rename their visible labels and adjust colors from the view/layer menu. These presentation edits are session-local and can be reset to the AXOS defaults without changing object assignments or backend persistence.

## Quantity take-off by layer

The quantities panel now reports CAD-layer usage in addition to equipment kind. Layer totals include station/equipment counts and occupied area per visible CAD layer label, and the copied CSV includes a dedicated layer section for release review and downstream quoting.

## Flow critical segments

Flow Health now surfaces the longest route segments as actionable rows. Each row shows the station-to-station leg, formatted distance, and selects both endpoint stations so engineers can inspect excessive travel before preparing an `arrange_line` preview.
