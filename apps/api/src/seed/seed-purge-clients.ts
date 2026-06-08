/**
 * AXOS OS — PURGA de datos de clientes reales (legal / confidencialidad).
 *
 * Elimina de la base CUALQUIER registro que NO sea de dominio público:
 *   • partNumber / model con prefijo de cliente prohibido (p. ej. `OP-`), o
 *   • customer / name / description con un nombre de empresa real (lista negra).
 *
 * Recorre material_master, pm_product_models, bom_headers/components, plans,
 * kits/pick-lists e inventario, en orden de dependencias (hijos → padres).
 *
 * Idempotente y SEGURO: sólo borra lo que coincide con la lista negra; NO toca
 * los datos legítimos del dueño. Imprime cada registro borrado con su motivo.
 *
 * El dueño lo correrá CONTRA PROD para limpiar lo ya desplegado. Es DRY-RUN por
 * defecto (sólo reporta lo que borraría); para borrar de verdad añade PURGE_CONFIRM=true:
 *   DATABASE_URL=<prod> npm run seed:purge-clients                     # preview (no borra)
 *   DATABASE_URL=<prod> PURGE_CONFIRM=true npm run seed:purge-clients  # borra
 * (Revisa/extiende la lista negra en public-domain-guard.ts antes de correrlo.)
 */
import 'reflect-metadata';
import { DataSource, In, ObjectLiteral, Repository } from 'typeorm';

import { ProductModel } from '../modules/product-models/entities/product-model.entity';
import { BomHeader } from '../modules/bom/entities/bom-header.entity';
import { BomComponent } from '../modules/bom/entities/bom-component.entity';
import { Plan } from '../modules/plans/entities/plan.entity';
import { Kit } from '../modules/kits/entities/kit.entity';
import { KitMaterial } from '../modules/kit-materials/entities/kit-material.entity';
import { InventoryPosition } from '../modules/inventory/entities/inventory-position.entity';
import { InventoryMovement } from '../modules/inventory/entities/inventory-movement.entity';
import { MaterialMaster } from '../modules/inventory/entities/material-master.entity';
import { EnterpriseCustomer } from '../modules/enterprise-campus/entities/enterprise-customer.entity';
import { EnterpriseProgram } from '../modules/enterprise-campus/entities/enterprise-program.entity';
import { EnterprisePlanLink } from '../modules/enterprise-campus/entities/enterprise-plan-link.entity';

import { bootSeedContext, runInDemoContext } from './seed-context';
import { findForbiddenReason, isForbiddenValue } from './public-domain-guard';

let totalRemoved = 0;
let wasDryRun = false;
const problems: string[] = [];

/** ¿Alguno de los campos del registro es de cliente real? Devuelve el motivo. */
function rowReason(row: ObjectLiteral, fields: string[]): string | null {
  for (const f of fields) {
    const reason = findForbiddenReason(row[f]);
    if (reason) return `${f}="${row[f]}" → ${reason}`;
  }
  return null;
}

async function removeEntities<T extends ObjectLiteral>(
  repo: Repository<T>,
  rows: T[],
  label: string,
): Promise<void> {
  if (!rows.length) {
    console.log(`  · ${label}: 0 coincidencias`);
    return;
  }
  try {
    await repo.remove(rows);
    totalRemoved += rows.length;
    console.log(`  ✔ ${label}: ${rows.length} eliminadas`);
  } catch (err) {
    problems.push(`${label}: ${(err as Error).message}`);
    console.log(`  ✖ ${label}: ${(err as Error).message}`);
  }
}

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
      await ds.createQueryBuilder().delete().from(t.table).where(`"${t.col}" IN (:...ids)`, { ids: kitIds }).execute();
    } catch {
      /* defensivo: tabla/columna ausente */
    }
  }
}

async function run(): Promise<void> {
  console.log('════════════════════════════════════════════════════════════');
  console.log(' AXOS OS — PURGA de datos de clientes reales (legal)');
  console.log(`   Destino: ${process.env.DATABASE_URL || 'SQLite local'}`);
  console.log('   Por defecto DRY-RUN (no borra). Borra de verdad sólo con PURGE_CONFIRM=true.');
  console.log('════════════════════════════════════════════════════════════');

  const app = await bootSeedContext();
  const ds = app.get(DataSource);

  try {
    await runInDemoContext(app, async () => {
      // ── Detección (carga + filtro en JS; robusto entre motores) ──────────
      const matRepo = ds.getRepository(MaterialMaster);
      const modelRepo = ds.getRepository(ProductModel);
      const headerRepo = ds.getRepository(BomHeader);
      const compRepo = ds.getRepository(BomComponent);
      const planRepo = ds.getRepository(Plan);

      const fMaterials = (await matRepo.find()).filter((m) => rowReason(m, ['partNumber', 'description', 'category']));
      const fPartSet = new Set(fMaterials.map((m) => m.partNumber));

      const fModels = (await modelRepo.find()).filter((m) => rowReason(m, ['modelNumber', 'name', 'customer', 'description']));
      const fModelSet = new Set(fModels.map((m) => m.modelNumber));

      const allHeaders = await headerRepo.find();
      const fHeaders = allHeaders.filter((h) => rowReason(h, ['model', 'productName', 'description']) || fModelSet.has(h.model));
      const fHeaderIds = fHeaders.map((h) => h.id);

      const allComponents = await compRepo.find();
      const fComponents = allComponents.filter(
        (c) => rowReason(c, ['componentNumber', 'description']) || fPartSet.has(c.componentNumber) || fHeaderIds.includes(c.bomHeaderId),
      );

      const allPlans = await planRepo.find({ relations: ['kit'] });
      const fPlans = allPlans.filter((p) => rowReason(p, ['model', 'workOrder']) || fModelSet.has(p.model));
      const fPlanIds = fPlans.map((p) => p.id);
      const fKitIds = fPlans.map((p) => p.kit?.id).filter((id): id is number => !!id);

      const posRepo = ds.getRepository(InventoryPosition);
      const movRepo = ds.getRepository(InventoryMovement);
      const fPositions = (await posRepo.find()).filter((p) => isForbiddenValue(p.partNumber) || fPartSet.has(p.partNumber));
      const fMovements = (await movRepo.find()).filter((m) => isForbiddenValue(m.partNumber) || fPartSet.has(m.partNumber));

      const custRepo = ds.getRepository(EnterpriseCustomer);
      const progRepo = ds.getRepository(EnterpriseProgram);
      const fPrograms = (await progRepo.find()).filter((p) => rowReason(p, ['code', 'name', 'primaryModelPrefix']));
      const fCustomers = (await custRepo.find()).filter((c) => rowReason(c, ['code', 'name', 'industry']));

      // ── Reporte de lo detectado (auditable) ─────────────────────────────
      console.log('\n· Detectado (cliente real / confidencial):');
      for (const m of fModels) console.log(`   modelo  ${m.modelNumber} — ${rowReason(m, ['modelNumber', 'name', 'customer', 'description'])}`);
      for (const m of fMaterials) console.log(`   parte   ${m.partNumber} — ${rowReason(m, ['partNumber', 'description', 'category'])}`);
      for (const p of fPlans) console.log(`   plan    ${p.workOrder ?? p.id} (${p.model}) — ${rowReason(p, ['model', 'workOrder']) ?? 'modelo confidencial'}`);
      for (const c of fCustomers) console.log(`   cliente ${c.code} — ${rowReason(c, ['code', 'name', 'industry'])}`);
      if (!fModels.length && !fMaterials.length && !fPlans.length && !fCustomers.length && !fHeaders.length) {
        console.log('   (nada — la base ya está limpia)');
      }

      const detected =
        fModels.length + fMaterials.length + fHeaders.length + fComponents.length +
        fPlans.length + fPositions.length + fMovements.length + fCustomers.length + fPrograms.length;

      // SALVAGUARDA PROD: por defecto es DRY-RUN (no borra nada). Sólo borra de
      // verdad con PURGE_CONFIRM=true — así una corrida accidental jamás destruye.
      if (process.env.PURGE_CONFIRM !== 'true') {
        wasDryRun = true;
        console.log(`\n· DRY-RUN: ${detected} registros confidenciales detectados. NO se borró nada.`);
        console.log('  Para borrar de verdad: PURGE_CONFIRM=true npm run seed:purge-clients');
        return;
      }

      // ── Borrado en orden de dependencias ────────────────────────────────
      console.log('\n· Borrando:');
      if (fKitIds.length) {
        const kms = await ds.getRepository(KitMaterial).find({ where: { kit: { id: In(fKitIds) } } as any });
        await removeEntities(ds.getRepository(KitMaterial), kms, 'kit_materials');
        await purgeKitDependents(ds, fKitIds);
      }
      if (fPlanIds.length) {
        const links = await ds.getRepository(EnterprisePlanLink).find({ where: { plan: { id: In(fPlanIds) } } as any });
        await removeEntities(ds.getRepository(EnterprisePlanLink), links, 'enterprise_plan_links');
        const kits = await ds.getRepository(Kit).find({ where: { plan: { id: In(fPlanIds) } } as any });
        await removeEntities(ds.getRepository(Kit), kits, 'kits');
      }
      await removeEntities(planRepo, fPlans, 'plans');
      await removeEntities(compRepo, fComponents, 'bom_components');
      await removeEntities(headerRepo, fHeaders, 'bom_headers');
      await removeEntities(modelRepo, fModels, 'pm_product_models');
      await removeEntities(movRepo, fMovements, 'inventory_movements');
      await removeEntities(posRepo, fPositions, 'inventory_positions');
      await removeEntities(matRepo, fMaterials, 'material_master');
      await removeEntities(progRepo, fPrograms, 'enterprise_programs');
      await removeEntities(custRepo, fCustomers, 'enterprise_customers');
    });

    console.log('────────────────────────────────────────────────────────────');
    if (wasDryRun) {
      console.log(' DRY-RUN — no se borró nada. Repite con PURGE_CONFIRM=true para purgar de verdad.');
    } else {
      console.log(` Total purgado: ${totalRemoved} filas de clientes reales.`);
      if (problems.length) {
        console.log(' Pasos con problemas (revisar manualmente):');
        for (const p of problems) console.log(`   - ${p}`);
      }
      console.log('✅ Purga completada (sólo se borró lo que coincide con la lista negra).');
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
