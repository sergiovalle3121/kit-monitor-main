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
- Pending: richer visual ghost previews and dedicated command-level undo/redo controls beyond the editor's existing undo/redo buttons.
