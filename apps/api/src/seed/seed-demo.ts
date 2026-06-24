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
import { HrService } from '../modules/hr/hr.service';
import { HrRequisition } from '../modules/hr/entities/hr-requisition.entity';
import { SuppliersService } from '../modules/suppliers/suppliers.service';
import { Supplier } from '../modules/suppliers/entities/supplier.entity';
import { SupplierContact } from '../modules/suppliers/entities/supplier-contact.entity';
import { SupplierCertification } from '../modules/suppliers/entities/supplier-certification.entity';
import { ErpSalesOrder } from '../modules/erp-core/entities/erp-sales-order.entity';
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
import { AccountsService } from '../modules/crm/services/accounts.service';
import { ContactsService } from '../modules/crm/services/contacts.service';
import { QuotesService } from '../modules/crm/services/quotes.service';
import { ActivitiesService } from '../modules/crm/services/activities.service';
import { CrmAccount } from '../modules/crm/entities/crm-account.entity';
import { CrmContact } from '../modules/crm/entities/crm-contact.entity';
import { CrmQuote } from '../modules/crm/entities/crm-quote.entity';
import { CrmActivity } from '../modules/crm/entities/crm-activity.entity';
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
import { NotificationsService } from '../modules/notifications/notifications.service';
import { UserNotification } from '../modules/notifications/entities/notification.entity';
// Densidad Fase 2: profundidad relacional de herramientas nuevas/enriquecidas.
import { WarehouseTask, WarehouseTaskType, WarehouseTaskStatus } from '../modules/inventory/entities/warehouse-task.entity';
import { MaterialReturn, MaterialReturnStatus } from '../modules/inventory/entities/material-return.entity';
import { ReplenishmentRule } from '../modules/inventory/entities/replenishment-rule.entity';
import { SCAR, ScarStatus, ScarSeverity } from '../modules/suppliers/entities/scar.entity';
import { IQCInspection, IqcResult } from '../modules/quality/entities/iqc-inspection.entity';
import { NCR, NcrStatus, NcrSeverity, NcrSourceType } from '../modules/ncr/entities/ncr.entity';
import { QualityService } from '../modules/quality/quality.service';
import { QualityHold, QualityHoldLevel } from '../modules/quality/entities/quality-hold.entity';
import { ProductModel } from '../modules/product-models/entities/product-model.entity';
import { QualityCharacteristic } from '../modules/quality/entities/quality-characteristic.entity';
import { QualityMeasurement } from '../modules/quality/entities/quality-measurement.entity';

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
  DEMO_WH_WIP,
  MV_REF_CONSUME,
  MV_REF_HOLD,
  MV_REF_RECEIVE,
  slugCode,
  DEMO_WH_TASK_PREFIX,
  DEMO_IQC_PREFIX,
  DEMO_SCAR_PREFIX,
  DEMO_NCR_PREFIX,
  DEMO_QHOLD_REASON,
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
// 3c. Enriquecimiento de proveedores: calificación, OTD/PPM, riesgo,
// certificaciones (con vencimientos) y contactos. Para que el Proveedor 360 abra
// con un maestro real, no una tabla de 4 campos. Idempotente.
// ─────────────────────────────────────────────────────────────────────────────
const SUPPLIER_EXTRAS: Record<string, Record<string, unknown>> = {
  'AX-SUP-FERRUM': { type: 'COMPONENT', commodity: 'Pasivos (R/C/L)', region: 'NAM', qualificationStatus: 'APPROVED', paymentTerms: 'NET45', incoterm: 'FCA', leadTimeDays: 21, otdPct: 98.6, ppm: 18, responsivenessScore: 95, riskLevel: 'LOW', financialHealth: 'STRONG', singleSource: false, ownerEmail: 'sqe.pasivos@axos-demo.example' },
  'AX-SUP-VOLTAIC': { type: 'COMPONENT', commodity: 'Discretos / Power', region: 'NAM', qualificationStatus: 'APPROVED', paymentTerms: 'NET30', incoterm: 'FCA', leadTimeDays: 28, otdPct: 97.2, ppm: 30, responsivenessScore: 90, riskLevel: 'LOW', financialHealth: 'STABLE', singleSource: false, ownerEmail: 'sqe.power@axos-demo.example' },
  'AX-SUP-NORVEL': { type: 'COMPONENT', commodity: 'Semiconductores (MCU)', region: 'NAM', qualificationStatus: 'APPROVED', paymentTerms: 'NET30', incoterm: 'EXW', leadTimeDays: 84, otdPct: 91.5, ppm: 55, responsivenessScore: 78, riskLevel: 'MEDIUM', financialHealth: 'STABLE', singleSource: true, ownerEmail: 'sqe.semi@axos-demo.example' },
  'AX-SUP-AXON': { type: 'COMPONENT', commodity: 'Microelectrónica', region: 'NAM', qualificationStatus: 'APPROVED', paymentTerms: 'NET45', incoterm: 'FCA', leadTimeDays: 70, otdPct: 95.8, ppm: 22, responsivenessScore: 88, riskLevel: 'LOW', financialHealth: 'STRONG', singleSource: false, ownerEmail: 'sqe.semi@axos-demo.example' },
  'AX-SUP-COBALT': { type: 'COMPONENT', commodity: 'Conectores', region: 'EMEA', qualificationStatus: 'APPROVED', paymentTerms: 'NET60', incoterm: 'DAP', leadTimeDays: 49, otdPct: 94.0, ppm: 40, responsivenessScore: 82, riskLevel: 'MEDIUM', financialHealth: 'STABLE', singleSource: false, ownerEmail: 'sqe.interconnect@axos-demo.example' },
  'AX-SUP-KESTREL': { type: 'COMPONENT', commodity: 'Magnéticos', region: 'APAC', qualificationStatus: 'CONDITIONAL', paymentTerms: 'NET30', incoterm: 'FOB', leadTimeDays: 56, otdPct: 88.3, ppm: 120, responsivenessScore: 70, riskLevel: 'HIGH', financialHealth: 'WATCH', singleSource: true, ownerEmail: 'sqe.magnetics@axos-demo.example' },
  'AX-SUP-QUARTZON': { type: 'COMPONENT', commodity: 'Timing / Cristales', region: 'APAC', qualificationStatus: 'APPROVED', paymentTerms: 'NET30', incoterm: 'FOB', leadTimeDays: 63, otdPct: 96.1, ppm: 35, responsivenessScore: 85, riskLevel: 'LOW', financialHealth: 'STABLE', singleSource: false, ownerEmail: 'sqe.timing@axos-demo.example' },
  'AX-SUP-LUMINA': { type: 'COMPONENT', commodity: 'Optoelectrónica', region: 'APAC', qualificationStatus: 'APPROVED', paymentTerms: 'NET45', incoterm: 'FOB', leadTimeDays: 42, otdPct: 95.0, ppm: 28, responsivenessScore: 86, riskLevel: 'LOW', financialHealth: 'STRONG', singleSource: false, ownerEmail: 'sqe.opto@axos-demo.example' },
  'AX-SUP-SENTINEL': { type: 'COMPONENT', commodity: 'Sensores', region: 'NAM', qualificationStatus: 'APPROVED', paymentTerms: 'NET30', incoterm: 'FCA', leadTimeDays: 35, otdPct: 96.7, ppm: 24, responsivenessScore: 89, riskLevel: 'LOW', financialHealth: 'STRONG', singleSource: false, ownerEmail: 'sqe.sensors@axos-demo.example' },
  'AX-SUP-GRANITE': { type: 'COMPONENT', commodity: 'Hardware / Estructurales', region: 'NAM', qualificationStatus: 'APPROVED', paymentTerms: 'NET45', incoterm: 'FCA', leadTimeDays: 14, otdPct: 99.1, ppm: 12, responsivenessScore: 96, riskLevel: 'LOW', financialHealth: 'STRONG', singleSource: false, ownerEmail: 'sqe.mechanical@axos-demo.example' },
  'AX-SUP-STRATA': { type: 'RAW_MATERIAL', commodity: 'PCB Fab', region: 'NAM', qualificationStatus: 'APPROVED', paymentTerms: 'NET60', incoterm: 'DAP', leadTimeDays: 35, otdPct: 93.4, ppm: 65, responsivenessScore: 80, riskLevel: 'MEDIUM', financialHealth: 'STABLE', singleSource: true, ownerEmail: 'sqe.pcb@axos-demo.example' },
  'AX-SUP-ORION': { type: 'DISTRIBUTOR', commodity: 'Distribución multilínea', region: 'APAC', qualificationStatus: 'CONDITIONAL', paymentTerms: 'NET30', incoterm: 'FOB', leadTimeDays: 45, otdPct: 90.2, ppm: 80, responsivenessScore: 74, riskLevel: 'MEDIUM', financialHealth: 'WATCH', singleSource: false, ownerEmail: 'buyer.distribution@axos-demo.example' },
};

// Vencimientos relativos (días): la mayoría vigentes; una por vencer y una vencida
// para mostrar las alertas de compliance.
const SUPPLIER_CERTS: Record<string, Array<{ standard: string; certNumber: string; issuedBy: string; issuedInDays: number; expiresInDays: number }>> = {
  'AX-SUP-FERRUM': [
    { standard: 'ISO9001', certNumber: 'Q1-FER-2023', issuedBy: 'TÜV (demo)', issuedInDays: -540, expiresInDays: 540 },
    { standard: 'IATF16949', certNumber: 'TS-FER-2023', issuedBy: 'TÜV (demo)', issuedInDays: -400, expiresInDays: 320 },
  ],
  'AX-SUP-VOLTAIC': [{ standard: 'ISO9001', certNumber: 'Q1-VOL-2024', issuedBy: 'SGS (demo)', issuedInDays: -300, expiresInDays: 430 }],
  'AX-SUP-NORVEL': [{ standard: 'ISO9001', certNumber: 'Q1-NOR-2022', issuedBy: 'BV (demo)', issuedInDays: -700, expiresInDays: 55 }],
  'AX-SUP-COBALT': [
    { standard: 'IATF16949', certNumber: 'TS-COB-2023', issuedBy: 'DEKRA (demo)', issuedInDays: -450, expiresInDays: 270 },
    { standard: 'ISO14001', certNumber: 'E1-COB-2023', issuedBy: 'DEKRA (demo)', issuedInDays: -450, expiresInDays: 270 },
  ],
  'AX-SUP-KESTREL': [{ standard: 'ISO9001', certNumber: 'Q1-KES-2021', issuedBy: 'JQA (demo)', issuedInDays: -800, expiresInDays: -30 }],
  'AX-SUP-SENTINEL': [
    { standard: 'ISO9001', certNumber: 'Q1-SEN-2024', issuedBy: 'NSF (demo)', issuedInDays: -250, expiresInDays: 480 },
    { standard: 'ISO13485', certNumber: 'MD-SEN-2024', issuedBy: 'NSF (demo)', issuedInDays: -250, expiresInDays: 480 },
  ],
  'AX-SUP-STRATA': [
    { standard: 'ISO9001', certNumber: 'Q1-STR-2023', issuedBy: 'UL (demo)', issuedInDays: -380, expiresInDays: 350 },
    { standard: 'UL', certNumber: 'UL-STR-94V0', issuedBy: 'UL (demo)', issuedInDays: -380, expiresInDays: 350 },
  ],
  'AX-SUP-ORION': [{ standard: 'ISO9001', certNumber: 'Q1-ORI-2022', issuedBy: 'SGS (demo)', issuedInDays: -650, expiresInDays: 80 }],
  'AX-SUP-GRANITE': [{ standard: 'ISO9001', certNumber: 'Q1-GRA-2024', issuedBy: 'BV (demo)', issuedInDays: -200, expiresInDays: 530 }],
};

const SUPPLIER_CONTACTS: Record<string, Array<Record<string, unknown>>> = {
  'AX-SUP-FERRUM': [
    { name: 'Elena Ruiz', title: 'Key Account Manager', role: 'SALES', email: 'elena.ruiz@ferrum.example', phone: '+52 33 5551 7001', isPrimary: true },
    { name: 'Marco Téllez', title: 'Gerente de Calidad', role: 'QUALITY', email: 'marco.tellez@ferrum.example' },
  ],
  'AX-SUP-NORVEL': [{ name: 'Janet Cole', title: 'Distributor Sales', role: 'SALES', email: 'janet.cole@norvel.example', isPrimary: true }],
  'AX-SUP-KESTREL': [{ name: 'Hiro Tanaka', title: 'Quality Engineer', role: 'QUALITY', email: 'hiro.tanaka@kestrel.example', isPrimary: true }],
  'AX-SUP-COBALT': [{ name: 'Anke Vogt', title: 'Account Manager', role: 'SALES', email: 'anke.vogt@cobalt.example', isPrimary: true }],
  'AX-SUP-STRATA': [{ name: 'Luis Carrillo', title: 'Gerente de Planta', role: 'OPERATIONS', email: 'luis.carrillo@strata.example', isPrimary: true }],
  'AX-SUP-ORION': [{ name: 'Wei Lim', title: 'Regional Sales APAC', role: 'SALES', email: 'wei.lim@orion.example', isPrimary: true }],
};

async function seedSupplierExtras(app: INestApplicationContext): Promise<Tally> {
  const t = tally();
  const ds = app.get(DataSource);
  const repo = ds.getRepository(Supplier);
  const certRepo = ds.getRepository(SupplierCertification);
  const contactRepo = ds.getRepository(SupplierContact);
  const suppliers = await repo.find();
  const idByCode = new Map(suppliers.map((s) => [s.code, s.id]));

  // 1) Enriquece el maestro
  for (const [code, extras] of Object.entries(SUPPLIER_EXTRAS)) {
    try {
      const id = idByCode.get(code);
      if (!id) { t.skipped++; continue; }
      await repo.update(id, extras as any);
      t.created++;
    } catch (err) {
      t.errors++;
      log('prov.360', `ERROR extras ${code}: ${(err as Error).message}`);
    }
  }

  // 2) Certificaciones (idempotente por proveedor+estándar)
  for (const [code, certs] of Object.entries(SUPPLIER_CERTS)) {
    const supplierId = idByCode.get(code);
    if (!supplierId) continue;
    for (const c of certs) {
      try {
        const exists = await certRepo.findOne({ where: { supplierId, standard: c.standard } });
        if (exists) { t.skipped++; continue; }
        const expiresAt = crmDay(c.expiresInDays);
        const status = c.expiresInDays < 0 ? 'EXPIRED' : c.expiresInDays <= 90 ? 'EXPIRING' : 'VALID';
        await certRepo.save(certRepo.create({
          supplierId, standard: c.standard, certNumber: c.certNumber, issuedBy: c.issuedBy,
          issuedAt: crmDay(c.issuedInDays), expiresAt, status,
        }));
        t.created++;
      } catch (err) {
        t.errors++;
        log('prov.360', `ERROR cert ${code}/${c.standard}: ${(err as Error).message}`);
      }
    }
  }

  // 3) Contactos (idempotente por proveedor+nombre)
  for (const [code, contacts] of Object.entries(SUPPLIER_CONTACTS)) {
    const supplierId = idByCode.get(code);
    if (!supplierId) continue;
    for (const c of contacts) {
      try {
        const exists = await contactRepo.findOne({ where: { supplierId, name: c.name as string } });
        if (exists) { t.skipped++; continue; }
        await contactRepo.save(contactRepo.create({ supplierId, ...c } as any));
        t.created++;
      } catch (err) {
        t.errors++;
        log('prov.360', `ERROR contacto ${code}/${String(c.name)}: ${(err as Error).message}`);
      }
    }
  }

  log('prov.360', `nuevos=${t.created} ya existían=${t.skipped} errores=${t.errors}`);
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
// RH / Capital Humano: plantilla, bajas (rotación), requisiciones, candidatos,
// evaluaciones (9-box) y ausentismo. Nombres sintéticos (universo AXOS, dominio
// público). Usa el servicio real de RH; idempotente por conteo de plantilla.
// ─────────────────────────────────────────────────────────────────────────────
const HR_DEPT: Record<string, string> = {
  SMT: 'Producción', THT: 'Producción', 'Ensamble Final': 'Producción', Pruebas: 'Producción',
  Almacén: 'Materiales', Calidad: 'Calidad', Ingeniería: 'Ingeniería',
};
const HR_CC: Record<string, string> = {
  SMT: 'CC-SMT-510', THT: 'CC-THT-520', 'Ensamble Final': 'CC-ENS-530', Pruebas: 'CC-TST-540',
  Almacén: 'CC-WH-600', Calidad: 'CC-QA-700', Ingeniería: 'CC-ENG-800',
};

async function seedPeopleHr(app: INestApplicationContext, ds: DataSource): Promise<Tally> {
  const hr = app.get(HrService, { strict: false });
  const t = tally();

  const existing = await hr.listEmployees();
  if (existing.length > 0) {
    log('rh', `ya existían ${existing.length} colaboradores; se omite`);
    t.skipped = existing.length;
    return t;
  }

  const now = Date.now();
  const dAgo = (n: number) => new Date(now - n * 86_400_000).toISOString().slice(0, 10);

  // [first, last, area, shift, labor, position, monthlyCost, hireDaysAgo, engagement]
  const ACTIVE: [string, string, string, string, 'DIRECT' | 'INDIRECT', string, number, number, number][] = [
    ['Juan', 'Pérez', 'SMT', 'A', 'DIRECT', 'Operador SMT', 13500, 420, 78],
    ['María', 'López', 'SMT', 'A', 'DIRECT', 'Operador SMT', 13200, 380, 71],
    ['Pedro', 'Ramírez', 'SMT', 'A', 'INDIRECT', 'Líder de línea SMT', 23000, 1100, 84],
    ['Lucía', 'Hernández', 'SMT', 'B', 'DIRECT', 'Operador SMT', 13500, 55, 46],
    ['Carlos', 'García', 'SMT', 'B', 'DIRECT', 'Operador SMT', 13500, 38, 41],
    ['Ana', 'Martínez', 'SMT', 'B', 'DIRECT', 'Operador SMT', 13200, 210, 58],
    ['Jorge', 'Sánchez', 'SMT', 'C', 'DIRECT', 'Operador SMT', 14000, 25, 39],
    ['Diana', 'Flores', 'SMT', 'C', 'DIRECT', 'Operador SMT', 14000, 72, 44],
    ['Raúl', 'Torres', 'THT', 'A', 'DIRECT', 'Operador THT', 12800, 640, 75],
    ['Sofía', 'Reyes', 'THT', 'A', 'DIRECT', 'Operador THT', 12800, 300, 69],
    ['Miguel', 'Cruz', 'THT', 'B', 'DIRECT', 'Operador THT', 12800, 150, 63],
    ['Elena', 'Morales', 'Ensamble Final', 'A', 'DIRECT', 'Ensamblador', 12500, 510, 80],
    ['Hugo', 'Ortiz', 'Ensamble Final', 'A', 'DIRECT', 'Ensamblador', 12500, 95, 66],
    ['Paola', 'Gutiérrez', 'Ensamble Final', 'B', 'DIRECT', 'Ensamblador', 12500, 47, 52],
    ['Iván', 'Mendoza', 'Ensamble Final', 'B', 'DIRECT', 'Ensamblador', 12500, 28, 43],
    ['Karla', 'Vázquez', 'Pruebas', 'A', 'DIRECT', 'Técnico de prueba', 16500, 720, 82],
    ['Luis', 'Romero', 'Pruebas', 'B', 'DIRECT', 'Técnico de prueba', 16500, 260, 70],
    ['Daniela', 'Castillo', 'Almacén', 'A', 'DIRECT', 'Almacenista', 12000, 900, 77],
    ['Óscar', 'Jiménez', 'Almacén', 'B', 'DIRECT', 'Surtidor de línea', 12200, 180, 60],
    ['Patricia', 'Núñez', 'Calidad', 'A', 'INDIRECT', 'Inspector de calidad', 17500, 1300, 86],
    ['Andrés', 'Rojas', 'Calidad', 'A', 'INDIRECT', 'Ingeniero de calidad', 35000, 1500, 88],
    ['Gabriela', 'Domínguez', 'Ingeniería', 'A', 'INDIRECT', 'Ingeniero de proceso', 38000, 1650, 90],
    ['Fernando', 'Aguilar', 'Ingeniería', 'A', 'INDIRECT', 'Ingeniero industrial', 37000, 540, 83],
    ['Mónica', 'Salazar', 'SMT', 'A', 'INDIRECT', 'Supervisor de producción', 42000, 1900, 87],
  ];

  for (let i = 0; i < ACTIVE.length; i++) {
    const [first, last, area, shift, labor, pos, cost, hire, eng] = ACTIVE[i];
    const isManager = pos.startsWith('Líder') || pos.startsWith('Supervisor');
    try {
      await hr.createEmployee({
        firstName: first, lastName: last, employeeNumber: String(1001 + i),
        position: pos, area, department: HR_DEPT[area], costCenter: HR_CC[area],
        shift, line: area === 'SMT' ? 'L-SMT-1' : area === 'THT' ? 'L-THT-1' : undefined,
        laborType: labor, hireDate: dAgo(hire), monthlyCost: cost, engagementScore: eng,
        // tramo de control: operadores reportan al líder SMT (1003) o al supervisor (1024)
        managerEmployeeNumber: isManager ? undefined : area === 'SMT' ? '1003' : '1024',
        supervisorName: isManager ? undefined : area === 'SMT' ? 'Pedro Ramírez' : 'Mónica Salazar',
      });
      t.created++;
    } catch (err) {
      t.errors++;
      log('rh', `ERROR alta ${first} ${last}: ${(err as Error).message}`);
    }
  }

  // Bajas (últimos 12 meses) — concentradas en SMT noche para rotación realista.
  // [first, last, area, shift, labor, hireDaysAgo, termDaysAgo, type, reason]
  const TERMS: [string, string, string, string, 'DIRECT' | 'INDIRECT', number, number, 'VOLUNTARY' | 'INVOLUNTARY', string][] = [
    ['Roberto', 'Díaz', 'SMT', 'C', 'DIRECT', 95, 35, 'VOLUNTARY', 'Mejor oferta'],
    ['Adriana', 'Campos', 'SMT', 'C', 'DIRECT', 40, 12, 'VOLUNTARY', 'Abandono de empleo'],
    ['Víctor', 'Luna', 'SMT', 'B', 'DIRECT', 70, 30, 'INVOLUNTARY', 'Ausentismo'],
    ['Brenda', 'Ríos', 'SMT', 'B', 'DIRECT', 55, 20, 'VOLUNTARY', 'Personal'],
    ['Sergio', 'Fuentes', 'Ensamble Final', 'B', 'DIRECT', 200, 60, 'VOLUNTARY', 'Mejor oferta'],
    ['Tania', 'Cordero', 'THT', 'B', 'DIRECT', 30, 8, 'VOLUNTARY', 'Abandono de empleo'],
    ['Emilio', 'Padilla', 'Almacén', 'B', 'DIRECT', 320, 90, 'INVOLUNTARY', 'Reestructura'],
    ['Natalia', 'Vega', 'Pruebas', 'A', 'DIRECT', 150, 110, 'VOLUNTARY', 'Reubicación'],
  ];
  for (let i = 0; i < TERMS.length; i++) {
    const [first, last, area, shift, labor, hire, term, type, reason] = TERMS[i];
    try {
      const emp = await hr.createEmployee({
        firstName: first, lastName: last, employeeNumber: String(2001 + i),
        position: 'Operador', area, department: HR_DEPT[area], costCenter: HR_CC[area],
        shift, laborType: labor, hireDate: dAgo(hire),
      });
      await hr.terminateEmployee(emp.id, { terminationType: type, reason, terminationDate: dAgo(term) });
      t.created++;
    } catch (err) {
      t.errors++;
      log('rh', `ERROR baja ${first} ${last}: ${(err as Error).message}`);
    }
  }

  // Requisiciones + pipeline.
  const reqRepo = ds.getRepository(HrRequisition);
  const mkReq = async (
    title: string, area: string, shift: string, openings: number,
    priority: string, reason: string, openedAgo: number, program?: string,
  ) => {
    const r = await hr.createRequisition({
      title, area, shift, openings, laborType: 'DIRECT',
      priority: priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
      reason: reason as 'GROWTH' | 'REPLACEMENT' | 'RAMP', program,
    });
    await reqRepo.update(r.id, { openedDate: new Date(now - openedAgo * 86_400_000) });
    return r;
  };
  try {
    const r1 = await mkReq('Operador SMT (turno C)', 'SMT', 'C', 6, 'CRITICAL', 'RAMP', 52, 'Axos Mobility');
    const r2 = await mkReq('Operador SMT (turno B)', 'SMT', 'B', 3, 'HIGH', 'REPLACEMENT', 18);
    await mkReq('Ensamblador (turno B)', 'Ensamble Final', 'B', 2, 'MEDIUM', 'GROWTH', 9);
    const rHold = await hr.createRequisition({ title: 'Técnico de prueba', area: 'Pruebas', shift: 'A', openings: 1, priority: 'LOW', reason: 'REPLACEMENT' });
    await hr.transitionRequisition(rHold.id, { to: 'ON_HOLD' });
    // Cubierta (para time-to-fill): abierta hace 40d, cubierta hace 8d.
    const rFilled = await mkReq('Almacenista', 'Almacén', 'B', 1, 'MEDIUM', 'GROWTH', 40);
    await hr.transitionRequisition(rFilled.id, { to: 'FILLED' });
    await reqRepo.update(rFilled.id, { filledDate: new Date(now - 8 * 86_400_000), filledCount: 1 });

    // Candidatos en distintas etapas sobre las vacantes abiertas.
    const pipeline: [string, string, string][] = [
      [r1.id, 'Esteban Mora', 'APPLIED'], [r1.id, 'Valeria Ponce', 'SCREEN'],
      [r1.id, 'Ricardo Salas', 'INTERVIEW'], [r1.id, 'Cecilia Bravo', 'APPLIED'],
      [r2.id, 'Marcos Téllez', 'SCREEN'], [r2.id, 'Lorena Vidal', 'INTERVIEW'],
      [r2.id, 'Hernán Cantú', 'OFFER'], [r1.id, 'Pamela Quiroz', 'APPLIED'],
      [r2.id, 'Iris Lozano', 'APPLIED'],
    ];
    const STEPS: Record<string, string[]> = {
      APPLIED: [], SCREEN: ['SCREEN'], INTERVIEW: ['SCREEN', 'INTERVIEW'], OFFER: ['SCREEN', 'INTERVIEW', 'OFFER'],
    };
    for (const [reqId, name, stage] of pipeline) {
      const c = await hr.createCandidate({ name, requisitionId: reqId, source: 'JOB_BOARD' });
      for (const step of STEPS[stage]) await hr.advanceCandidate(c.id, { to: step as 'SCREEN' | 'INTERVIEW' | 'OFFER' });
      t.created++;
    }
  } catch (err) {
    t.errors++;
    log('rh', `ERROR requisiciones: ${(err as Error).message}`);
  }

  // Evaluaciones de desempeño (distribuidas en el 9-box).
  // [name, area, performance(1-5), potential, succession]
  const REVIEWS: [string, string, number, 'LOW' | 'MED' | 'HIGH', string][] = [
    ['Gabriela Domínguez', 'Ingeniería', 5, 'HIGH', 'READY_NOW'],
    ['Fernando Aguilar', 'Ingeniería', 5, 'HIGH', 'READY_NOW'],
    ['Andrés Rojas', 'Calidad', 4, 'HIGH', 'ONE_TWO_YEARS'],
    ['Mónica Salazar', 'SMT', 5, 'MED', 'ONE_TWO_YEARS'],
    ['Karla Vázquez', 'Pruebas', 4, 'MED', 'ONE_TWO_YEARS'],
    ['Pedro Ramírez', 'SMT', 4, 'MED', 'NOT_READY'],
    ['Juan Pérez', 'SMT', 3, 'MED', 'NOT_READY'],
    ['Raúl Torres', 'THT', 3, 'LOW', 'NOT_READY'],
    ['Elena Morales', 'Ensamble Final', 3, 'HIGH', 'ONE_TWO_YEARS'],
    ['Carlos García', 'SMT', 2, 'MED', 'NOT_READY'],
    ['Jorge Sánchez', 'SMT', 2, 'LOW', 'NOT_READY'],
    ['Iván Mendoza', 'Ensamble Final', 1, 'LOW', 'NOT_READY'],
  ];
  for (const [name, area, perf, pot, succ] of REVIEWS) {
    try {
      await hr.createReview({
        employeeName: name, area, period: '2026-H1', reviewer: 'RH',
        performanceScore: perf, potential: pot, goalsMetPct: perf * 18 + 10,
        successionReadiness: succ as 'READY_NOW' | 'ONE_TWO_YEARS' | 'NOT_READY',
      });
      t.created++;
    } catch (err) {
      t.errors++;
    }
  }

  // Ausentismo últimos 45 días — concentrado en SMT noche (B/C) para señal real.
  // [name, area, shift, type, daysAgo, hours]
  const ABS: [string, string, string, string, number, number][] = [
    ['Carlos García', 'SMT', 'B', 'ABSENCE', 3, 8], ['Carlos García', 'SMT', 'B', 'LATE', 9, 1],
    ['Lucía Hernández', 'SMT', 'B', 'ABSENCE', 5, 8], ['Lucía Hernández', 'SMT', 'B', 'SICK', 14, 8],
    ['Jorge Sánchez', 'SMT', 'C', 'ABSENCE', 2, 8], ['Jorge Sánchez', 'SMT', 'C', 'ABSENCE', 11, 8],
    ['Jorge Sánchez', 'SMT', 'C', 'LATE', 6, 1], ['Diana Flores', 'SMT', 'C', 'ABSENCE', 7, 8],
    ['Diana Flores', 'SMT', 'C', 'LATE', 1, 1], ['Iván Mendoza', 'Ensamble Final', 'B', 'ABSENCE', 4, 8],
    ['Iván Mendoza', 'Ensamble Final', 'B', 'ABSENCE', 18, 8], ['Paola Gutiérrez', 'Ensamble Final', 'B', 'SICK', 10, 8],
    ['Miguel Cruz', 'THT', 'B', 'ABSENCE', 8, 8], ['Óscar Jiménez', 'Almacén', 'B', 'LATE', 12, 1],
    ['Ana Martínez', 'SMT', 'B', 'ABSENCE', 22, 8], ['Hugo Ortiz', 'Ensamble Final', 'A', 'SICK', 16, 8],
    ['Sofía Reyes', 'THT', 'A', 'ABSENCE', 28, 8], ['Luis Romero', 'Pruebas', 'B', 'LATE', 6, 1],
  ];
  for (const [name, area, shift, type, ago, hours] of ABS) {
    try {
      await hr.createAbsence({
        employeeName: name, area, shift, type: type as 'ABSENCE' | 'LATE' | 'SICK',
        date: dAgo(ago), hours, justified: type === 'SICK',
      });
      t.created++;
    } catch (err) {
      t.errors++;
    }
  }

  log('rh', `colaboradores+eventos creados=${t.created} errores=${t.errors}`);
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// CRM — Suite comercial: cuentas (cliente 360), contactos (buying center),
// oportunidades en todas las etapas, cotizaciones con líneas y actividades con
// tareas (algunas vencidas). Datos ficticios del universo AXOS (.example).
// ─────────────────────────────────────────────────────────────────────────────
const CRM_ACCOUNTS = [
  { code: 'AX-MOBILITY', name: 'Axos Mobility', type: 'CUSTOMER', tier: 'STRATEGIC', industry: 'Movilidad Eléctrica', segment: 'Automotive Tier-1', region: 'NAM', country: 'México', city: 'Guadalajara', website: 'axos-mobility.example', currency: 'USD', paymentTerms: 'NET45', incoterm: 'DAP', creditLimit: 5_000_000, annualRevenue: 1_200_000_000, employees: 8200, healthScore: 88, riskLevel: 'LOW', enterpriseCustomerCode: 'AX-MOBILITY', ownerEmail: 'ventas.mobility@axos-demo.example', tags: ['EV', 'Tier-1', 'Estratégico'] },
  { code: 'AX-POWER', name: 'Axos Power', type: 'CUSTOMER', tier: 'A', industry: 'Sistemas de Potencia', segment: 'Industrial Power', region: 'NAM', country: 'México', city: 'Monterrey', website: 'axos-power.example', currency: 'USD', paymentTerms: 'NET30', incoterm: 'FCA', creditLimit: 3_000_000, annualRevenue: 640_000_000, employees: 4100, healthScore: 81, riskLevel: 'MEDIUM', enterpriseCustomerCode: 'AX-POWER', ownerEmail: 'ventas.power@axos-demo.example', tags: ['Box-Build', 'Industrial'] },
  { code: 'AX-MEDICAL', name: 'Axos Medical', type: 'CUSTOMER', tier: 'A', industry: 'Dispositivos Médicos', segment: 'Class-II Medical', region: 'NAM', country: 'Estados Unidos', city: 'San Diego', website: 'axos-medical.example', currency: 'USD', paymentTerms: 'NET60', incoterm: 'DDP', creditLimit: 2_500_000, annualRevenue: 430_000_000, employees: 2600, healthScore: 85, riskLevel: 'LOW', enterpriseCustomerCode: 'AX-MEDICAL', ownerEmail: 'ventas.medical@axos-demo.example', tags: ['ISO-13485', 'Class-II'] },
  { code: 'AX-AERO', name: 'Axos Aero', type: 'PROSPECT', tier: 'B', industry: 'Aeroespacial', segment: 'Aerospace & Defense', region: 'NAM', country: 'Estados Unidos', city: 'Phoenix', website: 'axos-aero.example', currency: 'USD', paymentTerms: 'NET45', incoterm: 'DAP', creditLimit: 1_500_000, annualRevenue: 900_000_000, employees: 5400, healthScore: 64, riskLevel: 'MEDIUM', enterpriseCustomerCode: 'AX-AERO', ownerEmail: 'ventas.aero@axos-demo.example', tags: ['AS9100', 'Defensa'] },
  { code: 'AX-PROS-HELIOS', name: 'Helios Robotics', type: 'PROSPECT', tier: 'C', industry: 'Robótica Industrial', segment: 'Industrial Automation', region: 'NAM', country: 'México', city: 'Querétaro', website: 'helios-robotics.example', currency: 'USD', paymentTerms: 'NET30', incoterm: 'FCA', creditLimit: 500_000, annualRevenue: 85_000_000, employees: 540, healthScore: 58, riskLevel: 'MEDIUM', ownerEmail: 'ventas.namanaging@axos-demo.example', tags: ['Robótica'] },
  { code: 'AX-PROS-NIMBUS', name: 'Nimbus IoT', type: 'PROSPECT', tier: 'C', industry: 'IoT / Conectividad', segment: 'Consumer IoT', region: 'NAM', country: 'México', city: 'Guadalajara', website: 'nimbus-iot.example', currency: 'USD', paymentTerms: 'NET30', incoterm: 'FCA', creditLimit: 350_000, annualRevenue: 42_000_000, employees: 210, healthScore: 62, riskLevel: 'LOW', ownerEmail: 'ventas.iot@axos-demo.example', tags: ['IoT', 'Volumen'] },
] as const;

const CRM_CONTACTS: Record<string, Array<Record<string, unknown>>> = {
  'AX-MOBILITY': [
    { firstName: 'Laura', lastName: 'Méndez', title: 'Gerente de Commodity — Electrónica', department: 'PROCUREMENT', buyingRole: 'DECISION_MAKER', email: 'laura.mendez@axos-mobility.example', phone: '+52 33 5550 1001', isPrimary: true },
    { firstName: 'Diego', lastName: 'Fuentes', title: 'Líder de Ingeniería NPI', department: 'ENGINEERING', buyingRole: 'CHAMPION', email: 'diego.fuentes@axos-mobility.example', phone: '+52 33 5550 1002' },
    { firstName: 'Patricia', lastName: 'Soto', title: 'Ingeniera de Calidad de Proveedores (SQE)', department: 'QUALITY', buyingRole: 'INFLUENCER', email: 'patricia.soto@axos-mobility.example' },
  ],
  'AX-POWER': [
    { firstName: 'Ramón', lastName: 'Cárdenas', title: 'Director de Compras', department: 'PROCUREMENT', buyingRole: 'DECISION_MAKER', email: 'ramon.cardenas@axos-power.example', phone: '+52 81 5550 2001', isPrimary: true },
    { firstName: 'Sofía', lastName: 'Herrera', title: 'Gerente de Cadena de Suministro', department: 'SUPPLY_CHAIN', buyingRole: 'INFLUENCER', email: 'sofia.herrera@axos-power.example' },
  ],
  'AX-MEDICAL': [
    { firstName: 'Andrés', lastName: 'Villalobos', title: 'VP de Operaciones', department: 'EXECUTIVE', buyingRole: 'DECISION_MAKER', email: 'andres.villalobos@axos-medical.example', isPrimary: true },
    { firstName: 'Karen', lastName: 'Ibáñez', title: 'Gerente de Aseguramiento de Calidad', department: 'QUALITY', buyingRole: 'GATEKEEPER', email: 'karen.ibanez@axos-medical.example' },
  ],
  'AX-AERO': [
    { firstName: 'Gerardo', lastName: 'Pineda', title: 'Comprador Sr. — Electrónica', department: 'PROCUREMENT', buyingRole: 'INFLUENCER', email: 'gerardo.pineda@axos-aero.example', isPrimary: true },
  ],
  'AX-PROS-HELIOS': [
    { firstName: 'Mariana', lastName: 'Quintero', title: 'Cofundadora / CTO', department: 'EXECUTIVE', buyingRole: 'DECISION_MAKER', email: 'mariana.quintero@helios-robotics.example', isPrimary: true },
  ],
  'AX-PROS-NIMBUS': [
    { firstName: 'Tomás', lastName: 'Aguirre', title: 'Gerente de Producto', department: 'OPERATIONS', buyingRole: 'CHAMPION', email: 'tomas.aguirre@nimbus-iot.example', isPrimary: true },
  ],
};

const CRM_OPPS = [
  { account: 'AX-MOBILITY', title: 'BMS Gen-3 — transferencia de NPI a producción', status: 'PROPOSAL', estimatedValue: 4_800_000, source: 'EXISTING', productLine: 'PCBA', competitor: 'Línea interna del cliente', nextStep: 'Cerrar DFM y enviar cotización formal' },
  { account: 'AX-MOBILITY', title: 'Arnés de potencia — segunda fuente (dual-source)', status: 'QUALIFIED', estimatedValue: 1_350_000, source: 'RFQ', productLine: 'Cable & Harness', nextStep: 'Recibir muestras de validación' },
  { account: 'AX-POWER', title: 'Inversor industrial 30 kW — caja completa (box-build)', status: 'PROPOSAL', estimatedValue: 6_200_000, source: 'RFQ', productLine: 'Box-Build', competitor: 'EMS regional', nextStep: 'Revisión de costos de gabinete' },
  { account: 'AX-MEDICAL', title: 'Monitor de signos — PCBA clase II (IPC-A-610 III)', status: 'QUALIFIED', estimatedValue: 2_900_000, source: 'REFERRAL', productLine: 'PCBA', nextStep: 'Auditoría de proceso ISO 13485' },
  { account: 'AX-AERO', title: 'Módulo aviónico — calificación AS9100', status: 'LEAD', estimatedValue: 3_500_000, source: 'TRADESHOW', productLine: 'PCBA', nextStep: 'Plan de calificación AS9100' },
  { account: 'AX-PROS-HELIOS', title: 'Controlador de robot — piloto 5k u/año', status: 'LEAD', estimatedValue: 780_000, source: 'INBOUND', productLine: 'PCBA', nextStep: 'NDA + paquete de RFQ' },
  { account: 'AX-PROS-NIMBUS', title: 'Gateway IoT — programa de volumen', status: 'QUALIFIED', estimatedValue: 1_100_000, source: 'OUTBOUND', productLine: 'Box-Build', nextStep: 'Definir EAU y escalones de precio' },
  { account: 'AX-POWER', title: 'Módulo de potencia — expansión de volumen', status: 'WON', estimatedValue: 2_400_000, source: 'EXISTING', productLine: 'PCBA' },
  { account: 'AX-MEDICAL', title: 'Bomba de infusión — segunda fuente', status: 'LOST', estimatedValue: 1_800_000, source: 'RFQ', productLine: 'PCBA', lossReason: 'Precio fuera de objetivo' },
] as const;

const CRM_QUOTES = [
  {
    account: 'AX-MOBILITY', title: 'Cotización BMS Gen-3 — PCBA + ensamble final', oppTitle: 'BMS Gen-3 — transferencia de NPI a producción', paymentTerms: 'NET45', incoterm: 'DAP', leadTimeDays: 42, status: 'SENT', discountPct: 3,
    lines: [
      { description: 'PCBA BMS Gen-3 (SMT doble cara + AOI)', partNumber: 'AX-PCBA-BMS3', eau: 120000, quantity: 120000, unitCost: 38.5, unitPrice: 52.0, leadTimeDays: 42 },
      { description: 'Ensamble final + prueba funcional (ICT/FCT)', partNumber: 'AX-FA-BMS3', eau: 120000, quantity: 120000, unitCost: 9.2, unitPrice: 13.5 },
      { description: 'Empaque ESD + serialización', eau: 120000, quantity: 120000, unitCost: 1.1, unitPrice: 1.8 },
    ],
  },
  {
    account: 'AX-POWER', title: 'Cotización inversor 30 kW — box-build', oppTitle: 'Inversor industrial 30 kW — caja completa (box-build)', paymentTerms: 'NET30', incoterm: 'FCA', leadTimeDays: 56, status: 'DRAFT', discountPct: 0,
    lines: [
      { description: 'PCBA control + driver (SMT + THT)', partNumber: 'AX-PCBA-INV30', eau: 18000, quantity: 18000, unitCost: 142, unitPrice: 188 },
      { description: 'Ensamble de gabinete + cableado', eau: 18000, quantity: 18000, unitCost: 96, unitPrice: 131 },
      { description: 'Prueba HiPot + burn-in 4 h', eau: 18000, quantity: 18000, unitCost: 21, unitPrice: 29 },
    ],
  },
] as const;

const CRM_ACTIVITIES = [
  { account: 'AX-MOBILITY', type: 'MEETING', subject: 'Kickoff técnico BMS Gen-3', body: 'Revisión de gerbers, stack-up y DFM con ingeniería del cliente.', direction: 'OUTBOUND', daysAgo: 6 },
  { account: 'AX-MOBILITY', type: 'TASK', subject: 'Enviar cotización formal BMS Gen-3', dueInDays: 2, status: 'OPEN' },
  { account: 'AX-POWER', type: 'CALL', subject: 'Negociación de precio — inversor 30 kW', body: 'El cliente pide -6 %; contrapropuesta con escalón a 25k u.', direction: 'OUTBOUND', daysAgo: 3 },
  { account: 'AX-POWER', type: 'TASK', subject: 'Cargar BOM costeado del inversor', dueInDays: -1, status: 'OPEN' },
  { account: 'AX-MEDICAL', type: 'VISIT', subject: 'Auditoría de proceso ISO 13485', body: 'Recorrido de línea y revisión de control de cambios.', direction: 'OUTBOUND', daysAgo: 10 },
  { account: 'AX-AERO', type: 'TASK', subject: 'Preparar plan de calificación AS9100', dueInDays: 5, status: 'OPEN' },
  { account: 'AX-PROS-HELIOS', type: 'EMAIL', subject: 'Seguimiento RFQ controlador de robot', direction: 'OUTBOUND', daysAgo: 1 },
] as const;

function crmDay(offsetDays: number): Date {
  return new Date(Date.now() + offsetDays * 86_400_000);
}

// Órdenes de venta demo por cliente (para el Cliente 360 / finanzas).
const CUSTOMER_SALES_ORDERS: Array<{ customerCode: string; customerName: string; soNumber: string; status: string; total: number; daysAgo: number }> = [
  { customerCode: 'AX-MOBILITY', customerName: 'Axos Mobility', soNumber: 'SO-DEMO-MOB-01', status: 'in_production', total: 1_240_000, daysAgo: 18 },
  { customerCode: 'AX-MOBILITY', customerName: 'Axos Mobility', soNumber: 'SO-DEMO-MOB-02', status: 'shipped', total: 880_000, daysAgo: 40 },
  { customerCode: 'AX-POWER', customerName: 'Axos Power', soNumber: 'SO-DEMO-POW-01', status: 'confirmed', total: 1_560_000, daysAgo: 12 },
  { customerCode: 'AX-MEDICAL', customerName: 'Axos Medical', soNumber: 'SO-DEMO-MED-01', status: 'invoiced', total: 640_000, daysAgo: 55 },
  { customerCode: 'AX-MEDICAL', customerName: 'Axos Medical', soNumber: 'SO-DEMO-MED-02', status: 'in_production', total: 410_000, daysAgo: 8 },
];

async function seedCustomerSalesOrders(app: INestApplicationContext): Promise<Tally> {
  const t = tally();
  const repo = app.get(DataSource).getRepository(ErpSalesOrder);
  for (const o of CUSTOMER_SALES_ORDERS) {
    try {
      const exists = await repo.findOne({ where: { soNumber: o.soNumber } });
      if (exists) { t.skipped++; continue; }
      const subtotal = Math.round((o.total / 1.16) * 100) / 100;
      await repo.save(repo.create({
        soNumber: o.soNumber, customerCode: o.customerCode, customerName: o.customerName,
        orderDate: crmDay(-o.daysAgo), requestedDate: crmDay(-o.daysAgo + 45),
        status: o.status as any, currency: 'USD',
        subtotal, taxAmount: Math.round((o.total - subtotal) * 100) / 100, total: o.total,
        createdBy: 'seed-demo',
      }));
      t.created++;
    } catch (err) {
      t.errors++;
      log('ventas', `ERROR ${o.soNumber}: ${(err as Error).message}`);
    }
  }
  log('ventas', `órdenes nuevas=${t.created} ya existían=${t.skipped} errores=${t.errors}`);
  return t;
}

async function seedCrmSuite(app: INestApplicationContext): Promise<Tally> {
  const t = tally();
  const ds = app.get(DataSource);
  const accountsSvc = app.get(AccountsService);
  const contactsSvc = app.get(ContactsService);
  const crm = app.get(CrmService);
  const quotesSvc = app.get(QuotesService);
  const activitiesSvc = app.get(ActivitiesService);

  const acctRepo = ds.getRepository(CrmAccount);
  const idByCode = new Map<string, string>();
  const nameByCode = new Map(CRM_ACCOUNTS.map((a) => [a.code, a.name]));

  // 1) Cuentas
  for (const a of CRM_ACCOUNTS) {
    try {
      let row = await acctRepo.findOne({ where: { code: a.code } });
      if (!row) {
        row = await accountsSvc.create(a as any);
        t.created++;
      } else {
        t.skipped++;
      }
      idByCode.set(a.code, row.id);
    } catch (err) {
      t.errors++;
      log('crm', `ERROR cuenta ${a.code}: ${(err as Error).message}`);
    }
  }

  // 2) Contactos (idempotente por cuenta+nombre)
  const contactRepo = ds.getRepository(CrmContact);
  for (const [code, contacts] of Object.entries(CRM_CONTACTS)) {
    const accountId = idByCode.get(code);
    if (!accountId) continue;
    for (const c of contacts) {
      try {
        const exists = await contactRepo.findOne({
          where: { account_id: accountId, firstName: c.firstName as string },
        });
        if (exists) { t.skipped++; continue; }
        await contactsSvc.create({ accountId, ...c } as any);
        t.created++;
      } catch (err) {
        t.errors++;
        log('crm', `ERROR contacto ${String(c.firstName)}: ${(err as Error).message}`);
      }
    }
  }

  // 3) Oportunidades (idempotente por título); avanza por el pipeline
  const oppRepo = ds.getRepository(Opportunity);
  const oppIdByTitle = new Map<string, string>();
  const PATH: Record<string, string[]> = {
    LEAD: [], QUALIFIED: ['QUALIFIED'], PROPOSAL: ['QUALIFIED', 'PROPOSAL'],
    WON: ['QUALIFIED', 'PROPOSAL', 'WON'], LOST: ['QUALIFIED', 'LOST'],
  };
  for (const o of CRM_OPPS) {
    try {
      const accountId = idByCode.get(o.account);
      let row = await oppRepo.findOne({ where: { title: o.title } });
      if (!row) {
        row = await crm.create({
          title: o.title, accountId, customerName: nameByCode.get(o.account),
          estimatedValue: o.estimatedValue, source: o.source,
          productLine: o.productLine, competitor: (o as any).competitor,
          nextStep: (o as any).nextStep,
        } as any);
        for (const step of PATH[o.status] ?? []) {
          await crm.transition(row.id, {
            status: step as any,
            lossReason: step === 'LOST' ? (o as any).lossReason : undefined,
          } as any);
        }
        t.created++;
      } else {
        t.skipped++;
      }
      oppIdByTitle.set(o.title, row.id);
    } catch (err) {
      t.errors++;
      log('crm', `ERROR oportunidad ${o.title}: ${(err as Error).message}`);
    }
  }

  // 4) Cotizaciones con líneas (idempotente por cuenta+título)
  const quoteRepo = ds.getRepository(CrmQuote);
  for (const q of CRM_QUOTES) {
    try {
      const accountId = idByCode.get(q.account);
      if (!accountId) continue;
      const exists = await quoteRepo.findOne({ where: { account_id: accountId, title: q.title } });
      if (exists) { t.skipped++; continue; }
      const created = await quotesSvc.create({
        accountId, title: q.title, opportunityId: oppIdByTitle.get(q.oppTitle),
        paymentTerms: q.paymentTerms, incoterm: q.incoterm, leadTimeDays: q.leadTimeDays,
        discountPct: q.discountPct, lines: q.lines as any,
      } as any);
      if (q.status === 'SENT') await quotesSvc.transition(created.id, 'SENT');
      t.created++;
    } catch (err) {
      t.errors++;
      log('crm', `ERROR cotización ${q.title}: ${(err as Error).message}`);
    }
  }

  // 5) Actividades (idempotente por cuenta+asunto); backdatea el timeline
  const activityRepo = ds.getRepository(CrmActivity);
  for (const a of CRM_ACTIVITIES) {
    try {
      const accountId = idByCode.get(a.account);
      if (!accountId) continue;
      const exists = await activityRepo.findOne({ where: { account_id: accountId, subject: a.subject } });
      if (exists) { t.skipped++; continue; }
      const saved = await activitiesSvc.create({
        accountId, type: a.type, subject: a.subject, body: (a as any).body,
        direction: (a as any).direction, status: (a as any).status,
        dueAt: (a as any).dueInDays != null ? crmDay((a as any).dueInDays).toISOString() : undefined,
      } as any);
      if ((a as any).daysAgo != null) {
        await activityRepo.update(saved.id, { created_at: crmDay(-(a as any).daysAgo) });
      }
      t.created++;
    } catch (err) {
      t.errors++;
      log('crm', `ERROR actividad ${a.subject}: ${(err as Error).message}`);
    }
  }

  log('crm', `nuevos=${t.created} ya existían=${t.skipped} errores=${t.errors}`);
  return t;
}

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

  // CRM: la suite comercial completa (cuentas, contactos, oportunidades,
  // cotizaciones, actividades) se siembra en seedCrmSuite() — aquí ya no van
  // oportunidades sueltas.

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
    { failureDescription: 'Unidad no enciende — falla intermitente de fuente', severity: 'HIGH', customerName: 'Axos Mobility', partNumber: 'AX-PCBA-BMS3' },
    { failureDescription: 'Conector USB flojo reportado por cliente', severity: 'MEDIUM', customerName: 'Axos Power', partNumber: 'AX-PCBA-INV30' },
    { failureDescription: 'Falla de soldadura fría en módulo de sensor', severity: 'HIGH', customerName: 'Axos Medical' },
    { failureDescription: 'Etiqueta de trazabilidad ilegible en lote', severity: 'LOW', customerName: 'Axos Mobility' },
  ]) {
    await ensure(RmaCase, { failureDescription: r.failureDescription }, () => rma.create(r as any));
  }

  log('negocio', `registros nuevos=${t.created} ya existían=${t.skipped} errores=${t.errors}`);
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// Buzón de notificaciones: avisos demo por usuario (para que la campanita y el
// centro de notificaciones tengan contenido real con estado de leído de servidor).
// Idempotente por dedupeKey. Se crean con tenant nulo (mismo ámbito del demo), así
// el usuario los ve. Crea unos pocos por cada usuario existente.
// ─────────────────────────────────────────────────────────────────────────────
async function seedNotifications(app: INestApplicationContext): Promise<Tally> {
  const t = tally();
  const ds = app.get(DataSource);
  const notifications = app.get(NotificationsService);
  const users = await ds.getRepository(User).find({ take: 50 });
  const templates = [
    {
      kind: 'approval',
      severity: 'high',
      domain: 'planning',
      title: 'WOs publicadas pendientes de surtido',
      body: 'Hay órdenes en el muro del plan esperando kit. Revisa y autoriza el surtido.',
      href: '/dashboard/production-plan',
    },
    {
      kind: 'hold',
      severity: 'medium',
      domain: 'quality',
      title: 'Hold de calidad en MRB',
      body: 'Un lote quedó retenido y espera disposición del MRB.',
      href: '/dashboard/floor-quality',
    },
    {
      kind: 'system',
      severity: 'info',
      domain: 'office',
      title: 'Tu buzón de notificaciones está activo',
      body: 'Aquí llegan avisos del piso (andon, holds, aprobaciones) y del sistema, con estado de leído que se sincroniza entre dispositivos.',
      href: '/dashboard/notifications',
    },
  ];
  for (const u of users) {
    for (let i = 0; i < templates.length; i++) {
      const dedupeKey = `demo:notif:${u.id}:${i}`;
      try {
        const before = await ds
          .getRepository(UserNotification)
          .findOne({ where: { dedupeKey, userId: u.id } });
        if (before) {
          t.skipped++;
          continue;
        }
        await notifications.create({ userId: u.id, dedupeKey, ...templates[i] });
        t.created++;
      } catch (err) {
        t.errors++;
        log('avisos', `ERROR usuario ${u.id}: ${(err as Error).message}`);
      }
    }
  }
  log('avisos', `nuevos=${t.created} ya existían=${t.skipped} errores=${t.errors}`);
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

// ═════════════════════════════════════════════════════════════════════════════
// DENSIDAD FASE 2 — Profundidad relacional para que NINGUNA herramienta del hub
// quede vacía y las vistas relacionales (¿dónde se usa?, scorecard de proveedor,
// vida de herramental, CMMS, Clear-to-Build) tengan de qué tirar. Aditivo,
// idempotente (clave natural AX-*), 100% universo AXOS (pasa el audit).
// ═════════════════════════════════════════════════════════════════════════════

const DAY_MS = 86_400_000;
/** Fecha relativa a hoy (días; negativo = pasado). */
function relDate(days: number): Date {
  return new Date(Date.now() + days * DAY_MS);
}
/** Program slug (mismo que usa seedModels) por código de programa demo. */
const PROG = {
  mobility: slugCode('AX-MOBILITY-P'),
  power: slugCode('AX-POWER-P'),
  medical: slugCode('AX-MEDICAL-P'),
  aero: slugCode('AX-AERO-P'),
};

// ─────────────────────────────────────────────────────────────────────────────
// Tooling: herramentales (estencil/fixture/molde/galga) con vida total y disparos
// consumidos a distintos %, incluyendo 2 cerca de fin de vida, 1 en mantenimiento
// y 1 retirado — para que el semáforo de vida y las alertas tengan señal real.
// ─────────────────────────────────────────────────────────────────────────────
type ToolSpec = {
  name: string;
  type: 'STENCIL' | 'FIXTURE' | 'MOLD' | 'GAUGE';
  cavities: number;
  lifeShots: number;
  shotsUsed: number;
  status: 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'RETIRED';
  location: string;
  programId: string;
};
const DEMO_TOOLS: ToolSpec[] = [
  { name: 'Estencil SMT — AX-DRIVE-100', type: 'STENCIL', cavities: 1, lifeShots: 60000, shotsUsed: 12600, status: 'IN_USE', location: 'SMT Línea 1', programId: PROG.mobility },
  { name: 'Estencil SMT — AX-POWER-200', type: 'STENCIL', cavities: 1, lifeShots: 60000, shotsUsed: 33000, status: 'IN_USE', location: 'SMT Línea 2', programId: PROG.power },
  { name: 'Fixture ICT — AX-SENSE-300', type: 'FIXTURE', cavities: 4, lifeShots: 200000, shotsUsed: 156000, status: 'IN_USE', location: 'Pruebas Línea 5', programId: PROG.medical },
  { name: 'Fixture FCT — AX-COMM-400', type: 'FIXTURE', cavities: 2, lifeShots: 150000, shotsUsed: 132000, status: 'IN_USE', location: 'Pruebas Línea 7', programId: PROG.aero },
  { name: 'Molde carcasa — AX-MOTOR-500', type: 'MOLD', cavities: 2, lifeShots: 500000, shotsUsed: 486000, status: 'MAINTENANCE', location: 'Inyección', programId: PROG.mobility },
  { name: 'Molde gabinete — AX-GATE-600', type: 'MOLD', cavities: 1, lifeShots: 400000, shotsUsed: 92000, status: 'AVAILABLE', location: 'Inyección', programId: PROG.aero },
  { name: 'Galga pasa/no-pasa — AX-METER-700', type: 'GAUGE', cavities: 1, lifeShots: 100000, shotsUsed: 64000, status: 'IN_USE', location: 'Calidad', programId: PROG.power },
  { name: 'Fixture de prueba — AX-NODE-800 (fin de vida)', type: 'FIXTURE', cavities: 4, lifeShots: 180000, shotsUsed: 180000, status: 'RETIRED', location: 'Resguardo', programId: PROG.medical },
];

async function seedToolingDepth(app: INestApplicationContext, ds: DataSource): Promise<Tally> {
  const tooling = app.get(ToolingService, { strict: false });
  const repo = ds.getRepository(Tool);
  const t = tally();
  for (const spec of DEMO_TOOLS) {
    try {
      assertSeedText(spec.name, 'nombre de herramental');
      if (await repo.findOne({ where: { name: spec.name } })) { t.skipped++; continue; }
      const created = await tooling.create({
        name: spec.name, type: spec.type, cavities: spec.cavities,
        lifeShots: spec.lifeShots, shotsUsed: spec.shotsUsed,
        location: spec.location, programId: spec.programId,
      });
      if (spec.status !== 'AVAILABLE') await tooling.setStatus(created.id, { status: spec.status });
      t.created++;
    } catch (err) {
      t.errors++;
      log('tooling', `ERROR ${spec.name}: ${(err as Error).message}`);
    }
  }
  log('tooling', `herramentales=${t.created} ya existían=${t.skipped} errores=${t.errors}`);
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// Maintenance (CMMS): activos adicionales + órdenes correctivo/preventivo/predictivo
// en distintos estados (abierto/en progreso/completado/cancelado), con 1 PM vencido,
// 1 PM por vencer y completadas con paro real (MTTR). Liga órdenes a activos.
// ─────────────────────────────────────────────────────────────────────────────
type AssetSpec = { name: string; code: string; category: string; location: string; criticality: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; status: 'RUNNING' | 'DOWN' | 'IDLE' | 'RETIRED' };
const DEMO_MAINT_ASSETS: AssetSpec[] = [
  { name: 'Pick & Place P2', code: 'EQ-SMT-002', category: 'SMT', location: 'Línea 2', criticality: 'CRITICAL', status: 'RUNNING' },
  { name: 'AOI inline L1', code: 'EQ-AOI-001', category: 'Inspección', location: 'Línea 1', criticality: 'HIGH', status: 'RUNNING' },
  { name: 'Soldadora de ola THT', code: 'EQ-WAVE-001', category: 'THT', location: 'Línea THT', criticality: 'HIGH', status: 'DOWN' },
  { name: 'Lavadora de estencil', code: 'EQ-WASH-001', category: 'SMT', location: 'Cuarto SMT', criticality: 'MEDIUM', status: 'RUNNING' },
  { name: 'Estación ICT L5', code: 'EQ-ICT-005', category: 'Pruebas', location: 'Línea 5', criticality: 'HIGH', status: 'IDLE' },
  { name: 'Horno de curado L7', code: 'EQ-OVEN-002', category: 'Ensamble', location: 'Línea 7', criticality: 'MEDIUM', status: 'RUNNING' },
];

type OrderSpec = {
  title: string;
  type: 'PREVENTIVE' | 'CORRECTIVE' | 'PREDICTIVE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  asset?: string; // nombre del activo a ligar (nuevo o ya existente)
  assignedTo?: string;
  dueInDays?: number;
  target: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  downtimeMin?: number; // al completar
  startedDaysAgo?: number; // backdate para MTTR / historial
};
const DEMO_MAINT_ORDERS: OrderSpec[] = [
  { title: 'PM trimestral — Pick & Place P2', type: 'PREVENTIVE', priority: 'HIGH', asset: 'Pick & Place P2', assignedTo: 'Fernando Aguilar', dueInDays: -6, target: 'OPEN' },
  { title: 'PM mensual — AOI inline L1', type: 'PREVENTIVE', priority: 'MEDIUM', asset: 'AOI inline L1', assignedTo: 'Fernando Aguilar', dueInDays: 4, target: 'OPEN' },
  { title: 'PM semestral — Horno de reflujo SMT-1', type: 'PREVENTIVE', priority: 'MEDIUM', asset: 'Horno de reflujo SMT-1', assignedTo: 'Gabriela Domínguez', dueInDays: -1, target: 'COMPLETED', downtimeMin: 90, startedDaysAgo: 7 },
  { title: 'Correctivo — falla de soldadora de ola', type: 'CORRECTIVE', priority: 'HIGH', asset: 'Soldadora de ola THT', assignedTo: 'Fernando Aguilar', target: 'IN_PROGRESS', startedDaysAgo: 1 },
  { title: 'Correctivo — termopar zona 3 del horno', type: 'CORRECTIVE', priority: 'HIGH', asset: 'Horno de curado L7', dueInDays: 1, target: 'OPEN' },
  { title: 'Correctivo — boquilla tapada en P&P (resuelto)', type: 'CORRECTIVE', priority: 'MEDIUM', asset: 'Pick & Place P1', assignedTo: 'Fernando Aguilar', target: 'COMPLETED', downtimeMin: 45, startedDaysAgo: 3 },
  { title: 'Predictivo — análisis de vibración del compresor', type: 'PREDICTIVE', priority: 'LOW', asset: 'Compresor central', target: 'OPEN' },
  { title: 'Correctivo — fuga menor de aire (duplicado)', type: 'CORRECTIVE', priority: 'LOW', asset: 'Compresor central', target: 'CANCELLED' },
  { title: 'PM anual — Estación ICT L5', type: 'PREVENTIVE', priority: 'MEDIUM', asset: 'Estación ICT L5', assignedTo: 'Gabriela Domínguez', dueInDays: 12, target: 'IN_PROGRESS', startedDaysAgo: 1 },
  { title: 'Correctivo — banda transportadora L1', type: 'CORRECTIVE', priority: 'MEDIUM', asset: 'AOI inline L1', assignedTo: 'Fernando Aguilar', target: 'COMPLETED', downtimeMin: 120, startedDaysAgo: 5 },
];

async function seedMaintenanceDepth(app: INestApplicationContext, ds: DataSource): Promise<Tally> {
  const maint = app.get(MaintenanceService, { strict: false });
  const assetRepo = ds.getRepository(Asset);
  const orderRepo = ds.getRepository(MaintenanceOrder);
  const t = tally();

  // Activos (idempotente por nombre); estado distinto de RUNNING vía updateAsset.
  for (const a of DEMO_MAINT_ASSETS) {
    try {
      if (await assetRepo.findOne({ where: { name: a.name } })) { t.skipped++; continue; }
      const saved = await maint.createAsset({
        name: a.name, code: a.code, category: a.category,
        location: a.location, criticality: a.criticality,
      });
      if (a.status !== 'RUNNING') await maint.updateAsset(saved.id, { status: a.status });
      t.created++;
    } catch (err) {
      t.errors++;
      log('cmms', `ERROR activo ${a.name}: ${(err as Error).message}`);
    }
  }

  // Mapa nombre→id de TODOS los activos del ámbito demo (incluye los 3 previos).
  const assetIdByName = new Map((await maint.listAssets()).map((a) => [a.name, a.id]));

  for (const o of DEMO_MAINT_ORDERS) {
    try {
      if (await orderRepo.findOne({ where: { title: o.title } })) { t.skipped++; continue; }
      const assetId = o.asset ? assetIdByName.get(o.asset) : undefined;
      const created = await maint.createOrder({
        title: o.title, type: o.type, priority: o.priority,
        assetId, assignedTo: o.assignedTo,
        dueDate: o.dueInDays != null ? relDate(o.dueInDays).toISOString().slice(0, 10) : undefined,
      });
      if (o.target === 'IN_PROGRESS') {
        await maint.transitionOrder(created.id, { status: 'IN_PROGRESS' });
      } else if (o.target === 'COMPLETED') {
        await maint.transitionOrder(created.id, { status: 'IN_PROGRESS' });
        await maint.transitionOrder(created.id, { status: 'COMPLETED', downtimeMinutes: o.downtimeMin });
      } else if (o.target === 'CANCELLED') {
        await maint.transitionOrder(created.id, { status: 'CANCELLED' });
      }
      // Backdate (MTTR realista + historial): started/completed/created en el pasado.
      if (o.startedDaysAgo != null) {
        const started = relDate(-o.startedDaysAgo);
        const completed = o.target === 'COMPLETED'
          ? new Date(started.getTime() + (o.downtimeMin ?? 60) * 60_000)
          : undefined;
        await orderRepo.update(created.id, { startedAt: started, completedAt: completed, created_at: started } as any);
      }
      t.created++;
    } catch (err) {
      t.errors++;
      log('cmms', `ERROR orden ${o.title}: ${(err as Error).message}`);
    }
  }
  log('cmms', `activos+órdenes=${t.created} ya existían=${t.skipped} errores=${t.errors}`);
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// Warehouse tasks: cola de acomodo/surtido/traslado/conteo en varios estados
// (pendiente/en progreso/completada), cruzando partes demo y almacenes demo.
// ─────────────────────────────────────────────────────────────────────────────
/** Fecha relativa en minutos hacia atrás (para sembrar aging realista de pulls). */
function relMinutesAgo(mins: number): Date {
  return new Date(Date.now() - mins * 60_000);
}
type WhTaskSpec = {
  n: number;
  type: WarehouseTaskType;
  status: WarehouseTaskStatus;
  partNumber: string;
  quantity: number;
  fromWarehouseId: string;
  fromLocation: string;
  toWarehouseId: string;
  toLocation: string;
  assignedTo?: string;
  referenceType?: string;
  referenceId?: string;
  // ── Campos de PULL (aditivos) ──
  project?: string;
  requestor?: string;
  urgent?: boolean;
  touches?: number;
  slaMinutes?: number;
  /** Minutos que el pull lleva esperando (backdatea createdAt → aging vivo). */
  agingMinutes?: number;
  /** Para pulls entregados: minutos que tardó el suministro (createdAt→deliveredAt). */
  deliveredAfterMinutes?: number;
};
const WH = { RM: DEMO_WH_RM, WIP: DEMO_WH_WIP, QA: DEMO_WH_QA };
const DEMO_WH_TASKS: WhTaskSpec[] = [
  // Pulls abiertos con aging semaforizado (verde/ámbar/rojo según SLA).
  { n: 1, type: WarehouseTaskType.PUT_AWAY, status: WarehouseTaskStatus.PENDING, partNumber: 'PCB-AX100-4L', quantity: 800, fromWarehouseId: WH.RM, fromLocation: 'RECV', toWarehouseId: WH.RM, toLocation: 'A-01', assignedTo: 'Beto Almacén', referenceType: 'RECEIPT', referenceId: 'RCV-PCB-AX100-4L', project: 'AX-MOBILITY', requestor: 'Recibo', slaMinutes: 180, agingMinutes: 25, touches: 0 },
  { n: 2, type: WarehouseTaskType.PICK, status: WarehouseTaskStatus.PENDING, partNumber: 'IC-MCU-32B', quantity: 50, fromWarehouseId: WH.RM, fromLocation: 'A-01', toWarehouseId: WH.WIP, toLocation: 'L1-POU', assignedTo: 'Óscar Jiménez', referenceType: 'WO', referenceId: 'AX-WO-0001', project: 'AX-MOBILITY', requestor: 'Líder L1', urgent: true, slaMinutes: 60, agingMinutes: 95, touches: 2 },
  { n: 3, type: WarehouseTaskType.TRANSFER, status: WarehouseTaskStatus.IN_PROGRESS, partNumber: 'CONN-RJ45-MAG', quantity: 200, fromWarehouseId: WH.RM, fromLocation: 'A-01', toWarehouseId: WH.WIP, toLocation: 'L7-POU', assignedTo: 'Óscar Jiménez', referenceType: 'REPLEN', referenceId: 'AX-WO-0007', project: 'AX-POWER', requestor: 'Líder L7', slaMinutes: 90, agingMinutes: 35, touches: 1 },
  { n: 4, type: WarehouseTaskType.PUT_AWAY, status: WarehouseTaskStatus.COMPLETED, partNumber: 'RES-10K-0402', quantity: 20000, fromWarehouseId: WH.RM, fromLocation: 'RECV', toWarehouseId: WH.RM, toLocation: 'B-12', assignedTo: 'Beto Almacén', referenceType: 'RECEIPT', referenceId: 'RCV-RES-10K-0402', project: 'AX-MOBILITY', requestor: 'Recibo', slaMinutes: 180, deliveredAfterMinutes: 70, touches: 1 },
  { n: 5, type: WarehouseTaskType.PICK, status: WarehouseTaskStatus.IN_PROGRESS, partNumber: 'CAP-100N-0603', quantity: 2400, fromWarehouseId: WH.RM, fromLocation: 'A-01', toWarehouseId: WH.WIP, toLocation: 'L5-POU', assignedTo: 'Daniela Castillo', referenceType: 'WO', referenceId: 'AX-WO-0005', project: 'AX-MEDICAL', requestor: 'Líder L5', slaMinutes: 120, agingMinutes: 100, touches: 1 },
  { n: 6, type: WarehouseTaskType.CONFIRM, status: WarehouseTaskStatus.PENDING, partNumber: 'PCB-AX200-6L', quantity: 120, fromWarehouseId: WH.QA, fromLocation: 'QA-HOLD', toWarehouseId: WH.QA, toLocation: 'QA-HOLD', assignedTo: 'Carla Calidad', referenceType: 'IQC', referenceId: 'AX-IQC-0006', project: 'AX-AERO', requestor: 'Calidad IQC', slaMinutes: 240, agingMinutes: 50, touches: 0 },
  { n: 7, type: WarehouseTaskType.PICK, status: WarehouseTaskStatus.COMPLETED, partNumber: 'ENC-AX-ALU', quantity: 25, fromWarehouseId: WH.RM, fromLocation: 'A-01', toWarehouseId: WH.WIP, toLocation: 'L3-POU', assignedTo: 'Óscar Jiménez', referenceType: 'WO', referenceId: 'AX-WO-0003', project: 'AX-POWER', requestor: 'Líder L3', slaMinutes: 90, deliveredAfterMinutes: 40, touches: 1 },
  { n: 8, type: WarehouseTaskType.TRANSFER, status: WarehouseTaskStatus.PENDING, partNumber: 'LABEL-QR-AX', quantity: 5000, fromWarehouseId: WH.RM, fromLocation: 'A-01', toWarehouseId: WH.WIP, toLocation: 'L1-POU', assignedTo: undefined, referenceType: 'REPLEN', project: 'AX-MOBILITY', requestor: 'Líder L1', slaMinutes: 120, agingMinutes: 15, touches: 0 },
  { n: 9, type: WarehouseTaskType.PUT_AWAY, status: WarehouseTaskStatus.PENDING, partNumber: 'IC-XCVR-CAN', quantity: 3000, fromWarehouseId: WH.RM, fromLocation: 'RECV', toWarehouseId: WH.RM, toLocation: 'C-04', assignedTo: 'Beto Almacén', referenceType: 'RECEIPT', referenceId: 'RCV-IC-XCVR-CAN', project: 'AX-AERO', requestor: 'Recibo', slaMinutes: 180, agingMinutes: 60, touches: 0 },
  { n: 10, type: WarehouseTaskType.PICK, status: WarehouseTaskStatus.PENDING, partNumber: 'MOS-NCH-30V', quantity: 240, fromWarehouseId: WH.RM, fromLocation: 'A-01', toWarehouseId: WH.WIP, toLocation: 'L2-POU', assignedTo: undefined, referenceType: 'WO', referenceId: 'AX-WO-0003', project: 'AX-MEDICAL', requestor: 'Líder L2', urgent: true, slaMinutes: 120, agingMinutes: 150, touches: 3 },
  // Pulls ENTREGADOS (histórico para la analítica de suministro): varios almacenes,
  // proyectos y días, con tiempos de suministro (deliveredAfterMinutes) distintos.
  { n: 11, type: WarehouseTaskType.PICK, status: WarehouseTaskStatus.COMPLETED, partNumber: 'IC-MCU-32B', quantity: 30, fromWarehouseId: WH.RM, fromLocation: 'A-01', toWarehouseId: WH.WIP, toLocation: 'L1-POU', assignedTo: 'Óscar Jiménez', referenceType: 'PULL', referenceId: 'AX-WO-0001', project: 'AX-MOBILITY', requestor: 'Líder L1', slaMinutes: 60, deliveredAfterMinutes: 38, touches: 1 },
  { n: 12, type: WarehouseTaskType.PICK, status: WarehouseTaskStatus.COMPLETED, partNumber: 'CAP-100N-0603', quantity: 1800, fromWarehouseId: WH.RM, fromLocation: 'A-01', toWarehouseId: WH.WIP, toLocation: 'L5-POU', assignedTo: 'Daniela Castillo', referenceType: 'PULL', referenceId: 'AX-WO-0005', project: 'AX-MEDICAL', requestor: 'Líder L5', slaMinutes: 120, deliveredAfterMinutes: 155, touches: 2 },
  { n: 13, type: WarehouseTaskType.PICK, status: WarehouseTaskStatus.COMPLETED, partNumber: 'CONN-RJ45-MAG', quantity: 120, fromWarehouseId: WH.RM, fromLocation: 'A-01', toWarehouseId: WH.WIP, toLocation: 'L7-POU', assignedTo: 'Óscar Jiménez', referenceType: 'PULL', referenceId: 'AX-WO-0007', project: 'AX-POWER', requestor: 'Líder L7', slaMinutes: 90, deliveredAfterMinutes: 52, touches: 1 },
  { n: 14, type: WarehouseTaskType.PICK, status: WarehouseTaskStatus.COMPLETED, partNumber: 'MOS-NCH-30V', quantity: 200, fromWarehouseId: WH.RM, fromLocation: 'A-01', toWarehouseId: WH.WIP, toLocation: 'L2-POU', assignedTo: 'Daniela Castillo', referenceType: 'PULL', referenceId: 'AX-WO-0003', project: 'AX-MEDICAL', requestor: 'Líder L2', slaMinutes: 120, deliveredAfterMinutes: 60, touches: 1 },
  { n: 15, type: WarehouseTaskType.CONFIRM, status: WarehouseTaskStatus.COMPLETED, partNumber: 'PCB-AX200-6L', quantity: 80, fromWarehouseId: WH.QA, fromLocation: 'QA-HOLD', toWarehouseId: WH.WIP, toLocation: 'L9-POU', assignedTo: 'Carla Calidad', referenceType: 'PULL', referenceId: 'AX-IQC-0006', project: 'AX-AERO', requestor: 'Calidad IQC', slaMinutes: 240, deliveredAfterMinutes: 120, touches: 1 },
];

async function seedWarehouseTasks(ds: DataSource): Promise<Tally> {
  const repo = ds.getRepository(WarehouseTask);
  const t = tally();
  for (const w of DEMO_WH_TASKS) {
    const taskNumber = `${DEMO_WH_TASK_PREFIX}${String(w.n).padStart(4, '0')}`;
    try {
      if (await repo.findOne({ where: { taskNumber } })) { t.skipped++; continue; }
      const done = w.status === WarehouseTaskStatus.COMPLETED;
      // createdAt backdateado: para entregados, createdAt = ahora - (suministro + 1 día*n)
      // repartido en días para poblar la tendencia; para abiertos, ahora - agingMinutes.
      const supply = w.deliveredAfterMinutes ?? 0;
      const dayOffsetMin = done ? (w.n % 4) * 24 * 60 : 0; // dispersa entregas en ~4 días
      const createdAt = done
        ? relMinutesAgo(supply + dayOffsetMin)
        : relMinutesAgo(w.agingMinutes ?? 30);
      const deliveredAt = done ? relMinutesAgo(dayOffsetMin) : undefined;
      await repo.save(repo.create({
        taskNumber, type: w.type, status: w.status,
        partNumber: w.partNumber, quantity: w.quantity,
        fromWarehouseId: w.fromWarehouseId, fromLocation: w.fromLocation,
        toWarehouseId: w.toWarehouseId, toLocation: w.toLocation,
        assignedTo: w.assignedTo, referenceType: w.referenceType, referenceId: w.referenceId,
        project: w.project, requestor: w.requestor, urgent: w.urgent ?? false,
        touches: w.touches ?? 0, slaMinutes: w.slaMinutes,
        completedBy: done ? w.assignedTo : undefined,
        completedAt: deliveredAt,
        deliveredAt,
        createdAt,
      }));
      t.created++;
    } catch (err) {
      t.errors++;
      log('warehouse-task', `ERROR ${taskNumber}: ${(err as Error).message}`);
    }
  }
  log('warehouse-task', `tareas=${t.created} ya existían=${t.skipped} errores=${t.errors}`);
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// Devoluciones de material (return to stock): material que regresa al almacén,
// con motivo, batch y vendor; algunas pendientes, otras ya confirmadas.
// ─────────────────────────────────────────────────────────────────────────────
type ReturnSpec = {
  n: number;
  status: MaterialReturnStatus;
  partNumber: string;
  description?: string;
  quantity: number;
  uom?: string;
  batch?: string;
  vendor?: string;
  project?: string;
  fromLocation?: string;
  toWarehouseId: string;
  toLocation?: string;
  reason?: string;
  notes?: string;
  daysAgo?: number;
};
const DEMO_RETURNS: ReturnSpec[] = [
  { n: 1, status: MaterialReturnStatus.PENDING, partNumber: 'IC-MCU-32B', description: 'MCU 32-bit', quantity: 18, uom: 'EA', batch: 'L-MCU-2611', vendor: 'AX-SUP-NORVEL', project: 'AX-MOBILITY', fromLocation: 'L1-POU', toWarehouseId: WH.RM, toLocation: 'RET-01', reason: 'Sobrante de kit', daysAgo: 0 },
  { n: 2, status: MaterialReturnStatus.PENDING, partNumber: 'CONN-RJ45-MAG', description: 'Conector RJ45 magnético', quantity: 40, uom: 'EA', batch: 'L-RJ45-0907', vendor: 'AX-SUP-COBALT', project: 'AX-POWER', fromLocation: 'L7-POU', toWarehouseId: WH.RM, toLocation: 'RET-01', reason: 'Cambio de orden', daysAgo: 0 },
  { n: 3, status: MaterialReturnStatus.COMPLETED, partNumber: 'CAP-100N-0603', description: 'Cap 100nF 0603', quantity: 600, uom: 'EA', batch: 'L-CAP-1180', vendor: 'AX-SUP-FERRUM', project: 'AX-MEDICAL', fromLocation: 'L5-POU', toWarehouseId: WH.RM, toLocation: 'A-01', reason: 'Sobrante de kit', daysAgo: 1 },
  { n: 4, status: MaterialReturnStatus.COMPLETED, partNumber: 'RES-10K-0402', description: 'Res 10k 0402', quantity: 5000, uom: 'EA', batch: 'L-RES-3320', vendor: 'AX-SUP-FERRUM', project: 'AX-MOBILITY', fromLocation: 'L2-POU', toWarehouseId: WH.RM, toLocation: 'B-12', reason: 'Recuperable', daysAgo: 2 },
];

async function seedMaterialReturns(ds: DataSource): Promise<Tally> {
  const repo = ds.getRepository(MaterialReturn);
  const t = tally();
  for (const r of DEMO_RETURNS) {
    const returnNumber = `RET-2024-${String(r.n).padStart(4, '0')}`;
    try {
      if (await repo.findOne({ where: { returnNumber } })) { t.skipped++; continue; }
      const done = r.status === MaterialReturnStatus.COMPLETED;
      await repo.save(repo.create({
        returnNumber, status: r.status,
        partNumber: r.partNumber, description: r.description, quantity: r.quantity, uom: r.uom,
        batch: r.batch, vendor: r.vendor, project: r.project,
        fromLocation: r.fromLocation, toWarehouseId: r.toWarehouseId, toLocation: r.toLocation,
        reason: r.reason, notes: r.notes,
        restocked: done, createdBy: 'Beto Almacén',
        completedBy: done ? 'Beto Almacén' : undefined,
        completedAt: done ? relDate(-(r.daysAgo ?? 1)) : undefined,
        createdAt: relDate(-(r.daysAgo ?? 0)),
      }));
      t.created++;
    } catch (err) {
      t.errors++;
      log('material-return', `ERROR ${returnNumber}: ${(err as Error).message}`);
    }
  }
  log('material-return', `devoluciones=${t.created} ya existían=${t.skipped} errores=${t.errors}`);
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// Replenishment rules: punto-de-uso (WIP) que se reabastece desde RM. Mín/máx/
// seguridad + prioridad variada para que el motor de reabasto tenga reglas vivas.
// ─────────────────────────────────────────────────────────────────────────────
type ReplSpec = { partNumber: string; minStock: number; maxStock: number; safetyStock: number; priority: 'low' | 'normal' | 'high' | 'critical'; programId?: string; autoCreateTasks?: boolean };
const DEMO_REPL_RULES: ReplSpec[] = [
  { partNumber: 'PCB-AX100-4L', minStock: 40, maxStock: 200, safetyStock: 20, priority: 'critical', programId: PROG.mobility, autoCreateTasks: true },
  { partNumber: 'IC-MCU-32B', minStock: 100, maxStock: 600, safetyStock: 50, priority: 'high', autoCreateTasks: true },
  { partNumber: 'IC-XCVR-CAN', minStock: 60, maxStock: 300, safetyStock: 30, priority: 'high', programId: PROG.aero },
  { partNumber: 'CONN-RJ45-MAG', minStock: 50, maxStock: 250, safetyStock: 25, priority: 'high', programId: PROG.aero },
  { partNumber: 'RES-10K-0402', minStock: 2000, maxStock: 10000, safetyStock: 1000, priority: 'normal' },
  { partNumber: 'CAP-100N-0603', minStock: 2000, maxStock: 10000, safetyStock: 1000, priority: 'normal' },
  { partNumber: 'MOS-NCH-30V', minStock: 300, maxStock: 1500, safetyStock: 150, priority: 'normal', programId: PROG.power },
  { partNumber: 'ENC-AX-ALU', minStock: 30, maxStock: 150, safetyStock: 15, priority: 'high', programId: PROG.mobility },
  { partNumber: 'LABEL-QR-AX', minStock: 1000, maxStock: 6000, safetyStock: 500, priority: 'low' },
  { partNumber: 'IC-SENSOR-TEMP', minStock: 200, maxStock: 1200, safetyStock: 100, priority: 'normal', programId: PROG.medical },
];

async function seedReplenishmentRules(ds: DataSource): Promise<Tally> {
  const repo = ds.getRepository(ReplenishmentRule);
  const t = tally();
  for (const r of DEMO_REPL_RULES) {
    try {
      if (await repo.findOne({ where: { warehouseId: DEMO_WH_WIP, partNumber: r.partNumber } })) { t.skipped++; continue; }
      await repo.save(repo.create({
        warehouseId: DEMO_WH_WIP, partNumber: r.partNumber, programId: r.programId,
        minStock: r.minStock, maxStock: r.maxStock, safetyStock: r.safetyStock,
        preferredSourceWarehouseId: DEMO_WH_RM, isActive: true,
        autoCreateTasks: r.autoCreateTasks ?? false, priority: r.priority,
      }));
      t.created++;
    } catch (err) {
      t.errors++;
      log('replenishment', `ERROR ${r.partNumber}: ${(err as Error).message}`);
    }
  }
  log('replenishment', `reglas=${t.created} ya existían=${t.skipped} errores=${t.errors}`);
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// Calidad de proveedor (scorecard): inspecciones IQC (PASS/FAIL/CONDITIONAL) y
// SCARs ligadas a proveedores+partes. Los proveedores débiles (PPM alto) reciben
// fallas y SCARs → el scorecard pinta riesgo Major/Critical y OTD/PPM cobran vida.
// ─────────────────────────────────────────────────────────────────────────────
type IqcSpec = { n: number; supplierCode: string; partNumber: string; result: IqcResult; sampleSize: number; defectsFound: number; daysAgo: number; inspector: string; notes?: string };
const DEMO_IQC: IqcSpec[] = [
  { n: 1, supplierCode: 'AX-SUP-FERRUM', partNumber: 'RES-10K-0402', result: IqcResult.PASS, sampleSize: 200, defectsFound: 0, daysAgo: 40, inspector: 'Carla Calidad' },
  { n: 2, supplierCode: 'AX-SUP-GRANITE', partNumber: 'SCR-M3-8', result: IqcResult.PASS, sampleSize: 200, defectsFound: 0, daysAgo: 35, inspector: 'Carla Calidad' },
  { n: 3, supplierCode: 'AX-SUP-SENTINEL', partNumber: 'IC-SENSOR-TEMP', result: IqcResult.PASS, sampleSize: 80, defectsFound: 0, daysAgo: 28, inspector: 'Andrés Rojas' },
  { n: 4, supplierCode: 'AX-SUP-NORVEL', partNumber: 'IC-MCU-32B', result: IqcResult.PASS, sampleSize: 50, defectsFound: 0, daysAgo: 26, inspector: 'Andrés Rojas' },
  { n: 5, supplierCode: 'AX-SUP-NORVEL', partNumber: 'IC-MCU-32B', result: IqcResult.FAIL, sampleSize: 50, defectsFound: 4, daysAgo: 14, inspector: 'Andrés Rojas', notes: 'Coplanaridad de pines fuera de especificación.' },
  { n: 6, supplierCode: 'AX-SUP-STRATA', partNumber: 'PCB-AX200-6L', result: IqcResult.FAIL, sampleSize: 30, defectsFound: 3, daysAgo: 12, inspector: 'Carla Calidad', notes: 'Delaminación en borde y máscara de soldadura irregular.' },
  { n: 7, supplierCode: 'AX-SUP-STRATA', partNumber: 'PCB-AX100-4L', result: IqcResult.CONDITIONAL, sampleSize: 30, defectsFound: 1, daysAgo: 9, inspector: 'Carla Calidad', notes: 'Aceptado con desviación; vigilar registro de capas.' },
  { n: 8, supplierCode: 'AX-SUP-KESTREL', partNumber: 'XFMR-FLYBACK-5W', result: IqcResult.FAIL, sampleSize: 40, defectsFound: 6, daysAgo: 22, inspector: 'Andrés Rojas', notes: 'Inductancia fuera de tolerancia en 6 piezas.' },
  { n: 9, supplierCode: 'AX-SUP-KESTREL', partNumber: 'IND-4U7-1210', result: IqcResult.CONDITIONAL, sampleSize: 100, defectsFound: 2, daysAgo: 10, inspector: 'Andrés Rojas' },
  { n: 10, supplierCode: 'AX-SUP-ORION', partNumber: 'CONN-RJ45-MAG', result: IqcResult.FAIL, sampleSize: 60, defectsFound: 5, daysAgo: 18, inspector: 'Carla Calidad', notes: 'Pines doblados por mal embalaje del distribuidor.' },
  { n: 11, supplierCode: 'AX-SUP-ORION', partNumber: 'CONN-USB-C', result: IqcResult.PASS, sampleSize: 80, defectsFound: 0, daysAgo: 6, inspector: 'Carla Calidad' },
  { n: 12, supplierCode: 'AX-SUP-COBALT', partNumber: 'CONN-B2B-20', result: IqcResult.PASS, sampleSize: 80, defectsFound: 0, daysAgo: 20, inspector: 'Andrés Rojas' },
  { n: 13, supplierCode: 'AX-SUP-VOLTAIC', partNumber: 'CAP-10U-0805', result: IqcResult.PASS, sampleSize: 200, defectsFound: 0, daysAgo: 16, inspector: 'Carla Calidad' },
  { n: 14, supplierCode: 'AX-SUP-AXON', partNumber: 'IC-GATE-DRV', result: IqcResult.PASS, sampleSize: 50, defectsFound: 0, daysAgo: 12, inspector: 'Andrés Rojas' },
];

type ScarSpec = {
  n: number; supplierCode: string; partNumber: string; severity: ScarSeverity; status: ScarStatus;
  issueSummary: string; defectDescription: string; quantityAffected: number;
  openedDaysAgo: number; closedDaysAgo?: number; dueInDays?: number;
  supplierContact?: string; rootCause?: string; correctiveAction?: string;
};
const DEMO_SCARS: ScarSpec[] = [
  { n: 1, supplierCode: 'AX-SUP-KESTREL', partNumber: 'XFMR-FLYBACK-5W', severity: ScarSeverity.CRITICAL, status: ScarStatus.AWAITING_RESPONSE, issueSummary: 'Inductancia fuera de tolerancia en lote', defectDescription: '6 de 40 transformadores con inductancia bajo el límite; riesgo de falla de regulación.', quantityAffected: 6, openedDaysAgo: 21, dueInDays: 7, supplierContact: 'Hiro Tanaka', rootCause: 'Variación en número de vueltas del bobinado.' },
  { n: 2, supplierCode: 'AX-SUP-KESTREL', partNumber: 'IND-4U7-1210', severity: ScarSeverity.MINOR, status: ScarStatus.CLOSED, issueSummary: 'Marcado ilegible en carrete', defectDescription: 'Etiqueta de carrete sin trazabilidad de lote.', quantityAffected: 1, openedDaysAgo: 60, closedDaysAgo: 28, supplierContact: 'Hiro Tanaka', rootCause: 'Cinta de impresora agotada.', correctiveAction: 'Verificación de impresión añadida al empaque.' },
  { n: 3, supplierCode: 'AX-SUP-STRATA', partNumber: 'PCB-AX200-6L', severity: ScarSeverity.MAJOR, status: ScarStatus.RESPONSE_UNDER_REVIEW, issueSummary: 'Delaminación de PCB en recepción', defectDescription: '3 de 30 placas con delaminación de borde; rechazadas en IQC.', quantityAffected: 3, openedDaysAgo: 12, dueInDays: 10, supplierContact: 'Luis Carrillo', rootCause: 'Perfil de laminado fuera de control.' },
  { n: 4, supplierCode: 'AX-SUP-ORION', partNumber: 'CONN-RJ45-MAG', severity: ScarSeverity.MAJOR, status: ScarStatus.OPEN, issueSummary: 'Pines doblados por embalaje', defectDescription: '5 de 60 conectores con pines doblados; embalaje del distribuidor insuficiente.', quantityAffected: 5, openedDaysAgo: 18, dueInDays: 5, supplierContact: 'Wei Lim' },
  { n: 5, supplierCode: 'AX-SUP-NORVEL', partNumber: 'IC-MCU-32B', severity: ScarSeverity.MAJOR, status: ScarStatus.ACTION_ACCEPTED, issueSummary: 'Coplanaridad de pines', defectDescription: '4 de 50 MCU con coplanaridad fuera de especificación; riesgo de soldadura abierta.', quantityAffected: 4, openedDaysAgo: 14, dueInDays: 3, supplierContact: 'Janet Cole', rootCause: 'Manejo de charola en empaque.', correctiveAction: 'Charolas con soporte rígido y muestreo AQL reforzado.' },
  { n: 6, supplierCode: 'AX-SUP-COBALT', partNumber: 'CONN-B2B-20', severity: ScarSeverity.MINOR, status: ScarStatus.CLOSED, issueSummary: 'Fuerza de inserción alta', defectDescription: 'Fuerza de inserción sobre el límite en muestreo inicial.', quantityAffected: 12, openedDaysAgo: 75, closedDaysAgo: 40, supplierContact: 'Anke Vogt', rootCause: 'Acabado de contacto fuera de rango.', correctiveAction: 'Ajuste de baño de chapado; OK en re-validación.' },
];

async function seedSupplierQuality(ds: DataSource): Promise<Tally> {
  const supRepo = ds.getRepository(Supplier);
  const iqcRepo = ds.getRepository(IQCInspection);
  const scarRepo = ds.getRepository(SCAR);
  const t = tally();
  const idByCode = new Map((await supRepo.find()).map((s) => [s.code, s.id]));

  for (const q of DEMO_IQC) {
    const inspectionNumber = `${DEMO_IQC_PREFIX}${String(q.n).padStart(4, '0')}`;
    try {
      if (await iqcRepo.findOne({ where: { inspectionNumber } })) { t.skipped++; continue; }
      const supplierId = idByCode.get(q.supplierCode);
      await iqcRepo.save(iqcRepo.create({
        inspectionNumber,
        supplier: supplierId ? ({ id: supplierId } as any) : undefined,
        partNumber: q.partNumber, lotNumber: `LOT-${q.supplierCode.slice(-3)}-${q.n}`,
        result: q.result, sampleSize: q.sampleSize, defectsFound: q.defectsFound,
        inspector: q.inspector, notes: q.notes, warehouseId: DEMO_WH_QA,
        createdAt: relDate(-q.daysAgo),
      } as any));
      t.created++;
    } catch (err) {
      t.errors++;
      log('iqc', `ERROR ${inspectionNumber}: ${(err as Error).message}`);
    }
  }

  for (const s of DEMO_SCARS) {
    const scarNumber = `${DEMO_SCAR_PREFIX}${String(s.n).padStart(4, '0')}`;
    try {
      if (await scarRepo.findOne({ where: { scarNumber } })) { t.skipped++; continue; }
      const supplierId = idByCode.get(s.supplierCode);
      await scarRepo.save(scarRepo.create({
        scarNumber, supplier: supplierId ? ({ id: supplierId } as any) : undefined,
        status: s.status, severity: s.severity,
        partNumber: s.partNumber, lotNumber: `LOT-${s.supplierCode.slice(-3)}-${s.n}`,
        issueSummary: s.issueSummary, defectDescription: s.defectDescription,
        quantityAffected: s.quantityAffected,
        containmentRequired: 'Segregar lote afectado y 100% de inspección en recepción.',
        supplierRootCause: s.rootCause, supplierCorrectiveAction: s.correctiveAction,
        createdBy: DEMO_ACTOR, internalOwner: 'Andrés Rojas', supplierContact: s.supplierContact,
        dueDate: s.dueInDays != null ? relDate(s.dueInDays) : undefined,
        createdAt: relDate(-s.openedDaysAgo),
        closedAt: s.closedDaysAgo != null ? relDate(-s.closedDaysAgo) : undefined,
      } as any));
      t.created++;
    } catch (err) {
      t.errors++;
      log('scar', `ERROR ${scarNumber}: ${(err as Error).message}`);
    }
  }
  log('prov.calidad', `IQC+SCAR=${t.created} ya existían=${t.skipped} errores=${t.errors}`);
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// NCRs de calidad: no conformidades de recepción/proceso/proveedor ligadas a
// partes, modelos, WOs y clientes demo — para que el módulo de calidad/NCR abra
// con contenido cruzado y no vacío.
// ─────────────────────────────────────────────────────────────────────────────
type NcrSpec = {
  n: number; severity: NcrSeverity; status: NcrStatus; sourceType: NcrSourceType;
  category: string; description: string; partNumber: string; quantityAffected: number;
  line?: string; customer?: string; program?: string; model?: string; workOrder?: string;
  warehouse?: string; owner?: string; dispositionNotes?: string;
};
const DEMO_NCRS: NcrSpec[] = [
  { n: 1, severity: NcrSeverity.MAJOR, status: NcrStatus.CONTAINED, sourceType: NcrSourceType.INCOMING, category: 'Componente', description: 'PCB con delaminación detectada en IQC (proveedor Strataboard Fab).', partNumber: 'PCB-AX200-6L', quantityAffected: 3, warehouse: 'AX-WH-QA', program: 'Axos Power — Módulos 48V', model: 'AX-POWER-200', owner: 'Andrés Rojas', dispositionNotes: 'Lote segregado en cuarentena; pendiente disposición MRB.' },
  { n: 2, severity: NcrSeverity.MAJOR, status: NcrStatus.UNDER_REVIEW, sourceType: NcrSourceType.IN_PROCESS, category: 'Soldadura', description: 'Soldadura insuficiente en QFP detectada en AOI de la línea 1.', partNumber: 'PCB-AX100-4L', quantityAffected: 5, line: 'L1', customer: 'Axos Mobility', model: 'AX-DRIVE-100', workOrder: 'AX-WO-0001', owner: 'Patricia Núñez' },
  { n: 3, severity: NcrSeverity.CRITICAL, status: NcrStatus.OPEN, sourceType: NcrSourceType.IN_PROCESS, category: 'Funcional', description: 'Falla en prueba funcional de etapa de potencia en controlador de motor.', partNumber: 'AX-PCBA-500', quantityAffected: 2, line: 'L3', customer: 'Axos Mobility', model: 'AX-MOTOR-500', workOrder: 'AX-WO-0001', owner: 'Andrés Rojas' },
  { n: 4, severity: NcrSeverity.MINOR, status: NcrStatus.DISPOSITIONED, sourceType: NcrSourceType.INCOMING, category: 'Cosmético', description: 'Conectores con pines doblados por embalaje del distribuidor.', partNumber: 'CONN-RJ45-MAG', quantityAffected: 5, warehouse: 'AX-WH-QA', owner: 'Carla Calidad', dispositionNotes: 'Retrabajo de enderezado aprobado y verificado.' },
  { n: 5, severity: NcrSeverity.MAJOR, status: NcrStatus.OPEN, sourceType: NcrSourceType.SUPPLIER, category: 'Magnéticos', description: 'Transformador flyback fuera de tolerancia de inductancia (proveedor Kestrel Magnetics).', partNumber: 'XFMR-FLYBACK-5W', quantityAffected: 6, program: 'Axos Power — Módulos 48V', owner: 'Andrés Rojas' },
  { n: 6, severity: NcrSeverity.MINOR, status: NcrStatus.CLOSED, sourceType: NcrSourceType.IN_PROCESS, category: 'Etiquetado', description: 'Etiqueta de trazabilidad ilegible en unidades del nodo de sensores.', partNumber: 'LABEL-QR-AX', quantityAffected: 18, line: 'L8', customer: 'Axos Medical', model: 'AX-NODE-800', workOrder: 'AX-WO-0005', owner: 'Carla Calidad', dispositionNotes: 'Reimpresión y reverificación 100%.' },
];

async function seedQualityNcrs(ds: DataSource): Promise<Tally> {
  const repo = ds.getRepository(NCR);
  const t = tally();
  for (const n of DEMO_NCRS) {
    const ncrNumber = `${DEMO_NCR_PREFIX}${String(n.n).padStart(4, '0')}`;
    try {
      if (await repo.findOne({ where: { ncrNumber } })) { t.skipped++; continue; }
      await repo.save(repo.create({
        ncrNumber, status: n.status, severity: n.severity, sourceType: n.sourceType,
        category: n.category, description: n.description,
        partNumber: n.partNumber, lotNumber: `LOT-NCR-${n.n}`, quantityAffected: n.quantityAffected,
        line: n.line, customer: n.customer, program: n.program, model: n.model, workOrder: n.workOrder,
        warehouse: n.warehouse, createdBy: DEMO_ACTOR, owner: n.owner, dispositionNotes: n.dispositionNotes,
      }));
      t.created++;
    } catch (err) {
      t.errors++;
      log('ncr', `ERROR ${ncrNumber}: ${(err as Error).message}`);
    }
  }
  log('ncr', `NCRs=${t.created} ya existían=${t.skipped} errores=${t.errors}`);
  return t;
}

// ── SPC DATA FOUNDATION (demo): CTQ characteristics + plausible measurements ──
// The data SPC needs in order to exist: a small CTQ catalog on a demo model plus
// readings around the nominal (mostly in-spec, a couple near a limit) so the
// descriptive summary + histogram have something REAL to show. Plausible demo
// values live ONLY here (never in app logic). Idempotent + fully defensive.
async function seedSpcData(ds: DataSource): Promise<void> {
  try {
    const charRepo = ds.getRepository(QualityCharacteristic);
    const measRepo = ds.getRepository(QualityMeasurement);
    const model = await ds
      .getRepository(ProductModel)
      .findOne({ where: { modelNumber: 'AX-DRIVE-100' } });

    const specs: Array<{
      code: string; name: string; type: 'VARIABLE' | 'ATTRIBUTE'; unit: string | null;
      nominal?: number; usl?: number; lsl?: number; station: string; readings?: number[];
    }> = [
      {
        code: 'CTQ-DEMO-001', name: 'Voltaje de salida 3V3', type: 'VARIABLE', unit: 'V',
        nominal: 3.30, usl: 3.40, lsl: 3.20, station: 'Prueba ICT',
        readings: [3.30, 3.31, 3.29, 3.32, 3.28, 3.30, 3.33, 3.27, 3.31, 3.30, 3.29, 3.34, 3.30, 3.28, 3.41, 3.30, 3.32, 3.29, 3.31, 3.30],
      },
      {
        code: 'CTQ-DEMO-002', name: 'Altura del conector J1', type: 'VARIABLE', unit: 'mm',
        nominal: 10.00, usl: 10.20, lsl: 9.80, station: 'Ensamble final',
        readings: [10.00, 10.02, 9.98, 10.05, 9.97, 10.01, 10.03, 9.96, 10.04, 9.99, 10.00, 10.08, 9.95, 10.02, 9.79, 10.01, 10.00, 9.98, 10.06, 10.00],
      },
      {
        code: 'CTQ-DEMO-003', name: 'Presencia de etiqueta de trazabilidad', type: 'ATTRIBUTE',
        unit: null, station: 'Empaque',
      },
    ];

    let createdChars = 0, existed = 0, createdMeas = 0;
    for (const s of specs) {
      let c = await charRepo.findOne({ where: { code: s.code } });
      if (!c) {
        c = await charRepo.save(charRepo.create({
          code: s.code, name: s.name, modelId: model?.id ?? null, station: s.station,
          type: s.type, unit: s.unit,
          nominal: s.nominal ?? null, usl: s.usl ?? null, lsl: s.lsl ?? null,
          isCritical: true, active: true, notes: 'Característica CTQ demo (universo AXOS).',
          tenant_id: null, organization_id: null, plant_id: null, created_by: DEMO_ACTOR,
        }));
        createdChars++;
      } else {
        existed++;
      }

      const cid = c.id;
      if (s.type === 'VARIABLE' && s.readings) {
        const already = await measRepo.count({ where: { characteristicId: cid } });
        if (already === 0) {
          const now = Date.now();
          const rows = s.readings.map((value, i) => measRepo.create({
            characteristicId: cid, value, passed: null,
            subgroupId: `SG-${Math.floor(i / 5) + 1}`,
            subgroupLabel: `Subgrupo ${Math.floor(i / 5) + 1}`,
            measuredAt: new Date(now - (s.readings!.length - i) * 3_600_000),
            measuredBy: DEMO_ACTOR, source: 'FINAL_INSPECTION', reference: 'WO-DEMO-AX100',
            gage: 'CMM-01', notes: null,
            tenant_id: null, organization_id: null, plant_id: null, created_by: DEMO_ACTOR,
          }));
          await measRepo.save(rows);
          createdMeas += rows.length;
        }
      }
    }
    log('spc', `CTQ creadas=${createdChars} ya existían=${existed} · mediciones=${createdMeas}${model ? '' : ' (modelo AX-DRIVE-100 no hallado → CTQ generales)'}`);
  } catch (err) {
    log('spc', `ERROR (no fatal): ${(err as Error).message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Profundidad de inventario que CRUZA con planes (Clear-to-Build): existencias WIP
// de sub-ensambles, un faltante real (todo el on-hand asignado) y un hold de
// calidad sobre una parte demandada → al menos una WO en ROJO; el resto OK. Al
// final recalcula y persiste el readinessSummary de las WO publicadas.
// ─────────────────────────────────────────────────────────────────────────────
const WIP_SUBASSEMBLY_STOCK: Array<{ part: string; onHand: number }> = [
  { part: 'AX-PCBA-500', onHand: 18 },
  { part: 'AX-PCBA-600', onHand: 40 },
  { part: 'AX-PCBA-700', onHand: 26 },
  { part: 'AX-PCBA-800', onHand: 55 },
  { part: 'AX-PWRSTAGE-500', onHand: 30 },
];

async function seedInventoryDepth(app: INestApplicationContext, ds: DataSource): Promise<Tally> {
  const posRepo = ds.getRepository(InventoryPosition);
  const holdRepo = ds.getRepository(QualityHold);
  const planRepo = ds.getRepository(Plan);
  const quality = app.get(QualityService, { strict: false });
  const plansSvc = app.get(PlansService, { strict: false });
  const t = tally();

  // 1) Existencias WIP de sub-ensambles (buildables) → inventario que cruza BOMs.
  for (const w of WIP_SUBASSEMBLY_STOCK) {
    try {
      const exists = await posRepo.findOne({
        where: { partNumber: w.part, warehouseId: DEMO_WH_WIP, location: 'WIP-LINE' },
      });
      if (exists) { t.skipped++; continue; }
      await posRepo.save(posRepo.create({
        partNumber: w.part, warehouseId: DEMO_WH_WIP, location: 'WIP-LINE',
        onHand: w.onHand, allocated: 0, inTransit: 0, holdStatus: 'available',
      }));
      t.created++;
    } catch (err) {
      t.errors++;
      log('inv.wip', `ERROR ${w.part}: ${(err as Error).message}`);
    }
  }

  // 2) Faltante realista: todo el on-hand de PCB-AX100-4L (RM) queda asignado a
  //    otras órdenes → disponible 0 para AX-WO-0001 (Clear-to-Build de materiales).
  try {
    const pcb = await posRepo.findOne({
      where: { partNumber: 'PCB-AX100-4L', warehouseId: DEMO_WH_RM, holdStatus: 'available' },
    });
    if (pcb && Number(pcb.allocated) < 1 && Number(pcb.onHand) > 0) {
      await posRepo.update(pcb.id, { allocated: pcb.onHand });
      t.created++;
    }
  } catch (err) {
    t.errors++;
    log('inv.faltante', `ERROR PCB-AX100-4L: ${(err as Error).message}`);
  }

  // 3) Hold de calidad sobre PCB-AX200-6L (sólo lo usa AX-POWER-200) → quality ROJO
  //    para AX-WO-0003 y llena quality_holds. Idempotente por (parte+razón).
  try {
    const exists = await holdRepo.findOne({
      where: { partNumber: 'PCB-AX200-6L', reason: DEMO_QHOLD_REASON, isActive: true },
    });
    if (!exists) {
      await quality.createHold({
        partNumber: 'PCB-AX200-6L', level: QualityHoldLevel.PART_NUMBER,
        reason: DEMO_QHOLD_REASON, heldBy: DEMO_ACTOR,
        notes: 'Lote bajo disposición por delaminación detectada en IQC (demo).',
      });
      t.created++;
    }
  } catch (err) {
    t.errors++;
    log('inv.hold', `ERROR PCB-AX200-6L: ${(err as Error).message}`);
  }

  // 4) Fecha compromiso de las WO publicadas (mezcla vencida/hoy/en plazo) +
  //    recálculo y persistencia del readinessSummary (semáforo del piso real).
  const DUE_BY_WO: Record<string, number> = {
    'AX-WO-0001': -2, // vencida → embarque ROJO (+ faltante de PCB) = WO en rojo
    'AX-WO-0003': 1, // en plazo, pero quality ROJO por el hold
    'AX-WO-0005': 0, // vence hoy → embarque ÁMBAR
    'AX-WO-0007': 12, // holgado → verde
  };
  for (const p of DEMO_PLANS.filter((pl) => pl.publish)) {
    try {
      const plan = await planRepo.findOne({ where: { workOrder: p.workOrder }, relations: ['kit'] });
      if (!plan) { t.skipped++; continue; }
      const due = DUE_BY_WO[p.workOrder];
      if (due != null && !plan.dueDate) await planRepo.update(plan.id, { dueDate: relDate(due) });
      const fresh = await planRepo.findOne({ where: { workOrder: p.workOrder }, relations: ['kit'] });
      if (fresh) {
        const summary = await plansSvc.computeReadiness(fresh);
        await planRepo.update(fresh.id, { readinessSummary: summary as any });
      }
    } catch (err) {
      t.errors++;
      log('inv.readiness', `ERROR ${p.workOrder}: ${(err as Error).message}`);
    }
  }

  log('inv.densidad', `posiciones/faltante/hold/readiness=${t.created} omitidos=${t.skipped} errores=${t.errors}`);
  return t;
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
      await seedSupplierExtras(app);
      await seedReceipts(app, ds);
      await seedModels(app);
      await seedBoms(app, ds);
      await seedPlans(app, ds);
      await seedConsumption(app, ds);
      await seedQualityHolds(app, ds);
      await seedUsers(app);
      await seedPeopleHr(app, ds);
      await seedShopFloor(app, ds);
      await seedVisualAids(ds);
      await seedRouting(app, ds);
      await seedBayLayouts(ds);
      await seedMesExecutions(app, ds);
      await seedBusinessDomains(app);
      await seedCrmSuite(app);
      await seedCustomerSalesOrders(app);
      // ── Densidad Fase 2: profundidad relacional de herramientas nuevas ──
      await seedToolingDepth(app, ds);
      await seedMaintenanceDepth(app, ds);
      await seedWarehouseTasks(ds);
      await seedMaterialReturns(ds);
      await seedReplenishmentRules(ds);
      await seedSupplierQuality(ds);
      await seedQualityNcrs(ds);
      await seedSpcData(ds);
      await seedInventoryDepth(app, ds);
      await seedNotifications(app);
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
    console.log(`   Herramentales:    ${DEMO_TOOLS.length} (vida % variada, 2 cerca de fin de vida)`);
    console.log(`   CMMS:             ${DEMO_MAINT_ASSETS.length} activos + ${DEMO_MAINT_ORDERS.length} órdenes (PM vencido/por vencer)`);
    console.log(`   Warehouse tasks:  ${DEMO_WH_TASKS.length} (acomodo/surtido/traslado/conteo)`);
    console.log(`   Reglas reabasto:  ${DEMO_REPL_RULES.length}`);
    console.log(`   Calidad prov.:    IQC=${DEMO_IQC.length} · SCAR=${DEMO_SCARS.length} · NCR=${DEMO_NCRS.length}`);
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
