import { InventoryService } from './inventory.service';
import { LINE_STOCK_LOCATION, lineStockWarehouse } from './line-stock';
import { MaterialRequestsService } from '../material-requests/material-requests.service';

/**
 * End-to-end proof that the material loop CLOSES *and conserves*:
 *
 *   surtir N (TRANSFER de un almacén real)  →  origen baja N, LINE-<n> sube N
 *   →  consumir M (/operador)               →  LINE-<n> baja M
 *   → existencias en línea = N − M, y el ON-HAND GLOBAL se conserva en todo momento
 *
 * Uses a REAL `InventoryService` over a stateful in-memory position store, so the
 * same `InventoryPosition` rows are debited on the source and credited on the line
 * tank through the real `recordTransaction` math. The supply side is driven through
 * the REAL `MaterialRequestsService.fulfill` (now a conserving `transferToLine`),
 * the consume side through the same `recordTransaction({ type: 'CONSUME',
 * fromWarehouseId: LINE-<n>, ... })` call `mes-execution` makes at /operador. Both
 * sides agree on the position key via `lineStockWarehouse` + `LINE_STOCK_LOCATION`.
 */

interface Position {
  partNumber: string;
  warehouseId: string;
  location: string;
  onHand: number;
  holdStatus: string;
}

function makeStatefulInventory() {
  const positions = new Map<string, Position>();
  const keyOf = (part: string, wh: string, loc: string) =>
    `${part}|${wh}|${loc}`;

  const qrManager = {
    findOne: jest.fn(
      async (_entity: unknown, opts: { where: Record<string, unknown> }) => {
        const w = opts.where;
        return (
          positions.get(
            keyOf(
              String(w.partNumber),
              String(w.warehouseId),
              String(w.location ?? 'BULK'),
            ),
          ) ?? null
        );
      },
    ),
    create: jest.fn((_entity: unknown, x: Record<string, unknown>) => ({
      ...x,
    })),
    save: jest.fn(async (obj: Record<string, unknown>) => {
      // Positions carry warehouseId + onHand; movements do not — only persist positions.
      if (obj && 'warehouseId' in obj && 'onHand' in obj) {
        const p = obj as unknown as Position;
        positions.set(keyOf(p.partNumber, p.warehouseId, p.location), p);
      }
      return { id: 1, ...obj };
    }),
  };

  const queryRunner = {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager: qrManager,
  };
  const dataSource = { createQueryRunner: jest.fn(() => queryRunner) };
  const materialRepo = {
    findOne: jest.fn(async () => ({ partNumber: 'PN-100' })),
    create: jest.fn(),
    save: jest.fn(),
  };
  const audit = {
    recordAction: jest.fn().mockResolvedValue(undefined),
    recordException: jest.fn().mockResolvedValue(undefined),
  };

  // Tenant-scoped position repo used by `transferToLine` to find real source
  // stock — reads from the same in-memory store the movements mutate.
  const positionRepo = {
    find: jest.fn(async (opts?: { where?: Record<string, unknown> }) => {
      const where = opts?.where ?? {};
      const part = where.partNumber;
      const hold = where.holdStatus;
      return [...positions.values()].filter(
        (p) =>
          (part == null || p.partNumber === part) &&
          (hold == null || p.holdStatus === hold),
      );
    }),
  };

  const inventory = new InventoryService(
    positionRepo as never,
    {} as never, // movementRepo
    materialRepo as never,
    {} as never, // warehouseRepo
    audit as never,
    dataSource as never,
    { getTenantId: () => null } as never, // tenantCtx
  );

  const seed = (
    warehouseId: string,
    onHand: number,
    location = 'BULK',
    partNumber = 'PN-100',
    holdStatus = 'available',
  ) => {
    positions.set(keyOf(partNumber, warehouseId, location), {
      partNumber,
      warehouseId,
      location,
      onHand,
      holdStatus,
    });
  };
  const at = (wh: string, loc: string = LINE_STOCK_LOCATION) =>
    positions.get(keyOf('PN-100', wh, loc))?.onHand;
  const totalOnHand = (partNumber = 'PN-100') =>
    [...positions.values()]
      .filter((p) => p.partNumber === partNumber)
      .reduce((sum, p) => sum + p.onHand, 0);
  return { inventory, positions, seed, at, totalOnHand };
}

/** A MaterialRequestsService wired to the REAL stateful inventory above. */
function makeSupplyService(inventory: InventoryService, line: number | null) {
  const request = {
    id: 5,
    kitId: 7,
    status: 'authorized',
    partNumber: 'PN-100',
    requestedQty: 50,
    line: 'L2',
    workOrder: 'WO-700',
  };
  const repo = {
    findOne: jest.fn(async () => request),
    save: jest.fn(async (v: Record<string, unknown>) => ({ id: 5, ...v })),
  };
  const kitRepo = {
    findOne: jest.fn(async () => ({
      id: 7,
      plan: { status: 'published', workOrder: 'WO-700', line },
    })),
  };
  const signals = { emitToTenant: jest.fn() };
  const eventLedger = { recordEvent: jest.fn(async () => undefined) };

  const service = new MaterialRequestsService(
    repo as never,
    kitRepo as never,
    signals as never,
    eventLedger as never,
    inventory,
  );
  return { service, repo };
}

describe('Supply → consume inventory loop (LINE-<n> tank, conserving)', () => {
  it('fulfill TRANSFERS N from a real source into LINE-<n>; consume removes M; global on-hand conserved', async () => {
    const { inventory, at, seed, totalOnHand } = makeStatefulInventory();
    const N = 50;
    const M = 30;
    const wh = lineStockWarehouse(2)!; // 'LINE-2' — the PLAN line

    // Real source stock the supply will draw from (so nothing is created).
    seed('WH-RM', N);
    expect(totalOnHand()).toBe(N);

    // 1) SURTIR — fulfill the material request through the real service.
    const { service, repo } = makeSupplyService(inventory, 2);
    await service.fulfill(5, {}, 'warehouse@axos.test');

    // Conserved: LINE-2 holds N, the source is drained to 0, global is unchanged.
    expect(at(wh)).toBe(N);
    expect(at('WH-RM', 'BULK')).toBe(0);
    expect(totalOnHand()).toBe(N);
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'fulfilled' }),
    );

    // 2) CONSUMIR — same call mes-execution makes at /operador: CONSUME from the
    //    line tank at the shared line-level location.
    await inventory.recordTransaction({
      type: 'CONSUME',
      partNumber: 'PN-100',
      quantity: M,
      fromWarehouseId: wh,
      fromLocation: LINE_STOCK_LOCATION,
      actorName: 'operator@axos.test',
      referenceType: 'MES_EXECUTION_EVENT',
    });

    // 3) The loop closes: line balance = N − M, global on-hand also N − M.
    expect(at(wh)).toBe(N - M);
    expect(totalOnHand()).toBe(N - M);
  });

  it('fulfill with no real source stock THROWS and does NOT mark fulfilled (no phantom inventory)', async () => {
    const { inventory, at, positions } = makeStatefulInventory();
    const { service, repo } = makeSupplyService(inventory, 2);

    await expect(service.fulfill(5, {}, 'warehouse@axos.test')).rejects.toThrow(
      /insuficientes|Insufficient/i,
    );
    // Nothing created in the line tank, request never flipped to fulfilled.
    expect(at(lineStockWarehouse(2)!)).toBeUndefined();
    expect(positions.size).toBe(0);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('consuming from an unfilled tank throws (surfaced, not swallowed)', async () => {
    const { inventory } = makeStatefulInventory();
    await expect(
      inventory.recordTransaction({
        type: 'CONSUME',
        partNumber: 'PN-100',
        quantity: 5,
        fromWarehouseId: lineStockWarehouse(9)!,
        fromLocation: LINE_STOCK_LOCATION,
        actorName: 'operator@axos.test',
      }),
    ).rejects.toThrow(/Insufficient stock/i);
  });
});

describe('InventoryService.transferToLine (conserving supply deposit)', () => {
  it('debits a real source and credits LINE-<line>, conserving global on-hand', async () => {
    const { inventory, at, seed, totalOnHand } = makeStatefulInventory();
    seed('WH-RM', 40);
    const res = await inventory.transferToLine({
      partNumber: 'PN-100',
      quantity: 40,
      line: 3,
      actorName: 'wh@axos.test',
      referenceType: 'MES_STAGING',
    });
    expect(res).toEqual({
      deposited: true,
      warehouseId: 'LINE-3',
      sources: [{ warehouseId: 'WH-RM', location: 'BULK', quantity: 40 }],
    });
    expect(at('LINE-3')).toBe(40);
    expect(at('WH-RM', 'BULK')).toBe(0);
    expect(totalOnHand()).toBe(40);
  });

  it('splits the draw across multiple source positions FIFO', async () => {
    const { inventory, at, seed, totalOnHand } = makeStatefulInventory();
    seed('WH-RM', 30); // seeded first → consumed first
    seed('WH-A', 40, 'A-01');
    const res = await inventory.transferToLine({
      partNumber: 'PN-100',
      quantity: 50,
      line: 4,
      actorName: 'wh@axos.test',
    });
    expect(res.sources).toEqual([
      { warehouseId: 'WH-RM', location: 'BULK', quantity: 30 },
      { warehouseId: 'WH-A', location: 'A-01', quantity: 20 },
    ]);
    expect(at('LINE-4')).toBe(50);
    expect(at('WH-RM', 'BULK')).toBe(0);
    expect(at('WH-A', 'A-01')).toBe(20);
    expect(totalOnHand()).toBe(70); // 30 + 40, conserved
  });

  it('never sources from another line tank (LINE-* excluded) — throws instead', async () => {
    const { inventory, at, seed } = makeStatefulInventory();
    seed('LINE-9', 100, LINE_STOCK_LOCATION); // a filled tank, NOT a valid source
    await expect(
      inventory.transferToLine({
        partNumber: 'PN-100',
        quantity: 10,
        line: 4,
        actorName: 'wh@axos.test',
      }),
    ).rejects.toThrow(/insuficientes/i);
    expect(at('LINE-4')).toBeUndefined();
    expect(at('LINE-9')).toBe(100); // untouched
  });

  it('throws when real stock cannot cover the request (no phantom tank created)', async () => {
    const { inventory, at, seed } = makeStatefulInventory();
    seed('WH-RM', 5);
    await expect(
      inventory.transferToLine({
        partNumber: 'PN-100',
        quantity: 10,
        line: 3,
        actorName: 'wh@axos.test',
      }),
    ).rejects.toThrow(/insuficientes/i);
    expect(at('LINE-3')).toBeUndefined();
    expect(at('WH-RM', 'BULK')).toBe(5); // source untouched
  });

  it('skips (no move, no throw) when there is no line', async () => {
    const { inventory, positions, seed } = makeStatefulInventory();
    seed('WH-RM', 40);
    const res = await inventory.transferToLine({
      partNumber: 'PN-100',
      quantity: 40,
      line: null,
      actorName: 'wh@axos.test',
    });
    expect(res).toEqual({ deposited: false, warehouseId: null, sources: [] });
    expect(positions.size).toBe(1); // only the seeded source, untouched
  });

  it('skips when quantity is not positive', async () => {
    const { inventory, seed, at } = makeStatefulInventory();
    seed('WH-RM', 40);
    const res = await inventory.transferToLine({
      partNumber: 'PN-100',
      quantity: 0,
      line: 3,
      actorName: 'wh@axos.test',
    });
    expect(res).toEqual({ deposited: false, warehouseId: null, sources: [] });
    expect(at('WH-RM', 'BULK')).toBe(40);
  });
});

describe('InventoryService.issueToLine (non-conserving primitive, still available)', () => {
  it('deposits qty into LINE-<line> and reports deposited', async () => {
    const { inventory, at } = makeStatefulInventory();
    const res = await inventory.issueToLine({
      partNumber: 'PN-100',
      quantity: 40,
      line: 3,
      actorName: 'wh@axos.test',
      referenceType: 'MES_STAGING',
    });
    expect(res).toEqual({ deposited: true, warehouseId: 'LINE-3' });
    expect(at('LINE-3')).toBe(40);
  });

  it('skips (no move, no throw) when there is no line', async () => {
    const { inventory, positions } = makeStatefulInventory();
    const res = await inventory.issueToLine({
      partNumber: 'PN-100',
      quantity: 40,
      line: null,
      actorName: 'wh@axos.test',
    });
    expect(res).toEqual({ deposited: false, warehouseId: null });
    expect(positions.size).toBe(0);
  });
});
