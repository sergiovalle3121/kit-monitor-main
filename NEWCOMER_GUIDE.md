# Newcomer Guide: AXOS OS

> Onboarding for someone opening this repo for the first time. For the full
> architecture and rationale, read [`AXOS_OS_ARCHITECTURE.md`](AXOS_OS_ARCHITECTURE.md)
> and [`DECISIONS.md`](DECISIONS.md). For the domain map, read [`README.md`](README.md).

## 1) What this project is

AXOS OS is an **ERP + MES for an EMS** (electronics contract manufacturer): a
multi-tenant industrial platform that covers the manufacturing flow end to end —
material master and BOM → routing, MRP, shop-floor execution, quality, logistics
and finance — with an immutable **Event Ledger** as the traceability backbone.

- **Monorepo:** Turborepo + npm workspaces.
- **Backend:** NestJS API in [`apps/api`](apps/api) — TypeORM, JWT, WebSockets.
- **Frontend:** Next.js (App Router) app in [`apps/web`](apps/web) — React +
  TypeScript + Tailwind + shadcn/ui + SWR.
- **Shared:** [`packages/contracts`](packages/contracts) — shared types/contracts.
- **Data:** SQLite by default in local dev; PostgreSQL when `DATABASE_URL` is set.

## 2) Repo layout

```
apps/
  api/   NestJS backend — TypeORM, JWT, ~81 domain modules   → http://localhost:3000  (prefix /api)
  web/   Next.js frontend (App Router), dashboard by domain  → http://localhost:3001
packages/
  contracts/   shared types/contracts
docs/          architecture, blueprint, product vision, cleanup lists, archive/
```

## 3) High-level architecture

### Backend (NestJS) — `apps/api/src`

- App composition / module wiring: `apps/api/src/app.module.ts`
- Bootstrap, config, CORS, security, admin auto-seed: `apps/api/src/main.ts`
- TypeORM / DB strategy (SQLite dev vs Postgres prod): `apps/api/src/orm.options.ts`
- TypeORM CLI datasource (migrations): `apps/api/src/typeorm-cli.datasource.ts`
- Domain modules under `apps/api/src/modules/` — one folder per domain.
- Cross-cutting concerns under `apps/api/src/common/` (tenant scoping,
  interceptors, filters, database column types, security).

Typical module structure:

- `*.module.ts` (wiring) · `*.controller.ts` (HTTP) · `*.service.ts` (logic)
- `dto/` (request validation/types) · `entities/` (TypeORM models)
- `*.spec.ts` (unit tests, colocated)

### Frontend (Next.js App Router) — `apps/web/src`

- Root layout: `apps/web/src/app/layout.tsx`; landing: `apps/web/src/app/page.tsx`
- Dashboard shell (shared chrome for the domain screens):
  `apps/web/src/app/dashboard/layout.tsx`, with feature screens under
  `apps/web/src/app/dashboard/<domain>/`.
- API client: `apps/web/src/lib/apiFetch.ts` (all routes target the `/api` prefix).
- Auth: `apps/web/src/hooks/useAuth.ts`; permission gates:
  `apps/web/src/hooks/usePermissions.ts`.
- Data fetching: SWR via `apps/web/src/hooks/useApi.ts`.

## 4) Core domain model to understand first

The topology is ISA-95-like; learn it first and most behavior becomes obvious:

**Plant → Customer → Program → Model → Revision → Work Order → Line / Station**

Every transactional action also writes an **Event Ledger** entry (immutable
audit trail with full dimensional context). See
[`AXOS_OS_ARCHITECTURE.md`](AXOS_OS_ARCHITECTURE.md) §4.

## 5) Files newcomers should open first

**Backend (in this order)**

1. `apps/api/src/app.module.ts`
2. `apps/api/src/main.ts`
3. `apps/api/src/orm.options.ts`
4. `apps/api/src/modules/kits/kits.service.ts`
5. `apps/api/src/modules/plans/plans.service.ts`
6. `apps/api/src/modules/bom/bom.service.ts`

**Frontend (in this order)**

1. `apps/web/src/app/layout.tsx`
2. `apps/web/src/app/dashboard/layout.tsx`
3. `apps/web/src/lib/apiFetch.ts`
4. `apps/web/src/hooks/useAuth.ts`
5. `apps/web/src/hooks/usePermissions.ts`

## 6) Local setup and useful commands

**Requirements:** Node 20.9+, npm 10+. PostgreSQL is optional in dev (without
`DATABASE_URL` the API falls back to SQLite).

```bash
# From the repo root (installs all workspaces)
npm install
npm run dev            # turbo: API on :3000 (under /api) and web on :3001
```

Or per app:

```bash
cd apps/api && npm install && npm run start:dev   # backend → http://localhost:3000 (/api)
cd apps/web && npm install && npm run dev          # frontend → http://localhost:3001
```

Useful API commands (`apps/api`):

```bash
npm run build          # nest/tsc build
npm test               # unit tests (Jest)
npm run typecheck      # tsc --noEmit
npm run seed           # create default admin if missing
npm run seed:demo      # seed the demo universe (public-domain data)
npm run smoke:bootstrap  # boot the compiled dist against Postgres (DI/schema check)
```

Copy [`apps/api/.env.example`](apps/api/.env.example) to `apps/api/.env` and set
`NODE_ENV`, `PORT`, `ALLOWED_ORIGIN`, `DATABASE_URL`, `JWT_SECRET`.

## 7) Things that can surprise you

- The API applies a global `/api` prefix; the frontend targets `/api/...`.
- CORS and an optional shared-header gate live in `apps/api/src/main.ts`.
- **`synchronize: true` in prod** materializes the schema from entities (not from
  migrations). Existing migrations are incremental patches, not a from-scratch
  build. Entity changes must be **additive only** (nullable/defaulted columns; no
  DROP/rename/NOT-NULL-without-default). See [`DECISIONS.md`](DECISIONS.md) §2/§14.
- CI runs the blocking gates on every PR (build API · test API · lint web · build
  web · bootstrap smoke vs Postgres). API lint is non-blocking (pre-existing
  format debt; DECISIONS §13). See [`.github/workflows/ci.yml`](.github/workflows/ci.yml).
- Multi-tenancy (`tenant_id` + `TenantScopedRepository`) is adopted incrementally
  — not every module enforces it yet.

## 8) Recommended learning path (next)

1. Trace one story end-to-end: login → create plan → kit → advance/exception.
2. Read one domain module deeply — start with `kits` (status transitions touch
   many modules) or `mes-execution`.
3. Read `common/` (tenant scoping, interceptors, Event Ledger interceptor).
4. Finally, inspect `orm.options.ts` + migrations and the deployment config
   before touching entities.

## 9) First contribution ideas

- Expand DTO validation / error messages on a controller.
- Add a unit test for one critical service (e.g. `kits` + `resupplies`).
- Tighten typing (replace `any`) in a frontend hook or screen.
- Add a small architecture diagram to this guide.
