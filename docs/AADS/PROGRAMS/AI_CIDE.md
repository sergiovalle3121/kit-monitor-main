# AI / CIDE — Program Backlog

This program unifies the AXOS AI layer: the CIDE OpenAI-compatible command/tooling surface, function-calling tools, the semantic layer, analytics narratives, domain copilots (CAD, Office, MES, ERP), and the governance/safety controls that keep all of it auditable. The objective is one coherent, RBAC-checked, ledger-audited AI capability — not a pile of disconnected chatbots.

**Before any PR: INSPECT, do not duplicate.** AXOS already exists. Read the real modules first — backend `apps/api/src/modules/ai` (`ai-tools.service.ts`, `cide-provider.ts`, `ai-cards.ts`, `ai-pricing.ts`, `ai.controller.ts`, `ai.service.ts`, `dto/`, `entities/`, `README.md`), `apps/api/src/modules/semantic`, `apps/api/src/modules/governance`, `apps/api/src/modules/decision-intelligence`, and web `apps/web/src/components/Cide.tsx`, `ChatWidget.tsx`, `apps/web/src/components/chat`, route `apps/web/src/app/api/ai`. The CAD copilot is the canonical pattern (`apps/web/src/components/line-engineering/cad-intent.ts` + `apps/api/src/modules/line-engineering/cad-intent.service.ts`) — every new copilot reuses it rather than inventing a parallel screen. Every AI tool call must be RBAC-checked, transactional writes must confirm-before-write with undo, and every call must be audited to `apps/api/src/modules/event-ledger`. Keep PRs small, functional, and green — `main` deploys to Railway.

## Epics

1. **CIDE Tools** — the OpenAI-compatible command/tooling layer and its tool registry.
2. **Function Calling** — tool schemas, dispatch, RBAC gating, and result rendering.
3. **Semantic Layer** — entity/metric vocabulary the AI uses to resolve natural language.
4. **Analytics Narratives** — generated explanations over decision-intelligence data.
5. **CAD Copilot** — extend the existing CAD intent copilot.
6. **Office Copilot** — document/spreadsheet-style assistance reusing the copilot pattern.
7. **MES Copilot** — shop-floor / manufacturing execution copilot actions.
8. **ERP Copilot** — orders, inventory, and finance copilot actions.
9. **Governance/Safety** — RBAC enforcement, confirm/undo, audit, rate limits, redaction.

## Backlog

### CIDE Tools

#### CIDE-001 — Document CIDE tool registry contract
- **Epic:** CIDE Tools
- **Objective:** Write the contract describing how tools register with `ai-tools.service.ts` so new tools follow one shape.
- **Probable files:** `apps/api/src/modules/ai/README.md`, `apps/api/src/modules/ai/ai-tools.service.ts`
- **Acceptance criteria:** README documents the registration interface; no behavior change.
- **Checks:** `git diff --check`
- **Status:** PENDING

#### CIDE-002 — Expose tool catalog endpoint
- **Epic:** CIDE Tools
- **Objective:** Add a read-only endpoint returning the list of registered CIDE tools and their metadata.
- **Probable files:** `apps/api/src/modules/ai/ai.controller.ts`, `apps/api/src/modules/ai/ai-tools.service.ts`
- **Acceptance criteria:** GET returns tool names/descriptions; tools the caller lacks RBAC for are filtered out.
- **Checks:** `git diff --check`; `npm run build`, ai module tests
- **Status:** PENDING

#### CIDE-003 — CIDE provider model/config surface
- **Epic:** CIDE Tools
- **Objective:** Centralize CIDE model id and base config in `cide-provider.ts` instead of inline literals.
- **Probable files:** `apps/api/src/modules/ai/cide-provider.ts`
- **Acceptance criteria:** Provider reads model/config from one place; existing callers unchanged.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

#### CIDE-004 — Tool result card renderer
- **Epic:** CIDE Tools
- **Objective:** Add one new card type in `ai-cards.ts` for rendering a tool result summary.
- **Probable files:** `apps/api/src/modules/ai/ai-cards.ts`, `apps/web/src/components/chat`
- **Acceptance criteria:** Card renders in chat; falls back to text when fields missing.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

#### CIDE-005 — Per-tool pricing accounting hook
- **Epic:** CIDE Tools
- **Objective:** Record token/cost per tool invocation via `ai-pricing.ts`.
- **Probable files:** `apps/api/src/modules/ai/ai-pricing.ts`, `apps/api/src/modules/ai/ai-tools.service.ts`
- **Acceptance criteria:** Each tool call attributes cost to its tool name; totals unchanged.
- **Checks:** `git diff --check`; `npm run build`, pricing tests
- **Status:** PENDING

#### CIDE-006 — Tenant scoping for tool registry
- **Epic:** CIDE Tools
- **Objective:** Ensure the tool catalog is filtered by the caller's tenant context.
- **Probable files:** `apps/api/src/modules/ai/ai-tools.service.ts`, `apps/api/src/modules/ai/ai.service.ts`
- **Acceptance criteria:** A tenant never sees another tenant's tool instances; covered by a test.
- **Checks:** `git diff --check`; `npm run build`, ai module tests
- **Status:** PENDING

### Function Calling

#### CIDE-007 — Define one function-calling tool schema (DTO)
- **Epic:** Function Calling
- **Objective:** Add a single typed DTO describing one tool's arguments under the ai `dto/` folder.
- **Probable files:** `apps/api/src/modules/ai/dto`, `apps/api/src/modules/ai/ai-tools.service.ts`
- **Acceptance criteria:** DTO validates required args; invalid args rejected before dispatch.
- **Checks:** `git diff --check`; `npm run build`, ai module tests
- **Status:** PENDING

#### CIDE-008 — Tool dispatch router
- **Epic:** Function Calling
- **Objective:** Add a dispatcher that maps a function-call name to its registered handler.
- **Probable files:** `apps/api/src/modules/ai/ai-tools.service.ts`, `apps/api/src/modules/ai/ai.service.ts`
- **Acceptance criteria:** Known names dispatch; unknown names return a clean error, not a crash.
- **Checks:** `git diff --check`; `npm run build`, ai module tests
- **Status:** PENDING

#### CIDE-009 — RBAC gate on tool dispatch
- **Epic:** Function Calling
- **Objective:** Reject a function call when the caller lacks the tool's required permission.
- **Probable files:** `apps/api/src/modules/ai/ai-tools.service.ts`, `apps/api/src/modules/governance`
- **Acceptance criteria:** Unauthorized call returns 403-style result and is not executed; test proves it.
- **Checks:** `git diff --check`; `npm run build`, ai + governance tests
- **Status:** PENDING

#### CIDE-010 — Argument validation error surfacing
- **Epic:** Function Calling
- **Objective:** Return validation errors as a tool-result message the model can read back.
- **Probable files:** `apps/api/src/modules/ai/ai-tools.service.ts`, `apps/api/src/modules/ai/dto`
- **Acceptance criteria:** Malformed args produce a structured error result, not an exception.
- **Checks:** `git diff --check`; `npm run build`, ai module tests
- **Status:** PENDING

#### CIDE-011 — Read-only tool example end to end
- **Epic:** Function Calling
- **Objective:** Wire one read-only tool (e.g. lookup) from schema to dispatch to card.
- **Probable files:** `apps/api/src/modules/ai/ai-tools.service.ts`, `apps/api/src/modules/ai/ai-cards.ts`
- **Acceptance criteria:** A chat prompt triggers the tool and renders a result card.
- **Checks:** `git diff --check`; `npm run build`, ai module tests
- **Status:** PENDING

#### CIDE-012 — Tool call timeout and error result
- **Epic:** Function Calling
- **Objective:** Apply a per-call timeout so a slow tool returns an error result instead of hanging.
- **Probable files:** `apps/api/src/modules/ai/ai-tools.service.ts`
- **Acceptance criteria:** A simulated slow tool returns a timeout result; conversation continues.
- **Checks:** `git diff --check`; `npm run build`, ai module tests
- **Status:** PENDING

#### CIDE-013 — Tool result streaming to chat client
- **Epic:** Function Calling
- **Objective:** Stream tool-result events through the existing `apps/web/src/app/api/ai` route.
- **Probable files:** `apps/web/src/app/api/ai`, `apps/web/src/components/chat`
- **Acceptance criteria:** Tool result appears incrementally in the widget; no duplicate render.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

### Semantic Layer

#### CIDE-014 — Document semantic entity vocabulary
- **Epic:** Semantic Layer
- **Objective:** Catalog the existing entities/metrics the semantic module exposes.
- **Probable files:** `apps/api/src/modules/semantic`, `apps/api/src/modules/ai/README.md`
- **Acceptance criteria:** Inventory of entities documented; no code change.
- **Checks:** `git diff --check`
- **Status:** PENDING

#### CIDE-015 — Semantic resolve endpoint for one entity type
- **Epic:** Semantic Layer
- **Objective:** Add a resolver that maps a natural-language term to one canonical entity id.
- **Probable files:** `apps/api/src/modules/semantic`
- **Acceptance criteria:** Known synonyms resolve; unknown terms return empty, not error.
- **Checks:** `git diff --check`; `npm run build`, semantic tests
- **Status:** PENDING

#### CIDE-016 — Expose one semantic metric to CIDE tools
- **Epic:** Semantic Layer
- **Objective:** Register one semantic metric so a function-calling tool can request it by name.
- **Probable files:** `apps/api/src/modules/semantic`, `apps/api/src/modules/ai/ai-tools.service.ts`
- **Acceptance criteria:** Tool can fetch the metric value; tenant-scoped.
- **Checks:** `git diff --check`; `npm run build`, semantic + ai tests
- **Status:** PENDING

#### CIDE-017 — Semantic term disambiguation prompt
- **Epic:** Semantic Layer
- **Objective:** When a term matches multiple entities, return the candidates for the model to pick.
- **Probable files:** `apps/api/src/modules/semantic`, `apps/api/src/modules/ai/ai-cards.ts`
- **Acceptance criteria:** Ambiguous term returns a ranked candidate list, not a guess.
- **Checks:** `git diff --check`; `npm run build`, semantic tests
- **Status:** PENDING

### Analytics Narratives

#### CIDE-018 — Narrative template for one metric trend
- **Epic:** Analytics Narratives
- **Objective:** Generate a one-paragraph narrative describing a single metric's trend from decision-intelligence data.
- **Probable files:** `apps/api/src/modules/decision-intelligence`, `apps/api/src/modules/ai/ai-cards.ts`
- **Acceptance criteria:** Narrative renders from real data; empty data yields a graceful message.
- **Checks:** `git diff --check`; `npm run build`, decision-intelligence tests
- **Status:** PENDING

#### CIDE-019 — Narrative card in chat
- **Epic:** Analytics Narratives
- **Objective:** Add a narrative card type to render generated explanations in the chat widget.
- **Probable files:** `apps/api/src/modules/ai/ai-cards.ts`, `apps/web/src/components/chat`
- **Acceptance criteria:** Card shows narrative text plus source metric reference.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

#### CIDE-020 — Narrative grounding guard
- **Epic:** Analytics Narratives
- **Objective:** Ensure narratives only reference values present in the source dataset.
- **Probable files:** `apps/api/src/modules/decision-intelligence`, `apps/api/src/modules/ai/ai.service.ts`
- **Acceptance criteria:** A test confirms generated numbers match source rows.
- **Checks:** `git diff --check`; `npm run build`, decision-intelligence tests
- **Status:** PENDING

#### CIDE-021 — Narrative export to event ledger
- **Epic:** Analytics Narratives
- **Objective:** Record each generated narrative as an audited event.
- **Probable files:** `apps/api/src/modules/event-ledger`, `apps/api/src/modules/decision-intelligence`
- **Acceptance criteria:** Generating a narrative writes one ledger entry with metric ref.
- **Checks:** `git diff --check`; `npm run build`, event-ledger tests
- **Status:** PENDING

### CAD Copilot

#### CIDE-022 — Add one new CAD intent action
- **Epic:** CAD Copilot
- **Objective:** Extend the existing CAD intent service with one additional read-only intent.
- **Probable files:** `apps/api/src/modules/line-engineering/cad-intent.service.ts`, `apps/web/src/components/line-engineering/cad-intent.ts`
- **Acceptance criteria:** New intent recognized and returns a result; existing intents unchanged.
- **Checks:** `git diff --check`; `npm run build`, line-engineering tests
- **Status:** PENDING

#### CIDE-023 — CAD copilot confirm-before-write for one mutating intent
- **Epic:** CAD Copilot
- **Objective:** Gate one CAD-modifying intent behind explicit user confirmation.
- **Probable files:** `apps/api/src/modules/line-engineering/cad-intent.service.ts`, `apps/web/src/components/line-engineering/cad-intent.ts`
- **Acceptance criteria:** Write only occurs after confirm; cancel leaves state untouched.
- **Checks:** `git diff --check`; `npm run build`, line-engineering tests
- **Status:** PENDING

#### CIDE-024 — CAD copilot intent audit to ledger
- **Epic:** CAD Copilot
- **Objective:** Audit each CAD intent execution to the event ledger.
- **Probable files:** `apps/api/src/modules/line-engineering/cad-intent.service.ts`, `apps/api/src/modules/event-ledger`
- **Acceptance criteria:** Every intent run writes one ledger entry with actor and intent.
- **Checks:** `git diff --check`; `npm run build`, line-engineering + event-ledger tests
- **Status:** PENDING

### Office Copilot

#### CIDE-025 — Office copilot scaffold reusing CAD pattern
- **Epic:** Office Copilot
- **Objective:** Add an office intent module mirroring the CAD copilot structure (no parallel screen).
- **Probable files:** `apps/api/src/modules/ai/ai-tools.service.ts`, `apps/web/src/components/chat`
- **Acceptance criteria:** Module mirrors CAD intent shape; reuses chat widget for UI.
- **Checks:** `git diff --check`; `npm run build`, ai module tests
- **Status:** PENDING

#### CIDE-026 — Office copilot summarize-document action
- **Epic:** Office Copilot
- **Objective:** Add one read-only action that summarizes a selected document.
- **Probable files:** `apps/api/src/modules/ai/ai-tools.service.ts`, `apps/web/src/components/chat`
- **Acceptance criteria:** Summary returns for a valid doc; missing doc yields a clean error.
- **Checks:** `git diff --check`; `npm run build`, ai module tests
- **Status:** PENDING

#### CIDE-027 — Office copilot RBAC + ledger audit
- **Epic:** Office Copilot
- **Objective:** Enforce RBAC and audit each office copilot action to the ledger.
- **Probable files:** `apps/api/src/modules/ai/ai-tools.service.ts`, `apps/api/src/modules/event-ledger`, `apps/api/src/modules/governance`
- **Acceptance criteria:** Unauthorized action blocked; authorized action writes one ledger entry.
- **Checks:** `git diff --check`; `npm run build`, ai + governance tests
- **Status:** PENDING

### MES Copilot

#### CIDE-028 — MES copilot read-only status action
- **Epic:** MES Copilot
- **Objective:** Add one action that returns current status of a work order or line.
- **Probable files:** `apps/api/src/modules/ai/ai-tools.service.ts`, `apps/web/src/components/chat`
- **Acceptance criteria:** Status returns tenant-scoped data; unknown id handled gracefully.
- **Checks:** `git diff --check`; `npm run build`, ai module tests
- **Status:** PENDING

#### CIDE-029 — MES copilot mutating action with confirm/undo
- **Epic:** MES Copilot
- **Objective:** Add one shop-floor mutation (e.g. pause line) requiring confirm with undo.
- **Probable files:** `apps/api/src/modules/ai/ai-tools.service.ts`, `apps/api/src/modules/event-ledger`
- **Acceptance criteria:** Mutation runs only after confirm and is reversible; both states audited.
- **Checks:** `git diff --check`; `npm run build`, ai + event-ledger tests
- **Status:** PENDING

#### CIDE-030 — MES copilot RBAC gate
- **Epic:** MES Copilot
- **Objective:** Require an MES-operator permission for MES copilot actions.
- **Probable files:** `apps/api/src/modules/ai/ai-tools.service.ts`, `apps/api/src/modules/governance`
- **Acceptance criteria:** Non-operator blocked; operator allowed; test proves both paths.
- **Checks:** `git diff --check`; `npm run build`, ai + governance tests
- **Status:** PENDING

### ERP Copilot

#### CIDE-031 — ERP copilot read-only order lookup
- **Epic:** ERP Copilot
- **Objective:** Add one action that looks up an order or inventory item by id.
- **Probable files:** `apps/api/src/modules/ai/ai-tools.service.ts`, `apps/web/src/components/chat`
- **Acceptance criteria:** Lookup returns tenant-scoped record; missing id returns clean message.
- **Checks:** `git diff --check`; `npm run build`, ai module tests
- **Status:** PENDING

#### CIDE-032 — ERP copilot create-draft action with confirm
- **Epic:** ERP Copilot
- **Objective:** Add one action that drafts (not commits) an order, requiring confirmation to persist.
- **Probable files:** `apps/api/src/modules/ai/ai-tools.service.ts`, `apps/api/src/modules/event-ledger`
- **Acceptance criteria:** Draft persists only after confirm; transactional write with rollback on failure.
- **Checks:** `git diff --check`; `npm run build`, ai + event-ledger tests
- **Status:** PENDING

#### CIDE-033 — ERP copilot RBAC + audit
- **Epic:** ERP Copilot
- **Objective:** Enforce finance/ERP permission and audit each ERP action to the ledger.
- **Probable files:** `apps/api/src/modules/ai/ai-tools.service.ts`, `apps/api/src/modules/governance`, `apps/api/src/modules/event-ledger`
- **Acceptance criteria:** Unauthorized blocked; authorized action writes one audited ledger entry.
- **Checks:** `git diff --check`; `npm run build`, ai + governance tests
- **Status:** PENDING

### Governance/Safety

#### CIDE-034 — Central confirm-before-write helper
- **Epic:** Governance/Safety
- **Objective:** Add one shared helper that wraps any mutating tool in a confirm step.
- **Probable files:** `apps/api/src/modules/ai/ai-tools.service.ts`, `apps/api/src/modules/governance`
- **Acceptance criteria:** Wrapped tool never writes without confirm token; reused by copilots.
- **Checks:** `git diff --check`; `npm run build`, ai + governance tests
- **Status:** PENDING

#### CIDE-035 — Undo registry for transactional tool writes
- **Epic:** Governance/Safety
- **Objective:** Record an undo handle for each mutating tool call so it can be reversed.
- **Probable files:** `apps/api/src/modules/ai/ai-tools.service.ts`, `apps/api/src/modules/event-ledger`
- **Acceptance criteria:** A completed write can be undone within its window; undo is audited.
- **Checks:** `git diff --check`; `npm run build`, ai + event-ledger tests
- **Status:** PENDING

#### CIDE-036 — Mandatory ledger audit on every tool call
- **Epic:** Governance/Safety
- **Objective:** Ensure all tool dispatch paths write an event-ledger entry, read or write.
- **Probable files:** `apps/api/src/modules/ai/ai-tools.service.ts`, `apps/api/src/modules/event-ledger`
- **Acceptance criteria:** Test proves no dispatch path skips the ledger write.
- **Checks:** `git diff --check`; `npm run build`, ai + event-ledger tests
- **Status:** PENDING

#### CIDE-037 — Per-tenant AI rate limiting
- **Epic:** Governance/Safety
- **Objective:** Apply a per-tenant rate limit to AI tool calls to protect the platform.
- **Probable files:** `apps/api/src/modules/ai/ai.service.ts`, `apps/api/src/modules/governance`
- **Acceptance criteria:** Over-limit calls rejected with a clear message; under-limit unaffected.
- **Checks:** `git diff --check`; `npm run build`, governance tests
- **Status:** PENDING

#### CIDE-038 — Sensitive-field redaction in AI context
- **Epic:** Governance/Safety
- **Objective:** Redact flagged sensitive fields before they enter the model prompt.
- **Probable files:** `apps/api/src/modules/ai/ai.service.ts`, `apps/api/src/modules/governance`
- **Acceptance criteria:** Flagged fields never appear in outbound prompt; test verifies redaction.
- **Checks:** `git diff --check`; `npm run build`, ai + governance tests
- **Status:** PENDING

#### CIDE-039 — Tool permission matrix documentation
- **Epic:** Governance/Safety
- **Objective:** Document which RBAC permission each registered tool requires.
- **Probable files:** `apps/api/src/modules/ai/README.md`, `apps/api/src/modules/governance`
- **Acceptance criteria:** Matrix lists every tool and its required permission; no code change.
- **Checks:** `git diff --check`
- **Status:** PENDING

#### CIDE-040 — Audit query view for AI activity
- **Epic:** Governance/Safety
- **Objective:** Add a read-only view listing recent audited AI tool calls for a tenant.
- **Probable files:** `apps/api/src/modules/event-ledger`, `apps/web/src/components/Cide.tsx`
- **Acceptance criteria:** View shows actor, tool, and timestamp, tenant-scoped; reuses existing UI.
- **Checks:** `git diff --check`; `npm run build`, event-ledger tests
- **Status:** PENDING
