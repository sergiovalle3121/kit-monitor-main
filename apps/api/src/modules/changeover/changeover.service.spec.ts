import { DataSource } from 'typeorm';
import { ChangeoverService } from './changeover.service';
import { SfChangeover } from './entities/sf-changeover.entity';
import { ProductionPlanService } from '../production-plan/production-plan.service';
import { SfWorkOrder } from '../production-plan/entities/sf-work-order.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { createTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

describe('ChangeoverService (integration)', () => {
  let ds: DataSource;
  let svc: ChangeoverService;
  let plan: ProductionPlanService;
  const year = new Date().getFullYear();

  beforeEach(async () => {
    ds = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [SfChangeover, SfWorkOrder, DocumentSequence],
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
    svc = new ChangeoverService(
      createTenantScopedRepository(SfChangeover, ds.manager, ctx),
      ctx,
      numbering,
      plan,
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it('opens a changeover (CO folio) with a setup checklist, defaulting to OPEN', async () => {
    const co = await svc.open({
      line: 'SMT-1',
      fromModel: 'AX-1000',
      toModel: 'AX-2000',
      targetMinutes: 30,
      checklist: [{ key: 'feeders', label: 'Montar feeders' }],
    });
    expect(co.folio).toBe(`CO-${year}-00001`);
    expect(co.status).toBe('OPEN');
    expect(co.downtimeCategory).toBe('changeover');
    expect(co.checklist?.[0]).toMatchObject({ key: 'feeders', done: false });
    expect(co.startedAt).toBeNull();
  });

  it('enriches the incoming model/folio from the destination WO', async () => {
    const wo = await plan.publish({
      model: 'AX-2000',
      line: 'SMT-1',
      quantityPlanned: 50,
    });
    const co = await svc.open({ line: 'SMT-1', toWoId: wo.id });
    expect(co.toWoFolio).toBe(wo.folio);
    expect(co.toModel).toBe('AX-2000');
  });

  it('runs the stopwatch: start → complete stamps the changeover time as downtime', async () => {
    const co = await svc.open({ line: 'SMT-1', start: true });
    expect(co.status).toBe('IN_PROGRESS');
    expect(co.startedAt).not.toBeNull();

    // Wind the clock back 5 minutes to assert a deterministic duration.
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000);
    await ds
      .getRepository(SfChangeover)
      .update(co.id, { startedAt: fiveMinAgo });

    const done = await svc.complete(co.id);
    expect(done.status).toBe('COMPLETED');
    expect(done.completedAt).not.toBeNull();
    expect(done.durationSec).toBeGreaterThanOrEqual(290);
    expect(done.durationSec).toBeLessThanOrEqual(360);
    expect(done.downtimeReported).toBe(true);
    expect(done.downtimeCategory).toBe('changeover');
  });

  it('blocks complete while checklist items are pending unless forced', async () => {
    const co = await svc.open({
      line: 'SMT-1',
      start: true,
      checklist: [{ key: 'feeders', label: 'Montar feeders' }],
    });
    await expect(svc.complete(co.id)).rejects.toThrow(/Faltan pasos/);

    await svc.toggleChecklist(co.id, {
      key: 'feeders',
      done: true,
      by: 'setup@x',
    });
    const done = await svc.complete(co.id);
    expect(done.status).toBe('COMPLETED');
    expect(done.checklist?.[0].done).toBe(true);
    expect(done.checklist?.[0].doneBy).toBe('setup@x');
  });

  it('force-completes even with pending checklist items', async () => {
    const co = await svc.open({
      line: 'SMT-1',
      start: true,
      checklist: [{ key: 'feeders', label: 'Montar feeders' }],
    });
    const done = await svc.complete(co.id, { force: true });
    expect(done.status).toBe('COMPLETED');
  });

  it('cannot start a completed changeover', async () => {
    const co = await svc.open({ line: 'SMT-1', start: true });
    await svc.complete(co.id, { force: true });
    await expect(svc.start(co.id)).rejects.toThrow(/No se puede mover/);
  });

  it('toggling a checklist item on a closed changeover is rejected', async () => {
    const co = await svc.open({
      line: 'SMT-1',
      start: true,
      checklist: [{ key: 'a', label: 'A' }],
    });
    await svc.complete(co.id, { force: true });
    await expect(
      svc.toggleChecklist(co.id, { key: 'a', done: false }),
    ).rejects.toThrow(/cerrado/i);
  });

  it('aggregates SMED KPIs (avg time, %on-target, downtime)', async () => {
    // One on-target changeover (~5 min vs 30 min target).
    const a = await svc.open({ line: 'SMT-1', start: true, targetMinutes: 30 });
    await ds
      .getRepository(SfChangeover)
      .update(a.id, { startedAt: new Date(Date.now() - 5 * 60_000) });
    await svc.complete(a.id, { force: true });
    // One over-target changeover (~50 min vs 30 min target).
    const b = await svc.open({ line: 'SMT-1', start: true, targetMinutes: 30 });
    await ds
      .getRepository(SfChangeover)
      .update(b.id, { startedAt: new Date(Date.now() - 50 * 60_000) });
    await svc.complete(b.id, { force: true });

    const k = await svc.kpis();
    expect(k.completed).toBe(2);
    expect(k.onTarget).toBe(1);
    expect(k.pctOnTarget).toBe(0.5);
    expect(k.totalDowntimeSec).toBeGreaterThan(0);
  });
});
