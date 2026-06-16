import { DataSource } from 'typeorm';
import { CostIntelligenceService } from './cost-intelligence.service';
import { FinWoCostSnapshot } from './entities/fin-wo-cost-snapshot.entity';
import { SfConsumptionEvent } from '../operator-terminal/entities/sf-consumption-event.entity';
import { SfQualityHold } from '../floor-quality/entities/sf-quality-hold.entity';
import { MaterialMaster } from '../inventory/entities/material-master.entity';
import { SfWorkOrder } from '../production-plan/entities/sf-work-order.entity';
import { SfLineStation } from '../line-engineering/entities/sf-line-station.entity';
import { SfModelLine } from '../line-engineering/entities/sf-model-line.entity';
import { CostItem, CostCategory } from '../cost-rollup/entities/cost-item.entity';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { ProductionPlanService } from '../production-plan/production-plan.service';
import { LineEngineeringService } from '../line-engineering/line-engineering.service';
import { CostRollupService } from '../cost-rollup/cost-rollup.service';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { TenantContextService, TenantContext } from '../../common/tenant/tenant-context.service';
import { createTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

const CTX: TenantContext = {
  tenant_id: 'T1',
  organization_id: null,
  plant_id: null,
  user_email: 'cogs@axos.com',
  role: 'Admin',
  permissions: ['finance:read', 'finance:write'],
  scopes: null,
};

describe('CostIntelligenceService (integration)', () => {
  let ds: DataSource;
  let svc: CostIntelligenceService;
  let plan: ProductionPlanService;
  let lineEng: LineEngineeringService;
  let ctx: TenantContextService;

  beforeEach(async () => {
    ds = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [
        FinWoCostSnapshot,
        SfConsumptionEvent,
        SfQualityHold,
        MaterialMaster,
        SfWorkOrder,
        SfLineStation,
        SfModelLine,
        CostItem,
        DocumentSequence,
      ],
    });
    await ds.initialize();
    ctx = new TenantContextService();
    const numbering = new DocumentNumberingService(
      ds.getRepository(DocumentSequence),
      ds,
      ctx,
    );
    plan = new ProductionPlanService(
      createTenantScopedRepository(SfWorkOrder, ds.manager, ctx),
      ctx,
      numbering,
    );
    lineEng = new LineEngineeringService(
      createTenantScopedRepository(SfLineStation, ds.manager, ctx),
      createTenantScopedRepository(SfModelLine, ds.manager, ctx),
      ctx,
    );
    const costRollup = new CostRollupService(ds.getRepository(CostItem), ctx);
    svc = new CostIntelligenceService(
      createTenantScopedRepository(FinWoCostSnapshot, ds.manager, ctx),
      ds.getRepository(SfConsumptionEvent),
      ds.getRepository(SfQualityHold),
      ds.getRepository(MaterialMaster),
      ctx,
      plan,
      lineEng,
      costRollup,
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  /** Common scenario: 2-station routing, 2 materials, a WO with 8/10 completed. */
  async function seed(opts: { programId?: string; quantityPlanned?: number } = {}) {
    await ds.getRepository(MaterialMaster).save([
      ds.getRepository(MaterialMaster).create({ partNumber: 'P1', description: 'Part 1', standardCost: 10 }),
      ds.getRepository(MaterialMaster).create({ partNumber: 'P2', description: 'Part 2', standardCost: 5 }),
    ]);
    await lineEng.createStation({ model: 'AX', revision: 'A', line: 'L1', station: 'S1', sequence: 1, npExpected: 'P1', useFactor: 2, stdTimeSec: 1800 });
    await lineEng.createStation({ model: 'AX', revision: 'A', line: 'L1', station: 'S2', sequence: 2, npExpected: 'P2', useFactor: 1, stdTimeSec: 1800 });
    const wo = await plan.publish({
      model: 'AX',
      revision: 'A',
      line: 'L1',
      quantityPlanned: opts.quantityPlanned ?? 10,
      programId: opts.programId ?? 'PROG-1',
    });
    return wo;
  }

  async function addConsumption(
    wo: SfWorkOrder,
    rows: Array<{ station: string; part: string; units: number; backflushQty: number }>,
  ) {
    const repo = ds.getRepository(SfConsumptionEvent);
    let i = 0;
    for (const r of rows) {
      await repo.save(
        repo.create({
          idempotencyKey: `${wo.id}:${r.station}:${i++}`,
          woId: wo.id,
          woFolio: wo.folio,
          model: wo.model,
          station: r.station,
          part: r.part,
          units: r.units,
          backflushQty: r.backflushQty,
          outboxStatus: 'SENT_STUB',
          tenant_id: 'T1',
        }),
      );
    }
  }

  it('computes COGS from backflush + standard labor + overhead absorption', () =>
    ctx.run(CTX, async () => {
      const wo = await seed();
      await plan.incrementCompleted(wo.id, 8);
      await addConsumption(wo, [
        { station: 'S1', part: 'P1', units: 8, backflushQty: 16 },
        { station: 'S2', part: 'P2', units: 8, backflushQty: 8 },
      ]);

      const cogs = await svc.cogsForWo(wo.id);
      expect(cogs.materialCost).toBe(200); // 16*10 + 8*5
      expect(cogs.standardLaborHours).toBe(8); // (8*1800 + 8*1800)/3600
      expect(cogs.laborCost).toBe(360); // 8h * 45
      expect(cogs.laborSource).toBe('STANDARD_TIME_ESTIMATE');
      expect(cogs.overheadCost).toBe(100.8); // (200+360)*0.18
      expect(cogs.overheadSource).toBe('RATE_ABSORPTION');
      expect(cogs.cogs).toBe(660.8);
      expect(cogs.unitCost).toBe(82.6); // 660.8 / 8
    }));

  it('honors parameterizable labor/overhead rates', () =>
    ctx.run(CTX, async () => {
      const wo = await seed();
      await addConsumption(wo, [{ station: 'S1', part: 'P1', units: 10, backflushQty: 10 }]);
      const cogs = await svc.cogsForWo(wo.id, { laborRate: 100, overheadRate: 0 });
      // material 10*10 = 100 ; labor 5h*100 = 500 ; overhead 0
      expect(cogs.materialCost).toBe(100);
      expect(cogs.laborCost).toBe(500);
      expect(cogs.overheadCost).toBe(0);
      expect(cogs.cogs).toBe(600);
    }));

  it('reuses cost-rollup actuals for labor & overhead when present', () =>
    ctx.run(CTX, async () => {
      const wo = await seed({ programId: 'PROG-2' });
      await addConsumption(wo, [
        { station: 'S1', part: 'P1', units: 5, backflushQty: 10 },
        { station: 'S2', part: 'P2', units: 5, backflushQty: 5 },
      ]);
      const ci = ds.getRepository(CostItem);
      await ci.save([
        ci.create({ tenantId: 'T1', workOrderId: wo.folio, category: CostCategory.LABOR, amount: 1000, description: 'Salaries' }),
        ci.create({ tenantId: 'T1', workOrderId: wo.folio, category: CostCategory.OVERHEAD, amount: 200, description: 'Facility' }),
        ci.create({ tenantId: 'T1', workOrderId: wo.folio, category: CostCategory.ENERGY, amount: 50, description: 'Power' }),
      ]);

      const cogs = await svc.cogsForWo(wo.id);
      expect(cogs.materialCost).toBe(125); // 10*10 + 5*5
      expect(cogs.laborCost).toBe(1000);
      expect(cogs.laborSource).toBe('ROLLUP_ACTUAL');
      expect(cogs.overheadCost).toBe(250); // OVERHEAD 200 + ENERGY 50
      expect(cogs.overheadSource).toBe('ROLLUP_ACTUAL');
      expect(cogs.cogs).toBe(1375);
    }));

  it('computes material usage variance (plan BOM×qty vs backflush) + scrap from holds', () =>
    ctx.run(CTX, async () => {
      const wo = await seed();
      await addConsumption(wo, [
        { station: 'S1', part: 'P1', units: 8, backflushQty: 16 },
        { station: 'S2', part: 'P2', units: 8, backflushQty: 8 },
      ]);
      const holds = ds.getRepository(SfQualityHold);
      await holds.save(
        holds.create({ part: 'P1', qty: 5, scrapQty: 3, disposition: 'SCRAP', status: 'CLOSED', woId: wo.id, tenant_id: 'T1' }),
      );

      const v = await svc.varianceForWo(wo.id);
      expect(v.materialPlanCost).toBe(250); // 10 * (2*10 + 1*5)
      expect(v.materialActualCost).toBe(200); // 16*10 + 8*5
      expect(v.materialUsageVariance).toBe(-50);
      expect(v.usageVariancePct).toBe(-0.2);
      expect(v.scrapQty).toBe(3);
      expect(v.scrapCost).toBe(30); // 3 * 10
      expect(v.totalVariance).toBe(-20); // -50 + 30
      // per-part, sorted by |variance|: P1 (-40) before P2 (-10)
      expect(v.byPart[0].part).toBe('P1');
      expect(v.byPart[0].plannedQty).toBe(20);
      expect(v.byPart[0].actualQty).toBe(16);
      expect(v.byPart[0].usageVariance).toBe(-40);
    }));

  it('freezes a period-close snapshot and does not recompute it (idempotent)', () =>
    ctx.run(CTX, async () => {
      const wo = await seed();
      await plan.incrementCompleted(wo.id, 8);
      await addConsumption(wo, [
        { station: 'S1', part: 'P1', units: 8, backflushQty: 16 },
        { station: 'S2', part: 'P2', units: 8, backflushQty: 8 },
      ]);

      const first = await svc.createSnapshot({ period: '2026-06', woId: wo.id });
      expect(first.created).toBe(1);
      expect(first.skipped).toBe(0);
      const snap = first.snapshots[0];
      expect(snap.cogs).toBe(660.8);
      expect(snap.materialUsageVariance).toBe(-50);
      expect(snap.unitCost).toBe(82.6);
      expect(snap.quantityCompleted).toBe(8);
      expect(snap.laborRate).toBe(45);
      expect(snap.laborSource).toBe('STANDARD_TIME_ESTIMATE');

      // A second close of the same (WO, period) is a no-op — history is frozen.
      const again = await svc.createSnapshot({ period: '2026-06', woId: wo.id });
      expect(again.created).toBe(0);
      expect(again.skipped).toBe(1);
      expect((await svc.listSnapshots({ period: '2026-06' })).length).toBe(1);

      const kpis = await svc.snapshotKpis({ period: '2026-06' });
      expect(kpis.snapshots).toBe(1);
      expect(kpis.cogs).toBe(660.8);
      expect(kpis.unitsCompleted).toBe(8);
      expect(kpis.avgUnitCost).toBe(82.6);
      expect(kpis.scrapCost).toBe(0); // no holds in this scenario
    }));

  it('force re-closes an existing snapshot', () =>
    ctx.run(CTX, async () => {
      const wo = await seed();
      await addConsumption(wo, [{ station: 'S1', part: 'P1', units: 5, backflushQty: 10 }]);
      await svc.createSnapshot({ period: '2026-06', woId: wo.id });
      const forced = await svc.createSnapshot({ period: '2026-06', woId: wo.id, force: true });
      expect(forced.created).toBe(1);
      expect(forced.skipped).toBe(0);
      expect((await svc.listSnapshots({ woId: wo.id })).length).toBe(1); // still one row
    }));

  it('aggregates COGS across a program', () =>
    ctx.run(CTX, async () => {
      const wo = await seed({ programId: 'PROG-9' });
      await plan.incrementCompleted(wo.id, 8);
      await addConsumption(wo, [
        { station: 'S1', part: 'P1', units: 8, backflushQty: 16 },
        { station: 'S2', part: 'P2', units: 8, backflushQty: 8 },
      ]);
      const agg = await svc.cogsForProgram('PROG-9');
      expect(agg.workOrders).toHaveLength(1);
      expect(agg.totals.count).toBe(1);
      expect(agg.totals.materialCost).toBe(200);
      expect(agg.totals.cogs).toBe(660.8);
    }));

  it('requires woId or programId to close a period', () =>
    ctx.run(CTX, async () => {
      await expect(svc.createSnapshot({ period: '2026-06' })).rejects.toThrow(/woId o programId/);
    }));
});
