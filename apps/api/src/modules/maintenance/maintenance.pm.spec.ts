import { DataSource } from 'typeorm';
import { MaintenanceService } from './maintenance.service';
import { Asset } from './entities/asset.entity';
import { MaintenanceOrder } from './entities/maintenance-order.entity';
import { MaintenancePmPlan } from './entities/pm-plan.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { pmDueStatus } from './pm-frequency';

describe('MaintenanceService · preventive plans (integration)', () => {
  let dataSource: DataSource;
  let service: MaintenanceService;
  const year = new Date().getFullYear();
  const DAY = 86_400_000;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [Asset, MaintenanceOrder, MaintenancePmPlan, DocumentSequence],
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
      undefined, // ledger
      dataSource.getRepository(MaintenancePmPlan),
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('creates a PM plan and computes its first due date from frequency', async () => {
    const asset = await service.createAsset({ name: 'Horno SMT-1' });
    const plan = await service.createPmPlan({
      title: 'Lubricación de rieles',
      assetId: asset.id,
      frequencyType: 'DAYS',
      frequencyValue: 7,
      lastDoneDate: '2026-06-01',
    });
    expect(plan.assetName).toBe('Horno SMT-1');
    expect(plan.active).toBe(true);
    // 2026-06-01 + 7 días = 2026-06-08
    expect(new Date(plan.nextDueDate as Date).toISOString().slice(0, 10)).toBe(
      '2026-06-08',
    );
  });

  it('generates a PREVENTIVE order from an overdue PM and recomputes next due', async () => {
    const asset = await service.createAsset({ name: 'Compresor 7B' });
    const overdue = new Date(Date.now() - 30 * DAY)
      .toISOString()
      .slice(0, 10);
    const plan = await service.createPmPlan({
      title: 'Cambio de filtros',
      assetId: asset.id,
      frequencyType: 'WEEKS',
      frequencyValue: 2,
      nextDueDate: overdue,
    });
    // El plan está vencido antes de generar.
    expect(pmDueStatus(plan.nextDueDate)).toBe('OVERDUE');

    const { plan: advanced, order } = await service.generatePmOrder(plan.id);

    // La orden es PREVENTIVE, ligada al activo y con folio MO-.
    expect(order.type).toBe('PREVENTIVE');
    expect(order.assetId).toBe(asset.id);
    expect(order.assetName).toBe('Compresor 7B');
    expect(order.folio).toBe(`MO-${year}-000001`);
    expect(order.status).toBe('OPEN');

    // El plan avanzó: última realización = hoy, próxima = hoy + 2 semanas, ya VIGENTE.
    expect(advanced.lastDoneDate).toBeTruthy();
    expect(pmDueStatus(advanced.nextDueDate)).toBe('OK');
    const last = new Date(advanced.lastDoneDate as Date).getTime();
    const next = new Date(advanced.nextDueDate as Date).getTime();
    const days = Math.round((next - last) / DAY);
    expect(days).toBe(14); // 2 semanas
  });

  it('recomputes next due when frequency changes (additive PATCH)', async () => {
    const plan = await service.createPmPlan({
      title: 'Inspección general',
      frequencyType: 'DAYS',
      frequencyValue: 10,
      lastDoneDate: '2026-06-01',
    });
    const updated = await service.updatePmPlan(plan.id, { frequencyValue: 30 });
    // 2026-06-01 + 30 días = 2026-07-01
    expect(new Date(updated.nextDueDate as Date).toISOString().slice(0, 10)).toBe(
      '2026-07-01',
    );
  });

  it('counts overdue PM plans in the KPIs', async () => {
    const asset = await service.createAsset({ name: 'Banda 3' });
    const overdue = new Date(Date.now() - 5 * DAY).toISOString().slice(0, 10);
    await service.createPmPlan({
      title: 'Tensado de banda',
      assetId: asset.id,
      frequencyType: 'DAYS',
      frequencyValue: 30,
      nextDueDate: overdue,
    });
    const kpis = await service.kpis();
    expect(kpis.pmPlansActive).toBe(1);
    expect(kpis.pmOverdue).toBe(1);
    expect(kpis.pmDueSoon).toBe(0);
  });
});
