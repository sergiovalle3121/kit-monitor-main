# Runbook: cutover de `synchronize` → migraciones (acción del owner)

> **Por qué este doc:** el esquema de producción (Railway) lo construyó `synchronize: true`.
> Las 82 migraciones son **incrementales** — NO existe una migración *baseline* que cree
> las tablas base (`users`, `plans`, `bom_items`, `kits`, `production_wip`, `resupplies`, …).
> Por eso **NO se puede simplemente poner `SYNCHRONIZE=false`**: en una DB nueva produciría
> un esquema incompleto, y sobre la DB viva las migraciones que asumen tablas existentes
> fallarían. El cutover requiere pasos manuales sobre la DB viva que el repo no puede hacer.

## Estado actual (ya aplicado en código, seguro)

- `SYNCHRONIZE` (env) controla `synchronize`; por defecto `true` cuando hay `DATABASE_URL`
  (`apps/api/src/orm.options.ts:38-46`). **El env es `SYNCHRONIZE`, no `DB_SYNCHRONIZE`.**
- `migrationsRun` se activa **solo** cuando `synchronize` está apagado
  (`orm.options.ts:52`) → apagar synchronize enciende migraciones automáticamente.
- Fixes de código ya integrados: CORS fail-closed (`main.ts`), flag `DB_SSL_STRICT`
  (default relajado, `orm.options.ts` + `typeorm-cli.datasource.ts`), y la migración
  `AddCustomerAndProgram1713000000002` ahora es idempotente.

## Cutover seguro (pasos del owner sobre la DB de prod)

1. **Generar baseline** desde las entidades actuales contra una Postgres **vacía**:
   `npm --workspace=axos-os-backend run migration:generate -- src/migrations/<ts>-BaselineSchema`
   Revisar y commitear (crea ~198 tablas).
2. **Marcar la baseline como ya aplicada** en la DB de prod: insertar su fila en la tabla
   `migrations` para que `migration:run` **no** ejecute sus `CREATE` contra el esquema vivo.
3. Asegurar también la fila de `AddCustomerAndProgram1713000000002` (ya idempotente, por limpieza).
4. Setear `SYNCHRONIZE=false` en Railway. En el próximo deploy, `migrationsRun` correrá
   las migraciones pendientes (todas guardadas → no-op sobre lo existente).
5. Verificar el arranque y que `migration:run` no falle.

## Gotchas

- `migrationsRun` está acoplado a `!synchronize` (`orm.options.ts:52`).
- Hay **prefijos de timestamp duplicados** en migraciones (p.ej. `20260607180000`,
  `20260616000000`, `20260623180000`) — deconflictar antes de depender del orden estricto.
- Endurecer SSL (`DB_SSL_STRICT=true`) **solo** con un CA verificable de Railway, o
  romperá la conexión a la DB.
- CI hoy materializa el esquema con `synchronize` y **no valida migraciones**; tras el
  cutover conviene añadir un job que corra `migration:run` contra una Postgres efímera.
