import { DataSource } from 'typeorm';
import { RmaService } from './rma.service';
import { RmaCase } from './entities/rma-case.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { createTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

describe('RmaService (integration)', () => {
  let dataSource: DataSource;
  let service: RmaService;
  const year = new Date().getFullYear();

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [RmaCase, DocumentSequence],
    });
    await dataSource.initialize();

    const ctx = new TenantContextService();
    const numbering = new DocumentNumberingService(
      dataSource.getRepository(DocumentSequence),
      dataSource,
      ctx,
    );
    service = new RmaService(
      createTenantScopedRepository(RmaCase, dataSource.manager, ctx),
      ctx,
      numbering,
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('opens an RMA with an RMA folio and OPEN status', async () => {
    const r = await service.create({ failureDescription: 'No enciende', customerName: 'Cliente A' });
    expect(r.folio).toBe(`RMA-${year}-00001`);
    expect(r.status).toBe('OPEN');
  });

  it('drives investigation → disposition → closed', async () => {
    const r = await service.create({ failureDescription: 'Pantalla rota' });
    await service.transition(r.id, { status: 'INVESTIGATING', rootCause: 'Empaque' });
    const disp = await service.transition(r.id, { status: 'DISPOSITION', disposition: 'REPLACE' });
    expect(disp.disposition).toBe('REPLACE');
    const closed = await service.transition(r.id, { status: 'CLOSED' });
    expect(closed.closedAt).toBeTruthy();
  });

  it('requires a disposition when moving to DISPOSITION', async () => {
    const r = await service.create({ failureDescription: 'X' });
    await service.transition(r.id, { status: 'INVESTIGATING' });
    await expect(
      service.transition(r.id, { status: 'DISPOSITION' }),
    ).rejects.toThrow(/disposición/);
  });

  it('rejects an illegal transition', async () => {
    const r = await service.create({ failureDescription: 'Y' });
    await expect(
      service.transition(r.id, { status: 'DISPOSITION', disposition: 'REPAIR' }),
    ).rejects.toThrow(/Cannot move an RMA case/);
  });

  it('computes RMA KPIs (open, by disposition)', async () => {
    await service.create({ failureDescription: 'A' }); // open
    const b = await service.create({ failureDescription: 'B' });
    await service.transition(b.id, { status: 'INVESTIGATING' });
    await service.transition(b.id, { status: 'DISPOSITION', disposition: 'CREDIT' });
    await service.transition(b.id, { status: 'CLOSED' });

    const kpis = await service.kpis();
    expect(kpis.total).toBe(2);
    expect(kpis.open).toBe(1);
    expect(kpis.closed).toBe(1);
    expect(kpis.byDisposition.CREDIT).toBe(1);
  });
});
