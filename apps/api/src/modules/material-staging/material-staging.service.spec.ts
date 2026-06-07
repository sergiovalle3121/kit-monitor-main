import { DataSource } from 'typeorm';
import { MaterialStagingService } from './material-staging.service';
import { SfStaging } from './entities/sf-staging.entity';
import { SfReplenishCall } from './entities/sf-replenish-call.entity';
import { LineEngineeringService } from '../line-engineering/line-engineering.service';
import { SfLineStation } from '../line-engineering/entities/sf-line-station.entity';
import { SfModelLine } from '../line-engineering/entities/sf-model-line.entity';
import { ProductionPlanService } from '../production-plan/production-plan.service';
import { SfWorkOrder } from '../production-plan/entities/sf-work-order.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { createTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

describe('MaterialStagingService (integration)', () => {
  let dataSource: DataSource;
  let staging: MaterialStagingService;
  let plan: ProductionPlanService;
  let lineEng: LineEngineeringService;
  let ctx: TenantContextService;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [SfStaging, SfReplenishCall, SfLineStation, SfModelLine, SfWorkOrder, DocumentSequence],
    });
    await dataSource.initialize();
    ctx = new TenantContextService();
    const numbering = new DocumentNumberingService(dataSource.getRepository(DocumentSequence), dataSource, ctx);
    lineEng = new LineEngineeringService(
      createTenantScopedRepository(SfLineStation, dataSource.manager, ctx),
      createTenantScopedRepository(SfModelLine, dataSource.manager, ctx),
      ctx,
    );
    plan = new ProductionPlanService(
      createTenantScopedRepository(SfWorkOrder, dataSource.manager, ctx),
      ctx,
      numbering,
    );
    staging = new MaterialStagingService(
      createTenantScopedRepository(SfStaging, dataSource.manager, ctx),
      createTenantScopedRepository(SfReplenishCall, dataSource.manager, ctx),
      ctx,
      lineEng,
      plan,
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  async function setup(qty = 100) {
    await lineEng.createStation({ model: 'M', line: 'L', station: 'EST-10', sequence: 10, npExpected: 'P1', useFactor: 2 });
    await lineEng.createStation({ model: 'M', line: 'L', station: 'EST-20', sequence: 20, npExpected: 'P2', useFactor: 1 });
    const wo = await plan.publish({ model: 'M', line: 'L', quantityPlanned: qty });
    return wo;
  }

  it('generates staging lines from the WO routing (required = use factor × qty)', async () => {
    const wo = await setup(100);
    const lines = await staging.generateForWorkOrder({ woId: wo.id });
    expect(lines).toHaveLength(2);
    const p1 = lines.find((l) => l.part === 'P1')!;
    expect(p1.requiredQty).toBe(200); // 2 × 100
    expect(p1.minQty).toBe(30); // ceil(200 × 0.15)
    expect(p1.status).toBe('PENDING');
  });

  it('confirming all lines makes the WO material-ready', async () => {
    const wo = await setup(100);
    const lines = await staging.generateForWorkOrder({ woId: wo.id });
    for (const l of lines) await staging.confirmStaged(l.id, { stagedQty: l.requiredQty });
    const updated = await plan.getOne(wo.id);
    expect(updated.materialReady).toBe(true);
    expect(updated.status).toBe('STAGED');
  });

  it('a shortage blocks readiness and raises a replenishment call', async () => {
    const wo = await setup(100);
    const lines = await staging.generateForWorkOrder({ woId: wo.id });
    await staging.confirmStaged(lines[0].id, { stagedQty: lines[0].requiredQty });
    await staging.markShortage(lines[1].id, {});
    const updated = await plan.getOne(wo.id);
    expect(updated.materialReady).toBe(false);
    const calls = await staging.listReplenishCalls({ status: 'OPEN' });
    expect(calls.length).toBe(1);
    expect(calls[0].part).toBe('P2');
  });

  it('backflush below kanban point auto-raises a replenishment call', async () => {
    const wo = await setup(100);
    const lines = await staging.generateForWorkOrder({ woId: wo.id });
    // stage P1 with 200, min is 30. Consume 175 → 25 left ≤ 30 → kanban call.
    await staging.confirmStaged(lines[0].id, { stagedQty: 200 });
    const after = await staging.consumeStaged(wo.id, 'EST-10', 'P1', 175);
    expect(after?.stagedQty).toBe(25);
    const calls = await staging.listReplenishCalls({});
    expect(calls.some((c) => c.part === 'P1' && c.reason === 'KANBAN')).toBe(true);
  });

  it('backflush stockout throws (critical shortage) and raises an URGENT call', async () => {
    const wo = await setup(10);
    const lines = await staging.generateForWorkOrder({ woId: wo.id });
    await staging.confirmStaged(lines[0].id, { stagedQty: 1 });
    await expect(staging.consumeStaged(wo.id, 'EST-10', 'P1', 5)).rejects.toThrow(/Faltante crítico/);
    const calls = await staging.listReplenishCalls({});
    expect(calls.some((c) => c.reason === 'STOCKOUT' && c.priority === 'URGENT')).toBe(true);
  });

  it('consumeStaged is a no-op for untracked (wo, station, part)', async () => {
    const wo = await setup(10);
    await staging.generateForWorkOrder({ woId: wo.id });
    const res = await staging.consumeStaged(wo.id, 'EST-99', 'UNKNOWN', 3);
    expect(res).toBeNull();
  });

  it('computes staging KPIs (fill-rate, shortages, replenish time)', async () => {
    const wo = await setup(100);
    const lines = await staging.generateForWorkOrder({ woId: wo.id });
    await staging.confirmStaged(lines[0].id, { stagedQty: lines[0].requiredQty });
    const k = await staging.kpis();
    expect(k.totalLines).toBe(2);
    expect(k.stagedLines).toBe(1);
    expect(k.fillRatePct).toBe(0.5);
  });
});
