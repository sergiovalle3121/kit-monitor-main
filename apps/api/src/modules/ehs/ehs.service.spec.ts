import { DataSource } from 'typeorm';
import { EhsService } from './ehs.service';
import { SafetyIncident } from './entities/safety-incident.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { createTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

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
      createTenantScopedRepository(SafetyIncident, dataSource.manager, ctx),
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

  it('records the CAPA owner and commitment date on update', async () => {
    const inc = await service.create({ title: 'Resguardo dañado', type: 'RECORDABLE' });
    const updated = await service.update(inc.id, {
      rootCause: 'Mantenimiento omitido',
      correctiveAction: 'Reinstalar resguardo y añadir al checklist',
      capaOwner: 'supervisor@planta.com',
      capaDueDate: '2026-07-15',
    });
    expect(updated.capaOwner).toBe('supervisor@planta.com');
    expect(updated.capaDueDate).toBeTruthy();
    expect(new Date(updated.capaDueDate as Date).toISOString()).toContain('2026-07-15');

    // Empty strings clear the CAPA assignment (additive, non-destructive).
    const cleared = await service.update(inc.id, { capaOwner: '', capaDueDate: '' });
    expect(cleared.capaOwner).toBeNull();
    expect(cleared.capaDueDate).toBeNull();
  });

  it('counts open, overdue and due-soon CAPAs in the KPIs', async () => {
    const day = 86_400_000;
    const overdue = await service.create({ title: 'CAPA vencida', type: 'RECORDABLE' });
    await service.update(overdue.id, {
      capaOwner: 'a@planta.com',
      capaDueDate: new Date(Date.now() - 5 * day).toISOString(),
    });
    const soon = await service.create({ title: 'CAPA por vencer', type: 'FIRST_AID' });
    await service.update(soon.id, {
      capaOwner: 'b@planta.com',
      capaDueDate: new Date(Date.now() + 2 * day).toISOString(),
    });
    const future = await service.create({ title: 'CAPA holgada', type: 'NEAR_MISS' });
    await service.update(future.id, {
      capaOwner: 'c@planta.com',
      capaDueDate: new Date(Date.now() + 30 * day).toISOString(),
    });
    // A CAPA on a CLOSED incident must NOT count as open.
    const closed = await service.create({ title: 'CAPA cerrada', type: 'NEAR_MISS' });
    await service.update(closed.id, {
      capaOwner: 'd@planta.com',
      capaDueDate: new Date(Date.now() - 10 * day).toISOString(),
    });
    await service.transition(closed.id, { status: 'CLOSED' });

    const kpis = await service.kpis();
    expect(kpis.capaOpen).toBe(3); // overdue + soon + future, not the closed one
    expect(kpis.capaOverdue).toBe(1);
    expect(kpis.capaDueSoon).toBe(1);
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
