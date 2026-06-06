# Axos AI Copilot

Provider-agnostic AI layer for Axos OS. Today it talks to **Anthropic Claude**;
the design isolates the provider so another (self-hosted Llama/Mistral, etc.)
can be added without touching the rest of the app.

It is a **grounded** assistant: it answers from the real MES + ERP data via
read-only *tools*, filtered by the caller's RBAC permissions and scoped to their
tenant — it can never read data the user couldn't read in the UI.

## Billing model (hybrid)

Per tenant (`ai_tenant_config`):

- **BYO key** — the tenant stores its own Anthropic API key (encrypted,
  AES-256-GCM). It pays its own usage; no budget is enforced. Ideal for
  multi-tenant: each customer covers its own cost (platform cost = $0).
- **Platform key** — when a tenant has no BYO key, the platform key
  (`ANTHROPIC_API_KEY`) is used and the **monthly token budget** caps spend so
  cost can never run away. Default model is the cheap tier (Haiku).

Every turn is metered in `ai_usage_log` (tokens + estimated cost, attributed to
tenant + user) and visible to admins at **/dashboard/admin/ai**.

## Environment variables (backend)

| Var | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | optional | Platform key. Used for any tenant without a BYO key. If unset and no BYO key, chat returns a clear "not configured" error. |
| `AI_KEY_SECRET` | recommended | Secret used to encrypt BYO keys at rest. Falls back to `JWT_SECRET` if unset. |
| `AI_DEFAULT_MONTHLY_BUDGET_TOKENS` | optional | Default monthly token cap for new tenant configs (default `1000000`). |
| `AI_MOCK` | optional | `1` → demo mode: runs the real grounding tools but returns a canned, clearly-labelled reply without calling Anthropic (and without cost). Lets the UI be tried before any key is added. |

No personal credentials live in the repo — keys are provided only via env vars
(platform) or the encrypted per-tenant store (BYO).

## Endpoints (all under `/api/ai`, JWT-guarded)

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/chat` | any user | One copilot turn `{ message, conversationId?, model? }` → `{ reply, conversationId, toolsUsed, usage, costUsd, model, mock }` |
| GET | `/conversations` | any user | The caller's threads |
| GET | `/conversations/:id` | owner/admin | Thread + messages |
| GET | `/config` | admin | Per-tenant config (never returns the key, only last-4) |
| POST | `/config` | admin | Update `{ enabled?, apiKey?, defaultModel?, escalationModel?, monthlyTokenBudget?, rateLimitPerHour? }` (send `apiKey:""` to clear) |
| GET | `/usage` | admin | Token + cost totals, by-model breakdown, recent rows |

## Models & tiering

Default `claude-haiku-4-5` (cheap, <1¢/turn) for routine queries; admins can set
the escalation tier to `claude-opus-4-8` for hard reasoning. Pricing lives in
`ai-pricing.ts` and drives the cost estimates.

## Safety / limits

- Tools are RBAC-filtered before being offered to the model **and** re-checked
  on execution.
- Per-user hourly rate limit (`rateLimitPerHour`).
- Monthly token budget (platform key only) → HTTP 429 when exhausted.
- All grounding tools are **read-only**.
