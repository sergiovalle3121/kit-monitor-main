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
import { DataSource } from 'typeorm';

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
  DEMO_MODELS,
  DEMO_PARTS,
  DEMO_PLANS,
  DEMO_PLANT,
  DEMO_PROGRAMS,
  DEMO_SUPPLIERS,
  DEMO_SUPPLIER_PRICES,
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

  for (const part of DEMO_PARTS) {
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

async function seedBoms(app: INestApplicationContext, ds: DataSource): Promise<Tally> {
  const bomSvc = app.get(BomService, { strict: false });
  const headerRepo = ds.getRepository(BomHeader);
  const t = tally();

  for (const m of DEMO_MODELS) {
    try {
      const existing = await headerRepo.findOne({
        where: { model: m.modelNumber, revision: DEMO_BOM_REVISION },
        relations: ['components'],
      });
      if (existing) {
        await ensureBomActive(bomSvc, existing);
        t.skipped++;
        continue;
      }
      const header = await bomSvc.createBomWithComponents({
        model: m.modelNumber,
        productName: m.name,
        revision: DEMO_BOM_REVISION,
        bomType: 'Manufacturing',
        baseQuantity: 1,
        baseUnit: 'EA',
        description: `BOM demo ${m.modelNumber} — ${m.name}`,
        createdBy: DEMO_ACTOR,
        components: m.bom.map((line) => ({
          componentNumber: line.part,
          quantity: line.qty,
          unit: 'EA',
          usageFactor: 1,
          referenceDesignator: line.ref,
        })),
      });
      await headerRepo.update(header.id, { metadata: demoMeta() });
      await ensureBomActive(bomSvc, await headerRepo.findOneOrFail({ where: { id: header.id } }));
      t.created++;
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
