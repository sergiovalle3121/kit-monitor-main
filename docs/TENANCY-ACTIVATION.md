# Activación de multi-tenancy (single-tenant)

La **base** ya está en `main`:
- `tenant_id` (nullable) en todas las entidades de negocio (Phase A2).
- `TenantSubscriber` **puebla** `tenant_id` en escritura desde el claim del JWT (Phase A1).
- `TenantScopedRepository` ya **filtra** lecturas por tenant en ~25 módulos (cuando el JWT trae tenant).

## Pasos para activar (un solo tenant)

1. **Desplegar `main`** a Railway. En el arranque, `synchronize` crea la columna
   `tenant_id` (nullable) en todas las tablas. Las filas existentes quedan en `NULL`.

2. **Backfill (una sola vez)** — asigna el tenant por defecto a TODAS las filas existentes:
   ```bash
   # DRY-RUN (solo cuenta, no cambia nada):
   DATABASE_URL="<prod-url>" node apps/api/scripts/backfill-tenant.js
   # Aplicar:
   DATABASE_URL="<prod-url>" node apps/api/scripts/backfill-tenant.js --apply
   # (opcional) usar un id de tenant específico en vez de 'default':
   DEFAULT_TENANT_ID="mi-empresa" DATABASE_URL="<prod-url>" node apps/api/scripts/backfill-tenant.js --apply
   ```
   Es **idempotente** (solo toca filas con `tenant_id IS NULL`). Incluye la tabla de
   usuarios, así que tras correrlo los JWT llevan `tenant_id` y el filtrado queda
   consistente: **no-op** ahora (un solo tenant) y aislamiento **real** el día que
   agregues un segundo tenant.

3. **Verificar**: vuelve a correr el DRY-RUN; debe reportar **0 filas NULL**.

## Para crecer a multi-tenant (futuro)
- Asignar un `tenant_id` real por usuario/organización (en vez de `'default'`).
- El filtrado de lecturas ya aplica solo, por el claim del JWT.
- Índices `tenant_id`: agregar `@Index` (synchronize) o una migración `CONCURRENTLY`
  cuando el volumen lo pida.

## Nota
Mientras `synchronize` esté ON las migraciones no corren; por eso el backfill es un
**script**, no una migración. Tras el cutover a migraciones
(`docs/PROD-MIGRATION-CUTOVER.md`) se puede mover a una migración formal.
