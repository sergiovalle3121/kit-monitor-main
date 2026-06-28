# PLATFORM — Program Backlog

The PLATFORM program owns the cross-cutting foundation that every other AXOS module depends on: authentication and RBAC, multi-tenancy, search, notifications, audit/event-ledger, settings, API standards, CI/CD, performance, and observability. Its objective is to keep this shared substrate consistent, safe, and incremental — small functional PRs that strengthen what already exists rather than forking new variants of it.

> Before touching anything here, INSPECT the existing platform code first: `apps/api/src/modules/{auth,users,event-ledger,notifications,numbering,governance,import-data}`, `apps/web/src/middleware.ts`, and `apps/web/src/components/{WorkspaceGuard.tsx,SearchPalette.tsx,TCodePalette.tsx,searchSources.ts,WorkspaceSwitcher.tsx}`. AXOS already exists — never create a parallel screen, never duplicate a guard, centralize instead of forking.
>
> **Blast-radius warning:** Any change to tenant isolation or auth has system-wide reach. A missing `tenant_id` filter or a broadened guard is the highest-severity bug class. Every business table carries a mandatory `tenant_id`; every schema change goes through a TypeORM migration; `main` deploys to Railway, so never merge red.

## Epics

1. **Auth/RBAC** — authentication, sessions, roles, permissions, guards.
2. **Multi-tenancy** — `tenant_id` enforcement, isolation, workspace context.
3. **Search** — palette sources, T-Code navigation, query consistency.
4. **Notifications** — delivery, preferences, read state.
5. **Audit/Event Ledger** — immutable event capture and query.
6. **Settings** — tenant and user configuration surfaces.
7. **API Standards** — DTO contracts, pagination, error shape, validation.
8. **CI/CD** — pipeline checks, smoke, Railway deploy path.
9. **Performance** — indexes, query budgets, caching.
10. **Observability** — logging, metrics, tracing, health.

## Backlog

### Auth/RBAC

#### PLT-001 — Centralize permission constants
- **Epic:** Auth/RBAC
- **Objective:** Extract scattered permission string literals into one shared enum in `packages/contracts`.
- **Probable files:** `packages/contracts/src/auth/permissions.ts`, `apps/api/src/modules/auth`
- **Acceptance criteria:** All auth guards import permission names from the contracts enum; no remaining string-literal permission checks in `auth` module.
- **Checks:** `git diff --check`; `npm run build`, auth module tests
- **Status:** PENDING

#### PLT-002 — Add a reusable RolesGuard decorator
- **Epic:** Auth/RBAC
- **Objective:** Provide a single `@RequirePermission()` decorator that wraps the existing guard, replacing ad-hoc role checks in controllers.
- **Probable files:** `apps/api/src/modules/auth`
- **Acceptance criteria:** Decorator resolves required permission from metadata and denies with 403 when absent; one existing controller migrated as proof.
- **Checks:** `git diff --check`; `npm run build`, auth guard tests
- **Status:** PENDING

#### PLT-003 — Session expiry refresh helper
- **Epic:** Auth/RBAC
- **Objective:** Add one helper to recompute session expiry on activity without changing token issuance flow.
- **Probable files:** `apps/api/src/modules/auth`
- **Acceptance criteria:** Helper extends expiry only for valid sessions; expired sessions remain rejected.
- **Checks:** `git diff --check`; `npm run build`, auth tests
- **Status:** PENDING

#### PLT-004 — Deny-by-default guard audit test
- **Epic:** Auth/RBAC
- **Objective:** Add a test asserting that controllers without an explicit permission decorator are rejected, not allowed.
- **Probable files:** `apps/api/src/modules/auth`
- **Acceptance criteria:** Test fails if a route is reachable without a permission decorator on a protected controller.
- **Checks:** `git diff --check`; `npm run build`, auth tests
- **Status:** PENDING

#### PLT-005 — Normalize 401 vs 403 responses
- **Epic:** Auth/RBAC
- **Objective:** Ensure unauthenticated requests return 401 and unauthorized-but-authenticated return 403 consistently.
- **Probable files:** `apps/api/src/modules/auth`
- **Acceptance criteria:** Both cases covered by tests returning the correct status and standard error shape.
- **Checks:** `git diff --check`; `npm run build`, auth tests
- **Status:** PENDING

#### PLT-006 — Current-user helper for web
- **Epic:** Auth/RBAC
- **Objective:** Add one typed hook/helper to read the current user/permissions on the web side, reusing existing session source.
- **Probable files:** `apps/web/src/middleware.ts`, `apps/web/src/components/WorkspaceGuard.tsx`
- **Acceptance criteria:** Helper returns user + permissions; no new auth fetch path introduced.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

### Multi-tenancy

#### PLT-007 — Tenant-scoped repository helper
- **Epic:** Multi-tenancy
- **Objective:** Provide one helper that injects `tenant_id` into every query builder so callers cannot forget it.
- **Probable files:** `apps/api/src/modules/users`, `apps/api/src/modules/event-ledger`
- **Acceptance criteria:** Helper throws when invoked without a tenant context; one module migrated to use it.
- **Checks:** `git diff --check`; `npm run build`, tenant isolation tests
- **Status:** PENDING

#### PLT-008 — Tenant isolation regression test fixture
- **Epic:** Multi-tenancy
- **Objective:** Add a shared two-tenant fixture and a test proving tenant A cannot read tenant B rows.
- **Probable files:** `apps/api/src/modules/users`
- **Acceptance criteria:** Cross-tenant read returns empty/forbidden; test fails on any leak.
- **Checks:** `git diff --check`; `npm run build`, isolation tests
- **Status:** PENDING

#### PLT-009 — Guard against null tenant_id on write
- **Epic:** Multi-tenancy
- **Objective:** Reject inserts that lack a resolved `tenant_id` at the service boundary.
- **Probable files:** `apps/api/src/modules/users`, `apps/api/src/modules/event-ledger`
- **Acceptance criteria:** Write without tenant context throws before reaching the DB; covered by a test.
- **Checks:** `git diff --check`; `npm run build`, tests
- **Status:** PENDING

#### PLT-010 — Add tenant_id index migration audit
- **Epic:** Multi-tenancy
- **Objective:** Add a migration ensuring `tenant_id` is indexed on one high-traffic table currently missing it.
- **Probable files:** `apps/api/src/migrations`, `apps/api/src/modules/event-ledger`
- **Acceptance criteria:** Migration creates the index idempotently; up/down both run cleanly.
- **Checks:** `git diff --check`; `npm run build`, migration run
- **Status:** PENDING

#### PLT-011 — Tenant context propagation in WorkspaceGuard
- **Epic:** Multi-tenancy
- **Objective:** Ensure the active workspace tenant is the only source of tenant context on the web, removing any duplicate reads.
- **Probable files:** `apps/web/src/components/WorkspaceGuard.tsx`, `apps/web/src/components/WorkspaceSwitcher.tsx`
- **Acceptance criteria:** Switching workspace updates tenant context everywhere; no stale tenant in child components.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

#### PLT-012 — Reject cross-tenant id in path params
- **Epic:** Multi-tenancy
- **Objective:** Add a guard that 404s when a requested resource id belongs to a different tenant.
- **Probable files:** `apps/api/src/modules/users`
- **Acceptance criteria:** Resource from another tenant returns 404, not 200/403; covered by a test.
- **Checks:** `git diff --check`; `npm run build`, isolation tests
- **Status:** PENDING

### Search

#### PLT-013 — Register a new source via searchSources
- **Epic:** Search
- **Objective:** Add one entry to the central `searchSources` registry instead of creating a new palette component.
- **Probable files:** `apps/web/src/components/searchSources.ts`, `apps/web/src/components/SearchPalette.tsx`
- **Acceptance criteria:** New source appears in the existing palette; no parallel palette created.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

#### PLT-014 — Tenant-scope search results
- **Epic:** Search
- **Objective:** Ensure every search source query carries the active tenant filter.
- **Probable files:** `apps/web/src/components/searchSources.ts`
- **Acceptance criteria:** No source returns results outside the active tenant; verified for at least two sources.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

#### PLT-015 — Debounce palette input
- **Epic:** Search
- **Objective:** Add a small debounce to SearchPalette query input to cut redundant fetches.
- **Probable files:** `apps/web/src/components/SearchPalette.tsx`
- **Acceptance criteria:** Rapid typing issues a single trailing query; behavior unchanged otherwise.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

#### PLT-016 — T-Code alias consolidation
- **Epic:** Search
- **Objective:** Move duplicated T-Code aliases into the shared source list used by TCodePalette.
- **Probable files:** `apps/web/src/components/TCodePalette.tsx`, `apps/web/src/components/searchSources.ts`
- **Acceptance criteria:** Aliases defined once; TCodePalette reads from the shared registry.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

#### PLT-017 — Empty/no-results state for palette
- **Epic:** Search
- **Objective:** Add a consistent empty-state row to SearchPalette when a query returns nothing.
- **Probable files:** `apps/web/src/components/SearchPalette.tsx`
- **Acceptance criteria:** Empty query result shows the shared empty state; non-empty unaffected.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

### Notifications

#### PLT-018 — Mark-as-read endpoint
- **Epic:** Notifications
- **Objective:** Add one endpoint to mark a single notification read, scoped to the owning tenant/user.
- **Probable files:** `apps/api/src/modules/notifications`
- **Acceptance criteria:** Only the owner's notification can be marked read; cross-user attempt 404s.
- **Checks:** `git diff --check`; `npm run build`, notifications tests
- **Status:** PENDING

#### PLT-019 — Unread count helper
- **Epic:** Notifications
- **Objective:** Add a tenant/user-scoped unread count helper reusing the existing repository.
- **Probable files:** `apps/api/src/modules/notifications`
- **Acceptance criteria:** Count reflects only the current user's unread items; covered by a test.
- **Checks:** `git diff --check`; `npm run build`, tests
- **Status:** PENDING

#### PLT-020 — Notification preference flag
- **Epic:** Notifications
- **Objective:** Add one boolean preference (e.g. mute category) stored against the user, no new settings screen.
- **Probable files:** `apps/api/src/modules/notifications`, `apps/api/src/migrations`
- **Acceptance criteria:** Muted category suppresses delivery; migration up/down clean.
- **Checks:** `git diff --check`; `npm run build`, tests
- **Status:** PENDING

#### PLT-021 — Bulk mark-all-read
- **Epic:** Notifications
- **Objective:** Add a scoped mark-all-read action reusing existing read logic.
- **Probable files:** `apps/api/src/modules/notifications`
- **Acceptance criteria:** Only current user's notifications affected; no cross-tenant write.
- **Checks:** `git diff --check`; `npm run build`, tests
- **Status:** PENDING

### Audit/Event Ledger

#### PLT-022 — Standard event emit helper
- **Epic:** Audit/Event Ledger
- **Objective:** Provide one helper to append ledger events with tenant/user/correlation fields populated consistently.
- **Probable files:** `apps/api/src/modules/event-ledger`
- **Acceptance criteria:** Helper requires tenant context and rejects without it; one caller migrated.
- **Checks:** `git diff --check`; `npm run build`, event-ledger tests
- **Status:** PENDING

#### PLT-023 — Ledger immutability test
- **Epic:** Audit/Event Ledger
- **Objective:** Add a test asserting ledger rows cannot be updated or deleted through the service.
- **Probable files:** `apps/api/src/modules/event-ledger`
- **Acceptance criteria:** Update/delete paths are absent or throw; test enforces append-only.
- **Checks:** `git diff --check`; `npm run build`, tests
- **Status:** PENDING

#### PLT-024 — Tenant-scoped ledger query
- **Epic:** Audit/Event Ledger
- **Objective:** Ensure the ledger read API always filters by tenant and paginates.
- **Probable files:** `apps/api/src/modules/event-ledger`
- **Acceptance criteria:** Query returns only current tenant events with pagination; cross-tenant leak test passes.
- **Checks:** `git diff --check`; `npm run build`, isolation tests
- **Status:** PENDING

#### PLT-025 — Correlation id passthrough
- **Epic:** Audit/Event Ledger
- **Objective:** Carry an incoming request correlation id into emitted ledger events.
- **Probable files:** `apps/api/src/modules/event-ledger`
- **Acceptance criteria:** Emitted event records the request correlation id when present; covered by a test.
- **Checks:** `git diff --check`; `npm run build`, tests
- **Status:** PENDING

### Settings

#### PLT-026 — Typed tenant settings accessor
- **Epic:** Settings
- **Objective:** Add one typed getter for a tenant setting reusing the existing governance/config storage.
- **Probable files:** `apps/api/src/modules/governance`
- **Acceptance criteria:** Getter returns tenant-scoped value with a typed default; no new table.
- **Checks:** `git diff --check`; `npm run build`, tests
- **Status:** PENDING

#### PLT-027 — User preference read endpoint
- **Epic:** Settings
- **Objective:** Add a single endpoint returning the current user's preferences, scoped to user/tenant.
- **Probable files:** `apps/api/src/modules/users`
- **Acceptance criteria:** Endpoint returns only the caller's preferences; covered by a test.
- **Checks:** `git diff --check`; `npm run build`, tests
- **Status:** PENDING

#### PLT-028 — Numbering format setting wiring
- **Epic:** Settings
- **Objective:** Expose one existing numbering format option as a tenant setting through the numbering module.
- **Probable files:** `apps/api/src/modules/numbering`, `apps/api/src/modules/governance`
- **Acceptance criteria:** Numbering reads the tenant setting; default preserved when unset.
- **Checks:** `git diff --check`; `npm run build`, numbering tests
- **Status:** PENDING

### API Standards

#### PLT-029 — Shared pagination DTO
- **Epic:** API Standards
- **Objective:** Add one reusable pagination request/response DTO in contracts and adopt it in one endpoint.
- **Probable files:** `packages/contracts/src`, `apps/api/src/modules/event-ledger`
- **Acceptance criteria:** Endpoint returns the standard paginated shape; DTO shared, not duplicated.
- **Checks:** `git diff --check`; `npm run build`, tests
- **Status:** PENDING

#### PLT-030 — Standard error response shape
- **Epic:** API Standards
- **Objective:** Centralize the API error envelope via one exception filter.
- **Probable files:** `apps/api/src`, `packages/contracts/src`
- **Acceptance criteria:** Errors return the shared shape; one module verified by test.
- **Checks:** `git diff --check`; `npm run build`, tests
- **Status:** PENDING

#### PLT-031 — Global validation pipe enforcement
- **Epic:** API Standards
- **Objective:** Ensure DTO validation (whitelist + forbid unknown) is enabled globally and documented.
- **Probable files:** `apps/api/src`
- **Acceptance criteria:** Unknown fields rejected with 400; covered by a test on one DTO.
- **Checks:** `git diff --check`; `npm run build`, tests
- **Status:** PENDING

#### PLT-032 — Contract export consistency
- **Epic:** API Standards
- **Objective:** Ensure new DTOs are exported from the contracts barrel so web/api share one definition.
- **Probable files:** `packages/contracts/src/index.ts`
- **Acceptance criteria:** Targeted DTOs importable from package root; no duplicate local copies remain.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

### CI/CD

#### PLT-033 — Cache node_modules in CI
- **Epic:** CI/CD
- **Objective:** Add dependency caching to the existing workflow without changing the deploy path.
- **Probable files:** `.github/workflows`
- **Acceptance criteria:** `Build · Test · Lint · Smoke` still passes; Railway deploy step unchanged.
- **Checks:** `git diff --check`; CI green on PR
- **Status:** PENDING

#### PLT-034 — Run contracts build before api/web
- **Epic:** CI/CD
- **Objective:** Order the CI build so `packages/contracts` compiles first, preventing stale-type failures.
- **Probable files:** `.github/workflows`
- **Acceptance criteria:** Build job orders contracts ahead of dependents; check stays named `Build · Test · Lint · Smoke`.
- **Checks:** `git diff --check`; CI green on PR
- **Status:** PENDING

#### PLT-035 — Smoke test for health endpoint
- **Epic:** CI/CD
- **Objective:** Extend the existing smoke step to assert the API health endpoint responds 200.
- **Probable files:** `.github/workflows`, `apps/api/src`
- **Acceptance criteria:** Smoke fails if health is non-200; deploy path to Railway untouched.
- **Checks:** `git diff --check`; CI green on PR
- **Status:** PENDING

#### PLT-036 — Migration check in CI
- **Epic:** CI/CD
- **Objective:** Add a CI step that runs pending TypeORM migrations against a throwaway DB.
- **Probable files:** `.github/workflows`, `apps/api/src/migrations`
- **Acceptance criteria:** CI fails on a broken migration; does not run against production or block deploy.
- **Checks:** `git diff --check`; CI green on PR
- **Status:** PENDING

### Performance

#### PLT-037 — Add composite (tenant_id, created_at) index
- **Epic:** Performance
- **Objective:** Add one composite index for a common tenant-scoped time-ordered query via migration.
- **Probable files:** `apps/api/src/migrations`, `apps/api/src/modules/event-ledger`
- **Acceptance criteria:** Index created idempotently; up/down clean; query plan uses it.
- **Checks:** `git diff --check`; `npm run build`, migration run
- **Status:** PENDING

#### PLT-038 — Cap default page size
- **Epic:** Performance
- **Objective:** Enforce a maximum page size on one list endpoint to bound query cost.
- **Probable files:** `apps/api/src/modules/event-ledger`, `packages/contracts/src`
- **Acceptance criteria:** Oversized page size clamps to max; covered by a test.
- **Checks:** `git diff --check`; `npm run build`, tests
- **Status:** PENDING

#### PLT-039 — Select only needed columns in users list
- **Epic:** Performance
- **Objective:** Trim a wide select to required columns on one hot read path.
- **Probable files:** `apps/api/src/modules/users`
- **Acceptance criteria:** Response shape unchanged; query selects fewer columns; test still green.
- **Checks:** `git diff --check`; `npm run build`, tests
- **Status:** PENDING

### Observability

#### PLT-040 — Request correlation id middleware
- **Epic:** Observability
- **Objective:** Add middleware that attaches a correlation id to each request and log line.
- **Probable files:** `apps/api/src`
- **Acceptance criteria:** Every request log carries a correlation id; reused by ledger emit (PLT-025).
- **Checks:** `git diff --check`; `npm run build`, tests
- **Status:** PENDING

#### PLT-041 — Structured logger wrapper
- **Epic:** Observability
- **Objective:** Centralize log formatting (level, tenant, correlation id) in one logger helper.
- **Probable files:** `apps/api/src`
- **Acceptance criteria:** One module logs through the helper; no raw console logging added.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

#### PLT-042 — Health/readiness endpoint
- **Epic:** Observability
- **Objective:** Add a readiness endpoint checking DB connectivity, separate from liveness.
- **Probable files:** `apps/api/src`
- **Acceptance criteria:** Readiness returns 503 when DB is down, 200 when up; used by smoke (PLT-035).
- **Checks:** `git diff --check`; `npm run build`, tests
- **Status:** PENDING

#### PLT-043 — Slow query timing log
- **Epic:** Observability
- **Objective:** Log a warning when a request exceeds a configurable duration threshold.
- **Probable files:** `apps/api/src`
- **Acceptance criteria:** Requests over threshold emit one warning with correlation id; under threshold silent.
- **Checks:** `git diff --check`; `npm run build`, tests
- **Status:** PENDING
