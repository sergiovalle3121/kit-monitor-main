import { DataSource } from 'typeorm';
import { OperatorTerminalService } from './operator-terminal.service';
import { SfConsumptionEvent } from './entities/sf-consumption-event.entity';
import { SfFloorEvent } from './entities/sf-floor-event.entity';
import { SapAdapter } from './sap-adapter';
import { Certification } from '../people/entities/certification.entity';
import { LineEngineeringService } from '../line-engineering/line-engineering.service';
import { SfLineStation } from '../line-engineering/entities/sf-line-station.entity';
import { SfModelLine } from '../line-engineering/entities/sf-model-line.entity';
import { ProductionPlanService } from '../production-plan/production-plan.service';
import { SfWorkOrder } from '../production-plan/entities/sf-work-order.entity';
import { MaterialStagingService } from '../material-staging/material-staging.service';
import { SfStaging } from '../material-staging/entities/sf-staging.entity';
import { SfReplenishCall } from '../material-staging/entities/sf-replenish-call.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { createTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

describe('OperatorTerminalService (integration — the heart)', () => {
  let ds: DataSource;
  let op: OperatorTerminalService;
  let plan: ProductionPlanService;
  let lineEng: LineEngineeringService;
  let staging: MaterialStagingService;
  let ctx: TenantContextService;

  beforeEach(async () => {
    ds = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [
        SfConsumptionEvent, SfFloorEvent, Certification, SfLineStation, SfModelLine,
        SfWorkOrder, SfStaging, SfReplenishCall, DocumentSequence,
      ],
    });
    await ds.initialize();
    ctx = new TenantContextService();
    const numbering = new DocumentNumberingService(ds.getRepository(DocumentSequence), ds, ctx);
    lineEng = new LineEngineeringService(
      createTenantScopedRepository(SfLineStation, ds.manager, ctx),
      createTenantScopedRepository(SfModelLine, ds.manager, ctx),
      ctx,
    );
    plan = new ProductionPlanService(createTenantScopedRepository(SfWorkOrder, ds.manager, ctx), ctx, numbering);
    staging = new MaterialStagingService(
      createTenantScopedRepository(SfStaging, ds.manager, ctx),
      createTenantScopedRepository(SfReplenishCall, ds.manager, ctx),
      ctx, lineEng, plan,
    );
    op = new OperatorTerminalService(
      createTenantScopedRepository(SfConsumptionEvent, ds.manager, ctx),
      createTenantScopedRepository(SfFloorEvent, ds.manager, ctx),
      ds.getRepository(Certification),
      ctx, lineEng, plan, staging, new SapAdapter(),
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  /** Stand up a runnable WO: routing + WO + staged material. */
  async function ready(opts: Partial<{ consumptionMode: 'BY_UNIT' | 'BY_QTY_FACTOR'; serialControl: 'NONE' | 'BY_UNIT'; qty: number }> = {}) {
    await lineEng.createStation({ model: 'M', line: 'L', station: 'EST-10', sequence: 10, npExpected: 'P1', useFactor: 2, stdTimeSec: 30, visualAidUrl: 'aid' });
    const wo = await plan.publish({
      model: 'M', line: 'L', quantityPlanned: opts.qty ?? 10,
      consumptionMode: opts.consumptionMode ?? 'BY_UNIT',
      serialControl: opts.serialControl ?? 'NONE',
    });
    const lines = await staging.generateForWorkOrder({ woId: wo.id });
    for (const l of lines) await staging.confirmStaged(l.id, { stagedQty: 1000 });
    return wo;
  }

  it('confirms a unit: backflush = units × use factor, WO advances, material decrements', async () => {
    const wo = await ready();
    const before = (await staging.listForWorkOrder(wo.id))[0].stagedQty;
    const res = await op.confirm({ woId: wo.id, station: 'EST-10', scannedPart: 'P1' });
    expect(res.event.units).toBe(1);
    expect(res.event.backflushQty).toBe(2); // 1 × useFactor 2
    expect(res.event.outboxStatus).toBe('SENT_STUB');
    const woAfter = await plan.getOne(wo.id);
    expect(woAfter.quantityCompleted).toBe(1);
    const after = (await staging.listForWorkOrder(wo.id))[0].stagedQty;
    expect(after).toBe(before - 2);
  });

  it('poka-yoke rejects a wrong scanned NP', async () => {
    const wo = await ready();
    await expect(
      op.confirm({ woId: wo.id, station: 'EST-10', scannedPart: 'WRONG' }),
    ).rejects.toThrow(/Poka-yoke/);
  });

  it('a quality hold blocks confirmation', async () => {
    const wo = await ready();
    await plan.setQualityClear(wo.id, false);
    await expect(
      op.confirm({ woId: wo.id, station: 'EST-10', scannedPart: 'P1' }),
    ).rejects.toThrow(/No se puede confirmar/);
  });

  it('an uncertified operator is blocked when the station has certified people', async () => {
    const wo = await ready();
    // Seed a certification for EST-10 for someone ELSE → station becomes gated.
    await ds.getRepository(Certification).save(
      ds.getRepository(Certification).create({
        employeeName: 'Certified Op', employeeEmail: 'certified@plant.com',
        skill: 'SMT', station: 'EST-10', active: true, expiresDate: null,
      }),
    );
    // ctx user is 'anonymous' (not certified) → blocked.
    await expect(
      op.confirm({ woId: wo.id, station: 'EST-10', scannedPart: 'P1' }),
    ).rejects.toThrow(/no certificado/i);
  });

  it('counts by quantity × factor when the WO is configured that way', async () => {
    const wo = await ready({ consumptionMode: 'BY_QTY_FACTOR', qty: 100 });
    const res = await op.confirm({ woId: wo.id, station: 'EST-10', scannedPart: 'P1', units: 5 });
    expect(res.event.units).toBe(5);
    expect(res.event.backflushQty).toBe(10); // 5 × 2
    expect((await plan.getOne(wo.id)).quantityCompleted).toBe(5);
  });

  it('is idempotent: same key does not double-count', async () => {
    const wo = await ready();
    const a = await op.confirm({ woId: wo.id, station: 'EST-10', scannedPart: 'P1', idempotencyKey: 'unit-1' });
    const b = await op.confirm({ woId: wo.id, station: 'EST-10', scannedPart: 'P1', idempotencyKey: 'unit-1' });
    expect(b.event.id).toBe(a.event.id);
    expect((await plan.getOne(wo.id)).quantityCompleted).toBe(1);
  });

  it('requires a serial when the program demands genealogy', async () => {
    const wo = await ready({ serialControl: 'BY_UNIT' });
    await expect(
      op.confirm({ woId: wo.id, station: 'EST-10', scannedPart: 'P1' }),
    ).rejects.toThrow(/serial/i);
    const ok = await op.confirm({ woId: wo.id, station: 'EST-10', scannedPart: 'P1', unitSerial: 'SN-0001' });
    expect(ok.event.unitSerial).toBe('SN-0001');
  });

  it('raises an andon routed to the right role and lists it', async () => {
    const wo = await ready();
    const andon = await op.raiseAndon({ type: 'ANDON_MACHINE', woId: wo.id, station: 'EST-10', note: 'Feeder atascado' });
    expect(andon.targetRole).toBe('maintenance_tech');
    expect(andon.status).toBe('OPEN');
    const open = await op.listFloorEvents({ status: 'OPEN' });
    expect(open.length).toBe(1);
  });

  it('reports a defect from the station (routed to quality)', async () => {
    const wo = await ready();
    const d = await op.reportDefect({ woId: wo.id, station: 'EST-10', part: 'P1', note: 'Soldadura fría', severity: 'HIGH' });
    expect(d.type).toBe('DEFECT');
    expect(d.targetRole).toBe('quality_engineer');
  });
});
