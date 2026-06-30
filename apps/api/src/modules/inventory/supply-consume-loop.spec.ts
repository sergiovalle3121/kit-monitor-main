import { InventoryService } from './inventory.service';
import { LINE_STOCK_LOCATION, lineStockWarehouse } from './line-stock';
import { MaterialRequestsService } from '../material-requests/material-requests.service';

/**
 * End-to-end proof that the material loop CLOSES:
 *
 *   surtir N  →  LINE-<n> sube N  →  consumir M (/operador)  →  LINE-<n> baja M
 *   → existencias finales = N − M
 *
 * Uses a REAL `InventoryService` over a stateful in-memory position store, so
 * the same `InventoryPosition` is created on supply and decremented on consume
 * through the real `recordTransaction` math. The supply side is driven through
 * the REAL `MaterialRequestsService.fulfill`, the consume side through the same
 * `recordTransaction({ type: 'CONSUME', fromWarehouseId: LINE-<n>, ... })` call
 * that `mes-execution` makes at /operador. Both sides agree on the position key
 * via the shared `lineStockWarehouse` + `LINE_STOCK_LOCATION`.
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

  const inventory = new InventoryService(
    {} as never, // positionRepo (unused here)
    {} as never, // movementRepo
    materialRepo as never,
    {} as never, // warehouseRepo
    audit as never,
    dataSource as never,
    { getTenantId: () => null } as never, // tenantCtx
  );

  const at = (wh: string) =>
    positions.get(keyOf('PN-100', wh, LINE_STOCK_LOCATION))?.onHand;
  return { inventory, positions, at };
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

describe('Supply → consume inventory loop (LINE-<n> tank)', () => {
  it('fulfill deposits N into LINE-<n>; /operador consume removes M; balance = N − M', async () => {
    const { inventory, at } = makeStatefulInventory();
    const N = 50;
    const M = 30;
    const wh = lineStockWarehouse(2)!; // 'LINE-2' — the PLAN line

    // 1) SURTIR — fulfill the material request through the real service.
    const { service, repo } = makeSupplyService(inventory, 2);
    await service.fulfill(5, {}, 'warehouse@axos.test');

    // LINE-2 tank now holds the supplied N, and the request was marked fulfilled.
    expect(at(wh)).toBe(N);
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

    // 3) The loop closes: existencias finales = N − M.
    expect(at(wh)).toBe(N - M);
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
