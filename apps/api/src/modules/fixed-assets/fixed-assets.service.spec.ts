import { DataSource } from 'typeorm';
import { FixedAssetsService } from './fixed-assets.service';
import { FixedAsset } from './entities/fixed-asset.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

describe('FixedAssetsService (integration)', () => {
  let dataSource: DataSource;
  let service: FixedAssetsService;

  const monthsAgo = (n: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() - n);
    return d.toISOString().slice(0, 10);
  };

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [FixedAsset, DocumentSequence],
    });
    await dataSource.initialize();

    const ctx = new TenantContextService();
    const numbering = new DocumentNumberingService(
      dataSource.getRepository(DocumentSequence),
      dataSource,
      ctx,
    );
    service = new FixedAssetsService(
      dataSource.getRepository(FixedAsset),
      ctx,
      numbering,
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('capitalizes an asset with an FA folio and derives depreciation', async () => {
    const a = await service.create({
      name: 'Línea SMT',
      acquisitionCost: 12000,
      usefulLifeMonths: 12,
      acquisitionDate: monthsAgo(3),
    });
    expect(a.folio).toMatch(/^FA-\d{5}$/);
    expect(a.status).toBe('IN_SERVICE');
    expect(a.monthlyDepreciation).toBe(1000);
    expect(a.accumulatedDepreciation).toBe(3000); // 3 months
    expect(a.bookValue).toBe(9000);
  });

  it('disposing zeroes book value and blocks re-dispose', async () => {
    const a = await service.create({ name: 'X', acquisitionCost: 1000, usefulLifeMonths: 10 });
    const disposed = await service.dispose(a.id, {});
    expect(disposed.status).toBe('DISPOSED');
    expect(disposed.bookValue).toBe(0);
    await expect(service.dispose(a.id, {})).rejects.toThrow(/ya está dado de baja/);
  });

  it('computes portfolio KPIs over in-service assets', async () => {
    await service.create({ name: 'A', acquisitionCost: 12000, usefulLifeMonths: 12, acquisitionDate: monthsAgo(6) });
    await service.create({ name: 'B', acquisitionCost: 6000, usefulLifeMonths: 12, acquisitionDate: monthsAgo(0) });

    const kpis = await service.kpis();
    expect(kpis.inService).toBe(2);
    expect(kpis.totalCost).toBe(18000);
    // A: acc 6000 → book 6000; B: acc 0 → book 6000. Total book 12000.
    expect(kpis.totalBookValue).toBe(12000);
    expect(kpis.totalAccumulatedDepreciation).toBe(6000);
  });
});
