import { DataSource } from 'typeorm';
import { FaiService } from './fai.service';
import { SfFai } from './entities/sf-fai.entity';
import { ProductionPlanService } from '../production-plan/production-plan.service';
import { SfWorkOrder } from '../production-plan/entities/sf-work-order.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { createTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

describe('FaiService (integration)', () => {
  let ds: DataSource;
  let svc: FaiService;
  let plan: ProductionPlanService;
  const year = new Date().getFullYear();

  beforeEach(async () => {
    ds = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [SfFai, SfWorkOrder, DocumentSequence],
    });
    await ds.initialize();
    const ctx = new TenantContextService();
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
    svc = new FaiService(
      createTenantScopedRepository(SfFai, ds.manager, ctx),
      ctx,
      numbering,
      plan,
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  async function woRequiringFai() {
    return plan.publish({
      model: 'AX-1000',
      line: 'SMT-1',
      quantityPlanned: 100,
      faiRequired: true,
    });
  }

  it('opens a FAI (FAI folio) tied to the WO, denormalizing model/line', async () => {
    const wo = await woRequiringFai();
    const fai = await svc.create({
      woId: wo.id,
      station: 'EST-10',
      serial: 'SN-1',
    });
    expect(fai.folio).toBe(`FAI-${year}-00001`);
    expect(fai.result).toBe('PENDING');
    expect(fai.woFolio).toBe(wo.folio);
    expect(fai.model).toBe('AX-1000');
    expect(fai.line).toBe('SMT-1');
  });

  it('PASS approves the WO first-piece gate so it can run', async () => {
    const wo = await woRequiringFai();
    expect(plan.runBlockers(wo).blockers).toContain(
      'Primera pieza (FAI) sin aprobar.',
    );
    const fai = await svc.create({ woId: wo.id });
    await svc.submit(fai.id, {
      pass: true,
      inspector: 'QE-Ana',
      measurements: [
        { characteristic: 'Altura', lsl: 9.8, usl: 10.2, actual: 10.0 },
      ],
    });
    const woAfter = await plan.getOne(wo.id);
    expect(woAfter.faiApproved).toBe(true);
    expect(plan.runBlockers(woAfter).blockers).not.toContain(
      'Primera pieza (FAI) sin aprobar.',
    );
  });

  it('cannot approve a FAI with an out-of-tolerance measurement', async () => {
    const wo = await woRequiringFai();
    const fai = await svc.create({ woId: wo.id });
    await expect(
      svc.submit(fai.id, {
        pass: true,
        inspector: 'QE',
        measurements: [
          { characteristic: 'Altura', lsl: 9.8, usl: 10.2, actual: 10.5 },
        ],
      }),
    ).rejects.toThrow(/fuera de tolerancia/i);
    const woAfter = await plan.getOne(wo.id);
    expect(woAfter.faiApproved).toBe(false); // stays blocked
  });

  it('FAIL leaves the WO blocked and stamps measurement pass flags', async () => {
    const wo = await woRequiringFai();
    const fai = await svc.create({ woId: wo.id });
    const failed = await svc.submit(fai.id, {
      pass: false,
      inspector: 'QE',
      measurements: [
        { characteristic: 'Altura', lsl: 9.8, usl: 10.2, actual: 10.5 },
      ],
    });
    expect(failed.result).toBe('FAIL');
    expect(failed.measurements?.[0].pass).toBe(false);
    const woAfter = await plan.getOne(wo.id);
    expect(woAfter.faiApproved).toBe(false);
  });

  it('cannot re-submit a terminal FAI; open a new attempt instead', async () => {
    const wo = await woRequiringFai();
    const fai = await svc.create({ woId: wo.id });
    await svc.submit(fai.id, { pass: false, inspector: 'QE' });
    await expect(
      svc.submit(fai.id, { pass: true, inspector: 'QE' }),
    ).rejects.toThrow(/No se puede mover/);
    // A fresh attempt can still pass.
    const retry = await svc.create({ woId: wo.id });
    const ok = await svc.submit(retry.id, { pass: true, inspector: 'QE' });
    expect(ok.result).toBe('PASS');
    const history = await svc.byWo(wo.id);
    expect(history).toHaveLength(2);
  });

  it('rejects creating a FAI for an unknown WO', async () => {
    await expect(svc.create({ woId: 'does-not-exist' })).rejects.toThrow(
      /no encontrada/i,
    );
  });

  it('aggregates FAI KPIs (first-pass yield)', async () => {
    const wo1 = await woRequiringFai();
    const wo2 = await woRequiringFai();
    const f1 = await svc.create({ woId: wo1.id });
    await svc.submit(f1.id, { pass: true, inspector: 'QE' });
    const f2 = await svc.create({ woId: wo2.id });
    await svc.submit(f2.id, {
      pass: false,
      inspector: 'QE',
      measurements: [{ characteristic: 'D', usl: 1, actual: 2 }],
    });
    const k = await svc.kpis();
    expect(k.total).toBe(2);
    expect(k.passed).toBe(1);
    expect(k.failed).toBe(1);
    expect(k.firstPassYieldPct).toBe(0.5);
    expect(k.woApproved).toBe(1);
    expect(k.measurementsOutOfTol).toBe(1);
  });
});
