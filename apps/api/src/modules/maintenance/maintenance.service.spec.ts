import { DataSource } from 'typeorm';
import { MaintenanceService } from './maintenance.service';
import { Asset } from './entities/asset.entity';
import { MaintenanceOrder } from './entities/maintenance-order.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

describe('MaintenanceService (integration)', () => {
  let dataSource: DataSource;
  let service: MaintenanceService;
  const year = new Date().getFullYear();

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [Asset, MaintenanceOrder, DocumentSequence],
    });
    await dataSource.initialize();

    const ctx = new TenantContextService();
    const numbering = new DocumentNumberingService(
      dataSource.getRepository(DocumentSequence),
      dataSource,
      ctx,
    );
    service = new MaintenanceService(
      dataSource.getRepository(Asset),
      dataSource.getRepository(MaintenanceOrder),
      ctx,
      numbering,
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('creates an order with an MO folio and denormalizes the asset name', async () => {
    const asset = await service.createAsset({ name: 'Horno SMT-1' });
    const order = await service.createOrder({
      title: 'Cambiar termopar',
      assetId: asset.id,
      type: 'PREVENTIVE',
    });
    expect(order.folio).toBe(`MO-${year}-000001`);
    expect(order.status).toBe('OPEN');
    expect(order.assetName).toBe('Horno SMT-1');
  });

  it('drives the order lifecycle and records downtime', async () => {
    const order = await service.createOrder({ title: 'Reparar banda' });
    await service.transitionOrder(order.id, { status: 'IN_PROGRESS' });
    const done = await service.transitionOrder(order.id, {
      status: 'COMPLETED',
      downtimeMinutes: 45,
    });
    expect(done.status).toBe('COMPLETED');
    expect(done.startedAt).toBeTruthy();
    expect(done.completedAt).toBeTruthy();
    expect(done.downtimeMinutes).toBe(45);
  });

  it('rejects an illegal transition', async () => {
    const order = await service.createOrder({ title: 'Salto inválido' });
    await expect(
      service.transitionOrder(order.id, { status: 'COMPLETED' }),
    ).rejects.toThrow(/Cannot move a maintenance order/);
  });

  it('computes CMMS KPIs (PM compliance, downtime, overdue)', async () => {
    // One preventive completed, one corrective open and overdue.
    const pm = await service.createOrder({ title: 'PM mensual', type: 'PREVENTIVE' });
    await service.transitionOrder(pm.id, { status: 'IN_PROGRESS' });
    await service.transitionOrder(pm.id, { status: 'COMPLETED', downtimeMinutes: 30 });

    await service.createOrder({
      title: 'Falla urgente',
      type: 'CORRECTIVE',
      dueDate: '2020-01-01', // in the past → overdue
    });

    const kpis = await service.kpis();
    expect(kpis.ordersCompleted).toBe(1);
    expect(kpis.ordersOpen).toBe(1);
    expect(kpis.ordersOverdue).toBe(1);
    expect(kpis.pmCompliance).toBe(100); // 1/1 preventive completed
    expect(kpis.totalDowntimeMinutes).toBe(30);
    expect(kpis.mttrHours).not.toBeNull();
  });
});
