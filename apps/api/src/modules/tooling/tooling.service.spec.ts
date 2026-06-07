import { DataSource } from 'typeorm';
import { ToolingService } from './tooling.service';
import { Tool } from './entities/tool.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

describe('ToolingService (integration)', () => {
  let dataSource: DataSource;
  let service: ToolingService;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [Tool, DocumentSequence],
    });
    await dataSource.initialize();

    const ctx = new TenantContextService();
    const numbering = new DocumentNumberingService(
      dataSource.getRepository(DocumentSequence),
      dataSource,
      ctx,
    );
    service = new ToolingService(
      dataSource.getRepository(Tool),
      ctx,
      numbering,
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('creates a tool with a TL folio and derived life fields', async () => {
    const t = await service.create({ name: 'Molde A', lifeShots: 100000 });
    expect(t.folio).toMatch(/^TL-\d{5}$/);
    expect(t.status).toBe('AVAILABLE');
    expect(t.lifePercent).toBe(0);
    expect(t.remainingShots).toBe(100000);
  });

  it('accumulates usage and flags near-EOL', async () => {
    const t = await service.create({ name: 'Molde B', lifeShots: 100000 });
    await service.recordUsage(t.id, { shots: 50000 });
    const after = await service.recordUsage(t.id, { shots: 35000 });
    expect(after.shotsUsed).toBe(85000);
    expect(after.lifePercent).toBe(85);
    expect(after.nearEol).toBe(true);
    expect(after.remainingShots).toBe(15000);
  });

  it('changes status', async () => {
    const t = await service.create({ name: 'Molde C', lifeShots: 100 });
    const inUse = await service.setStatus(t.id, { status: 'IN_USE' });
    expect(inUse.status).toBe('IN_USE');
  });

  it('computes tooling KPIs (avg life, near-EOL, maintenance)', async () => {
    const a = await service.create({ name: 'A', lifeShots: 100000 });
    await service.recordUsage(a.id, { shots: 90000 }); // 90% near EOL
    const b = await service.create({ name: 'B', lifeShots: 100000 });
    await service.recordUsage(b.id, { shots: 10000 }); // 10%
    await service.setStatus(b.id, { status: 'MAINTENANCE' });

    const kpis = await service.kpis();
    expect(kpis.total).toBe(2);
    expect(kpis.inMaintenance).toBe(1);
    expect(kpis.nearEol).toBe(1);
    expect(kpis.avgLifeConsumedPct).toBe(50); // (90 + 10) / 2
  });
});
