# CIDE — Cognitive Intelligence & Decision Engine

CIDE is **Axos OS's own AI** — the in-app data analyst for an EMS. It runs on a
**self-hosted, open-weight model** served through an **OpenAI-compatible**
endpoint (Ollama, vLLM, llama.cpp, TGI) that you control. There is **no external
AI vendor** in the loop — no Anthropic, no DeepSeek, no OpenAI cloud — so the
whole conversation and all business data stay inside your own infrastructure.

It is a **grounded** analyst: it answers from the real MES + ERP data via
read-only *tools*, filtered by the caller's RBAC permissions and scoped to their
tenant — it can never read data the user couldn't read in the UI. Beyond simple
lookups, CIDE can chain tools to analyze causes and trends (e.g. the immutable
**Event Ledger** via `operations_pulse` / `ledger_trace`) and propose decisions.

## Why self-hosted

- **Data sovereignty** — prompts and grounded data never leave your servers.
- **No per-token billing** — inference cost is your own compute; cost metering is
  retained as a capacity signal, not an invoice.
- **Portable** — the engine is just a URL. Dev on CPU Ollama, scale to a GPU
  vLLM cluster in prod by changing `CIDE_BASE_URL`. No code change.

## Models

Default models are **Apache-2.0** licensed (permissive, per
`THIRD_PARTY_NOTICES.md`). Pick per hardware in **/dashboard/admin/ai**:

| Tag | License | Notes |
|---|---|---|
| `qwen2.5:7b` (default) | Apache-2.0 | Runs on CPU or a small GPU. Strong tool-use + Spanish. |
| `qwen2.5:14b` | Apache-2.0 | Stronger reasoning, needs a GPU. |
| `qwen2.5:32b` (escalation) | Apache-2.0 | Heavy reasoning, GPU. |
| `mistral:7b` | Apache-2.0 | Lightweight alternative. |

## Running the engine

The simplest engine is **Ollama**, which exposes the OpenAI-compatible API at
`http://localhost:11434/v1`. A ready-to-run compose file lives at
[`infra/cide/docker-compose.yml`](../../../../../infra/cide/docker-compose.yml):

```bash
# from repo root
docker compose -f infra/cide/docker-compose.yml up -d   # starts Ollama
docker exec -it cide-ollama ollama pull qwen2.5:7b        # pull the model once
```

Then point the API at it (defaults already match local Ollama):

```bash
CIDE_BASE_URL=http://localhost:11434/v1
# CIDE_API_KEY=    # only if your engine requires a bearer token
```

## Environment variables (backend)

| Var | Required | Purpose |
|---|---|---|
| `CIDE_BASE_URL` | optional | OpenAI-compatible engine URL. Default `http://localhost:11434/v1` (local Ollama). |
| `CIDE_API_KEY` | optional | Bearer token if your engine requires one (local Ollama does not). |
| `AI_MAX_OUTPUT_TOKENS` | optional | Output-token cap per turn (default 700). |
| `AI_DEFAULT_MONTHLY_BUDGET_TOKENS` | optional | Default monthly **usage guardrail** for new tenants (default `1000000`). |
| `AI_MOCK` | optional | `1` → demo mode: runs the real grounding tools but returns a canned reply without calling the engine. Lets the UI be tried before the engine is up. |

No credentials live in the repo. Model weights are **pulled by the engine at
deploy time**, never committed to git.

## Endpoints (all under `/api/ai`, JWT-guarded)

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/chat` | any user | One CIDE turn `{ message, conversationId?, model? }` → `{ reply, conversationId, toolsUsed, usage, model, mock }` |
| GET | `/conversations` | any user | The caller's threads |
| GET | `/conversations/:id` | owner/admin | Thread + messages |
| GET | `/config` | admin | Per-tenant config + engine status |
| POST | `/config` | admin | Update `{ enabled?, defaultModel?, escalationModel?, monthlyTokenBudget?, rateLimitPerHour? }` |
| GET | `/usage` | admin | Token totals, by-model breakdown, recent rows |

## Safety / limits

- Tools are RBAC-filtered before being offered to the model **and** re-checked
  on execution. All grounding tools are **read-only**.
- Per-user hourly rate limit (`rateLimitPerHour`).
- Monthly token **usage guardrail** → HTTP 429 when exhausted.
- Agentic tool loop is bounded (`MAX_TOOL_ROUNDS` / `MAX_TOTAL_ROUNDS`) to
  prevent runaway calls.
