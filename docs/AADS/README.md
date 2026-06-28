# AADS — AXOS Autonomous Development System

> The technical PMO that lives inside the repo. It coordinates **ChatGPT**, **Codex**
> and **Claude Code** to build AXOS OS through small, green, non-redundant PRs.

AADS is **not a product feature**. It is the operating system *for building* AXOS OS:
the documents, queues and roles that turn three AI agents into a disciplined
engineering team working against a single source of truth.

---

## 1. Why AADS exists

AXOS OS is already a **large, advanced** application — a multi-tenant Industrial OS
(ERP + MES + Office + CAD + AI) built as a Turborepo modular monolith
(`apps/web` Next.js, `apps/api` NestJS, `packages/contracts`). It has 90+ backend
modules and 80+ dashboard routes already in production.

That scale is exactly the problem AADS solves. Without coordination, AI agents:

- re-create modules that already exist (a new "operator screen" when
  `operator-terminal` is already shipped),
- write parallel pages instead of extending the live one,
- open giant PRs that can't be reviewed or that break `main`,
- and merge red builds straight into production.

AADS replaces isolated prompts with a **shared backlog, shared rules and explicit
roles** so every change is small, inspected-before-built, and safe to ship.

---

## 2. The three agents (and GitHub)

| Actor | Role | Acts like | Outputs |
|-------|------|-----------|---------|
| **ChatGPT** | **Architect / CTO** | Decides *what* and *why* | Programs, priorities, master prompts, redundancy calls |
| **Codex** | **Builder** | Produces *the code* | Small PRs with summary, tests, file list |
| **Claude Code** | **Integrator** | Guards *the merge* | Reviews, fixes, squash-merges green PRs, protects `main` |
| **GitHub** | **Source of truth** | The system of record | PRs, CI status, history, merge state |
| **Railway** | **Production** | The deploy target | Every merge to `main` ships live |

### ChatGPT — Architect / CTO
Defines architecture, creates and prioritizes programs, writes master prompts for
Codex, reviews summaries, detects redundancy, and decides the next block of work.
See [`AI/CHATGPT_ARCHITECT.md`](AI/CHATGPT_ARCHITECT.md).

### Codex — Builder
Inspects the codebase *before* writing anything, never duplicates a module,
produces small functional PRs, updates AADS docs, and leaves a summary + tests +
file list. If it can't finish or can't go green, it stops and reports — it does not
force a merge. See [`AI/CODEX_BUILDER.md`](AI/CODEX_BUILDER.md).

### Claude Code — Integrator
Reviews Codex PRs, rejects redundant code, runs tests, fixes failures, and
**squash-merges only when CI is green**. It protects `main` and therefore Railway.
See [`AI/CLAUDE_INTEGRATOR.md`](AI/CLAUDE_INTEGRATOR.md).

### GitHub — single source of truth
The backlog, the rules and the status files live in the repo, but the **live state**
of any change is GitHub: the PR, its CI check, its review, its merge. If it isn't on
GitHub, it didn't happen.

### Railway — production
`main` deploys to Railway automatically. There is no staging gate between merge and
production. **This is why we never merge in red** — a red merge is a production
outage.

---

## 3. How a unit of work flows

```text
ChatGPT (Architect)
   │  defines program + priority, writes a queue item
   ▼
QUEUES/CODEX_QUEUE.md  ──►  Codex (Builder)
   │                          inspects → builds small PR → summary/tests/files
   ▼
GitHub PR  ──►  Claude Code (Integrator)
   │             review → no duplication? → tests green? → fix if needed
   ▼
CI green ──► squash merge ──► main ──► Railway (production)
   │
   └─ if blocked → STATUS/BLOCKED.md, take next item
   └─ when shipped → STATUS/DONE.md
```

---

## 4. Directory map

```text
docs/AADS/
  README.md                       ← you are here
  MASTER_ENGINEERING_ROADMAP.md   ← the 8 programs, status, risks, next PRs
  PROGRAMS/                       ← per-program backlogs of small PRs
    OFFICE.md  CAD.md  MES.md  ERP.md  CRM.md
    AI_CIDE.md  ANALYTICS.md  PLATFORM.md
  QUEUES/
    CODEX_QUEUE.md                ← what Codex builds next (PENDING/…)
    CLAUDE_QUEUE.md               ← how Claude reviews & merges
  WORK_PACKETS/                   ← parallel-safe execution layer (AADS v2)
    README.md  _TEMPLATE.md  WP-*.md
  STATUS/
    DONE.md  BLOCKED.md  TECH_DEBT.md
  AI/
    CHATGPT_ARCHITECT.md  CODEX_BUILDER.md  CLAUDE_INTEGRATOR.md
```

---

## 5. Critical rules (non-negotiable)

1. **AXOS already exists and is advanced.** Never assume something isn't there.
2. **Inspect before you create.** Search `apps/api/src/modules` and
   `apps/web/src` (and `packages/contracts`) first.
3. **No duplicate modules.** Extend the existing one.
4. **No parallel screens.** If a page exists, improve it — don't fork it.
5. **Every PR is small, functional and green.**
6. **`main` deploys to Railway.** Never merge in red.
7. **Blocked → mark `BLOCKED`, take the next item.** Don't stall the queue.

These rules are enforced by the role docs in `AI/` and the review checklist in
`QUEUES/CLAUDE_QUEUE.md`.

---

## 6. House conventions (inherited from the repo)

- **Stack:** Next.js (App Router) + React + TS + Tailwind/shadcn (`apps/web`);
  NestJS + TypeORM + PostgreSQL (`apps/api`); shared DTOs in `packages/contracts`.
- **Multi-tenancy:** mandatory `tenant_id` on every business table.
- **Migrations:** all schema changes via TypeORM migrations — no manual SQL.
- **Audit:** critical business actions write to the **Event Ledger**.
- **Commits:** Conventional Commits; **squash & merge** to keep `main` linear.
- **CI gate:** `Build · Test · Lint · Smoke` must be green before merge.

See [`/AGENTS.md`](../../AGENTS.md) and
[`/AXOS_OS_ARCHITECTURE.md`](../../AXOS_OS_ARCHITECTURE.md) for the full house rules.
