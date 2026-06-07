import { DataSource } from 'typeorm';
import { PeopleService } from './people.service';
import { Certification } from './entities/certification.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

describe('PeopleService (integration)', () => {
  let dataSource: DataSource;
  let service: PeopleService;
  const year = new Date().getFullYear();

  const inDays = (n: number) =>
    new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [Certification, DocumentSequence],
    });
    await dataSource.initialize();

    const ctx = new TenantContextService();
    const numbering = new DocumentNumberingService(
      dataSource.getRepository(DocumentSequence),
      dataSource,
      ctx,
    );
    service = new PeopleService(
      dataSource.getRepository(Certification),
      ctx,
      numbering,
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('creates a certification with a CERT folio and derives VALID status', async () => {
    const c = await service.create({
      employeeName: 'Juan Pérez',
      skill: 'IPC-A-610',
      expiresDate: inDays(365),
    });
    expect(c.folio).toBe(`CERT-${year}-00001`);
    expect(c.status).toBe('VALID');
  });

  it('derives EXPIRING and EXPIRED from the expiry date', async () => {
    const soon = await service.create({ employeeName: 'A', skill: 'ESD', expiresDate: inDays(10) });
    expect(soon.status).toBe('EXPIRING');
    const old = await service.create({ employeeName: 'B', skill: 'ESD', expiresDate: inDays(-5) });
    expect(old.status).toBe('EXPIRED');
  });

  it('computes skills KPIs (valid, expiring buckets, coverage)', async () => {
    await service.create({ employeeName: 'A', skill: 'Soldadura', expiresDate: inDays(10) });
    await service.create({ employeeName: 'B', skill: 'Soldadura', expiresDate: inDays(400) });
    await service.create({ employeeName: 'C', skill: 'AOI', expiresDate: inDays(-1) });

    const kpis = await service.kpis();
    expect(kpis.total).toBe(3);
    expect(kpis.expired).toBe(1);
    expect(kpis.valid).toBe(2); // the two non-expired
    expect(kpis.expiring30).toBe(1); // the +10d one
    expect(kpis.employees).toBe(3);
    expect(kpis.skills).toBe(2);
    expect(kpis.coverage[0]).toEqual({ skill: 'Soldadura', count: 2 });
  });
});
