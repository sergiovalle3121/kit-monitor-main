# Backend Architecture - NestJS Modular Monolith

## Tech Stack
- **Framework**: NestJS (TypeScript)
- **Database**: PostgreSQL (SQLite for local dev via `orm.options.ts` fallback)
- **ORM**: TypeORM (with `autoLoadEntities`, migrations in `src/migrations/`)
- **Auth**: Multi-tenant RBAC (Role-Based Access Control)
- **Documentation**: Swagger/OpenAPI

## Database Design Rules (Multi-tenant)
Every business table MUST include:
- `tenant_id`: ID of the SaaS client.
- `organization_id`: ID of the organization within the tenant.
- `plant_id`: ID of the specific manufacturing plant.
- Metadata: `created_at`, `updated_at`, `deleted_at` (soft delete), `created_by`.

## Module Structure
The backend is organized into domain-specific modules:
- `auth`: Identity and access.
- `organizations`: Multi-tenant hierarchy management.
- `inventory`: Materials and stock.
- `production`: Work orders and line events.
- `planning`: Forecasts and scheduling.
- ... (refer to AGENTS.md for full list)

## Multi-tenant Entity Base

All business entities extend `TenantBaseEntity` from `src/common/entities/tenant-base.entity.ts`.
This provides: `tenant_id`, `organization_id`, `plant_id`, `created_at`, `updated_at`,
`deleted_at` (soft delete), and `created_by`.

`tenant_id` is **never** accepted from the client — it is always injected server-side from the JWT.

See `docs/tenant-migration-plan.md` for the incremental migration roadmap.

## Integration
- Use DTOs for all requests.
- `class-validator` for DTO validation (no Zod — TypeORM stack uses class-transformer).
- All endpoints must be documented in Swagger.
