# Tenant Migration Plan — AXOS OS

## Context

The API is healthy (TypeScript compiles clean, 22 domain modules, TypeORM + SQLite/PostgreSQL).
None of the existing entities carry `tenant_id`. This document tracks the incremental path to full
multi-tenant isolation.

> **ORM Note:** The codebase uses TypeORM throughout. `AGENTS.md` and `backend-architecture.md`
> reference Prisma — those docs are incorrect and have been updated accordingly.

---

## Target Data Model

Every business entity must extend `TenantBaseEntity`:

```ts
abstract class TenantBaseEntity {
  tenant_id: string;        // SaaS client ID
  organization_id: string;  // Organization within tenant
  plant_id: string;         // Manufacturing plant
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;  // soft delete
  created_by: string;       // user ID or email
}
```

`User` is an exception — it maps to tenants but IS part of the tenant hierarchy.

---

## Architecture: Tenant Context Flow

```
JWT token
  └─ { sub, role, tenant_id, organization_id, plant_id }
        └─ TenantContextService.get()
              └─ injected into every service via @TenantContext() decorator
                    └─ scopes all TypeORM queries automatically
```

### Key pieces to build (in order):

1. `TenantBaseEntity` — abstract TypeORM entity (`src/common/entities/tenant-base.entity.ts`)
2. `TenantContextService` — reads tenant from request (`src/common/tenant/tenant-context.service.ts`)
3. `TenantInterceptor` — injects tenant into AsyncLocalStorage per request
4. JWT payload update — add `tenant_id`, `organization_id`, `plant_id` to token
5. Entity migrations — TypeORM migrations adding columns to existing tables
6. Service updates — replace `user.scopes.buildings` scoping with `tenant_id` scoping

---

## Migration Priority Order

### Tier 1 — Foundation (do first, everything depends on this)
| Module | Why first |
|--------|-----------|
| `common/` | TenantBaseEntity + TenantContextService live here |
| `users` | User entity links to tenant; JWT payload origin |
| `auth` | JWT must embed tenant_id in payload |

### Tier 2 — Core domain (high business value)
| Module | Entities to update |
|--------|-------------------|
| `inventory` | InventoryPosition, InventoryMovement, MaterialMaster, WarehouseTask, ReplenishmentRule |
| `production-runtime` | Work orders, line events |
| `plans` | Production plans |
| `kits` / `kit-materials` | Kit records |
| `bom` | Bill of materials |

### Tier 3 — Quality & Governance
| Module | Entities to update |
|--------|-------------------|
| `quality` | QC records |
| `ncr` | Non-conformance reports |
| `governance` | Audit logs, exceptions |
| `engineering` | Engineering orders |

### Tier 4 — Logistics & Support
| Module |
|--------|
| `receiving`, `shipping`, `resupplies` |
| `suppliers`, `advances` |
| `bay-layout`, `enterprise-campus` |
| `decision-intelligence`, `event-ledger`, `visual-aids` |
| `cancellation-requests`, `exceptions` |

---

## Step-by-Step for Each Module

For each module in Tier 2–4, repeat:

```
1. Update entity → extend TenantBaseEntity (remove old created_at/updated_at if duplicated)
2. Generate TypeORM migration:
   npm run migration:generate -- src/migrations/AddTenantTo<Module>
3. Update service → replace scoped queries with tenant_id from TenantContextService
4. Update DTOs → remove tenant_id from request body (injected server-side only)
5. Verify no endpoint exposes or accepts tenant_id directly from client
```

---

## Progress

### ✅ Tier 1 — DONE (2026-04-25)
- [x] `src/common/entities/tenant-base.entity.ts` — abstract base with all required columns
- [x] `src/common/types/jwt.types.ts` — `JwtPayload` and `AuthenticatedUser` interfaces
- [x] `User` entity → `tenant_id`, `organization_id`, `plant_id` (nullable), `deleted_at` added
- [x] `AuthService.login()` → JWT now carries full tenant context + enriched login response
- [x] `JwtStrategy.validate()` → `req.user` is now typed as `AuthenticatedUser`
- [x] `PermissionsGuard` → typed with `AuthenticatedUser`, fixed TS strict-null issues

### Next Steps
- [ ] Create `TenantContextService` with AsyncLocalStorage (injectable per-request tenant context)
- [ ] Create `TenantInterceptor` (register globally in `main.ts`)
- [ ] Pick one Tier 2 module (`inventory`) as the pilot migration
- [ ] Generate TypeORM migration for `users` table: add `tenant_id`, `organization_id`, `plant_id`, `deleted_at`

---

## Rules

- `tenant_id` is **never** accepted from the client request body — always read from JWT
- `plant_id` is per-request context (a user can operate multiple plants)
- Soft delete via `deleted_at` — never hard-delete business records
- All queries MUST filter by `tenant_id` at the repository layer, not the controller
