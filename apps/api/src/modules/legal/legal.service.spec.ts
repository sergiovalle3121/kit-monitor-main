import { DataSource } from 'typeorm';
import { LegalService } from './legal.service';
import { Contract } from './entities/contract.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { createTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

describe('LegalService (integration)', () => {
  let dataSource: DataSource;
  let service: LegalService;
  const year = new Date().getFullYear();

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [Contract, DocumentSequence],
    });
    await dataSource.initialize();

    const ctx = new TenantContextService();
    const numbering = new DocumentNumberingService(
      dataSource.getRepository(DocumentSequence),
      dataSource,
      ctx,
    );
    service = new LegalService(
      createTenantScopedRepository(Contract, dataSource.manager, ctx),
      ctx,
      numbering,
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('creates a contract with a CON folio and DRAFT status', async () => {
    const c = await service.create({ title: 'Acuerdo cliente A', value: 1000000 });
    expect(c.folio).toBe(`CON-${year}-00001`);
    expect(c.status).toBe('DRAFT');
    expect(c.value).toBe(1000000);
  });

  it('activates, expires and renews via the state machine', async () => {
    const c = await service.create({ title: 'Suministro' });
    const active = await service.transition(c.id, { status: 'ACTIVE' });
    expect(active.status).toBe('ACTIVE');
    await service.transition(c.id, { status: 'EXPIRED' });
    const renewed = await service.transition(c.id, {
      status: 'ACTIVE',
      endDate: '2027-12-31',
    });
    expect(renewed.status).toBe('ACTIVE');
    expect(renewed.endDate).toBeTruthy();
  });

  it('rejects an illegal transition', async () => {
    const c = await service.create({ title: 'Salto inválido' });
    await expect(
      service.transition(c.id, { status: 'EXPIRED' }),
    ).rejects.toThrow(/Cannot move a contract/);
  });

  it('computes expiry KPIs (active value + expiring buckets)', async () => {
    const soon = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
    const a = await service.create({ title: 'Vence pronto', value: 500000, endDate: soon });
    await service.transition(a.id, { status: 'ACTIVE' });

    const b = await service.create({ title: 'Borrador', value: 999 });
    void b; // stays DRAFT, excluded from active value

    const kpis = await service.kpis();
    expect(kpis.total).toBe(2);
    expect(kpis.active).toBe(1);
    expect(kpis.activeValue).toBe(500000);
    expect(kpis.expiring30).toBe(1);
  });
});
