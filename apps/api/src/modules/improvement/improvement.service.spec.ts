import { DataSource } from 'typeorm';
import { ImprovementService } from './improvement.service';
import { ImprovementInitiative } from './entities/improvement-initiative.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

describe('ImprovementService (integration)', () => {
  let dataSource: DataSource;
  let service: ImprovementService;
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

    const ctx = new TenantContextService();
    const numbering = new DocumentNumberingService(
      dataSource.getRepository(DocumentSequence),
      dataSource,
      ctx,
    );
    service = new ImprovementService(
      dataSource.getRepository(ImprovementInitiative),
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
});
