import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { ProductionPlanService } from './production-plan.service';
import { SfWorkOrder } from './entities/sf-work-order.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import {
  TenantContextService,
  TenantContext,
} from '../../common/tenant/tenant-context.service';
import { createTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

function ctxFor(tenant: string | null): TenantContext {
  return {
    tenant_id: tenant,
    organization_id: null,
    plant_id: null,
    user_email: 'planner@test',
    role: null,
    permissions: null,
    scopes: null,
  };
}

describe('ProductionPlanService (integration)', () => {
  let dataSource: DataSource;
  let service: ProductionPlanService;
  let ctx: TenantContextService;
  const year = new Date().getFullYear();

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [SfWorkOrder, DocumentSequence],
    });
    await dataSource.initialize();
    ctx = new TenantContextService();
    const numbering = new DocumentNumberingService(
      dataSource.getRepository(DocumentSequence),
      dataSource,
      ctx,
    );
    service = new ProductionPlanService(
      createTenantScopedRepository(SfWorkOrder, dataSource.manager, ctx),
      ctx,
      numbering,
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('publishes a WO with a WO- folio in RELEASED', async () => {
    const wo = await service.publish({ model: 'AX-1000', line: 'SMT-1', quantityPlanned: 500 });
    expect(wo.folio).toBe(`WO-${year}-000001`);
    expect(wo.status).toBe('RELEASED');
    expect(wo.materialReady).toBe(false);
  });

  it('blocks publish before folio allocation when material readiness is incomplete', async () => {
    const readiness = {
      evaluatePublish: jest.fn().mockResolvedValue({
        publishable: false,
        model: 'AX-1000',
        revision: 'A',
        bomHeaderId: 1,
        blockers: ['P-1: faltan 6 EA'],
        demand: [],
        summary: {
          materials: 'red',
          quality: 'green',
          shipping: 'unknown',
          detail: {
            totalParts: 1,
            shortParts: 1,
            shortages: [],
            heldParts: [],
            dueDate: null,
            daysToDue: null,
            reasons: ['P-1: faltan 6 EA'],
          },
          timestamp: new Date(),
        },
      }),
    };
    const numbering = { allocate: jest.fn() };
    const ledger = { recordEvent: jest.fn().mockResolvedValue({}) };
    const gated = new ProductionPlanService(
      createTenantScopedRepository(SfWorkOrder, dataSource.manager, ctx),
      ctx,
      numbering as unknown as DocumentNumberingService,
      ledger as never,
      undefined,
      readiness as never,
    );

    await expect(
      gated.publish({ model: 'AX-1000', line: 'SMT-1', quantityPlanned: 500 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(readiness.evaluatePublish).toHaveBeenCalledWith({
      model: 'AX-1000',
      line: 'SMT-1',
      quantityPlanned: 500,
    });
    expect(numbering.allocate).not.toHaveBeenCalled();
    expect(ledger.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SF_WO_PUBLISH_BLOCKED',
        referenceType: 'SF_WORK_ORDER_DRAFT',
        metadata: expect.objectContaining({
          reasonCode: 'MATERIAL_READINESS_BLOCKED',
        }),
      }),
    );
  });

  it('staging readiness moves RELEASED→STAGED; pulling back reverts', async () => {
    const wo = await service.publish({ model: 'M', line: 'L', quantityPlanned: 10 });
    const staged = await service.setMaterialReady(wo.id, true);
    expect(staged.status).toBe('STAGED');
    expect(staged.materialReady).toBe(true);
    const back = await service.setMaterialReady(wo.id, false);
    expect(back.status).toBe('RELEASED');
  });

  it('execution increments completion and auto-completes the WO', async () => {
    const wo = await service.publish({ model: 'M', line: 'L', quantityPlanned: 3 });
    await service.setMaterialReady(wo.id, true);
    let cur = await service.incrementCompleted(wo.id, 1);
    expect(cur.status).toBe('IN_EXECUTION'); // first unit starts it
    expect(cur.quantityCompleted).toBe(1);
    await service.incrementCompleted(wo.id, 1);
    cur = await service.incrementCompleted(wo.id, 1);
    expect(cur.quantityCompleted).toBe(3);
    expect(cur.status).toBe('COMPLETED');
    expect(cur.completedAt).toBeTruthy();
  });

  it('allows cancellation only before staging or execution activity', async () => {
    const clean = await service.publish({ model: 'M', line: 'L', quantityPlanned: 2 });
    const cancelled = await service.transition(clean.id, { status: 'CANCELLED' });
    expect(cancelled.status).toBe('CANCELLED');

    const staged = await service.publish({ model: 'M2', line: 'L', quantityPlanned: 2 });
    await service.setMaterialReady(staged.id, true);
    await expect(service.transition(staged.id, { status: 'CANCELLED' })).rejects.toThrow(
      /material ya montado/,
    );

    const running = await service.publish({ model: 'M3', line: 'L', quantityPlanned: 2 });
    await service.incrementCompleted(running.id, 1);
    await expect(service.transition(running.id, { status: 'CANCELLED' })).rejects.toThrow(
      /ejecucion ya iniciada/,
    );
  });

  it('reports run blockers (material, quality hold, FAI)', async () => {
    const wo = await service.publish({ model: 'M', line: 'L', quantityPlanned: 5, faiRequired: true });
    let b = service.runBlockers(wo);
    expect(b.runnable).toBe(false);
    expect(b.blockers.length).toBe(2); // no material + FAI pending

    await service.setMaterialReady(wo.id, true);
    await service.setFaiApproved(wo.id, true);
    const ready = await service.getOne(wo.id);
    b = service.runBlockers(ready);
    expect(b.runnable).toBe(true);

    // a quality hold blocks again
    await service.setQualityClear(wo.id, false);
    const held = await service.getOne(wo.id);
    expect(service.runBlockers(held).runnable).toBe(false);
  });

  it('authorizes operators (the supervisor "acceso") and gates by membership', async () => {
    const wo = await service.publish({ model: 'M', line: 'L', quantityPlanned: 5 });
    // No explicit list → open to certified operators.
    expect(service.isOperatorAuthorized(wo, 'anyone@x')).toBe(true);
    const auth = await service.authorizeOperators(wo.id, { operators: ['op1@plant.com'] });
    expect(service.isOperatorAuthorized(auth, 'op1@plant.com')).toBe(true);
    expect(service.isOperatorAuthorized(auth, 'intruder@x')).toBe(false);
  });

  it('aggregates plan KPIs (adherence, readiness)', async () => {
    const a = await service.publish({ model: 'M', line: 'L', quantityPlanned: 10 });
    await service.publish({ model: 'N', line: 'L', quantityPlanned: 10 });
    await service.setMaterialReady(a.id, true);
    await service.incrementCompleted(a.id, 5);
    const k = await service.kpis();
    expect(k.total).toBe(2);
    expect(k.unitsPlanned).toBe(20);
    expect(k.unitsCompleted).toBe(5);
    expect(k.planAdherencePct).toBe(0.25);
    expect(k.woWithReadiness).toBe(1);
  });

  it('isolates WOs by tenant', async () => {
    await ctx.run(ctxFor('T_A'), () => service.publish({ model: 'M', line: 'L', quantityPlanned: 1 }));
    await ctx.run(ctxFor('T_B'), () => service.publish({ model: 'M', line: 'L', quantityPlanned: 1 }));
    const aList = await ctx.run(ctxFor('T_A'), () => service.list());
    expect(aList).toHaveLength(1);
    expect(aList[0].tenant_id).toBe('T_A');
  });
});
