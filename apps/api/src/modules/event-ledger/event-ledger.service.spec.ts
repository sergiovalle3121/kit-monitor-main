import { DataSource, Repository } from 'typeorm';
import { EventLedgerService } from './event-ledger.service';
import { LedgerEvent, EventDomain } from './entities/ledger-event.entity';

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
  let repo: Repository<LedgerEvent>;
  let service: EventLedgerService;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [LedgerEvent],
    });
    await dataSource.initialize();
    repo = dataSource.getRepository(LedgerEvent);
    service = new EventLedgerService(repo);
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
    await service.recordEvent({ domain: EventDomain.MATERIALS, action: 'A', referenceType: 'KIT', referenceId: 'K-1' });
    await service.recordEvent({ domain: EventDomain.MATERIALS, action: 'B', referenceType: 'KIT', referenceId: 'K-1' });
    await service.recordEvent({ domain: EventDomain.MATERIALS, action: 'OTHER', referenceType: 'KIT', referenceId: 'K-2' });

    const events = await service.getEventsByReference('KIT', 'K-1');
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.action).sort()).toEqual(['A', 'B']);
    // Orden DESC por timestamp: el más reciente primero.
    const [first, second] = events;
    expect(first.timestamp.getTime()).toBeGreaterThanOrEqual(second.timestamp.getTime());
  });

  it('propaga (rethrow) si la persistencia falla', async () => {
    jest.spyOn(repo, 'save').mockRejectedValueOnce(new Error('db down'));
    await expect(
      service.recordEvent({ domain: EventDomain.SYSTEM, action: 'BOOM' }),
    ).rejects.toThrow('db down');
  });
});
