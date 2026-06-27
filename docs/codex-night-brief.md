# Codex Night Brief — CAD additive lane

## Analysis of Claude's master prompt

Claude's brief is safe for autonomous overnight CAD work because it treats `main` as production: every merge must be small, green, atomic, and reversible. The highest-value rule is to keep all work behind the existing CAD tab and make changes additive, so a broken experimental PR cannot block unrelated overnight work.

## Working contract

- Codex owns only `apps/web/src/components/line-engineering/Layout3DEditor.tsx` and UI-only additions around the CAD surface.
- Pure CAD math modules and backend/API contracts remain Claude-owned.
- If a new endpoint, DTO, or pure-module signature is needed, Codex should open a tiny contract-request PR and immediately continue with another UI-only task.
- PRs touching the large editor file must be serialized to avoid conflicts.

## OpenAI-compatible AI lane

AXOS already routes AI through CIDE, an OpenAI-compatible endpoint. CAD copilots should therefore be written against an OpenAI-compatible tool/function schema instead of a vendor-specific SDK. The same tool list can run against self-hosted CIDE or OpenAI by changing `baseURL`, keeping factory data inside controlled infrastructure.

### Function-calling target

The first CAD AI primitive is a command bar that maps natural language into deterministic editor operations, for example:

- `pasillo 1.2 entre SMT e inspección`
- `alinear centro`
- `distribuir horizontal`
- `conectar flujo`

This commit seeds that UI locally without adding network calls, backend dependencies, or production risk.
