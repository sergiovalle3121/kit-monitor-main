/**
 * AXOS OS — Limpieza de los datos semilla DEMO.
 *
 * Elimina SOLO lo marcado como demo (identidad determinística desde el catálogo
 * compartido: modelos AX-*, partes del catálogo, almacenes AX-WH-*, órdenes
 * AX-WO-*, clientes/programas AX-*, correos @axos.example). Respeta el orden de
 * dependencias (hijos → padres) para no violar llaves foráneas.
 *
 * Pensado para que el dueño pueda limpiar incluso producción si llegó a sembrarla.
 * Por eso NO se bloquea por entorno: sólo borra lo demo y reporta lo que quitó.
 *
 * Uso: DATABASE_URL=... npm run seed:demo:clear
 */
import 'reflect-metadata';
import { DataSource, In, Like, ObjectLiteral, Repository } from 'typeorm';

import { ProductModel } from '../modules/product-models/entities/product-model.entity';
import { BomHeader } from '../modules/bom/entities/bom-header.entity';
import { BomComponent } from '../modules/bom/entities/bom-component.entity';
import { Plan } from '../modules/plans/entities/plan.entity';
import { Kit } from '../modules/kits/entities/kit.entity';
import { KitMaterial } from '../modules/kit-materials/entities/kit-material.entity';
import { InventoryPosition } from '../modules/inventory/entities/inventory-position.entity';
import { InventoryMovement } from '../modules/inventory/entities/inventory-movement.entity';
import { MaterialMaster } from '../modules/inventory/entities/material-master.entity';
import { EnterpriseWarehouse } from '../modules/enterprise-campus/entities/enterprise-warehouse.entity';
import { EnterpriseCustomer } from '../modules/enterprise-campus/entities/enterprise-customer.entity';
import { EnterpriseProgram } from '../modules/enterprise-campus/entities/enterprise-program.entity';
import { EnterprisePlanLink } from '../modules/enterprise-campus/entities/enterprise-plan-link.entity';
import { User } from '../modules/users/entities/user.entity';
import { Supplier } from '../modules/suppliers/entities/supplier.entity';
import { ErpSupplierPrice } from '../modules/erp-core/entities/erp-supplier-price.entity';
import { SfWorkOrder } from '../modules/production-plan/entities/sf-work-order.entity';
import { SfQualityHold } from '../modules/floor-quality/entities/sf-quality-hold.entity';
import { SfDowntimeEvent } from '../modules/oee/entities/sf-downtime-event.entity';
import { SfLineStation } from '../modules/line-engineering/entities/sf-line-station.entity';
import { ProcessStep } from '../modules/process-routing/entities/process-step.entity';
import { ProcessStepMaterial } from '../modules/process-routing/entities/process-step-material.entity';
import { WorkOrderExecution } from '../modules/mes-execution/entities/work-order-execution.entity';
import { ExecutionStep } from '../modules/mes-execution/entities/execution-step.entity';
import { ExecutionStepMaterial } from '../modules/mes-execution/entities/execution-step-material.entity';
import { ExecutionEvent } from '../modules/mes-execution/entities/execution-event.entity';
import { VisualAid } from '../modules/visual-aids/entities/visual-aid.entity';
import { BayLayout } from '../modules/bay-layout/entities/bay-layout.entity';
// Densidad Fase 2: herramientas nuevas/enriquecidas a limpiar (sólo lo demo).
import { Tool } from '../modules/tooling/entities/tool.entity';
import { Asset } from '../modules/maintenance/entities/asset.entity';
import { MaintenanceOrder } from '../modules/maintenance/entities/maintenance-order.entity';
import { WarehouseTask } from '../modules/inventory/entities/warehouse-task.entity';
import { ReplenishmentRule } from '../modules/inventory/entities/replenishment-rule.entity';
import { SCAR } from '../modules/suppliers/entities/scar.entity';
import { IQCInspection } from '../modules/quality/entities/iqc-inspection.entity';
import { NCR } from '../modules/ncr/entities/ncr.entity';
import { QualityHold } from '../modules/quality/entities/quality-hold.entity';

import { bootSeedContext, runInDemoContext } from './seed-context';
import {
  DEMO_ACTOR,
  DEMO_CUSTOMER_CODES,
  DEMO_MODEL_NUMBERS,
  DEMO_MV_REF_TYPES,
  DEMO_PART_NUMBERS,
  DEMO_PROGRAM_CODES,
  DEMO_SF_HOLDS,
  DEMO_SF_WORK_ORDERS,
  DEMO_SUBASSEMBLY_NUMBERS,
  DEMO_SUPPLIER_CODES,
  DEMO_USER_EMAILS,
  DEMO_WAREHOUSES,
  DEMO_WORK_ORDERS,
  SF_DOWNTIME_PREFIX,
  SF_HOLD_LOT,
  SF_WO_NOTE,
  DEMO_WH_TASK_PREFIX,
  DEMO_IQC_PREFIX,
  DEMO_SCAR_PREFIX,
  DEMO_NCR_PREFIX,
  DEMO_QHOLD_REASON,
} from './seed-constants';

const DEMO_WH_IDS = DEMO_WAREHOUSES.map((w) => w.id);

const summary: Array<{ label: string; removed: number; note?: string }> = [];

/** find → remove (agnóstico de PK y de motor de BD). Reporta cuántas filas quitó. */
async function removeBy<T extends ObjectLiteral>(
  repo: Repository<T>,
  where: any,
  label: string,
): Promise<number> {
  try {
    const rows = await repo.find({ where });
    if (!rows.length) {
      summary.push({ label, removed: 0 });
      return 0;
    }
    await repo.remove(rows);
    summary.push({ label, removed: rows.length });
    console.log(`  ✔ ${label}: ${rows.length} eliminadas`);
    return rows.length;
  } catch (err) {
    summary.push({ label, removed: 0, note: `ERROR: ${(err as Error).message}` });
    console.log(`  ✖ ${label}: no se pudo borrar — ${(err as Error).message}`);
    return 0;
  }
}

/** Borra dependientes de kits demo por columna kitId (defensivo; raw + try/catch). */
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
  for (const tgt of targets) {
    try {
      const res = await ds
        .createQueryBuilder()
        .delete()
        .from(tgt.table)
        .where(`"${tgt.col}" IN (:...ids)`, { ids: kitIds })
        .execute();
      if (res.affected) console.log(`  ✔ ${tgt.table}: ${res.affected} eliminadas (dependiente de kit)`);
    } catch {
      /* tabla/columna ausente o sin filas: ignorar (defensivo) */
    }
  }
}

async function run(): Promise<void> {
  console.log('════════════════════════════════════════════════════════════');
  console.log(' AXOS OS — Limpieza de datos semilla DEMO');
  console.log(`   Destino: ${process.env.DATABASE_URL || 'SQLite local'}`);
  console.log('════════════════════════════════════════════════════════════');

  const app = await bootSeedContext();
  const ds = app.get(DataSource);

  try {
    await runInDemoContext(app, async () => {
      const planRepo = ds.getRepository(Plan);
      const headerRepo = ds.getRepository(BomHeader);

      // Identidad de lo demo (ids necesarios para borrar dependientes primero).
      const demoPlans = await planRepo.find({
        where: [{ workOrder: In(DEMO_WORK_ORDERS) }, { model: In(DEMO_MODEL_NUMBERS) }],
        relations: ['kit'],
      });
      const planIds = demoPlans.map((p) => p.id);
      const kitIds = demoPlans.map((p) => p.kit?.id).filter((id): id is number => !!id);

      // Modelos finales + sub-ensambles (ambos tienen BOM header propio).
      const bomModels = [...DEMO_MODEL_NUMBERS, ...DEMO_SUBASSEMBLY_NUMBERS];
      const demoHeaders = await headerRepo.find({ where: { model: In(bomModels) } });
      const headerIds = demoHeaders.map((h) => h.id);

      console.log(`\n· Identificados: ${planIds.length} planes, ${kitIds.length} kits, ${headerIds.length} BOMs demo\n`);

      // ── Densidad Fase 2 (aditivo): herramientas nuevas/enriquecidas. Se quitan
      //    ANTES que proveedores (FK scar/iqc→supplier). Coincidencia exacta de
      //    marcador demo (prefijo AX-* o actor de siembra) — sólo borra lo demo.
      await removeBy(ds.getRepository(QualityHold), { reason: DEMO_QHOLD_REASON }, 'quality_holds (demo)');
      await removeBy(ds.getRepository(SCAR), { scarNumber: Like(`${DEMO_SCAR_PREFIX}%`) }, 'scars');
      await removeBy(ds.getRepository(IQCInspection), { inspectionNumber: Like(`${DEMO_IQC_PREFIX}%`) }, 'iqc_inspections');
      await removeBy(ds.getRepository(NCR), { ncrNumber: Like(`${DEMO_NCR_PREFIX}%`) }, 'ncrs');
      await removeBy(ds.getRepository(WarehouseTask), { taskNumber: Like(`${DEMO_WH_TASK_PREFIX}%`) }, 'warehouse_tasks');
      await removeBy(ds.getRepository(ReplenishmentRule), { warehouseId: In(DEMO_WH_IDS) }, 'replenishment_rules');
      await removeBy(ds.getRepository(MaintenanceOrder), { created_by: DEMO_ACTOR }, 'maintenance_orders');
      await removeBy(ds.getRepository(Asset), { created_by: DEMO_ACTOR }, 'assets');
      await removeBy(ds.getRepository(Tool), { created_by: DEMO_ACTOR }, 'tooling_assets');

      // ── 0) Sustrato de piso (aditivo del Paso 1): ejecución MES + ruteo +
      //       ayudas visuales + bahías. Se quita ANTES que planes/modelos.
      const execRepo = ds.getRepository(WorkOrderExecution);
      const demoExecs = await execRepo.find({
        where: [{ planId: In(planIds.length ? planIds : [-1]) }, { workOrder: In(DEMO_WORK_ORDERS) }],
      });
      const execIds = demoExecs.map((e) => e.id);
      if (execIds.length) {
        await removeBy(ds.getRepository(ExecutionEvent), { executionId: In(execIds) }, 'mes_execution_events');
        await removeBy(ds.getRepository(ExecutionStepMaterial), { executionId: In(execIds) }, 'mes_execution_step_materials');
        await removeBy(ds.getRepository(ExecutionStep), { executionId: In(execIds) }, 'mes_execution_steps');
        await removeBy(execRepo, { id: In(execIds) }, 'mes_work_order_executions');
      }

      // Ruta de proceso (process_steps + sus materiales) por modelo demo.
      const psRepo = ds.getRepository(ProcessStep);
      const demoSteps = await psRepo.find({ where: { model: In(DEMO_MODEL_NUMBERS) } });
      const stepIds = demoSteps.map((s) => s.id);
      if (stepIds.length) {
        await removeBy(ds.getRepository(ProcessStepMaterial), { stepId: In(stepIds) }, 'process_step_materials');
        await removeBy(psRepo, { id: In(stepIds) }, 'process_steps');
      }

      // Ruteo de ingeniería + ayudas visuales + bahías (por modelo demo).
      await removeBy(ds.getRepository(SfLineStation), { model: In(DEMO_MODEL_NUMBERS) }, 'sf_line_stations');
      await removeBy(ds.getRepository(VisualAid), { model: In(DEMO_MODEL_NUMBERS) }, 'visual_aids');
      await removeBy(ds.getRepository(BayLayout), { model: In(DEMO_MODEL_NUMBERS) }, 'bay_layouts');

      // ── Orden de dependencias: hijos → padres ───────────────────────────
      // 1) Materiales de kit
      if (kitIds.length) {
        await removeBy(ds.getRepository(KitMaterial), { kit: { id: In(kitIds) } }, 'kit_materials');
      } else {
        summary.push({ label: 'kit_materials', removed: 0 });
      }

      // 2) Dependientes varios de kit (defensivo)
      await purgeKitDependents(ds, kitIds);

      // 3) Enlaces plan↔enterprise (FK a plan)
      if (planIds.length) {
        await removeBy(ds.getRepository(EnterprisePlanLink), { plan: { id: In(planIds) } }, 'enterprise_plan_links');
      }

      // 4) Kits (FK a plan)
      if (planIds.length) {
        await removeBy(ds.getRepository(Kit), { plan: { id: In(planIds) } }, 'kits');
      }

      // 5) Planes
      if (demoPlans.length) {
        try {
          await planRepo.remove(demoPlans);
          summary.push({ label: 'plans', removed: demoPlans.length });
          console.log(`  ✔ plans: ${demoPlans.length} eliminadas`);
        } catch (err) {
          summary.push({ label: 'plans', removed: 0, note: `ERROR: ${(err as Error).message}` });
          console.log(`  ✖ plans: ${(err as Error).message}`);
        }
      } else {
        summary.push({ label: 'plans', removed: 0 });
      }

      // 6) Componentes de BOM (cascade también, pero explícito por seguridad)
      if (headerIds.length) {
        await removeBy(ds.getRepository(BomComponent), { bomHeaderId: In(headerIds) }, 'bom_components');
      }

      // 7) Cabeceras de BOM (modelos finales + sub-ensambles)
      await removeBy(ds.getRepository(BomHeader), { model: In(bomModels) }, 'bom_headers');

      // 8) Modelos
      await removeBy(ds.getRepository(ProductModel), { modelNumber: In(DEMO_MODEL_NUMBERS) }, 'pm_product_models');

      // 9) Movimientos de inventario (por referencia demo o parte demo)
      await removeBy(
        ds.getRepository(InventoryMovement),
        [{ referenceType: In(DEMO_MV_REF_TYPES) }, { partNumber: In(DEMO_PART_NUMBERS) }],
        'inventory_movements',
      );

      // 10) Posiciones de inventario (por parte demo o almacén demo)
      await removeBy(
        ds.getRepository(InventoryPosition),
        [{ partNumber: In(DEMO_PART_NUMBERS) }, { warehouseId: In(DEMO_WH_IDS) }],
        'inventory_positions',
      );

      // 11) Precios de proveedor + proveedores demo (antes que materiales)
      await removeBy(ds.getRepository(ErpSupplierPrice), { partNumber: In(DEMO_PART_NUMBERS) }, 'erp_supplier_prices');
      await removeBy(ds.getRepository(Supplier), { code: In(DEMO_SUPPLIER_CODES) }, 'suppliers');

      // 12) Materiales (partes hoja + sub-ensambles) — después de posiciones
      await removeBy(
        ds.getRepository(MaterialMaster),
        { partNumber: In([...DEMO_PART_NUMBERS, ...DEMO_SUBASSEMBLY_NUMBERS]) },
        'material_master',
      );

      // 12) Almacenes (después de posiciones)
      await removeBy(ds.getRepository(EnterpriseWarehouse), { id: In(DEMO_WH_IDS) }, 'enterprise_warehouses');

      // 13) Programas (antes que clientes; FK RESTRICT)
      await removeBy(ds.getRepository(EnterpriseProgram), { code: In(DEMO_PROGRAM_CODES) }, 'enterprise_programs');

      // 14) Clientes
      await removeBy(ds.getRepository(EnterpriseCustomer), { code: In(DEMO_CUSTOMER_CODES) }, 'enterprise_customers');

      // 15) Piso de producción: holds + downtime (referencian WO por string) → WOs
      await removeBy(
        ds.getRepository(SfQualityHold),
        { lot: In(DEMO_SF_HOLDS.map((h) => SF_HOLD_LOT(h.woRef))) },
        'sf_quality_holds',
      );
      await removeBy(
        ds.getRepository(SfDowntimeEvent),
        { reasonNote: Like(`${SF_DOWNTIME_PREFIX}%`) },
        'sf_downtime_events',
      );
      await removeBy(
        ds.getRepository(SfWorkOrder),
        { notes: In(DEMO_SF_WORK_ORDERS.map((w) => SF_WO_NOTE(w.ref))) },
        'sf_work_orders',
      );

      // 16) Usuarios demo
      await removeBy(ds.getRepository(User), { email: In(DEMO_USER_EMAILS) }, 'users');
    });

    const total = summary.reduce((a, s) => a + s.removed, 0);
    const failed = summary.filter((s) => s.note);
    console.log('────────────────────────────────────────────────────────────');
    console.log(` Total eliminado: ${total} filas demo.`);
    if (failed.length) {
      console.log(' Pasos con problemas (revisar manualmente):');
      for (const f of failed) console.log(`   - ${f.label}: ${f.note}`);
    }
    console.log('✅ Limpieza DEMO completada (sólo se borró lo marcado como demo).');
    console.log('────────────────────────────────────────────────────────────');
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error('❌ Limpieza DEMO falló:', err);
  process.exit(1);
});
