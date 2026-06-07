import { DataSource } from 'typeorm';
import { FloorQualityService } from './floor-quality.service';
import { SfQualityHold } from './entities/sf-quality-hold.entity';
import { SfConsumptionEvent } from '../operator-terminal/entities/sf-consumption-event.entity';
import { ProductionPlanService } from '../production-plan/production-plan.service';
import { SfWorkOrder } from '../production-plan/entities/sf-work-order.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { createTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

describe('FloorQualityService (integration)', () => {
  let ds: DataSource;
  let svc: FloorQualityService;
  let plan: ProductionPlanService;
  let ctx: TenantContextService;
  const year = new Date().getFullYear();

  beforeEach(async () => {
    ds = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [SfQualityHold, SfConsumptionEvent, SfWorkOrder, DocumentSequence],
    });
    await ds.initialize();
    ctx = new TenantContextService();
    const numbering = new DocumentNumberingService(ds.getRepository(DocumentSequence), ds, ctx);
    plan = new ProductionPlanService(createTenantScopedRepository(SfWorkOrder, ds.manager, ctx), ctx, numbering);
    svc = new FloorQualityService(
      createTenantScopedRepository(SfQualityHold, ds.manager, ctx),
      ds.getRepository(SfConsumptionEvent),
      ctx, numbering, plan,
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it('creates a hold (NCR folio) and blocks the WO consumption', async () => {
    const wo = await plan.publish({ model: 'M', line: 'L', quantityPlanned: 10 });
    expect(wo.qualityClear).toBe(true);
    const hold = await svc.createHold({ part: 'P1', qty: 50, woId: wo.id, defectType: 'Soldadura fría', severity: 'HIGH' });
    expect(hold.folio).toBe(`NCR-${year}-00001`);
    expect(hold.status).toBe('HELD');
    const woAfter = await plan.getOne(wo.id);
    expect(woAfter.qualityClear).toBe(false); // hold blocks consumption
  });

  it('USE_AS_IS disposition requires a waiver; closing releases the WO', async () => {
    const wo = await plan.publish({ model: 'M', line: 'L', quantityPlanned: 10 });
    const hold = await svc.createHold({ part: 'P1', qty: 5, woId: wo.id });
    await svc.toMrb(hold.id);
    await expect(svc.disposition(hold.id, { disposition: 'USE_AS_IS', signedBy: 'QE' })).rejects.toThrow(/waiver/i);
    await svc.disposition(hold.id, { disposition: 'USE_AS_IS', signedBy: 'QE', waiver: 'DEV-001' });
    const closed = await svc.close(hold.id);
    expect(closed.status).toBe('CLOSED');
    const woAfter = await plan.getOne(wo.id);
    expect(woAfter.qualityClear).toBe(true); // released once no open holds remain
  });

  it('RTV disposition requires a SCAR reference', async () => {
    const hold = await svc.createHold({ part: 'P2', qty: 100 });
    await svc.toMrb(hold.id);
    await expect(svc.disposition(hold.id, { disposition: 'RTV', signedBy: 'QE' })).rejects.toThrow(/SCAR/i);
    const d = await svc.disposition(hold.id, { disposition: 'RTV', signedBy: 'QE', scarRef: 'SCAR-77' });
    expect(d.disposition).toBe('RTV');
  });

  it('runs the rework loop: disposition REWORK → rework → reinspect pass → CLOSED', async () => {
    const hold = await svc.createHold({ part: 'P3', qty: 20 });
    await svc.toMrb(hold.id);
    await svc.disposition(hold.id, { disposition: 'REWORK', signedBy: 'QE' });
    await svc.startRework(hold.id);
    const done = await svc.reinspect(hold.id, { pass: true, reworkHours: 2 });
    expect(done.status).toBe('CLOSED');
    expect(done.reworkHours).toBe(2);
  });

  it('a failed re-inspection loops back to REWORK', async () => {
    const hold = await svc.createHold({ part: 'P3', qty: 20 });
    await svc.toMrb(hold.id);
    await svc.disposition(hold.id, { disposition: 'REPAIR', signedBy: 'QE' });
    await svc.startRework(hold.id);
    const again = await svc.reinspect(hold.id, { pass: false });
    expect(again.status).toBe('REWORK');
  });

  it('cannot disposition before MRB review', async () => {
    const hold = await svc.createHold({ part: 'P1', qty: 5 });
    await expect(svc.disposition(hold.id, { disposition: 'SCRAP', signedBy: 'QE' })).rejects.toThrow(/No se puede mover/);
  });

  it('where-used returns the consumption genealogy for a part', async () => {
    await ds.getRepository(SfConsumptionEvent).save(
      ds.getRepository(SfConsumptionEvent).create({
        idempotencyKey: 'k1', woId: 'w1', woFolio: 'WO-1', model: 'M', station: 'EST-10',
        part: 'P1', units: 1, backflushQty: 2, unitSerial: 'SN-1', operatorEmail: 'op@x', outboxStatus: 'SENT_STUB',
      }),
    );
    const used = await svc.whereUsed('P1');
    expect(used).toHaveLength(1);
    expect(used[0].unitSerial).toBe('SN-1');
  });

  it('aggregates quality KPIs (open, %use-as-is, scrap)', async () => {
    const h1 = await svc.createHold({ part: 'P1', qty: 10 });
    await svc.toMrb(h1.id);
    await svc.disposition(h1.id, { disposition: 'USE_AS_IS', signedBy: 'QE', waiver: 'W1' });
    await svc.close(h1.id);
    const h2 = await svc.createHold({ part: 'P2', qty: 5 });
    await svc.toMrb(h2.id);
    await svc.disposition(h2.id, { disposition: 'SCRAP', signedBy: 'QE' });
    await svc.close(h2.id);
    const k = await svc.kpis();
    expect(k.dispositioned).toBe(2);
    expect(k.useAsIs).toBe(1);
    expect(k.pctUseAsIs).toBe(0.5);
    expect(k.scrapQty).toBe(5); // SCRAP close set scrapQty = qty
  });
});
