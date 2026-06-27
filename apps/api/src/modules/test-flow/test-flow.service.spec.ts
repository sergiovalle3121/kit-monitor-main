import { DataSource } from 'typeorm';
import { TestFlowService } from './test-flow.service';
import { UnitFlow } from './entities/unit-flow.entity';
import { FloorQualityService } from '../floor-quality/floor-quality.service';
import { SfQualityHold } from '../floor-quality/entities/sf-quality-hold.entity';
import { SfConsumptionEvent } from '../operator-terminal/entities/sf-consumption-event.entity';
import { ProductionPlanService } from '../production-plan/production-plan.service';
import { SfWorkOrder } from '../production-plan/entities/sf-work-order.entity';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { LedgerEvent } from '../event-ledger/entities/ledger-event.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { createTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

describe('TestFlowService (integration)', () => {
  let ds: DataSource;
  let flow: TestFlowService;
  let fq: FloorQualityService;
  let ledger: EventLedgerService;
  let ctx: TenantContextService;

  beforeEach(async () => {
    ds = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [
        UnitFlow,
        SfQualityHold,
        SfConsumptionEvent,
        SfWorkOrder,
        DocumentSequence,
        LedgerEvent,
      ],
    });
    await ds.initialize();
    ctx = new TenantContextService();
    const numbering = new DocumentNumberingService(
      ds.getRepository(DocumentSequence),
      ds,
      ctx,
    );
    const plan = new ProductionPlanService(
      createTenantScopedRepository(SfWorkOrder, ds.manager, ctx),
      ctx,
      numbering,
    );
    fq = new FloorQualityService(
      createTenantScopedRepository(SfQualityHold, ds.manager, ctx),
      ds.getRepository(SfConsumptionEvent),
      ctx,
      numbering,
      plan,
    );
    ledger = new EventLedgerService(
      createTenantScopedRepository(LedgerEvent, ds.manager, ctx),
      ctx,
    );
    // genealogy intentionally omitted — it is an optional enrichment.
    flow = new TestFlowService(ds.getRepository(UnitFlow), ctx, ledger, fq);
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it('queues a finished serial for Pruebas, tied to its WO + model', async () => {
    await flow.enqueueFromAssembly({
      serialNumber: 'SN-1',
      workOrder: 'WO-1',
      executionId: 7,
      model: 'M-100',
      station: 'EST-FINAL',
    });
    const queue = await flow.getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].serialNumber).toBe('SN-1');
    expect(queue[0].stage).toBe('AWAITING_TEST');
    expect(queue[0].workOrder).toBe('WO-1');
    expect(queue[0].model).toBe('M-100');
    expect(queue[0].executionId).toBe(7);
  });

  it('is idempotent per serial — re-confirming does not duplicate the queue', async () => {
    await flow.enqueueFromAssembly({ serialNumber: 'SN-1', workOrder: 'WO-1' });
    await flow.enqueueFromAssembly({
      serialNumber: 'SN-1',
      workOrder: 'WO-1',
      model: 'M-100',
    });
    const queue = await flow.getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].model).toBe('M-100'); // provenance refreshed in place
  });

  it('PASS → ready for Empaque and leaves the test queue', async () => {
    await flow.enqueueFromAssembly({ serialNumber: 'SN-1', workOrder: 'WO-1' });
    const routed = await flow.routeFromTest({
      serialNumber: 'SN-1',
      result: 'PASS',
      testRecordId: 'tr-1',
    });
    expect(routed.stage).toBe('READY_FOR_PACKAGING');
    expect(routed.destination).toBe('PACKAGING');
    expect(routed.testResult).toBe('PASS');
    expect(routed.testRecordId).toBe('tr-1');
    expect(await flow.getQueue()).toHaveLength(0); // not awaiting test anymore
    expect(await flow.getQueue({ stage: 'READY_FOR_PACKAGING' })).toHaveLength(
      1,
    );
  });

  it('FAIL → disposition via a real floor-quality hold (reused, not reinvented)', async () => {
    await flow.enqueueFromAssembly({
      serialNumber: 'SN-2',
      workOrder: 'WO-1',
      model: 'M-100',
      station: 'EST-FINAL',
    });
    const routed = await flow.routeFromTest({
      serialNumber: 'SN-2',
      result: 'FAIL',
      failureCode: 'F-101',
      failureDescription: 'Cold solder',
      testRecordId: 'tr-2',
    });
    expect(routed.stage).toBe('IN_DISPOSITION');
    expect(routed.destination).toBe('DISPOSITION');
    expect(routed.failureCode).toBe('F-101');
    expect(routed.holdId).toBeTruthy();

    // The hold is a genuine floor-quality hold, linked by serial…
    const hold = await fq.getHold(routed.holdId as string);
    expect(hold.serial).toBe('SN-2');
    expect(hold.part).toBe('M-100');
    expect(hold.status).toBe('HELD');

    // …and it dispositions through the existing MRB flow unchanged.
    await fq.toMrb(hold.id);
    const done = await fq.disposition(hold.id, {
      disposition: 'SCRAP',
      signedBy: 'QE',
    });
    expect(done.disposition).toBe('SCRAP');
  });

  it('routes a serial even if it never went through the assembly hook', async () => {
    const routed = await flow.routeFromTest({
      serialNumber: 'SN-ORPHAN',
      result: 'PASS',
    });
    expect(routed.stage).toBe('READY_FOR_PACKAGING');
    const trace = await flow.trace('SN-ORPHAN');
    expect(trace.destination).toBe('PACKAGING');
  });

  it('traces a serial end-to-end: WO → prueba → destino, with a ledger journey', async () => {
    await flow.enqueueFromAssembly({
      serialNumber: 'SN-3',
      workOrder: 'WO-9',
      model: 'M-200',
    });
    await flow.routeFromTest({
      serialNumber: 'SN-3',
      result: 'PASS',
      testRecordId: 'tr-3',
    });
    const trace = await flow.trace('SN-3');
    expect(trace.workOrder).toBe('WO-9');
    expect(trace.testResult).toBe('PASS');
    expect(trace.destination).toBe('PACKAGING');
    expect(trace.testRecordId).toBe('tr-3');
    const actions = (trace.events as { action: string }[]).map((e) => e.action);
    expect(actions).toContain('UNIT_QUEUED_FOR_TEST');
    expect(actions).toContain('UNIT_ROUTED_TO_PACKAGING');
  });

  it('summarises the queue by stage', async () => {
    await flow.enqueueFromAssembly({ serialNumber: 'A' });
    await flow.enqueueFromAssembly({ serialNumber: 'B' });
    await flow.routeFromTest({ serialNumber: 'B', result: 'PASS' });
    await flow.enqueueFromAssembly({ serialNumber: 'C' });
    await flow.routeFromTest({ serialNumber: 'C', result: 'FAIL' });
    const s = await flow.summary();
    expect(s.total).toBe(3);
    expect(s.awaitingTest).toBe(1);
    expect(s.readyForPackaging).toBe(1);
    expect(s.inDisposition).toBe(1);
  });
});
