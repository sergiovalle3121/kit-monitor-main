import { DataSource } from 'typeorm';
import { EventLedgerService } from './event-ledger.service';
import { LedgerEvent, EventDomain } from './entities/ledger-event.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  TenantScopedRepository,
  createTenantScopedRepository,
} from '../../common/tenant/tenant-scoped.repository';

/**
 * Integración ligera (SQLite en memoria) del Event Ledger. El repo es real; se
 * verifica el alta de eventos (con defaults de los blobs JSON), la consulta por
 * referencia (filtro + orden DESC) y el rethrow ante un fallo de persistencia.
 *
 * `getEventsByWorkOrder` usa el operador JSON `->>` de Postgres y se cubre en el
 * spec del controller (delegación con servicio simulado).
 */
describe('EventLedgerService (integration)', () => {
  let dataSource: DataSource;
  let repo: TenantScopedRepository<LedgerEvent>;
  let service: EventLedgerService;
  let activeTenant: string | null;

  const tenantCtx = {
    getTenantId: () => activeTenant,
  } as unknown as TenantContextService;

  async function seedEvent(
    partial: Partial<LedgerEvent>,
  ): Promise<LedgerEvent> {
    const rawRepo = dataSource.getRepository(LedgerEvent);
    const event = rawRepo.create({
      tenantId: partial.tenantId ?? null,
      domain: partial.domain ?? EventDomain.PRODUCTION,
      action: partial.action ?? 'EVENT',
      actorId: partial.actorId,
      actorName: partial.actorName,
      referenceType: partial.referenceType,
      referenceId: partial.referenceId,
      workOrder: partial.workOrder,
      context: partial.context ?? {},
      transaction: partial.transaction ?? {},
      metadata: partial.metadata ?? {},
    });
    const saved = await rawRepo.save(event);
    if (partial.timestamp) {
      await rawRepo.update(saved.id, { timestamp: partial.timestamp });
    }
    return rawRepo.findOneByOrFail({ id: saved.id });
  }

  beforeEach(async () => {
    activeTenant = null;
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [LedgerEvent],
    });
    await dataSource.initialize();
    repo = createTenantScopedRepository(
      LedgerEvent,
      dataSource.manager,
      tenantCtx,
    );
    service = new EventLedgerService(repo, tenantCtx);
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('registra un evento y rellena context/transaction/metadata vacíos por defecto', async () => {
    const saved = await service.recordEvent({
      domain: EventDomain.MATERIALS,
      action: 'KIT_CREATED',
      referenceType: 'KIT',
      referenceId: 'K-1',
      actorName: 'op1',
    });

    expect(saved.id).toBeTruthy();
    expect(saved.domain).toBe(EventDomain.MATERIALS);
    expect(saved.action).toBe('KIT_CREATED');
    expect(saved.context).toEqual({});
    expect(saved.transaction).toEqual({});
    expect(saved.metadata).toEqual({});
  });

  it('persiste los blobs JSON cuando se proporcionan', async () => {
    const saved = await service.recordEvent({
      domain: EventDomain.QUALITY,
      action: 'HOLD_APPLIED',
      context: { lot: 'L1' },
      transaction: { quantity: 5 },
      metadata: { reasonCode: 'NCR' },
    });
    const found = await repo.findOne({ where: { id: saved.id } });
    expect(found?.context).toEqual({ lot: 'L1' });
    expect(found?.transaction).toEqual({ quantity: 5 });
    expect(found?.metadata).toEqual({ reasonCode: 'NCR' });
  });

  it('getEventsByReference filtra por tipo+id y ordena por timestamp DESC', async () => {
    await service.recordEvent({
      domain: EventDomain.MATERIALS,
      action: 'A',
      referenceType: 'KIT',
      referenceId: 'K-1',
    });
    await service.recordEvent({
      domain: EventDomain.MATERIALS,
      action: 'B',
      referenceType: 'KIT',
      referenceId: 'K-1',
    });
    await service.recordEvent({
      domain: EventDomain.MATERIALS,
      action: 'OTHER',
      referenceType: 'KIT',
      referenceId: 'K-2',
    });

    const events = await service.getEventsByReference('KIT', 'K-1');
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.action).sort()).toEqual(['A', 'B']);
    // Orden DESC por timestamp: el más reciente primero.
    const [first, second] = events;
    expect(first.timestamp.getTime()).toBeGreaterThanOrEqual(
      second.timestamp.getTime(),
    );
  });

  it('queryEvents composes filters, paginates, and isolates by tenant', async () => {
    await seedEvent({
      tenantId: 'TENANT_A',
      domain: EventDomain.PRODUCTION,
      action: 'UNIT_STOPPED',
      actorId: 'op-1',
      actorName: 'Operator One',
      referenceType: 'WORK_ORDER',
      referenceId: 'WO-1',
      workOrder: 'WO-1',
      timestamp: new Date('2026-06-02T12:00:00.000Z'),
    });
    await seedEvent({
      tenantId: 'TENANT_A',
      domain: EventDomain.PRODUCTION,
      action: 'UNIT_STARTED',
      actorId: 'op-1',
      actorName: 'Operator One',
      referenceType: 'WORK_ORDER',
      referenceId: 'WO-1',
      workOrder: 'WO-1',
      timestamp: new Date('2026-06-01T12:00:00.000Z'),
    });
    await seedEvent({
      tenantId: 'TENANT_B',
      domain: EventDomain.PRODUCTION,
      action: 'UNIT_STOPPED',
      actorId: 'op-1',
      actorName: 'Operator One',
      referenceType: 'WORK_ORDER',
      referenceId: 'WO-1',
      workOrder: 'WO-1',
      timestamp: new Date('2026-06-02T13:00:00.000Z'),
    });
    await seedEvent({
      tenantId: 'TENANT_A',
      domain: EventDomain.QUALITY,
      action: 'HOLD_CREATED',
      actorId: 'op-1',
      referenceType: 'WORK_ORDER',
      referenceId: 'WO-1',
      timestamp: new Date('2026-06-02T14:00:00.000Z'),
    });

    activeTenant = 'TENANT_A';

    const result = await service.queryEvents({
      actor: 'Operator',
      domain: 'production',
      referenceType: 'work_order',
      referenceId: 'WO-1',
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-03T00:00:00.000Z',
      page: '1',
      pageSize: '1',
    });

    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 1,
      total: 2,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].tenantId).toBe('TENANT_A');
    expect(result.items[0].action).toBe('UNIT_STOPPED');
  });

  it('queryEvents rejects invalid domains and date ranges', async () => {
    await expect(service.queryEvents({ domain: 'FINANCE' })).rejects.toThrow(
      'Unsupported ledger domain',
    );
    await expect(
      service.queryEvents({
        from: '2026-06-03T00:00:00.000Z',
        to: '2026-06-01T00:00:00.000Z',
      }),
    ).rejects.toThrow('from must be earlier than or equal to to');
  });

  it('propaga (rethrow) si la persistencia falla', async () => {
    jest.spyOn(repo, 'save').mockRejectedValueOnce(new Error('db down'));
    await expect(
      service.recordEvent({ domain: EventDomain.SYSTEM, action: 'BOOM' }),
    ).rejects.toThrow('db down');
  });
});
