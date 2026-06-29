# AXOS CAD Capability Audit

Last updated: 2026-06-29

This audit tracks the non-redundancy check for the CAD tree sprint. It is scoped to the current mainline CAD implementation and open PR risk observed during this run.

| Capability | Exists? | Files | Maturity | Gap | Next non-redundant PR | Owner files | Collision risk with open PRs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Unified CAD workbench | Yes | `apps/web/src/components/line-engineering/Layout3DEditor.tsx`, `docs/cad-industrial-workbench.md` | strong | Still a large single file; fullscreen shell extraction remains pending. | Extract workbench chrome only after PR 746 lands. | `Layout3DEditor.tsx`, future `cad-workbench/*` | High: PR 746 edits `Layout3DEditor.tsx`. |
| Command dock and registry | Yes | `apps/web/src/lib/cad/commands/*`, `Layout3DEditor.tsx`, `docs/cad-copilot-command-contract.md` | usable | Commands mostly mutate existing objects; few compound industrial workflows. | Add compound commands that reuse `move`/`connect`/`report` operations. | `apps/web/src/lib/cad/commands/*` | Low: no open CAD command PR found. |
| Flow health | Yes | `apps/web/src/lib/cad/flow-optimization.ts`, `Layout3DEditor.tsx` | usable | Flow suggestions are not yet one-click compound workflows. | Preview-first flow-line command and later richer flow panel actions. | `flow-optimization.ts`, `commands/registry.ts` | Low unless touching viewport UI. |
| Layers and locks | Yes | `apps/web/src/lib/cad/layers.ts`, `Layout3DEditor.tsx` | usable | Local only until backend persistence contract is wired. | Persist layer assignments after contract review. | `layers.ts`, layout API types | Medium: avoid if another layer PR opens. |
| Industrial symbols | Yes | `apps/web/src/lib/cad/symbols.ts`, `Layout3DEditor.tsx` | usable | Inserted symbols are mapped to current asset archetypes, not native block instances. | Add native block-instance model after symbol persistence decision. | `symbols.ts`, future block helpers | Medium if touching symbol palette UI. |
| DXF import/export | Yes | `apps/web/src/lib/cad/dxf-import.ts`, `dxf-export.ts`, `layout-export-adapter.ts`, `Layout3DEditor.tsx` | usable | Editable import is still limited to supported primitives and conversion caps. | Layer-selective DXF import review. | `dxf-*`, `Layout3DEditor.tsx` | Medium: avoid if DXF PR appears. |
| Validation center | Partial | `apps/web/src/lib/cad/validation-report.ts`, `collisions.ts`, `safety-zones.ts`, `Layout3DEditor.tsx` | usable | Needs richer issue actions and ignored/local issue state. | Build validation side panel after viewport PRs settle. | `validation-report.ts`, editor UI | Medium due Layout editor churn. |
| Measurements and annotations | Yes | `apps/web/src/lib/cad/measurements.ts`, `annotations.ts`, `Layout3DEditor.tsx` | usable | Dimension styles and release rules are basic. | Add dimension style helper and UI controls. | `measurements.ts`, `annotations.ts` | Low for helper-only; medium for UI. |
| Command palette and shortcuts | Yes | `command-palette.ts`, `keyboard-shortcuts.ts`, `Layout3DEditor.tsx` | usable | More command examples and compound workflows needed. | Add workflow commands before new UI. | `commands/*`, `command-palette.ts` | Low. |
| Local snapshots | Yes | `snapshots.ts`, `Layout3DEditor.tsx` | usable | Session-local; backend version workflow separate. | Snapshot before more high-risk conversions. | `snapshots.ts`, editor versions modal | Medium if touching versions UI. |

## Existing implementation inspected

- `AGENTS.md`
- `README.md`
- `AXOS_OS_ARCHITECTURE.md`
- `docs/cad-copilot-command-contract.md`
- `docs/codex-night-log.md`
- `docs/cad-tool-summary.md`
- `docs/cad-industrial-workbench.md`
- `docs/cad-roadmap-fase-66-69.md`
- `docs/cad-contracts-catalog.md`
- `docs/design/AXOS_DESIGN_LANGUAGE.md`
- `docs/design/AXOS_SHELL_TAXONOMY.md`
- `apps/web/src/lib/routeChrome.ts`
- `apps/web/src/components/line-engineering/Layout3DEditor.tsx`
- `apps/web/src/lib/cad/**`
- `apps/web/src/lib/cad/commands/**`

## Current run decision

Open PR #796 (`codex/night-cad-validation-center`) edits `Layout3DEditor.tsx`, `validation-report.spec.ts`, and the CAD docs, so this run avoided validation-center/clearance work. The selected improvement extends the existing CAD layer system instead of creating a new layer manager: layer summaries now live in `apps/web/src/lib/cad/layers.ts`, the existing CAD Layers panel gets show-all / hide-empty / unlock-all actions, and `Layout3DEditor.tsx` applies CAD layer visibility to station and asset geometry in the viewport.

## Non-redundant layer evidence

- Existing capability found: `DEFAULT_CAD_LAYERS`, local layer assignment, lock enforcement, active layer, layer counts, isolate, and selection assignment already existed.
- What was reused: `CadLayer`, `CadLayerAssignments`, `assignObjectsToLayer`, `toggleCadLayerVisible`, `toggleCadLayerLocked`, and the existing CAD Layers panel inside `Layout3DEditor.tsx`.
- What was extended: `layers.ts` now provides layer summaries and presentation helpers for show-all, isolate, hide-empty, and unlock-all.
- What was wired into `Layout3DEditor`: the layer panel now uses shared summaries, quick actions are visible in the panel, the status bar shows active/hidden/locked layer state, and layer visibility hides/shows assigned station/asset objects in the viewport.
- What was intentionally not duplicated: no new editor, no new layer table, no backend persistence path, and no parallel viewport renderer.
