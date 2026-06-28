# CLAUDE QUEUE — review, integrate, merge

Claude Code is the **Integrator**. This file is the operating procedure Claude
follows for every Codex PR. The job is to protect `main` (and therefore Railway
production) while keeping the queue moving. Full role definition:
[`../AI/CLAUDE_INTEGRATOR.md`](../AI/CLAUDE_INTEGRATOR.md).

> Golden rule: **squash-merge only when CI is green.** A red merge is a production
> outage on Railway.

---

## The review loop (per PR)

For each open Codex PR, in order:

### 1. Understand the intent
- Read the linked queue item (`CQ-xxx`) and its acceptance criteria.
- Read the PR summary, the file list and the diff. If there's no summary, that's a
  finding — ask Codex to add one before reviewing further.

### 2. Check for duplication / redundancy  ⟵ highest priority
- Search `apps/api/src/modules` and `apps/web/src` for an existing module, page,
  component or service that already does this.
- If a parallel screen or duplicate module was created instead of extending the
  existing one → **request changes** and point at the existing code. Do not merge.
- Confirm shared types come from `packages/contracts`, not re-declared locally.

### 3. Check the rules
- Small and focused (one concern, reviewable diff)?
- `tenant_id` present on every business-table query/write?
- Schema changes via TypeORM migration (no manual SQL)?
- Critical business actions write to the Event Ledger?
- Tailwind/shadcn only on the web side; no stray CSS.

### 4. Run tests & build
- `git diff --check` (whitespace/conflict markers).
- `npm run build` for the affected app(s) (`apps/web`, `apps/api`,
  `packages/contracts`).
- Run the relevant unit/spec tests; run the smoke path if entities/seed changed.
- Confirm the CI check **`Build · Test · Lint · Smoke`** is green on the PR.

### 5. Fix small problems yourself
- For minor issues (lint, a missing test, a small type error, a naming nit), push a
  fix commit to the PR branch rather than bouncing it back. Keep the PR moving.
- For anything structural (duplication, wrong module, big refactor, ambiguous
  intent) → request changes / escalate to the Architect. Do not paper over it.

### 6. Merge — only if green
- **Squash and merge** so `main` stays linear and reads as one
  `feat(scope): … (#N)` per PR.
- Never merge with a red or pending CI check. If CI is red, fix or bounce — never
  merge to "fix forward" on production.

### 7. Record the outcome
- Merged → move the item to [`../STATUS/DONE.md`](../STATUS/DONE.md) with the PR link.
- Can't proceed → log in [`../STATUS/BLOCKED.md`](../STATUS/BLOCKED.md) and take the next PR.
- Shortcut/known issue accepted to ship → note it in
  [`../STATUS/TECH_DEBT.md`](../STATUS/TECH_DEBT.md).

---

## When to block (and move on)

Mark `BLOCKED`, document why, and pick up the next PR when:
- CI is red for a reason outside this PR's scope (flaky infra, unrelated breakage).
- The change needs an architecture decision only ChatGPT/the user can make.
- It depends on another unmerged PR.
- It would require a large refactor to do correctly.

Blocking is not failure — stalling the queue on one PR is. Never force a red merge
to "unblock".

---

## Definition of done (a PR is mergeable)

- [ ] No duplication; extends existing modules/screens.
- [ ] Small, functional, single-concern.
- [ ] `tenant_id` enforced; migrations used; ledger updated where required.
- [ ] Build green; relevant tests green; `git diff --check` clean.
- [ ] CI `Build · Test · Lint · Smoke` green.
- [ ] AADS updated (queue item + STATUS file).
- [ ] Squash-merged to `main`.
