import { DataSource } from 'typeorm';
import { EhsService } from './ehs.service';
import { SafetyIncident } from './entities/safety-incident.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

describe('EhsService (integration)', () => {
  let dataSource: DataSource;
  let service: EhsService;
  const year = new Date().getFullYear();

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [SafetyIncident, DocumentSequence],
    });
    await dataSource.initialize();

    const ctx = new TenantContextService();
    const numbering = new DocumentNumberingService(
      dataSource.getRepository(DocumentSequence),
      dataSource,
      ctx,
    );
    service = new EhsService(
      dataSource.getRepository(SafetyIncident),
      ctx,
      numbering,
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('reports an incident with an INC folio and REPORTED status', async () => {
    const inc = await service.create({ title: 'Derrame de aceite' });
    expect(inc.folio).toBe(`INC-${year}-00001`);
    expect(inc.status).toBe('REPORTED');
    expect(inc.type).toBe('NEAR_MISS');
    expect(inc.occurredAt).toBeTruthy();
  });

  it('drives the investigation lifecycle and stamps timestamps', async () => {
    const inc = await service.create({ title: 'Corte en mano', type: 'RECORDABLE' });
    const investigating = await service.transition(inc.id, {
      status: 'INVESTIGATING',
      rootCause: 'Guarda faltante',
    });
    expect(investigating.status).toBe('INVESTIGATING');
    expect(investigating.investigatedAt).toBeTruthy();
    expect(investigating.rootCause).toBe('Guarda faltante');

    await service.transition(inc.id, {
      status: 'ACTION_PENDING',
      correctiveAction: 'Instalar guarda',
    });
    const closed = await service.transition(inc.id, { status: 'CLOSED' });
    expect(closed.status).toBe('CLOSED');
    expect(closed.closedAt).toBeTruthy();
  });

  it('rejects an illegal transition', async () => {
    const inc = await service.create({ title: 'Salto inválido' });
    await expect(
      service.transition(inc.id, { status: 'ACTION_PENDING' }),
    ).rejects.toThrow(/Cannot move a safety incident/);
  });

  it('computes safety KPIs (recordables, lost days, days since last recordable)', async () => {
    await service.create({ title: 'Near miss', type: 'NEAR_MISS' });
    const rec = await service.create({ title: 'Recordable', type: 'RECORDABLE' });
    await service.create({ title: 'Lost time', type: 'LOST_TIME' });

    // Record lost days on the recordable while investigating.
    await service.transition(rec.id, { status: 'INVESTIGATING', lostDays: 3 });

    const kpis = await service.kpis();
    expect(kpis.total).toBe(3);
    expect(kpis.nearMissCount).toBe(1);
    expect(kpis.recordableCount).toBe(2); // RECORDABLE + LOST_TIME
    expect(kpis.lostTimeCount).toBe(1);
    expect(kpis.totalLostDays).toBe(3);
    // occurredAt defaults to now → 0 days since last recordable.
    expect(kpis.daysSinceLastRecordable).toBe(0);
    expect(kpis.open).toBe(3);
  });
});
