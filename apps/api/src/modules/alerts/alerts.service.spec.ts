import { ReadinessLight, ReadinessSummary } from '@axos/contracts';
import { AlertsService } from './alerts.service';

/**
 * Unit del motor de alertas con repo de planes, PlansService.computeReadiness y
 * NotificationsService.create simulados (sin DB real). Demuestra el contrato:
 *  - un plan en rojo produce EXACTAMENTE una notificación con el dedupe_key esperado;
 *  - una SEGUNDA corrida el mismo día NO duplica (gracias al dedupe_key);
 *  - un plan en verde NO genera notificación;
 *  - due-date dentro de N días → severidad 'high'; dueño no resoluble → se omite.
 */
describe('AlertsService.scanReadinessAndNotify', () => {
  let planRepo: { find: jest.Mock };
  let plans: { computeReadiness: jest.Mock };
  let users: { findOneByEmail: jest.Mock };
  let notifications: { create: jest.Mock };
  /** Emula el dedupe real (por dedupeKey+userId) de NotificationsService.create. */
  let store: Map<string, any>;
  let service: AlertsService;

  const mkReadiness = (over: {
    materials?: ReadinessLight;
    quality?: ReadinessLight;
    shipping?: ReadinessLight;
    daysToDue?: number | null;
    reasons?: string[];
  }): ReadinessSummary => ({
    materials: over.materials ?? 'green',
    quality: over.quality ?? 'green',
    shipping: over.shipping ?? 'green',
    detail: {
      totalParts: 1,
      shortParts: 0,
      shortages: [],
      heldParts: [],
      dueDate: null,
      daysToDue: over.daysToDue ?? null,
      reasons: over.reasons ?? [],
    },
    timestamp: new Date(),
  });

  const plan = (over: Partial<Record<string, any>> = {}) => ({
    id: 7,
    model: 'M-100',
    workOrder: 'WO-7',
    status: 'published',
    publishedBy: 'ana@axos.test',
    releasedBy: null,
    dueDate: null,
    ...over,
  });

  beforeEach(() => {
    planRepo = { find: jest.fn() };
    plans = { computeReadiness: jest.fn() };
    users = { findOneByEmail: jest.fn().mockResolvedValue({ id: 'user-ana' }) };
    store = new Map();
    notifications = {
      create: jest.fn(async (input: any) => {
        const key = `${input.dedupeKey}::${input.userId}`;
        if (input.dedupeKey && store.has(key)) return store.get(key);
        const saved = { id: `n-${store.size + 1}`, ...input };
        if (input.dedupeKey) store.set(key, saved);
        return saved;
      }),
    };
    service = new AlertsService(
      planRepo as never,
      plans as never,
      notifications as never,
      users as never,
    );
  });

  afterEach(() => jest.useRealTimers());

  it('un plan en rojo genera UNA notificación con el dedupe_key esperado', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-22T10:00:00'));
    planRepo.find.mockResolvedValue([plan()]);
    plans.computeReadiness.mockResolvedValue(
      mkReadiness({
        materials: 'red',
        reasons: ['Faltante total: 2 de 2 materiales sin existencia.'],
      }),
    );

    const res = await service.scanReadinessAndNotify();

    expect(res).toEqual({ scanned: 1, notified: 1 });
    expect(notifications.create).toHaveBeenCalledTimes(1);
    const arg = notifications.create.mock.calls[0][0];
    expect(arg).toMatchObject({
      userId: 'user-ana',
      severity: 'critical',
      domain: 'planning',
      source: 'alerts:readiness',
      href: '/dashboard/production-plan',
      dedupeKey: 'readiness:plan:7:2026-06-22',
    });
    expect(arg.title).toContain('M-100');
    expect(arg.body).toContain('WO-7');
    expect(store.size).toBe(1);
  });

  it('una SEGUNDA corrida el mismo día NO duplica (dedupe_key)', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-22T10:00:00'));
    planRepo.find.mockResolvedValue([plan()]);
    plans.computeReadiness.mockResolvedValue(
      mkReadiness({
        quality: 'red',
        reasons: ['Retención de calidad activa en 1 material(es).'],
      }),
    );

    await service.scanReadinessAndNotify();
    await service.scanReadinessAndNotify();

    // create() se llama en ambas corridas con la MISMA llave, pero el almacén
    // (que emula el dedupe) tiene exactamente una: no se duplica la notificación.
    expect(notifications.create).toHaveBeenCalledTimes(2);
    const keys = notifications.create.mock.calls.map((c) => c[0].dedupeKey);
    expect(keys).toEqual([
      'readiness:plan:7:2026-06-22',
      'readiness:plan:7:2026-06-22',
    ]);
    expect(store.size).toBe(1);
  });

  it('un plan en verde NO genera notificación', async () => {
    planRepo.find.mockResolvedValue([
      plan({ id: 9, model: 'M-OK', workOrder: 'WO-9', status: 'active' }),
    ]);
    plans.computeReadiness.mockResolvedValue(
      mkReadiness({
        materials: 'green',
        quality: 'green',
        shipping: 'green',
        daysToDue: 30,
      }),
    );

    const res = await service.scanReadinessAndNotify();

    expect(res).toEqual({ scanned: 1, notified: 0 });
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('due-date dentro de N días (verde por lo demás) avisa con severidad high', async () => {
    planRepo.find.mockResolvedValue([plan()]);
    plans.computeReadiness.mockResolvedValue(
      mkReadiness({ daysToDue: 2, reasons: [] }),
    );

    const res = await service.scanReadinessAndNotify();

    expect(res).toEqual({ scanned: 1, notified: 1 });
    const arg = notifications.create.mock.calls[0][0];
    expect(arg.severity).toBe('high');
    expect(arg.title).toContain('próximo a vencer');
  });

  it('plan en riesgo pero con dueño no resoluble (no email): escaneado, no notificado', async () => {
    planRepo.find.mockResolvedValue([
      plan({ publishedBy: 'system', releasedBy: null }),
    ]);
    plans.computeReadiness.mockResolvedValue(mkReadiness({ materials: 'red' }));

    const res = await service.scanReadinessAndNotify();

    expect(res).toEqual({ scanned: 1, notified: 0 });
    expect(users.findOneByEmail).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });
});
