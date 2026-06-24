#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Backfill de tenant_id para una app SINGLE-TENANT.
 *
 * Asigna DEFAULT_TENANT_ID (por defecto 'default') a TODA fila cuya columna
 * `tenant_id` (o `tenantId`) esté en NULL, en todas las tablas que tengan esa
 * columna. Idempotente (el WHERE ... IS NULL hace que re-correrlo no cambie nada).
 *
 * Por qué un script y no una migración: con `synchronize` ON (orm.options.ts),
 * las migraciones NO corren, así que esto está pensado para correrse UNA vez en
 * prod, después de desplegar `main` (que crea las columnas vía synchronize).
 *
 * Uso:
 *   node scripts/backfill-tenant.js                 # DRY-RUN: solo cuenta cuántas filas se tocarían
 *   node scripts/backfill-tenant.js --apply         # aplica el UPDATE
 *   DEFAULT_TENANT_ID=mi-empresa node scripts/backfill-tenant.js --apply
 *
 * Requiere DATABASE_URL (Postgres). Tras correrlo, todas las filas y usuarios
 * quedan en un solo tenant; el filtrado por tenant (TenantScopedRepository, ya
 * presente) queda consistente como no-op ahora y como aislamiento real el día
 * que agregues un segundo tenant.
 */
const { Client } = require('pg');

async function main() {
  const apply = process.argv.includes('--apply');
  const tenant = process.env.DEFAULT_TENANT_ID || 'default';
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('ERROR: falta DATABASE_URL.');
    process.exit(1);
  }

  const sslEnabled =
    process.env.NODE_ENV === 'production' || url.includes('sslmode=require');
  const client = new Client({
    connectionString: url,
    ssl: sslEnabled
      ? { rejectUnauthorized: process.env.DB_SSL_STRICT === 'true' }
      : false,
  });
  await client.connect();

  try {
    const { rows: cols } = await client.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_name IN ('tenant_id', 'tenantId')
      ORDER BY table_name, column_name
    `);

    if (cols.length === 0) {
      console.log(
        'No se encontraron columnas tenant_id/tenantId. ¿Desplegaste `main` con las entidades nuevas (synchronize crea las columnas)?',
      );
      return;
    }

    console.log(
      `${apply ? 'APLICANDO' : 'DRY-RUN'} — tenant='${tenant}' sobre ${cols.length} columnas:\n`,
    );

    let totalNull = 0;
    let totalUpdated = 0;
    for (const { table_name, column_name } of cols) {
      const q = `"${table_name}"`;
      const c = `"${column_name}"`;
      const {
        rows: [{ count }],
      } = await client.query(
        `SELECT COUNT(*)::int AS count FROM ${q} WHERE ${c} IS NULL`,
      );
      if (count === 0) continue;
      totalNull += count;
      if (apply) {
        const res = await client.query(
          `UPDATE ${q} SET ${c} = $1 WHERE ${c} IS NULL`,
          [tenant],
        );
        totalUpdated += res.rowCount;
        console.log(`  ${table_name}.${column_name}: ${res.rowCount} → '${tenant}'`);
      } else {
        console.log(`  ${table_name}.${column_name}: ${count} fila(s) NULL`);
      }
    }

    console.log(
      apply
        ? `\nListo. ${totalUpdated} fila(s) actualizadas a tenant='${tenant}'.`
        : `\nDRY-RUN: ${totalNull} fila(s) NULL en total. Corre de nuevo con --apply para aplicar.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
