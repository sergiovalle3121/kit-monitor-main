import { DataSource } from 'typeorm';
import { CrmService } from './crm.service';
import { Opportunity } from './entities/opportunity.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

describe('CrmService (integration)', () => {
  let dataSource: DataSource;
  let service: CrmService;
  const year = new Date().getFullYear();

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [Opportunity, DocumentSequence],
    });
    await dataSource.initialize();

    const ctx = new TenantContextService();
    const numbering = new DocumentNumberingService(
      dataSource.getRepository(DocumentSequence),
      dataSource,
      ctx,
    );
    service = new CrmService(
      dataSource.getRepository(Opportunity),
      ctx,
      numbering,
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('creates an opportunity with an OPP folio at LEAD', async () => {
    const o = await service.create({ title: 'Servers Gen6', estimatedValue: 1000000 });
    expect(o.folio).toBe(`OPP-${year}-00001`);
    expect(o.status).toBe('LEAD');
    expect(o.probability).toBe(10);
  });

  it('advances stages, updating probability and stamping close', async () => {
    const o = await service.create({ title: 'Deal', estimatedValue: 500000 });
    const q = await service.transition(o.id, { status: 'QUALIFIED' });
    expect(q.probability).toBe(30);
    await service.transition(o.id, { status: 'PROPOSAL' });
    const won = await service.transition(o.id, { status: 'WON' });
    expect(won.probability).toBe(100);
    expect(won.closedAt).toBeTruthy();
  });

  it('rejects an illegal transition', async () => {
    const o = await service.create({ title: 'Bad' });
    await expect(service.transition(o.id, { status: 'WON' })).rejects.toThrow(
      /Cannot move an opportunity/,
    );
  });

  it('computes pipeline, weighted value and win-rate', async () => {
    // Open proposal worth 1,000,000 @ 60% → weighted 600,000.
    const a = await service.create({ title: 'A', estimatedValue: 1000000 });
    await service.transition(a.id, { status: 'QUALIFIED' });
    await service.transition(a.id, { status: 'PROPOSAL' });
    // Won 200,000.
    const b = await service.create({ title: 'B', estimatedValue: 200000 });
    await service.transition(b.id, { status: 'QUALIFIED' });
    await service.transition(b.id, { status: 'PROPOSAL' });
    await service.transition(b.id, { status: 'WON' });
    // Lost.
    const c = await service.create({ title: 'C', estimatedValue: 99999 });
    await service.transition(c.id, { status: 'LOST' });

    const kpis = await service.kpis();
    expect(kpis.open).toBe(1); // only A is open
    expect(kpis.pipelineValue).toBe(1000000);
    expect(kpis.weightedValue).toBe(600000);
    expect(kpis.wonValue).toBe(200000);
    expect(kpis.winRatePct).toBe(50); // 1 won of 2 closed
  });
});
