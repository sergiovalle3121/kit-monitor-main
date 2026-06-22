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

