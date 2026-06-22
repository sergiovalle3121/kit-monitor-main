/**
 * AXOS OS — Seed DEMO (datos semilla FUNCIONALES, universo AXOS).
 *
 * Crea datos realistas llamando a los SERVICIOS REALES (igual que si un usuario
 * los capturara): estados (DRAFT→ACTIVE), folios, explosión de BOM y valuación
 * de inventario se calculan de verdad. NADA de INSERT crudo saltándose la lógica.
 *
 * Idempotente: si el dato ya existe (por su clave), no se duplica. Se puede correr
 * dos veces sin romper. Todo queda marcado como demo para poder limpiarlo después
 * con `seed-demo-clear.ts`.
 *
 * Uso:
 *   DATABASE_URL=... npm run seed:demo
 *   (o)  ts-node -r tsconfig-paths/register src/seed/seed-demo.ts
 */
import 'reflect-metadata';
import { INestApplicationContext } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { ProductModelsService } from '../modules/product-models/product-models.service';
import { BomService } from '../modules/bom/bom.service';
import { BomHeader, BomStatus } from '../modules/bom/entities/bom-header.entity';
import { InventoryService } from '../modules/inventory/inventory.service';
import { InventoryMovement } from '../modules/inventory/entities/inventory-movement.entity';
import { InventoryPosition } from '../modules/inventory/entities/inventory-position.entity';
import { MaterialMaster } from '../modules/inventory/entities/material-master.entity';
import { PlansService } from '../modules/plans/plans.service';
import { Plan } from '../modules/plans/entities/plan.entity';
import { PickListService } from '../modules/pick-lists/pick-list.service';
import { EnterpriseCampusService } from '../modules/enterprise-campus/enterprise-campus.service';
import { EnterpriseWarehouse } from '../modules/enterprise-campus/entities/enterprise-warehouse.entity';
import { EnterpriseCustomer } from '../modules/enterprise-campus/entities/enterprise-customer.entity';
import { EnterpriseProgram } from '../modules/enterprise-campus/entities/enterprise-program.entity';
import { UsersService } from '../modules/users/users.service';
import { User } from '../modules/users/entities/user.entity';
import { SuppliersService } from '../modules/suppliers/suppliers.service';
import { Supplier } from '../modules/suppliers/entities/supplier.entity';
import { ErpMmService } from '../modules/erp-core/services/erp-mm.service';
import { ProductionPlanService } from '../modules/production-plan/production-plan.service';
import { SfWorkOrder } from '../modules/production-plan/entities/sf-work-order.entity';
import { FloorQualityService } from '../modules/floor-quality/floor-quality.service';
import { SfQualityHold } from '../modules/floor-quality/entities/sf-quality-hold.entity';
import { OeeService } from '../modules/oee/oee.service';
import { SfDowntimeEvent } from '../modules/oee/entities/sf-downtime-event.entity';
import { LineEngineeringService } from '../modules/line-engineering/line-engineering.service';
import { SfLineStation } from '../modules/line-engineering/entities/sf-line-station.entity';
import { ProcessRoutingService } from '../modules/process-routing/process-routing.service';
import { ProcessStep } from '../modules/process-routing/entities/process-step.entity';
import { ProcessStepMaterial } from '../modules/process-routing/entities/process-step-material.entity';
import { MesExecutionService } from '../modules/mes-execution/mes-execution.service';
import { WorkOrderExecution } from '../modules/mes-execution/entities/work-order-execution.entity';
import { ExecutionStep } from '../modules/mes-execution/entities/execution-step.entity';
import { VisualAid } from '../modules/visual-aids/entities/visual-aid.entity';
import { BayLayout } from '../modules/bay-layout/entities/bay-layout.entity';

// Dominios de negocio (para que cada módulo del hub muestre datos reales).
import { CrmService } from '../modules/crm/crm.service';
import { Opportunity } from '../modules/crm/entities/opportunity.entity';
import { EhsService } from '../modules/ehs/ehs.service';
import { SafetyIncident } from '../modules/ehs/entities/safety-incident.entity';
import { MaintenanceService } from '../modules/maintenance/maintenance.service';
import { Asset } from '../modules/maintenance/entities/asset.entity';
import { MaintenanceOrder } from '../modules/maintenance/entities/maintenance-order.entity';
import { LegalService } from '../modules/legal/legal.service';
import { Contract } from '../modules/legal/entities/contract.entity';
import { ExpensesService } from '../modules/expenses/expenses.service';
import { ExpenseReport } from '../modules/expenses/entities/expense-report.entity';
import { FixedAssetsService } from '../modules/fixed-assets/fixed-assets.service';
import { FixedAsset } from '../modules/fixed-assets/entities/fixed-asset.entity';
import { ToolingService } from '../modules/tooling/tooling.service';
import { Tool } from '../modules/tooling/entities/tool.entity';
import { ProcurementService } from '../modules/procurement/procurement.service';
import { PurchaseOrder } from '../modules/procurement/entities/purchase-order.entity';
import { RmaService } from '../modules/rma/rma.service';
import { RmaCase } from '../modules/rma/entities/rma-case.entity';

import {
  assertNotProduction,
  bootSeedContext,
  runInDemoContext,
} from './seed-context';
import {
  assertSeedCustomer,
  assertSeedModel,
  assertSeedPart,
  assertSeedText,
  validateDemoCatalog,
} from './public-domain-guard';
import { assertDatabasePublicDomain } from './forbidden-scan';
import {
  DEMO_ACTOR,
  DEMO_BOM_REVISION,
  DEMO_COMPANY,
  DEMO_CUSTOMERS,
  DEMO_HOLDS,
  DEMO_MES_WALK_UNITS,
  DEMO_MES_WORK_ORDERS,
  DEMO_MODELS,
  DEMO_PARTS,
  DEMO_PLANS,
  DEMO_PLANT,
  DEMO_PROGRAMS,
  DEMO_PROCESS_REVISION,
  DEMO_ROUTING_REVISION,
  DEMO_ROUTINGS,
  MES_SEED_CRID,
  DEMO_SF_DOWNTIME,
  DEMO_SF_HOLDS,
  DEMO_SF_WORK_ORDERS,
  DEMO_SUBASSEMBLIES,
  DEMO_SUBASSEMBLY_PARTS,
  DEMO_SUPPLIERS,
  DEMO_SUPPLIER_PRICES,
  SF_DOWNTIME_PREFIX,
  SF_HOLD_LOT,
  SF_WO_NOTE,
  DEMO_USERS,
  DEMO_USER_PASSWORD,
  DEMO_WAREHOUSES,
  DEMO_WH_QA,
  DEMO_WH_RM,
  MV_REF_CONSUME,
  MV_REF_HOLD,
  MV_REF_RECEIVE,
  slugCode,
} from './seed-constants';

/** Ubicación física fija para las recepciones/consumos demo (una posición por parte). */
const RM_LOCATION = 'A-01';

interface Tally {
  created: number;
  skipped: number;
  errors: number;
}
const tally = (): Tally => ({ created: 0, skipped: 0, errors: 0 });

function log(section: string, msg: string): void {
  console.log(`  [${section}] ${msg}`);
}

/**
 * Metadata de demo tipada como `any` a propósito: las columnas `metadata` son
 * índices abiertos (`Record<string, any>`) y el tipado de `repo.update/create`
 * de TypeORM rechaza literales `true` en esos índices. Devolver `any` evita esa
 * fricción sin perder la marca `{ demo: true }`.
 */
function demoMeta(extra: Record<string, any> = {}): any {
  return { demo: true, ...extra };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Almacenes (master data; FK de inventory_positions)
// ─────────────────────────────────────────────────────────────────────────────
async function seedWarehouses(ds: DataSource): Promise<Tally> {
  const repo = ds.getRepository(EnterpriseWarehouse);
  const t = tally();
  for (const wh of DEMO_WAREHOUSES) {
    try {
      const existing = await repo.findOne({ where: { id: wh.id } });
      if (existing) {
        t.skipped++;
        continue;
      }
      await repo.save(
        repo.create({
          id: wh.id,
          code: wh.code,
          name: wh.name,
          type: wh.type,
          status: 'active',
          locationCount: wh.locationCount,
          sortOrder: wh.sortOrder,
          building: null,
          metadata: demoMeta({ plant: DEMO_PLANT }),
        }),
      );
      t.created++;
    } catch (err) {
      t.errors++;
      log('almacenes', `ERROR ${wh.id}: ${(err as Error).message}`);
    }
  }
  log('almacenes', `creados=${t.created} ya existían=${t.skipped} errores=${t.errors}`);
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Clientes + Programas (sub-marcas AXOS) vía EnterpriseCampusService
// ─────────────────────────────────────────────────────────────────────────────
async function seedCustomersAndPrograms(
  app: INestApplicationContext,
  ds: DataSource,
): Promise<Tally> {
  const enterprise = app.get(EnterpriseCampusService, { strict: false });
  const custRepo = ds.getRepository(EnterpriseCustomer);
  const progRepo = ds.getRepository(EnterpriseProgram);
  const t = tally();

  for (const c of DEMO_CUSTOMERS) {
    try {
      assertSeedCustomer(c.name);
      assertSeedText(c.industry, `industria de ${c.code}`);
      const existing = await custRepo.findOne({ where: { code: c.code } });
      if (existing) {
        t.skipped++;
        continue;
      }
      const saved = await enterprise.createCustomer({
        code: c.code,
        name: c.name,
        industry: c.industry,
        status: 'active',
      } as any);
      await custRepo.update(saved.id, { metadata: demoMeta() });
      t.created++;
    } catch (err) {
      t.errors++;
      log('clientes', `ERROR ${c.code}: ${(err as Error).message}`);
    }
  }

  for (const p of DEMO_PROGRAMS) {
    try {
      assertSeedText(p.name, `nombre de programa ${p.code}`);
      const existing = await progRepo.findOne({ where: { code: p.code } });
      if (existing) {
        t.skipped++;
        continue;
      }
      const saved = await enterprise.createProgram({
        code: p.code,
        name: p.name,
        customerId: slugCode(p.customerCode),
        status: p.status,
        primaryModelPrefix: p.prefix,
      } as any);
      await progRepo.update(saved.id, { metadata: demoMeta() });
      t.created++;
    } catch (err) {
      t.errors++;
      log('programas', `ERROR ${p.code}: ${(err as Error).message}`);
    }
  }

  log('clientes/prog', `creados=${t.created} ya existían=${t.skipped} errores=${t.errors}`);
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Partes (MaterialMaster) vía InventoryService.ensureMaterial (idempotente)
// ─────────────────────────────────────────────────────────────────────────────
async function seedMaterials(
  app: INestApplicationContext,
  ds: DataSource,
): Promise<Tally> {
  const inventory = app.get(InventoryService, { strict: false });
  const matRepo = ds.getRepository(MaterialMaster);
  const t = tally();

  // Partes hoja (commodities) + sub-ensambles (PCBAs/sub-módulos) como materiales.
  for (const part of [...DEMO_PARTS, ...DEMO_SUBASSEMBLY_PARTS]) {
    try {
      assertSeedPart(part.partNumber);
      assertSeedText(part.description, `descripción de ${part.partNumber}`);
      const before = await matRepo.findOne({ where: { partNumber: part.partNumber } });
      const mat = await inventory.ensureMaterial({
        partNumber: part.partNumber,
        description: part.description,
        uom: part.uom,
        standardCost: part.standardCost,
        category: part.category,
      });
      // Marca demo + clase ABC + AVL (fabricante/MPN ficticios). ensureMaterial no
      // las toca, así que se persisten aquí. Idempotente.
      if (!mat.metadata?.demo || mat.abcClass !== part.abcClass || !mat.metadata?.avl) {
        await matRepo.update(part.partNumber, {
          metadata: demoMeta({ avl: part.avl }),
          abcClass: part.abcClass,
        });
      }
      before ? t.skipped++ : t.created++;
    } catch (err) {
      t.errors++;
      log('partes', `ERROR ${part.partNumber}: ${(err as Error).message}`);
    }
  }
  log('partes', `creadas=${t.created} ya existían=${t.skipped} errores=${t.errors}`);
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3b. Proveedores ficticios (Supplier) + precios (ErpSupplierPrice)
// ─────────────────────────────────────────────────────────────────────────────
async function seedSuppliers(
  app: INestApplicationContext,
  ds: DataSource,
): Promise<Tally> {
  const suppliersSvc = app.get(SuppliersService, { strict: false });
  const repo = ds.getRepository(Supplier);
  const t = tally();
  for (const s of DEMO_SUPPLIERS) {
    try {
      assertSeedText(s.name, `nombre de proveedor ${s.code}`);
      const existing = await repo.findOne({ where: { code: s.code } });
      if (existing) {
        t.skipped++;
        continue;
      }
      await suppliersSvc.create({
        code: s.code,
        name: s.name,
        country: s.country,
        status: 'active',
        qualityScore: s.qualityScore,
        notes: 'Proveedor demo AXOS (dominio público)',
      });
      t.created++;
    } catch (err) {
      t.errors++;
      log('proveedores', `ERROR ${s.code}: ${(err as Error).message}`);
    }
  }
  log('proveedores', `creados=${t.created} ya existían=${t.skipped} errores=${t.errors}`);
  return t;
}

async function seedSupplierPrices(
  app: INestApplicationContext,
  ds: DataSource,
): Promise<Tally> {
  const erpMm = app.get(ErpMmService, { strict: false });
  const repo = ds.getRepository(Supplier);
  const t = tally();
  const idByCode = new Map((await repo.find()).map((s) => [s.code, s.id]));

  for (const p of DEMO_SUPPLIER_PRICES) {
    try {
      const supplierId = idByCode.get(p.supplierCode);
      if (!supplierId) {
        t.skipped++;
        continue;
      }
      // upsert idempotente (clave única supplierId+partNumber).
      await erpMm.upsertSupplierPrice({
        supplierId,
        partNumber: p.partNumber,
        unitPrice: p.unitPrice,
        currency: p.currency,
        moq: p.moq,
        leadTimeDays: p.leadTimeDays,
        preferred: p.preferred,
        active: true,
      });
      t.created++;
    } catch (err) {
      t.errors++;
      log('precios', `ERROR ${p.partNumber}/${p.supplierCode}: ${(err as Error).message}`);
    }
  }
  log('precios prov.', `upserts=${t.created} omitidos=${t.skipped} errores=${t.errors}`);
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Recepciones de inventario (RECEIVE) → posiciones + valuación
// ─────────────────────────────────────────────────────────────────────────────
async function seedReceipts(
  app: INestApplicationContext,
  ds: DataSource,
): Promise<Tally> {
  const inventory = app.get(InventoryService, { strict: false });
  const mvRepo = ds.getRepository(InventoryMovement);
  const t = tally();

  for (const part of DEMO_PARTS) {
    const referenceId = `RCV-${part.partNumber}`;
    try {
      const exists = await mvRepo.findOne({
        where: { referenceType: MV_REF_RECEIVE, referenceId },
      });
      if (exists) {
        t.skipped++;
        continue;
      }
      await inventory.recordTransaction({
        type: 'RECEIVE',
        partNumber: part.partNumber,
        quantity: part.recvQty,
        // `inventory_movements.fromWarehouseId` es NOT NULL en el esquema; para una
        // recepción (sin origen) usamos cadena vacía como centinela "externo":
        // `if (dto.fromWarehouseId)` queda falso (no descuenta) y se satisface NOT NULL.
        fromWarehouseId: '',
        toWarehouseId: DEMO_WH_RM,
        toLocation: RM_LOCATION,
        actorName: DEMO_ACTOR,
        referenceType: MV_REF_RECEIVE,
        referenceId,
        reason: 'Recepción semilla demo AXOS',
      });
      t.created++;
    } catch (err) {
      t.errors++;
      log('recepciones', `ERROR ${part.partNumber}: ${(err as Error).message}`);
    }
  }
  log('recepciones', `creadas=${t.created} ya existían=${t.skipped} errores=${t.errors}`);
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Modelos (ProductModel) DRAFT→ACTIVE
// ─────────────────────────────────────────────────────────────────────────────
async function seedModels(app: INestApplicationContext): Promise<Tally> {
  const models = app.get(ProductModelsService, { strict: false });
  const t = tally();

  for (const m of DEMO_MODELS) {
    try {
      assertSeedModel(m.modelNumber);
      assertSeedCustomer(m.customer);
      assertSeedText(m.name, `nombre de ${m.modelNumber}`);
      assertSeedText(m.description, `descripción de ${m.modelNumber}`);
      for (const line of m.bom) assertSeedPart(line.part);
      const existing = await models.findByNumber(m.modelNumber);
      if (existing) {
        if (existing.status === 'DRAFT') await models.activate(existing.id);
        t.skipped++;
        continue;
      }
      const created = await models.create({
        modelNumber: m.modelNumber,
        name: m.name,
        customer: m.customer,
        revision: m.revision,
        description: m.description,
        programId: slugCode(m.programCode),
        metadata: demoMeta({
          programa: m.customer,
          company: DEMO_COMPANY,
          plant: DEMO_PLANT,
        }),
      });
      await models.activate(created.id);
      t.created++;
    } catch (err) {
      t.errors++;
      log('modelos', `ERROR ${m.modelNumber}: ${(err as Error).message}`);
    }
  }
  log('modelos', `creados=${t.created} ya existían=${t.skipped} errores=${t.errors}`);
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. BOM por modelo DRAFT→APPROVED→ACTIVE
// ─────────────────────────────────────────────────────────────────────────────
async function ensureBomActive(
  bomSvc: BomService,
  header: BomHeader,
): Promise<void> {
  if (header.status === BomStatus.ACTIVE) return;
  if (header.status === BomStatus.APPROVED) {
    await bomSvc.activateBom(header.id);
    return;
  }
  await bomSvc.approveBom(header.id, DEMO_ACTOR);
  await bomSvc.activateBom(header.id);
}

/** Crea (idempotente) y activa un BOM para `model` con sus líneas. Soporta multinivel
 *  (line.level se pasa tal cual: 2 = referencia a sub-ensamble). */
async function ensureBomFor(
  bomSvc: BomService,
  headerRepo: Repository<BomHeader>,
  spec: {
    model: string;
    productName: string;
    description: string;
    bom: Array<{ part: string; qty: number; ref?: string; level?: number }>;
  },
): Promise<'created' | 'skipped'> {
  const existing = await headerRepo.findOne({
    where: { model: spec.model, revision: DEMO_BOM_REVISION },
    relations: ['components'],
  });
  if (existing) {
    await ensureBomActive(bomSvc, existing);
    return 'skipped';
  }
  const header = await bomSvc.createBomWithComponents({
    model: spec.model,
    productName: spec.productName,
    revision: DEMO_BOM_REVISION,
    bomType: 'Manufacturing',
    baseQuantity: 1,
    baseUnit: 'EA',
    description: spec.description,
    createdBy: DEMO_ACTOR,
    components: spec.bom.map((line) => ({
      componentNumber: line.part,
      quantity: line.qty,
      unit: 'EA',
      usageFactor: 1,
      referenceDesignator: line.ref,
      level: line.level,
    })),
  });
  await headerRepo.update(header.id, { metadata: demoMeta() });
  await ensureBomActive(bomSvc, await headerRepo.findOneOrFail({ where: { id: header.id } }));
  return 'created';
}

async function seedBoms(app: INestApplicationContext, ds: DataSource): Promise<Tally> {
  const bomSvc = app.get(BomService, { strict: false });
  const headerRepo = ds.getRepository(BomHeader);
  const t = tally();

  // Sub-ensambles primero (sus BOMs existen antes de que los modelos los referencien).
  for (const sa of DEMO_SUBASSEMBLIES) {
    try {
      const r = await ensureBomFor(bomSvc, headerRepo, {
        model: sa.partNumber,
        productName: sa.name,
        description: `BOM sub-ensamble ${sa.partNumber} — ${sa.name}`,
        bom: sa.bom,
      });
      r === 'created' ? t.created++ : t.skipped++;
    } catch (err) {
      t.errors++;
      log('bom', `ERROR ${sa.partNumber}: ${(err as Error).message}`);
    }
  }

  for (const m of DEMO_MODELS) {
    try {
      const r = await ensureBomFor(bomSvc, headerRepo, {
        model: m.modelNumber,
        productName: m.name,
        description: `BOM demo ${m.modelNumber} — ${m.name}`,
        bom: m.bom,
      });
      r === 'created' ? t.created++ : t.skipped++;
    } catch (err) {
      t.errors++;
      log('bom', `ERROR ${m.modelNumber}: ${(err as Error).message}`);
    }
  }
  log('bom', `creados=${t.created} ya existían=${t.skipped} errores=${t.errors}`);
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Planes (algunos pending, otros published → kit con BOM explotado)
// ─────────────────────────────────────────────────────────────────────────────
async function seedPlans(app: INestApplicationContext, ds: DataSource): Promise<Tally> {
  const plansSvc = app.get(PlansService, { strict: false });
  const pickList = app.get(PickListService, { strict: false });
  const planRepo = ds.getRepository(Plan);
  const t = tally();
  let published = 0;

  for (const p of DEMO_PLANS) {
    try {
      let plan = await planRepo.findOne({
        where: { workOrder: p.workOrder },
        relations: ['kit'],
      });
      if (!plan) {
        const created = await plansSvc.create({
          workOrder: p.workOrder,
          model: p.model,
          quantity: p.quantity,
          line: p.line,
          shift: p.shift,
        });
        await planRepo.update(created.id, { priority: p.priority });
        plan = await planRepo.findOne({
          where: { workOrder: p.workOrder },
          relations: ['kit'],
        });
        t.created++;
      } else {
        t.skipped++;
      }

      // Publicar (explota el BOM ACTIVE en kit) si corresponde y aún no tiene kit.
      if (p.publish && plan && !plan.kit) {
        await pickList.publishPlan(plan.id, DEMO_ACTOR);
        published++;
      }
    } catch (err) {
      t.errors++;
      log('planes', `ERROR ${p.workOrder}: ${(err as Error).message}`);
    }
  }
  log('planes', `creados=${t.created} ya existían=${t.skipped} publicados(kits)=${published} errores=${t.errors}`);
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Consumo (CONSUME / backflush) para las WO publicadas → historial de movimientos
// ─────────────────────────────────────────────────────────────────────────────
async function seedConsumption(
  app: INestApplicationContext,
  ds: DataSource,
): Promise<Tally> {
  const inventory = app.get(InventoryService, { strict: false });
  const mvRepo = ds.getRepository(InventoryMovement);
  const recvByPart = new Map(DEMO_PARTS.map((p) => [p.partNumber, p.recvQty]));
  const modelByNumber = new Map(DEMO_MODELS.map((m) => [m.modelNumber, m]));
  const t = tally();

  for (const plan of DEMO_PLANS.filter((p) => p.publish)) {
    const model = modelByNumber.get(plan.model);
    if (!model) continue;
    for (const line of model.bom) {
      const need = line.qty * plan.quantity;
      const recv = recvByPart.get(line.part) ?? 0;
      // Guarda existencias: sólo consume si deja > 50% en mano (evita faltantes).
      if (need > recv * 0.5) {
        t.skipped++;
        continue;
      }
      const referenceId = `CON-${plan.workOrder}-${line.part}`;
      try {
        const exists = await mvRepo.findOne({
          where: { referenceType: MV_REF_CONSUME, referenceId },
        });
        if (exists) {
          t.skipped++;
          continue;
        }
        await inventory.recordTransaction({
          type: 'CONSUME',
          partNumber: line.part,
          quantity: need,
          fromWarehouseId: DEMO_WH_RM,
          fromLocation: RM_LOCATION,
          // Centinela "sin destino" (backflush): `toWarehouseId` es NOT NULL en el
          // esquema; cadena vacía deja `if (dto.toWarehouseId)` falso (no agrega).
          toWarehouseId: '',
          actorName: DEMO_ACTOR,
          referenceType: MV_REF_CONSUME,
          referenceId,
          reason: `Backflush demo WO ${plan.workOrder}`,
        });
        t.created++;
      } catch (err) {
        t.errors++;
        log('consumo', `ERROR ${referenceId}: ${(err as Error).message}`);
      }
    }
  }
  log('consumo', `movimientos=${t.created} omitidos=${t.skipped} errores=${t.errors}`);
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// 8b. Calidad: existencias en cuarentena / inspección (holdStatus ≠ available)
// ─────────────────────────────────────────────────────────────────────────────
async function seedQualityHolds(
  app: INestApplicationContext,
  ds: DataSource,
): Promise<Tally> {
  const inventory = app.get(InventoryService, { strict: false });
  const mvRepo = ds.getRepository(InventoryMovement);
  const t = tally();

  for (const hold of DEMO_HOLDS) {
    const referenceId = `QA-${hold.part}`;
    try {
      const exists = await mvRepo.findOne({
        where: { referenceType: MV_REF_HOLD, referenceId },
      });
      if (exists) {
        t.skipped++;
        continue;
      }
      await inventory.recordTransaction({
        type: 'RECEIVE',
        partNumber: hold.part,
        quantity: hold.quantity,
        fromWarehouseId: '',
        toWarehouseId: DEMO_WH_QA,
        toLocation: 'QA-HOLD',
        holdStatus: hold.holdStatus,
        actorName: DEMO_ACTOR,
        referenceType: MV_REF_HOLD,
        referenceId,
        reason: `Material en ${hold.holdStatus} (inspección de calidad)`,
      });
      t.created++;
    } catch (err) {
      t.errors++;
      log('calidad', `ERROR ${hold.part}: ${(err as Error).message}`);
    }
  }
  log('calidad', `holds=${t.created} ya existían=${t.skipped} errores=${t.errors}`);
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Usuarios demo (roles variados) — opcional pero útil para probar permisos
// ─────────────────────────────────────────────────────────────────────────────
async function seedUsers(app: INestApplicationContext): Promise<Tally> {
  const usersSvc = app.get(UsersService, { strict: false });
  const t = tally();

  for (const u of DEMO_USERS) {
    try {
      const existing = await usersSvc.findOneByEmail(u.email);
      if (existing) {
        t.skipped++;
        continue;
      }
      await usersSvc.create({
        email: u.email,
        username: u.username,
        name: u.name,
        role: u.role as User['role'],
        position: u.position,
        password: DEMO_USER_PASSWORD,
        status: 'active',
        isActive: true,
      });
      t.created++;
    } catch (err) {
      t.errors++;
      log('usuarios', `ERROR ${u.email}: ${(err as Error).message}`);
    }
  }
  log('usuarios', `creados=${t.created} ya existían=${t.skipped} errores=${t.errors}`);
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Piso de producción: WOs sf_work_orders en distintos estados + historia
//     (avances, holds de calidad, downtime). Usa los servicios reales del piso.
// ─────────────────────────────────────────────────────────────────────────────
async function seedShopFloor(
  app: INestApplicationContext,
  ds: DataSource,
): Promise<Tally> {
  const planSvc = app.get(ProductionPlanService, { strict: false });
  const qualitySvc = app.get(FloorQualityService, { strict: false });
  const oeeSvc = app.get(OeeService, { strict: false });
  const woRepo = ds.getRepository(SfWorkOrder);
  const holdRepo = ds.getRepository(SfQualityHold);
  const dtRepo = ds.getRepository(SfDowntimeEvent);
  const programByModel = new Map(DEMO_MODELS.map((m) => [m.modelNumber, slugCode(m.programCode)]));
  const t = tally();
  const woIdByRef = new Map<string, string>();

  // ── Work orders (publicar + llevar a su estado objetivo) ──
  for (const w of DEMO_SF_WORK_ORDERS) {
    try {
      const note = SF_WO_NOTE(w.ref);
      let wo = await woRepo.findOne({ where: { notes: note } });
      if (!wo) {
        wo = await planSvc.publish({
          model: w.model,
          line: w.line,
          quantityPlanned: w.quantityPlanned,
          customer: w.customer,
          priority: w.priority,
          taktTargetSec: w.taktTargetSec,
          faiRequired: w.faiRequired ?? false,
          notes: note,
          programId: programByModel.get(w.model) ?? undefined,
        });
        if (w.faiRequired) await planSvc.setFaiApproved(wo.id, true);
        if (w.state !== 'RELEASED') await planSvc.setMaterialReady(wo.id, true); // → STAGED
        if (w.state === 'IN_EXECUTION') {
          await planSvc.incrementCompleted(wo.id, Math.min(w.completed ?? 1, Math.max(1, w.quantityPlanned - 1)));
        }
        if (w.state === 'COMPLETED') await planSvc.incrementCompleted(wo.id, w.quantityPlanned);
        t.created++;
      } else {
        t.skipped++;
      }
      woIdByRef.set(w.ref, wo.id);
    } catch (err) {
      t.errors++;
      log('work orders', `ERROR ${w.ref}: ${(err as Error).message}`);
    }
  }
  log('work orders', `creadas=${t.created} ya existían=${t.skipped} errores=${t.errors}`);

  // ── Holds de calidad (bloquean su WO) ──
  let holds = 0;
  for (const h of DEMO_SF_HOLDS) {
    try {
      const lot = SF_HOLD_LOT(h.woRef);
      if (await holdRepo.findOne({ where: { lot } })) continue;
      await qualitySvc.createHold({
        part: h.part,
        qty: h.qty,
        woId: woIdByRef.get(h.woRef),
        lot,
        origin: 'IN_PROCESS',
        defectType: h.defectType,
        severity: h.severity,
      });
      holds++;
    } catch (err) {
      log('holds', `ERROR ${h.woRef}: ${(err as Error).message}`);
    }
  }
  log('holds', `creados=${holds} (de ${DEMO_SF_HOLDS.length})`);

  // ── Downtime / paros (cerrados con duración, o un OPEN en curso) ──
  let downtime = 0;
  for (const d of DEMO_SF_DOWNTIME) {
    try {
      const reasonNote = `${SF_DOWNTIME_PREFIX} ${d.note}`;
      if (await dtRepo.findOne({ where: { reasonNote } })) continue;
      const ev = await oeeSvc.openDowntime({
        line: d.line,
        reasonCode: d.reasonCode,
        reasonNote,
        startAt: new Date(Date.now() - d.startMinAgo * 60_000).toISOString(),
      });
      if (d.durationMin > 0) {
        await oeeSvc.closeDowntime(ev.id, {
          endAt: new Date(Date.now() - (d.startMinAgo - d.durationMin) * 60_000).toISOString(),
        });
      }
      downtime++;
    } catch (err) {
      log('downtime', `ERROR ${d.line}: ${(err as Error).message}`);
    }
  }
  log('downtime', `creados=${downtime} (de ${DEMO_SF_DOWNTIME.length})`);

  t.created += holds + downtime;
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. Ayudas visuales (VisualAid) por modelo+estación AX.
//     Asset placeholder de dominio público (filename) enlazado desde el ruteo.
// ─────────────────────────────────────────────────────────────────────────────
async function seedVisualAids(ds: DataSource): Promise<Tally> {
  const repo = ds.getRepository(VisualAid);
  const t = tally();
  for (const route of DEMO_ROUTINGS) {
    for (const s of route.stations) {
      try {
        assertSeedModel(route.model);
        assertSeedText(s.visualAidTitle, `título de ayuda visual ${s.visualAidId}`);
        const existing = await repo.findOne({ where: { id: s.visualAidId } });
        if (existing) {
          t.skipped++;
          continue;
        }
        await repo.save(
          repo.create({
            id: s.visualAidId,
            model: route.model,
            title: s.visualAidTitle,
            process: s.name,
            area: s.station,
            revision: DEMO_ROUTING_REVISION,
            pdfUrl: s.visualAidFile, // columna `filename` (placeholder dominio público)
            isActive: true,
            uploadedBy: DEMO_ACTOR,
            notes: 'Ayuda visual demo AXOS (dominio público)',
          }),
        );
        t.created++;
      } catch (err) {
        t.errors++;
        log('ayudas visuales', `ERROR ${s.visualAidId}: ${(err as Error).message}`);
      }
    }
  }
  log('ayudas visuales', `creadas=${t.created} ya existían=${t.skipped} errores=${t.errors}`);
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. Ruteo / layout por estación (keystone). Dos vistas consistentes del MISMO
//     catálogo (DEMO_ROUTINGS), bajo el MISMO tenant demo (ámbito nulo):
//       • SfLineStation (line-engineering, rev 'A')  → stationRequirements()/surtido.
//       • ProcessStep + ProcessStepMaterial (rev '1.0') → lo que explota mes-execution.
// ─────────────────────────────────────────────────────────────────────────────
async function seedRouting(app: INestApplicationContext, ds: DataSource): Promise<Tally> {
  const lineEng = app.get(LineEngineeringService, { strict: false });
  const routingSvc = app.get(ProcessRoutingService, { strict: false });
  const stepRepo = ds.getRepository(ProcessStep);
  const matRepo = ds.getRepository(ProcessStepMaterial);
  const t = tally();
  let steps = 0;

  for (const route of DEMO_ROUTINGS) {
    // ── (a) SfLineStation (rev 'A') — el ruteo que lee el surtido ──
    const existingStations = await lineEng.listStations({
      model: route.model,
      revision: DEMO_ROUTING_REVISION,
    });
    const haveStation = new Set(existingStations.map((s) => s.station));
    for (const s of route.stations) {
      try {
        assertSeedPart(s.npExpected);
        if (haveStation.has(s.station)) {
          t.skipped++;
          continue;
        }
        await lineEng.createStation({
          model: route.model,
          revision: DEMO_ROUTING_REVISION,
          line: route.line,
          station: s.station,
          sequence: s.sequence,
          npExpected: s.npExpected,
          useFactor: s.useFactor,
          stdTimeSec: s.stdTimeSec,
          feederPosition: s.feederPosition,
          visualAidUrl: s.visualAidUrl,
          ctq: s.ctq,
          programId: route.programId || undefined,
          notes: `Ruteo demo AXOS · ${s.name}`,
        });
        t.created++;
      } catch (err) {
        t.errors++;
        log('ruteo', `ERROR ${route.model}/${s.station}: ${(err as Error).message}`);
      }
    }

    // ── (b) ProcessStep + material (rev '1.0') — lo que explota mes-execution ──
    for (const s of route.stations) {
      try {
        let step = await stepRepo.findOne({
          where: { model: route.model, sequence: s.sequence },
        });
        if (!step) {
          step = await routingSvc.createStep({
            model: route.model,
            revision: DEMO_PROCESS_REVISION,
            sequence: s.sequence,
            name: s.name,
            stationType: s.stationType,
            visualAidId: s.visualAidId,
            instructions: `Estación ${s.station} · consumir ${s.npExpected} (${s.useFactor}/u).`,
          });
          steps++;
        }
        const haveMat = await matRepo.findOne({
          where: { stepId: step.id, partNumber: s.npExpected },
        });
        if (!haveMat) {
          await routingSvc.addMaterial(step.id, {
            partNumber: s.npExpected,
            description: `NP de estación ${s.station} (demo AXOS)`,
            qtyPerUnit: s.useFactor,
            unit: 'EA',
          });
        }
      } catch (err) {
        t.errors++;
        log('ruteo proceso', `ERROR ${route.model}/${s.station}: ${(err as Error).message}`);
      }
    }
  }
  log('ruteo', `estaciones Sf creadas=${t.created} ya existían=${t.skipped} · pasos proceso nuevos=${steps} errores=${t.errors}`);
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. Colocación en bahía (BayLayout): NP del ruteo → bahía (1–6) + stock mínimo.
// ─────────────────────────────────────────────────────────────────────────────
async function seedBayLayouts(ds: DataSource): Promise<Tally> {
  const repo = ds.getRepository(BayLayout);
  const t = tally();
  for (const route of DEMO_ROUTINGS) {
    for (const s of route.stations) {
      try {
        assertSeedPart(s.npExpected);
        const existing = await repo.findOne({
          where: { model: route.model, partNumber: s.npExpected, bahia: s.bahia },
        });
        if (existing) {
          t.skipped++;
          continue;
        }
        await repo.save(
          repo.create({
            model: route.model,
            partNumber: s.npExpected,
            bahia: s.bahia,
            minStock: s.minStock,
          }),
        );
        t.created++;
      } catch (err) {
        t.errors++;
        log('bahías', `ERROR ${route.model}/${s.npExpected}: ${(err as Error).message}`);
      }
    }
  }
  log('bahías', `creadas=${t.created} ya existían=${t.skipped} errores=${t.errors}`);
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// 14. Ejecución MES en curso: abre WorkOrderExecution para planes AX publicados
//     (explota el ruteo de proceso en pasos reales) y deja la 1ª estación
//     in_process vía el avance REAL del operador (idempotente por clientRequestId).
// ─────────────────────────────────────────────────────────────────────────────
async function seedMesExecutions(app: INestApplicationContext, ds: DataSource): Promise<Tally> {
  const mes = app.get(MesExecutionService, { strict: false });
  const planRepo = ds.getRepository(Plan);
  const execRepo = ds.getRepository(WorkOrderExecution);
  const stepRepo = ds.getRepository(ExecutionStep);
  const t = tally();
  let walked = 0;

  for (const workOrder of DEMO_MES_WORK_ORDERS) {
    try {
      const plan = await planRepo.findOne({ where: { workOrder } });
      if (!plan) {
        t.skipped++;
        continue;
      }
      // Abrir ejecución (idempotente: openExecution devuelve la existente).
      let exec = await execRepo.findOne({ where: { planId: plan.id } });
      if (!exec) {
        await mes.openExecution({ workOrder }, DEMO_ACTOR);
        exec = await execRepo.findOne({ where: { planId: plan.id } });
        if (exec) t.created++;
      } else {
        t.skipped++;
      }
      if (!exec) continue;

      // Dejar la 1ª estación in_process: avance parcial (< cantidad) del operador.
      const first = await stepRepo.findOne({
        where: { executionId: exec.id },
        order: { sequence: 'ASC' },
      });
      if (first && first.status === 'pending') {
        const qty = Math.max(1, Math.min(DEMO_MES_WALK_UNITS, (exec.quantity || 1) - 1));
        await mes.confirmAdvance(
          exec.id,
          first.stepId,
          { quantity: qty, clientRequestId: MES_SEED_CRID(workOrder), operator: DEMO_ACTOR },
          DEMO_ACTOR,
        );
        walked++;
      }
    } catch (err) {
      t.errors++;
      log('ejecución mes', `ERROR ${workOrder}: ${(err as Error).message}`);
    }
  }
  log('ejecución mes', `ejecuciones=${t.created} ya existían=${t.skipped} pasos in_process=${walked} errores=${t.errors}`);
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dominios de negocio (CMMS, EHS, CRM, legal, gastos, activos fijos, tooling,
// compras, RMA): demo FUNCIONAL vía los servicios reales — folio y estatus se
// auto-asignan, igual que si un usuario los capturara. Así cada módulo del hub
// abre con contenido real en vez de vacío. Idempotente por clave natural; el
// texto es genérico/ficticio (pasa el candado de dominio público). Se invoca con
// los servicios resueltos del contenedor; los DTOs van como `any` porque la
// validación class-validator sólo corre por HTTP, no al llamar el servicio.
// ─────────────────────────────────────────────────────────────────────────────
async function seedBusinessDomains(app: INestApplicationContext): Promise<Tally> {
  const t = tally();
  const ds = app.get(DataSource);

  async function ensure(
    entity: any,
    where: Record<string, unknown>,
    create: () => Promise<unknown>,
  ): Promise<void> {
    try {
      const existing = await ds.getRepository(entity).findOne({ where: where as any });
      if (existing) {
        t.skipped++;
        return;
      }
      await create();
      t.created++;
    } catch (err) {
      t.errors++;
      log('negocio', `ERROR (${JSON.stringify(where)}): ${(err as Error).message}`);
    }
  }

  const crm = app.get(CrmService);
  for (const title of [
    'Programa wearable XR — nueva línea SMT',
    'Expansión de volumen — módulo de potencia',
    'Cotización: controlador IoT (piloto)',
  ]) {
    await ensure(Opportunity, { title }, () => crm.create({ title } as any));
  }

  const ehs = app.get(EhsService);
  for (const r of [
    { title: 'Casi-accidente: derrame menor de pasta de soldadura', type: 'NEAR_MISS', severity: 'LOW' },
    { title: 'Primeros auxilios: corte leve al pelar cable', type: 'FIRST_AID', severity: 'LOW' },
    { title: 'Ambiental: fuga menor de aire comprimido', type: 'ENVIRONMENTAL', severity: 'MEDIUM' },
  ]) {
    await ensure(SafetyIncident, { title: r.title }, () => ehs.create(r as any));
  }

  const maint = app.get(MaintenanceService);
  for (const a of [
    { name: 'Horno de reflujo SMT-1', criticality: 'HIGH', category: 'SMT', location: 'Línea 1' },
    { name: 'Pick & Place P1', criticality: 'CRITICAL', category: 'SMT', location: 'Línea 1' },
    { name: 'Compresor central', criticality: 'MEDIUM', category: 'Utilidades', location: 'Cuarto de máquinas' },
  ]) {
    await ensure(Asset, { name: a.name }, () => maint.createAsset(a as any));
  }
  for (const o of [
    { title: 'Preventivo mensual: horno de reflujo', type: 'PREVENTIVE', priority: 'MEDIUM' },
    { title: 'Correctivo: boquilla tapada en P&P', type: 'CORRECTIVE', priority: 'HIGH' },
  ]) {
    await ensure(MaintenanceOrder, { title: o.title }, () => maint.createOrder(o as any));
  }

  const legal = app.get(LegalService);
  for (const c of [
    { title: 'NDA mutuo con proveedor de estructurales', type: 'NDA' },
    { title: 'Contrato de servicio de calibración', type: 'SERVICE' },
    { title: 'Arrendamiento de nave 2', type: 'LEASE' },
  ]) {
    await ensure(Contract, { title: c.title }, () => legal.create(c as any));
  }

  const expenses = app.get(ExpensesService);
  for (const e of [
    { description: 'Viáticos: visita a proveedor', amount: 4200, category: 'TRAVEL' },
    { description: 'Capacitación IPC-A-610', amount: 8800, category: 'TRAINING' },
    { description: 'Consumibles de laboratorio', amount: 1500, category: 'SUPPLIES' },
  ]) {
    await ensure(ExpenseReport, { description: e.description }, () => expenses.create(e as any));
  }

  const fixedAssets = app.get(FixedAssetsService);
  for (const f of [
    { name: 'Horno de reflujo SMT-1', acquisitionCost: 1_800_000, usefulLifeMonths: 120 },
    { name: 'AOI inline', acquisitionCost: 950_000, usefulLifeMonths: 84 },
    { name: 'Montacargas eléctrico', acquisitionCost: 420_000, usefulLifeMonths: 96 },
  ]) {
    await ensure(FixedAsset, { name: f.name }, () => fixedAssets.create(f as any));
  }

  const tooling = app.get(ToolingService);
  for (const tl of [
    { name: 'Stencil SMT AX-100', lifeShots: 50_000, type: 'STENCIL' },
    { name: 'Fixture ICT AX-200', lifeShots: 200_000, type: 'FIXTURE' },
    { name: 'Molde de carcasa AX-300', lifeShots: 500_000, type: 'MOLD' },
  ]) {
    await ensure(Tool, { name: tl.name }, () => tooling.create(tl as any));
  }

  const procurement = app.get(ProcurementService);
  for (const p of [
    { title: 'OC resistencias 0402 (reposición)', priority: 'MEDIUM' },
    { title: 'OC conectores board-to-board', priority: 'HIGH' },
    { title: 'OC etiquetas térmicas', priority: 'LOW' },
  ]) {
    await ensure(PurchaseOrder, { title: p.title }, () => procurement.create(p as any));
  }

  const rma = app.get(RmaService);
  for (const r of [
    { failureDescription: 'Unidad no enciende — falla intermitente de fuente', severity: 'HIGH' },
    { failureDescription: 'Conector USB flojo reportado por cliente', severity: 'MEDIUM' },
  ]) {
    await ensure(RmaCase, { failureDescription: r.failureDescription }, () => rma.create(r as any));
  }

  log('negocio', `registros nuevos=${t.created} ya existían=${t.skipped} errores=${t.errors}`);
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// Valuación rápida de inventario (SUM(onHand × standardCost)) para el resumen.
// ─────────────────────────────────────────────────────────────────────────────
async function inventoryValuation(ds: DataSource): Promise<number> {
  // QueryBuilder con entidades: TypeORM mapea propiedad→columna (evita adivinar
  // si la columna es camelCase u snake_case según la entidad).
  const row = await ds
    .getRepository(InventoryPosition)
    .createQueryBuilder('pos')
    .innerJoin(MaterialMaster, 'mat', 'mat.partNumber = pos.partNumber')
    .select('COALESCE(SUM(pos.onHand * mat.standardCost), 0)', 'value')
    .getRawOne<{ value: string }>();
  return Number(row?.value ?? 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Orquestación
// ─────────────────────────────────────────────────────────────────────────────
async function run(): Promise<void> {
  assertNotProduction();

  // CANDADO LEGAL: valida TODO el catálogo (dominio público) ANTES de tocar la BD.
  // Si algo huele a cliente real (prefijo OP-, nombre de empresa real…), aborta.
  const checked = validateDemoCatalog();

  console.log('════════════════════════════════════════════════════════════');
  console.log(' AXOS OS — Seed DEMO (universo AXOS, datos funcionales)');
  console.log(`   Candado dominio público: ${checked} campos verificados ✔`);
  console.log('════════════════════════════════════════════════════════════');

  const app = await bootSeedContext();
  const ds = app.get(DataSource);

  try {
    await runInDemoContext(app, async () => {
      await seedWarehouses(ds);
      await seedCustomersAndPrograms(app, ds);
      await seedMaterials(app, ds);
      await seedSuppliers(app, ds);
      await seedSupplierPrices(app, ds);
      await seedReceipts(app, ds);
      await seedModels(app);
      await seedBoms(app, ds);
      await seedPlans(app, ds);
      await seedConsumption(app, ds);
      await seedQualityHolds(app, ds);
      await seedUsers(app);
      await seedShopFloor(app, ds);
      await seedVisualAids(ds);
      await seedRouting(app, ds);
      await seedBayLayouts(ds);
      await seedMesExecutions(app, ds);
      await seedBusinessDomains(app);
    });

    // CANDADO LEGAL (post-seed): re-escanea TODA la base y FALLA ruidosamente si
    // algo prohibido se coló (que no se vuelva a colar). El detector es el mismo
    // del guard. Escape para casos límite: SKIP_PUBLIC_DOMAIN_ASSERT=true.
    if (process.env.SKIP_PUBLIC_DOMAIN_ASSERT !== 'true') {
      await runInDemoContext(app, () => assertDatabasePublicDomain(ds));
      console.log('   Candado dominio público (post-seed): base limpia ✔');
    }

    const valuation = await inventoryValuation(ds);
    console.log('────────────────────────────────────────────────────────────');
    console.log(' Resumen:');
    console.log(`   Almacenes demo:   ${DEMO_WAREHOUSES.length}`);
    console.log(`   Clientes/Prog:    ${DEMO_CUSTOMERS.length}/${DEMO_PROGRAMS.length}`);
    console.log(`   Proveedores:      ${DEMO_SUPPLIERS.length} (precios: ${DEMO_SUPPLIER_PRICES.length})`);
    console.log(`   Partes (MM):      ${DEMO_PARTS.length}`);
    console.log(`   Modelos (AX-):    ${DEMO_MODELS.length}`);
    console.log(`   Planes:           ${DEMO_PLANS.length} (${DEMO_PLANS.filter((p) => p.publish).length} publicados)`);
    console.log(`   WOs piso:         ${DEMO_SF_WORK_ORDERS.length} (holds: ${DEMO_SF_HOLDS.length}, paros: ${DEMO_SF_DOWNTIME.length})`);
    console.log(`   Ruteo (estac.):   ${DEMO_ROUTINGS.reduce((a, r) => a + r.stations.length, 0)} en ${DEMO_ROUTINGS.length} modelos (rev ${DEMO_ROUTING_REVISION})`);
    console.log(`   Ejecución MES:    ${DEMO_MES_WORK_ORDERS.length} WO publicadas (1ª estación in_process)`);
    console.log(`   Usuarios demo:    ${DEMO_USERS.length}`);
    console.log(`   Valuación inv.:   $${valuation.toFixed(2)} USD`);
    console.log('   Folios ejemplo:   modelos ' + DEMO_MODELS.map((m) => m.modelNumber).join(', '));
    console.log('   Órdenes ejemplo:  ' + DEMO_PLANS.slice(0, 3).map((p) => p.workOrder).join(', ') + ' …');
    console.log('────────────────────────────────────────────────────────────');
    console.log('✅ Seed DEMO completado. Verifica con `npm run seed:demo:verify`.');
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error('❌ Seed DEMO falló:', err);
  process.exit(1);
});
