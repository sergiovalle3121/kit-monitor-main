import { DataSource } from 'typeorm';
import { CycleCountsService } from './cycle-counts.service';
import { CycleCount } from './entities/cycle-count.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import type { TenantContext } from '../../common/tenant/tenant-context.service';

function tenantContext(tenant_id: string | null): TenantContext {
  return {
    tenant_id,
    organization_id: tenant_id,
    plant_id: null,
    user_email: 'cycle-counter@example.com',
    role: 'Admin',
    permissions: null,
    scopes: null,
  };
}

describe('CycleCountsService (integration)', () => {
  let dataSource: DataSource;
  let service: CycleCountsService;
  let ctx: TenantContextService;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [CycleCount, DocumentSequence],
    });
    await dataSource.initialize();

    ctx = new TenantContextService();
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

  it('builds an actionable discrepancy monitor from unresolved counted variances', async () => {
    const shortage = await service.create({ partNumber: 'SHORT', systemQty: 100 });
    await service.recordCount(shortage.id, { countedQty: 80 });
    const overage = await service.create({ partNumber: 'OVER', systemQty: 50 });
    await service.recordCount(overage.id, { countedQty: 52 });
    const exact = await service.create({ partNumber: 'EXACT', systemQty: 10 });
    await service.recordCount(exact.id, { countedQty: 10 });
    const adjusted = await service.create({ partNumber: 'ADJ', systemQty: 20 });
    await service.recordCount(adjusted.id, { countedQty: 10 });
    await service.transition(adjusted.id, { status: 'ADJUSTED' });

    const monitor = await service.discrepancyMonitor();

    expect(monitor.summary).toEqual(
      expect.objectContaining({
        total: 2,
        high: 1,
        medium: 0,
        low: 1,
        shortages: 1,
        overages: 1,
        totalAbsVariance: 22,
        netVariance: -18,
      }),
    );
    expect(monitor.items.map((item) => item.partNumber)).toEqual([
      'SHORT',
      'OVER',
    ]);
    expect(monitor.items[0]).toEqual(
      expect.objectContaining({
        direction: 'SHORTAGE',
        severity: 'HIGH',
        recommendedAction: 'INVESTIGATE_SHORTAGE',
      }),
    );
  });

  it('scopes getOne and transitions by tenant context', async () => {
    const countA = await ctx.run(tenantContext('TENANT_A'), () =>
      service.create({ partNumber: 'TENANT-A-PART', systemQty: 10 }),
    );

    await expect(
      ctx.run(tenantContext('TENANT_B'), () => service.getOne(countA.id)),
    ).rejects.toThrow(/Conteo no encontrado/);

    await expect(
      ctx.run(tenantContext('TENANT_B'), () =>
        service.transition(countA.id, { status: 'CANCELLED' }),
      ),
    ).rejects.toThrow(/Conteo no encontrado/);

    const visible = await ctx.run(tenantContext('TENANT_A'), () =>
      service.getOne(countA.id),
    );
    expect(visible.partNumber).toBe('TENANT-A-PART');
  });
});
