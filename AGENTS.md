# AXOS OS - Rules for AI Agents

You are part of the AXOS OS Engineering Team. This project is an Industrial OS (ERP + MES) designed as a high-fidelity, multi-tenant SaaS.

## 1. Core Principles
- **Aesthetic**: Premium, minimalist, white-label / Modern Industrial.
- **Architecture**: Modular Monolith (Monorepo) using Turborepo.
- **Frontend**: Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui.
- **Backend**: NestJS, TypeScript, TypeORM, PostgreSQL.
- **Multi-tenancy**: Mandatory `tenant_id` on all business-critical tables.

## 2. Agent Roles
- **Antigravity (Gemini)**: Architect & Orchestrator. Lead on UI/UX and Data Modeling (TypeORM).
- **Claude Code**: Backend Refactoring, Migrations, Infrastructure, and Terminal-heavy tasks.
- **Codex / Copilot**: Local code assistance, autocompletion, and granular logic implementation.

## 3. Strict Rules
- **No Duplication**: Check existing modules in `apps/api/src/modules` and `apps/web/src/components` before creating new ones.
- **Type Safety**: Use shared types/DTOs from `packages/contracts` (once established).
- **Styling**: ONLY use Tailwind CSS. No custom CSS files unless strictly necessary for animations (Framer Motion preferred).
- **Components**: Use shadcn/ui primitives. Customize them to fit the AXOS Premium look.
- **Data Integrity**: Every database change MUST be done via TypeORM migrations. No manual SQL unless authorized.
- **Documentation**: Update `/docs` if you change architecture or domain logic.
- **Audit Logs**: Any critical business action must be logged.

## 4. Workflow
1. Read the relevant document in `/docs` before starting a task.
2. If unsure about a design decision, ask the User to consult Antigravity.
3. Commit often with descriptive messages (Conventional Commits preferred).

## 5. Git & PR Workflow (commit verification + merge method)
- **Commit identity**: configure git as `Claude <noreply@anthropic.com>` at the
  start of every session (`git config user.email noreply@anthropic.com && git
  config user.name Claude`) so authored commits are attributable/verified.
- **Branch → PR → squash**: develop on the assigned feature branch, open a PR to
  `main`, and **merge with "Squash and merge"** (repo convention — history reads
  as one `feat(scope): … (#N)` commit per PR). Keep `main` linear.
  - GitHub creates the squash commit, so its *committer* shows as GitHub
    (`noreply@github.com`) and may read as "Unverified". That is expected for
    server-side merges and is NOT a commit to rewrite (it is already on `main`).
    To get verified merge commits, enable commit signing at the
    repo/account level in GitHub settings (owner action, not an in-repo change).
  - Recommended GitHub repo setting: **default merge method = Squash** (and
    disable merge-commit/rebase) so every PR merges consistently.
- **Green before merge**: the CI check `Build · Test · Lint · Smoke` must pass
  before merging. **Every merge to `main` deploys to production** — never merge
  red. Verify locally (`tsc`, `nest build`, `next build`; run the demo seed
  against a local Postgres when touching entities/seed) before pushing.

## 6. Codex — Anti-Redundancy Rules (READ FIRST)

Codex is the high-throughput implementer on this team. To keep velocity without
piling up redundant work, every Codex task MUST follow these rules. They exist
because the most common review failures have been redundancy, not bugs.

1. **Always branch from the LATEST `main`, never regenerate from an old base.**
   Before starting, run `git fetch origin && git rebase origin/main` (or branch
   fresh off `origin/main`). Regenerating a task from a stale base reintroduces
   code that was already removed and creates **duplicate migrations** and
   superset conflicts that have to be resolved by hand. If a task is being
   re-run, rebase it — do not replay the old diff.

2. **One system per concern — extend, don't duplicate.** Before adding a
   service/module/table, search `apps/api/src/modules` and
   `apps/web/src/components` for an existing one and extend it. Concrete open
   example: Office has **two parallel comment systems** (`office_document_comments`
   for Docs and `office_comments` for Slides). New comment work must converge on
   a **single** generic anchored-comment model, not add a third path.

3. **Wire what you build into the UI — no barrel-only features.** Several CAD
   modules (measurements, collisions, flow-optimization, safety-zones,
   dxf-export, annotations, validation-report) exist and are tested but are only
   re-exported from `apps/web/src/lib/cad/index.ts` and never mounted in the
   editor. A feature is not "done" until it is reachable by a user. Prefer
   finishing/wiring an existing module over starting a new one.

4. **Migrations: unique timestamps, no duplicates.** Every TypeORM migration
   needs a unique `YYYYMMDDHHMMSS` prefix. Before adding one, list
   `apps/api/src/migrations` and confirm no migration already creates that table
   — duplicate `CREATE TABLE` migrations have repeatedly collided. When in doubt,
   bump the timestamp and make the migration idempotent (`IF NOT EXISTS`).

5. **Don't reintroduce removed code.** If `main` deleted or refactored something
   (e.g. a local theme replaced by the global theme, a kiosk flag generalized to
   `useRouteChrome`/`hideFloatingWidgets`), keep the new shape. Rebasing (rule 1)
   prevents most of this; when a conflict appears, take `main`'s direction and
   re-apply your *new* feature on top, never the other way around.

