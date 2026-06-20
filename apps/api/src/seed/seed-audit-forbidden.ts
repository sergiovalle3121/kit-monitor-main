/**
 * AXOS OS — AUDITORÍA de datos prohibidos (Fase 1, paso 1).  *** SÓLO LECTURA ***
 *
 * Recorre TODAS las tablas con campos de texto (parte / modelo / cliente /
 * programa / proveedor / descripciones) usando el detector legal YA EXISTENTE
 * (`findForbiddenReason` del guard) y reporta, POR TABLA, cada fila cuyo valor
 * lleve un prefijo de cliente prohibido (p. ej. `OP-`) o un nombre de empresa
 * real de la lista negra. Imprime conteos + ejemplos + desglose por motivo.
 *
 * ESTO ES DRY-RUN: JAMÁS borra ni modifica nada. Es la foto auditable que el
 * owner revisa ANTES de aprobar la purga.
 *
 * Uso:
 *   DATABASE_URL=<prod> npm run seed:audit-forbidden            # reporte (exit 0)
 *   DATABASE_URL=<prod> npm run seed:audit-forbidden -- --strict # exit 1 si hay hallazgos (CI)
 *   DATABASE_URL=<prod> npm run seed:audit-forbidden -- --json   # salida JSON cruda
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';

import { bootSeedContext, runInDemoContext } from './seed-context';
import { scanForbidden, formatScanReport } from './forbidden-scan';

async function run(): Promise<void> {
  const strict = process.argv.includes('--strict');
  const asJson = process.argv.includes('--json');

  if (!asJson) {
    console.log('════════════════════════════════════════════════════════════');
    console.log(' AXOS OS — AUDITORÍA de datos prohibidos (DRY-RUN, sólo lectura)');
    console.log(`   Destino: ${process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/\/\/[^@]*@/, '//***@') : 'SQLite local'}`);
    console.log('   Detector: findForbiddenReason (FORBIDDEN_PREFIXES + REAL_COMPANY_BLACKLIST)');
    console.log('   NO se borra ni modifica nada. Reporte por tabla.');
    console.log('════════════════════════════════════════════════════════════');
  }

  const app = await bootSeedContext();
  const ds = app.get(DataSource);

  try {
    const res = await runInDemoContext(app, () =>
      scanForbidden(ds, { log: asJson ? undefined : (m) => console.log(m) }),
    );

    if (asJson) {
      // Salida JSON cruda (sin las entidades completas; sólo lo reportable).
      const slim = {
        totals: {
          entities: res.totalEntities,
          scannedRows: res.totalScannedRows,
          matchedRows: res.totalMatchedRows,
          tablesWithHits: res.withHits.length,
          errors: res.errors.length,
        },
        byReason: res.byReason,
        tables: res.withHits.map((f) => ({
          table: f.table,
          entity: f.entity,
          scanned: f.scanned,
          matched: f.matched,
          examples: f.rows.slice(0, 10).map((r) => ({ pk: r.pk, hits: r.hits })),
        })),
        errors: res.errors,
      };
      console.log(JSON.stringify(slim, null, 2));
    } else {
      console.log('');
      console.log(formatScanReport(res, { examplesPerTable: 5 }));
      console.log('────────────────────────────────────────────────────────────');
      if (res.totalMatchedRows > 0) {
        console.log(
          ' Siguiente paso (cuando el owner lo apruebe): correr la purga →\n' +
            '   DATABASE_URL=<prod> npm run seed:purge-clients            # dry-run (qué borraría)\n' +
            '   DATABASE_URL=<prod> npm run seed:purge-clients -- --apply # borra de verdad',
        );
      }
      console.log('────────────────────────────────────────────────────────────');
    }

    if (strict && res.totalMatchedRows > 0) {
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error('❌ Auditoría falló:', err);
  process.exit(1);
});
