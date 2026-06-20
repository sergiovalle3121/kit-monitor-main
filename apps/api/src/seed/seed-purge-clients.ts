/**
 * AXOS OS — PURGA de datos de clientes reales (legal / confidencialidad).
 *
 * Elimina de la base CUALQUIER fila que NO sea de dominio público: número de
 * parte / modelo / cliente / programa / proveedor / descripción con un prefijo de
 * cliente prohibido (p. ej. `OP-`) o un nombre de empresa real (lista negra).
 *
 * DETECCIÓN: usa el MOTOR COMPARTIDO `scanForbidden()` (que a su vez usa el
 * detector legal del guard `findForbiddenReason`). Cubre TODAS las tablas con
 * texto (materials, requisiciones, POs, BOMs, models, shipments, inventario,
 * RMA, CRM, genealogía, sf_*, ERP…), no sólo el núcleo histórico.
 *
 * BORRADO en dos planos, respetando llaves foráneas:
 *   1) Cascada CURADA del núcleo con FKs reales (plan→kit→materiales/dependientes,
 *      header→componentes, modelos, inventario, programas→clientes).
 *   2) Barrido COMPRENSIVO del resto (POs, requisiciones, embarques, RMA, CRM…)
 *      con pasadas de reintento por si hubiera FKs; lo que no se pueda borrar se
 *      REPORTA (nunca se deja un huérfano silencioso ni se fuerza sobre datos
 *      legítimos).
 *
 * Idempotente y SEGURO. *** Por defecto es DRY-RUN (no borra) ***; sólo borra de
 * verdad con el flag explícito `--apply` (o `PURGE_CONFIRM=true`):
 *   DATABASE_URL=<prod> npm run seed:purge-clients             # preview (no borra)
 *   DATABASE_URL=<prod> npm run seed:purge-clients -- --apply  # borra de verdad
 * (Revisa/extiende la lista negra en public-domain-guard.ts antes de correrlo.)
 */
import 'reflect-metadata';
import { DataSource, In, ObjectLiteral } from 'typeorm';

import { Plan } from '../modules/plans/entities/plan.entity';
import { Kit } from '../modules/kits/entities/kit.entity';
import { KitMaterial } from '../modules/kit-materials/entities/kit-material.entity';
import { EnterprisePlanLink } from '../modules/enterprise-campus/entities/enterprise-plan-link.entity';

import { bootSeedContext, runInDemoContext } from './seed-context';
import { scanForbidden, formatScanReport, type ScanResult } from './forbidden-scan';

/** Tablas que cubre la cascada CURADA (el barrido las omite para no duplicar). */
const CURATED_TABLES = new Set<string>([
  'plans',
  'kits',
  'kit_materials',
  'enterprise_plan_links',
  'bom_components',
  'bom_headers',
  'pm_product_models',
  'inventory_movements',
  'inventory_positions',
  'material_master',
  'enterprise_programs',
  'enterprise_customers',
]);

interface SummaryRow {
  label: string;
  removed: number;
  note?: string;
}

const summary: SummaryRow[] = [];
const problems: string[] = [];

function record(label: string, removed: number, note?: string): void {
  summary.push({ label, removed, note });
  if (note) {
    console.log(`  ✖ ${label}: ${note}`);
  } else if (removed) {
    console.log(`  ✔ ${label}: ${removed} eliminada(s)`);
  }
}

/** Borra un lote de filas (entidades cargadas) vía el repo de su `target`. */
async function removeRows(
  ds: DataSource,
  target: unknown,
  rows: ObjectLiteral[],
  label: string,
): Promise<boolean> {
  if (!target || !rows.length) {
    if (rows.length) record(label, 0, 'sin target consultable');
    return true;
  }
  try {
    await ds.getRepository(target as new () => ObjectLiteral).remove(rows as ObjectLiteral[]);
    record(label, rows.length);
    return true;
  } catch (err) {
    record(label, 0, (err as Error).message);
    problems.push(`${label}: ${(err as Error).message}`);
    return false;
  }
}

/** Borra dependientes de kits prohibidos por columna kitId (defensivo; raw + try/catch). */
async function purgeKitDependents(ds: DataSource, kitIds: number[]): Promise<void> {
  if (!kitIds.length) return;
  const targets: Array<{ table: string; col: string }> = [
    { table: 'advances', col: 'kitId' },
    { table: 'kit_exceptions', col: 'kitId' },
    { table: 'resupplies', col: 'kitId' },
    { table: 'cancellation_requests', col: 'kit_id' },
    { table: 'production_bay_events', col: 'kitId' },
    { table: 'production_bay_material_states', col: 'kitId' },
  ];
  for (const t of targets) {
    try {
      const res = await ds
        .createQueryBuilder()
        .delete()
        .from(t.table)
        .where(`"${t.col}" IN (:...ids)`, { ids: kitIds })
        .execute();
      if (res.affected) console.log(`  ✔ ${t.table}: ${res.affected} eliminada(s) (dependiente de kit prohibido)`);
    } catch {
      /* tabla/columna ausente o sin filas: ignorar (defensivo) */
    }
  }
}

/** Cantidad de FKs entrantes por tabla (heurística de orden de borrado: hojas primero). */
function inboundFkCount(ds: DataSource): Map<string, number> {
  const counts = new Map<string, number>();
  for (const meta of ds.entityMetadatas) {
    for (const fk of meta.foreignKeys) {
      const ref = fk.referencedEntityMetadata?.tableName;
      if (ref) counts.set(ref, (counts.get(ref) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Barrido comprensivo: borra las filas prohibidas de TODAS las tablas no curadas,
 * con pasadas de reintento para resolver dependencias de FK. Lo que no se pueda
 * borrar tras N pasadas se reporta como problema (no se fuerza).
 */
async function sweepRemaining(ds: DataSource, res: ScanResult): Promise<void> {
  const inbound = inboundFkCount(ds);
  let work = res.withHits
    .filter((f) => !CURATED_TABLES.has(f.table))
    .map((f) => ({ f, rows: f.rows.map((r) => r.entity) as ObjectLiteral[] }))
    // Hojas (menos FKs entrantes) primero → menos reintentos.
    .sort((a, b) => (inbound.get(a.f.table) ?? 0) - (inbound.get(b.f.table) ?? 0));

  for (let pass = 1; pass <= 5 && work.length; pass++) {
    let progressed = false;
    for (const item of work) {
      if (!item.rows.length) continue;
      try {
        await ds.getRepository(item.f.target as new () => ObjectLiteral).remove(item.rows);
        record(item.f.table, item.rows.length);
        item.rows = [];
        progressed = true;
      } catch (err) {
        // Probable FK pendiente; reintentar en la próxima pasada.
        if (pass === 5) {
          record(item.f.table, 0, (err as Error).message);
          problems.push(`${item.f.table}: ${(err as Error).message}`);
        }
      }
    }
    work = work.filter((w) => w.rows.length);
    if (!progressed) break;
  }
}

/** Cascada curada del núcleo (FKs reales). Toma las filas prohibidas del scan. */
async function purgeCuratedCore(ds: DataSource, res: ScanResult): Promise<void> {
  const byTable = new Map(res.findings.map((f) => [f.table, f]));
  const rowsOf = (t: string): ObjectLiteral[] => byTable.get(t)?.rows.map((r) => r.entity) ?? [];
  const targetOf = (t: string): unknown => byTable.get(t)?.target;

  // ── Planes prohibidos → kits/materiales/dependientes/enlaces → planes ───────
  const fPlans = rowsOf('plans');
  const fPlanIds = fPlans.map((p) => (p as { id: number }).id).filter((id) => id != null);
  if (fPlanIds.length) {
    const kits = await ds.getRepository(Kit).find({ where: { plan: { id: In(fPlanIds) } } as any });
    const kitIds = kits.map((k) => k.id);
    if (kitIds.length) {
      const kms = await ds.getRepository(KitMaterial).find({ where: { kit: { id: In(kitIds) } } as any });
      await removeRows(ds, KitMaterial, kms, 'kit_materials');
      await purgeKitDependents(ds, kitIds);
    }
    const links = await ds.getRepository(EnterprisePlanLink).find({ where: { plan: { id: In(fPlanIds) } } as any });
    await removeRows(ds, EnterprisePlanLink, links, 'enterprise_plan_links');
    await removeRows(ds, Kit, kits, 'kits');
  }
  await removeRows(ds, targetOf('plans'), fPlans, 'plans');

  // ── BOM: componentes prohibidos, luego cabeceras (cascade borra los demás) ──
  await removeRows(ds, targetOf('bom_components'), rowsOf('bom_components'), 'bom_components');
  await removeRows(ds, targetOf('bom_headers'), rowsOf('bom_headers'), 'bom_headers');

  // ── Modelos ────────────────────────────────────────────────────────────────
  await removeRows(ds, targetOf('pm_product_models'), rowsOf('pm_product_models'), 'pm_product_models');

  // ── Inventario: movimientos y posiciones antes que el maestro de material ───
  await removeRows(ds, targetOf('inventory_movements'), rowsOf('inventory_movements'), 'inventory_movements');
  await removeRows(ds, targetOf('inventory_positions'), rowsOf('inventory_positions'), 'inventory_positions');
  await removeRows(ds, targetOf('material_master'), rowsOf('material_master'), 'material_master');

  // ── Enterprise: programas (FK a cliente) antes que clientes ─────────────────
  await removeRows(ds, targetOf('enterprise_programs'), rowsOf('enterprise_programs'), 'enterprise_programs');
  await removeRows(ds, targetOf('enterprise_customers'), rowsOf('enterprise_customers'), 'enterprise_customers');
}

async function run(): Promise<void> {
  const apply = process.argv.includes('--apply') || process.env.PURGE_CONFIRM === 'true';

  console.log('════════════════════════════════════════════════════════════');
  console.log(' AXOS OS — PURGA de datos de clientes reales (legal)');
  console.log(`   Destino: ${process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/\/\/[^@]*@/, '//***@') : 'SQLite local'}`);
  console.log(`   Modo: ${apply ? '🔥 APPLY (BORRA de verdad)' : 'DRY-RUN (no borra)'}`);
  console.log('   Detección: scanForbidden → findForbiddenReason (prefijos + lista negra)');
  console.log('════════════════════════════════════════════════════════════');

  const app = await bootSeedContext();
  const ds = app.get(DataSource);

  try {
    await runInDemoContext(app, async () => {
      const res = await scanForbidden(ds);

      console.log('');
      console.log(formatScanReport(res, { examplesPerTable: 3 }));
      console.log('');

      if (res.totalMatchedRows === 0) {
        console.log('· Nada que purgar — la base ya está limpia.');
        return;
      }

      if (!apply) {
        console.log(`· DRY-RUN: ${res.totalMatchedRows} fila(s) prohibida(s) en ${res.withHits.length} tabla(s). NO se borró nada.`);
        console.log('  Para borrar de verdad: npm run seed:purge-clients -- --apply');
        return;
      }

      console.log('· Borrando (cascada curada del núcleo):');
      await purgeCuratedCore(ds, res);
      console.log('· Borrando (barrido comprensivo del resto):');
      await sweepRemaining(ds, res);

      // Verificación final: re-escanea para confirmar que no quedó nada (idempotencia).
      const after = await scanForbidden(ds);
      console.log('');
      if (after.totalMatchedRows === 0) {
        console.log('· Verificación post-purga: 0 filas prohibidas restantes ✔');
      } else {
        console.log(`· Verificación post-purga: AÚN quedan ${after.totalMatchedRows} fila(s) en ${after.withHits.length} tabla(s):`);
        for (const f of after.withHits) {
          console.log(`    - ${f.table}: ${f.matched} (FK desde datos legítimos / revisar manualmente)`);
        }
      }
    });

    const total = summary.reduce((a, s) => a + s.removed, 0);
    console.log('────────────────────────────────────────────────────────────');
    if (!apply) {
      console.log(' DRY-RUN — no se borró nada. Repite con `-- --apply` para purgar de verdad.');
    } else {
      console.log(` Total purgado: ${total} fila(s) de clientes reales.`);
      if (problems.length) {
        console.log(' Pasos con problemas (revisar manualmente):');
        for (const p of problems) console.log(`   - ${p}`);
      }
      console.log('✅ Purga completada (sólo se borró lo que coincide con prefijos/lista negra).');
    }
    console.log('────────────────────────────────────────────────────────────');
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error('❌ Purga falló:', err);
  process.exit(1);
});
