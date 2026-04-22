# Newcomer Guide: AXOS OS

## 1) What this project is

AXOS OS is a monorepo for tracking production plans, kits, BOM materials, and execution events on the shop floor.

- **Frontend:** Angular app (`frontend/`) for operators/planners.
- **Backend:** NestJS API (`backend/`) with TypeORM and JWT auth.
- **Data:** SQLite by default in local dev, PostgreSQL when DB env vars are provided.

## 2) High-level architecture

### Frontend (Angular)

- Entry and global setup: `frontend/src/main.ts`, `frontend/src/app/app.config.ts`.
- Routing and navigation: `frontend/src/app/app.routes.ts`.
- Auth stack:
  - `frontend/src/app/core/auth.service.ts`
  - `frontend/src/app/core/auth.guard.ts`
  - `frontend/src/app/core/jwt-interceptor.ts`
- Shared API client: `frontend/src/app/core/api.service.ts`.
- Feature screens (lazy-loaded):
  - `features/plan`, `features/forecast`, `features/bom`, `features/kits`,
    `features/conteos`, `features/production`, `features/monitor`.
- Shell layout/sidebar: `frontend/src/app/layout/shell/`.

### Backend (NestJS)

- App composition: `backend/src/app.module.ts`.
- Bootstrap/config/CORS/security: `backend/src/main.ts`.
- DB strategy config: `backend/src/orm.options.ts`.
- Module-per-domain organization under `backend/src/modules/`:
  - `auth`, `users`, `plans`, `bom`, `bay-layout`, `kits`, `kit-materials`,
    `advances`, `resupplies`, `exceptions`.
- Typical module structure:
  - `*.module.ts` (wiring)
  - `*.controller.ts` (HTTP)
  - `*.service.ts` (business logic)
  - `dto/` (request validation/types)
  - `entities/` (TypeORM models)

## 3) Core domain model to understand first

If you learn these entities first, most of the app behavior becomes obvious:

1. **Plan** (`plans`): what must be produced (WO, model, qty, shift, sequence).
2. **Kit** (`kits`): kit generated for a plan, with lifecycle status.
3. **KitMaterial** (`kit_materials`): required vs actual material quantities per kit.
4. **Resupply** (`resupplies`): shortage requests and delivered quantities.
5. **KitException** (`kit_exceptions`): disruptions/issues raised and resolved.
6. **Advance** (`advances`): production progress updates over time.

## 4) Runtime flow in plain language

1. User logs in (`/auth/login`) and receives JWT.
2. Frontend stores token and sends it in later API calls.
3. Planner creates/updates plans.
4. Kit is created and moved through statuses.
5. BOM import/catalog maps model -> required part numbers and usage factors.
6. During execution, operators report advances, resupplies, and exceptions.
7. Monitoring screens aggregate this operational state.

## 5) Files newcomers should open first

### Backend (in this order)

1. `backend/src/app.module.ts`
2. `backend/src/main.ts`
3. `backend/src/orm.options.ts`
4. `backend/src/modules/kits/kits.controller.ts`
5. `backend/src/modules/kits/kits.service.ts`
6. `backend/src/modules/plans/plans.service.ts`
7. `backend/src/modules/bom/bom.service.ts`
8. `backend/src/modules/resupplies/resupplies.service.ts`
9. `backend/src/modules/exceptions/exceptions.service.ts`

### Frontend (in this order)

1. `frontend/src/app/app.routes.ts`
2. `frontend/src/app/core/api.service.ts`
3. `frontend/src/app/core/auth.service.ts`
4. `frontend/src/app/layout/shell/shell.ts`
5. `frontend/src/app/features/plan/plan.component.ts`
6. `frontend/src/app/features/kits/kits.component.ts`
7. `frontend/src/app/features/monitor/monitor.component.ts`
8. `frontend/src/app/features/forecast/forecast.component.ts`

## 6) Local setup and useful commands

From repo root:

```bash
# Backend
cd backend
npm install
npm run start:dev

# Frontend (new terminal)
cd frontend
npm install
npm start
```

Useful backend commands:

```bash
npm run seed                  # create default admin if missing
npm run test                  # unit tests
npm run test:e2e              # e2e tests
```

## 7) Things that can surprise you

- Backend applies global `/api` prefix; frontend URLs should target API paths accordingly.
- CORS and optional shared-header gate are controlled in `backend/src/main.ts`.
- TypeORM can auto-sync schema in some modes (`orm.options.ts`); verify before prod changes.
- There are migrations in `backend/src/migrations/`; check schema intent before editing entities.
- BOM import supports multiple spreadsheet layouts via parsers in `backend/src/modules/bom/`.

## 8) Recommended learning path (next)

1. **Trace one full user story end-to-end**
   - Login -> create plan -> create kit -> register advance/resupply/exception.
2. **Read one domain module deeply**
   - Start with `kits` (status transitions touch many modules).
3. **Understand data ingest paths**
   - BOM and Kanban parsers (`bom-parser.ts`, `kanban-parser.ts`).
4. **Understand forecasting internals**
   - `frontend/src/app/features/forecast/forecast.parser.ts`
   - `frontend/src/app/features/forecast/forecast.analytics.ts`
   - `frontend/src/app/features/forecast/forecast.engine.ts`
5. **Finally, inspect migrations and deployment config**
   - `backend/src/migrations/*`
   - `.env.example` files and Docker/nginx files.

## 9) First contribution ideas for a newcomer

- Add/expand API DTO validation and error messages.
- Add integration tests for one critical workflow (kit + resupply).
- Improve typing in frontend feature services/components (replace `any`).
- Add lightweight architecture diagrams to this guide.

