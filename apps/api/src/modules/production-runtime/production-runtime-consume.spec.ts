import { ProductionRuntimeService } from './production-runtime.service';
import { ProductionWip } from './entities/production-wip.entity';
import {
  LINE_STOCK_LOCATION,
  lineStockWarehouse,
} from '../inventory/line-stock';

/**
 * Locks the consume side of the inventory loop for /operador (production
 * runtime). The formal CONSUME must drain the SAME line tank that supply
 * (staging / fulfill) fills — `LINE-<línea>` at the shared `LINE_STOCK_LOCATION`
 * — and NOT the old `BAY-<bayId>` location, which fragmented the tank per bay
 * so the decrement never landed on a real position.
 *
 * The transactional `registerBayEvent` is exercised with a stub EntityManager
 * (the duplicate guard, WIP and total query-builders are simulated); the private
 * `findKit` / `ensureMaterialState` / `buildBackendView` helpers are spied so the
 * test focuses on the recordTransaction call shape the consume path emits.
 */
describe('ProductionRuntimeService consume → LINE-<n> tank', () => {
  const LINE = 2;

  function makeService(inventory: { recordTransaction: jest.Mock }) {
    const noop = {} as never;
    const dataSource = {
      transaction: jest.fn(async (cb: (em: unknown) => unknown) => cb(em)),
    };
    const audit = { recordAction: jest.fn(async () => undefined) };

    const states = [
      {
        partNumber: 'PN-100',
        usagePerAssembly: 1,
        availableQty: 50,
        consumedQty: 0,
      },
    ];
    const qb = {
      setLock: () => qb,
      select: () => qb,
      where: () => qb,
      andWhere: () => qb,
      getMany: async () => states,
      getRawOne: async () => ({ total: '5' }),
    };
    const em = {
      findOne: jest.fn(async (entity: unknown) =>
        entity === ProductionWip
          ? { completedQty: 0, status: 'in_production' }
          : null,
      ),
      createQueryBuilder: jest.fn(() => qb),
      count: jest.fn(async () => 1),
      save: jest.fn(async (x: unknown) => x),
      create: jest.fn((_e: unknown, x: unknown) => x),
      update: jest.fn(async () => undefined),
    };

    const service = new ProductionRuntimeService(
      noop, // kitRepo
      noop, // kitMaterialRepo
      noop, // bayLayoutRepo
      noop, // bomRepo
      noop, // eventRepo
      noop, // incidentRepo
      noop, // materialStateRepo
      noop, // wipRepo
      noop, // programRepo
      noop, // lineRepo
      inventory as never,
      dataSource as never,
      audit as never,
      noop, // tenantCtx
    );

    const kit = {
      id: 7,
      plan: {
        line: LINE,
        model: 'MODEL-X',
        workOrder: 'WO-700',
        quantity: 120,
      },
    };
    jest.spyOn(service as never, 'findKit').mockResolvedValue(kit as never);
    jest
      .spyOn(service as never, 'ensureMaterialState')
      .mockResolvedValue(undefined as never);
    jest
      .spyOn(service as never, 'buildBackendView')
      .mockResolvedValue({ bays: [] } as never);

    return { service, states };
  }

  it('emits CONSUME against LINE-<plan.line> at the shared line location (not BAY-<bayId>)', async () => {
    const recordTransaction = jest.fn(async () => undefined);
    const { service, states } = makeService({ recordTransaction });

    await service.registerBayEvent(
      7,
      3, // bayId — deliberately != line, to prove the tank is line-keyed
      { quantity: 4, operator: 'op@axos.test', clientRequestId: 'req-1' },
      { email: 'op@axos.test' } as never,
    );

    expect(recordTransaction).toHaveBeenCalledTimes(1);
    const tx = recordTransaction.mock.calls[0][0];
    expect(tx).toMatchObject({
      type: 'CONSUME',
      partNumber: 'PN-100',
      quantity: 4, // quantity * usagePerAssembly
      fromWarehouseId: lineStockWarehouse(LINE), // 'LINE-2'
      fromLocation: LINE_STOCK_LOCATION, // 'LINE', not 'BAY-3'
      referenceType: 'PRODUCTION_EVENT',
      referenceId: 'req-1',
    });
    expect(tx.fromLocation).not.toMatch(/^BAY-/);
    // The bay is preserved as context in the human-readable reason.
    expect(tx.reason).toContain('BAY-3');
    // Local material state was still decremented.
    expect(states[0].consumedQty).toBe(4);
    expect(states[0].availableQty).toBe(46);
  });

  it('does NOT throw when the formal decrement fails — it is fail-soft but logged', async () => {
    const recordTransaction = jest.fn(async () => {
      throw new Error('Insufficient stock in LINE-2 for PN-100');
    });
    const { service, states } = makeService({ recordTransaction });
    const warn = jest
      .spyOn(
        (service as never as { logger: { warn: jest.Mock } }).logger,
        'warn',
      )
      .mockImplementation(() => undefined);

    await expect(
      service.registerBayEvent(
        7,
        1,
        { quantity: 2, operator: 'op@axos.test', clientRequestId: 'req-2' },
        { email: 'op@axos.test' } as never,
      ),
    ).resolves.toBeDefined();

    // The failure was surfaced (logged), not silently swallowed.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('Insufficient stock');
    // And the production event still completed (local state advanced).
    expect(states[0].consumedQty).toBe(2);
  });

  it('skips the formal decrement (logged) when the plan has no line', async () => {
    const recordTransaction = jest.fn(async () => undefined);
    const noop = {} as never;
    const dataSource = {
      transaction: jest.fn(async (cb: (em: unknown) => unknown) => cb(em)),
    };
    const states = [
      {
        partNumber: 'PN-100',
        usagePerAssembly: 1,
        availableQty: 50,
        consumedQty: 0,
      },
    ];
    const qb = {
      setLock: () => qb,
      select: () => qb,
      where: () => qb,
      andWhere: () => qb,
      getMany: async () => states,
      getRawOne: async () => ({ total: '0' }),
    };
    const em = {
      findOne: jest.fn(async (entity: unknown) =>
        entity === ProductionWip ? { completedQty: 0 } : null,
      ),
      createQueryBuilder: jest.fn(() => qb),
      count: jest.fn(async () => 1),
      save: jest.fn(async (x: unknown) => x),
      create: jest.fn((_e: unknown, x: unknown) => x),
      update: jest.fn(async () => undefined),
    };
    const service = new ProductionRuntimeService(
      noop,
      noop,
      noop,
      noop,
      noop,
      noop,
      noop,
      noop,
      noop,
      noop,
      { recordTransaction } as never,
      dataSource as never,
      { recordAction: jest.fn(async () => undefined) } as never,
      noop,
    );
    jest.spyOn(service as never, 'findKit').mockResolvedValue({
      id: 7,
      plan: { line: null, model: 'MODEL-X', workOrder: 'WO-700', quantity: 1 },
    } as never);
    jest
      .spyOn(service as never, 'ensureMaterialState')
      .mockResolvedValue(undefined as never);
    jest
      .spyOn(service as never, 'buildBackendView')
      .mockResolvedValue({ bays: [] } as never);
    const warn = jest
      .spyOn(
        (service as never as { logger: { warn: jest.Mock } }).logger,
        'warn',
      )
      .mockImplementation(() => undefined);

    await service.registerBayEvent(
      7,
      1,
      { quantity: 1, operator: 'op@axos.test', clientRequestId: 'req-3' },
      { email: 'op@axos.test' } as never,
    );

    // No formal decrement attempted (no line tank to target), but it is logged.
    expect(recordTransaction).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('sin línea');
    // Local state still advanced.
    expect(states[0].consumedQty).toBe(1);
  });
});
