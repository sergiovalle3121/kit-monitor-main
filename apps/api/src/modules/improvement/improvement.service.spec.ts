import { DataSource } from 'typeorm';
import { ImprovementService } from './improvement.service';
import { ImprovementInitiative } from './entities/improvement-initiative.entity';
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
    user_email: 'u@test',
    role: null,
    permissions: null,
    scopes: null,
  };
}

describe('ImprovementService (integration)', () => {
  let dataSource: DataSource;
  let service: ImprovementService;
  let ctx: TenantContextService;
  const year = new Date().getFullYear();

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [ImprovementInitiative, DocumentSequence],
    });
    await dataSource.initialize();

    ctx = new TenantContextService();
    const numbering = new DocumentNumberingService(
      dataSource.getRepository(DocumentSequence),
      dataSource,
      ctx,
    );
    service = new ImprovementService(
      createTenantScopedRepository(ImprovementInitiative, dataSource.manager, ctx),
      ctx,
      numbering,
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('creates an initiative with a CI folio and DRAFT status', async () => {
    const ini = await service.create({
      title: 'Reducir scrap SMT',
      estimatedSavings: 25000,
    });
    expect(ini.folio).toBe(`CI-${year}-00001`);
    expect(ini.status).toBe('DRAFT');
    expect(ini.methodology).toBe('KAIZEN');
    expect(ini.estimatedSavings).toBe(25000);
  });

  it('drives the full lifecycle and stamps timestamps', async () => {
    const ini = await service.create({ title: 'Lean cell layout' });
    const a = await service.transition(ini.id, { status: 'IN_PROGRESS' });
    expect(a.status).toBe('IN_PROGRESS');
    expect(a.startedAt).toBeTruthy();

    await service.transition(ini.id, { status: 'IMPLEMENTED' });
    const v = await service.transition(ini.id, {
      status: 'VERIFIED',
      actualSavings: 18000,
    });
    expect(v.status).toBe('VERIFIED');
    expect(v.actualSavings).toBe(18000);
    expect(v.verifiedAt).toBeTruthy();

    const c = await service.transition(ini.id, { status: 'CLOSED' });
    expect(c.status).toBe('CLOSED');
    expect(c.closedAt).toBeTruthy();
  });

  it('rejects an illegal transition', async () => {
    const ini = await service.create({ title: 'Bad jump' });
    await expect(
      service.transition(ini.id, { status: 'CLOSED' }),
    ).rejects.toThrow(/Cannot move an improvement initiative/);
  });

  it('aggregates KPIs (estimated vs realized savings)', async () => {
    const a = await service.create({ title: 'A', estimatedSavings: 10000 });
    const b = await service.create({ title: 'B', estimatedSavings: 5000 });
    await service.create({ title: 'C', estimatedSavings: 99999 });

    // Drive A to VERIFIED with realized savings; cancel C.
    await service.transition(a.id, { status: 'IN_PROGRESS' });
    await service.transition(a.id, { status: 'IMPLEMENTED' });
    await service.transition(a.id, { status: 'VERIFIED', actualSavings: 8000 });
    await service.transition(b.id, { status: 'CANCELLED' });

    // Wait — B was DRAFT, so DRAFT→CANCELLED is allowed.
    const kpis = await service.kpis();
    expect(kpis.total).toBe(3);
    expect(kpis.byStatus.VERIFIED).toBe(1);
    expect(kpis.byStatus.CANCELLED).toBe(1);
    expect(kpis.realizedSavings).toBe(8000);
    // Estimated excludes the cancelled one (B, 5000): 10000 + 99999.
    expect(kpis.estimatedSavings).toBe(109999);
  });

  // P2 anti-leak: two tenants, same service, zero cross-tenant data.
  it('isolates data by tenant (no cross-tenant reads)', async () => {
    const a = await ctx.run(ctxFor('TENANT_A'), () =>
      service.create({ title: 'A-only' }),
    );
    await ctx.run(ctxFor('TENANT_B'), () => service.create({ title: 'B-only' }));

    // list() (QueryBuilder + scope) only returns the active tenant.
    const aList = await ctx.run(ctxFor('TENANT_A'), () => service.list());
    expect(aList.map((i) => i.title)).toEqual(['A-only']);
    const bList = await ctx.run(ctxFor('TENANT_B'), () => service.list());
    expect(bList.map((i) => i.title)).toEqual(['B-only']);

    // getOne() (scoped findOne) cannot reach another tenant's row.
    await expect(
      ctx.run(ctxFor('TENANT_B'), () => service.getOne(a.id)),
    ).rejects.toThrow(/no encontrada/);

    // ...and update/transition inherit the isolation (they call getOne).
    await expect(
      ctx.run(ctxFor('TENANT_B'), () =>
        service.transition(a.id, { status: 'IN_PROGRESS' }),
      ),
    ).rejects.toThrow(/no encontrada/);

    // The owning tenant can read its own.
    const got = await ctx.run(ctxFor('TENANT_A'), () => service.getOne(a.id));
    expect(got.title).toBe('A-only');
  });
});
