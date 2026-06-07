import { DataSource } from 'typeorm';
import { CycleCountsService } from './cycle-counts.service';
import { CycleCount } from './entities/cycle-count.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

describe('CycleCountsService (integration)', () => {
  let dataSource: DataSource;
  let service: CycleCountsService;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [CycleCount, DocumentSequence],
    });
    await dataSource.initialize();

    const ctx = new TenantContextService();
    const numbering = new DocumentNumberingService(
      dataSource.getRepository(DocumentSequence),
      dataSource,
      ctx,
    );
    service = new CycleCountsService(
      dataSource.getRepository(CycleCount),
      ctx,
      numbering,
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('creates an OPEN count with a CC folio', async () => {
    const cc = await service.create({ partNumber: 'P1', systemQty: 100 });
    expect(cc.folio).toMatch(/^CC-\d{6}-0001$/);
    expect(cc.status).toBe('OPEN');
    expect(cc.variance).toBeNull();
  });

  it('records a count and computes variance', async () => {
    const cc = await service.create({ partNumber: 'P1', systemQty: 100 });
    const counted = await service.recordCount(cc.id, { countedQty: 95 });
    expect(counted.status).toBe('COUNTED');
    expect(counted.countedQty).toBe(95);
    expect(counted.variance).toBe(-5);
  });

  it('adjusting a count syncs system qty to the count and zeroes variance', async () => {
    const cc = await service.create({ partNumber: 'P1', systemQty: 100 });
    await service.recordCount(cc.id, { countedQty: 90 });
    const adjusted = await service.transition(cc.id, { status: 'ADJUSTED' });
    expect(adjusted.systemQty).toBe(90);
    expect(adjusted.variance).toBe(0);
  });

  it('rejects counting a non-open count and illegal transitions', async () => {
    const cc = await service.create({ partNumber: 'P1', systemQty: 10 });
    await service.recordCount(cc.id, { countedQty: 10 });
    await expect(service.recordCount(cc.id, { countedQty: 9 })).rejects.toThrow(
      /OPEN/,
    );
    await expect(
      service.transition(cc.id, { status: 'CANCELLED' }),
    ).rejects.toThrow(/Cannot move a cycle count/);
  });

  it('computes inventory accuracy KPI', async () => {
    const a = await service.create({ partNumber: 'A', systemQty: 100 });
    await service.recordCount(a.id, { countedQty: 100 }); // accurate
    const b = await service.create({ partNumber: 'B', systemQty: 50 });
    await service.recordCount(b.id, { countedQty: 47 }); // variance -3
    await service.create({ partNumber: 'C', systemQty: 5 }); // still open

    const kpis = await service.kpis();
    expect(kpis.total).toBe(3);
    expect(kpis.open).toBe(1);
    expect(kpis.inventoryAccuracyPct).toBe(50); // 1 accurate of 2 counted
    expect(kpis.countsWithVariance).toBe(1);
    expect(kpis.totalAbsVariance).toBe(3);
  });
});
