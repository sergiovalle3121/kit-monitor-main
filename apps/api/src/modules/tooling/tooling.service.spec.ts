import { DataSource } from 'typeorm';
import { ToolingService } from './tooling.service';
import { Tool } from './entities/tool.entity';
import { ToolCheckout } from './entities/tool-checkout.entity';
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
      entities: [Tool, ToolCheckout, DocumentSequence],
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
      dataSource.getRepository(ToolCheckout),
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

  // ── Check-out / check-in a una WO ──────────────────────────────────────────

  it('checks a tool out to a WO, marks it IN_USE and blocks a second checkout', async () => {
    const t = await service.create({ name: 'Molde D', lifeShots: 100000 });
    const out = await service.checkout(t.id, {
      workOrderFolio: 'WO-001',
      by: 'crib@axos.test',
    });
    expect(out.status).toBe('IN_USE');
    expect(out.activeCheckout?.workOrderFolio).toBe('WO-001');
    expect(out.activeCheckout?.checkedOutBy).toBe('crib@axos.test');

    // Un tool prestado NO puede volver a prestarse.
    await expect(
      service.checkout(t.id, { workOrderFolio: 'WO-002' }),
    ).rejects.toThrow(/prestado/i);
  });

  it('checks a tool in: back to AVAILABLE and adds shots via the usage logic', async () => {
    const t = await service.create({ name: 'Molde E', lifeShots: 100000 });
    await service.checkout(t.id, { workOrderFolio: 'WO-010' });

    const back = await service.checkin(t.id, { shots: 30000, by: 'crib@axos.test' });
    expect(back.status).toBe('AVAILABLE');
    expect(back.shotsUsed).toBe(30000); // sumado vía recordUsage (no duplicado)
    expect(back.lifePercent).toBe(30);
    expect(back.activeCheckout).toBeNull();

    const history = await service.listCheckouts(t.id);
    expect(history).toHaveLength(1);
    expect(history[0].checkedInAt).toBeTruthy();
    expect(history[0].shotsAtCheckout).toBe(0);
    expect(history[0].shotsAtCheckin).toBe(30000);
    expect(history[0].shotsDuring).toBe(30000);
  });

  it('refuses checkout when the tool is not AVAILABLE', async () => {
    const t = await service.create({ name: 'Molde F', lifeShots: 100 });
    await service.setStatus(t.id, { status: 'MAINTENANCE' });
    await expect(
      service.checkout(t.id, { workOrderFolio: 'WO-1' }),
    ).rejects.toThrow(/mantenimiento/i);
  });

  it('refuses check-in when there is no open loan', async () => {
    const t = await service.create({ name: 'Molde G', lifeShots: 100 });
    await expect(service.checkin(t.id, {})).rejects.toThrow(/préstamo/i);
  });

  // ── Calibración (IATF) ─────────────────────────────────────────────────────

  it('records calibration, derives the next date from the interval and reports status', async () => {
    const t = await service.create({ name: 'Galga A', lifeShots: 0, type: 'GAUGE' });
    const calibratedAt = new Date();
    const cal = await service.recordCalibration(t.id, {
      calibratedAt: calibratedAt.toISOString(),
      intervalDays: 365,
    });
    expect(cal.lastCalibrationDate).toBeTruthy();
    expect(cal.nextCalibrationDate).toBeTruthy();
    expect(cal.calibrationStatus).toBe('VALID'); // ~1 año por delante
    expect(cal.daysToCalibration).toBeGreaterThan(300);
  });

  it('flags overdue calibration in the KPIs', async () => {
    const t = await service.create({ name: 'Galga B', lifeShots: 0, type: 'GAUGE' });
    await service.recordCalibration(t.id, {
      calibratedAt: '2020-01-01T00:00:00.000Z',
      nextDate: '2021-01-01T00:00:00.000Z',
    });
    const one = await service.getOne(t.id);
    expect(one.calibrationStatus).toBe('OVERDUE');

    const kpis = await service.kpis();
    expect(kpis.calibrationOverdue).toBe(1);
  });
});
