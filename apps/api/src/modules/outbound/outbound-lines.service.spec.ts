import { DataSource } from 'typeorm';
import { OutboundLinesService } from './outbound-lines.service';
import { OutboundShipmentLine } from './entities/outbound-shipment-line.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import type { InventoryService } from '../inventory/inventory.service';

describe('OutboundLinesService', () => {
  let dataSource: DataSource;
  let lines: OutboundLinesService;
  let recordTransaction: jest.Mock;
  let ensureMaterial: jest.Mock;

  function build(inventory?: Partial<InventoryService>) {
    lines = new OutboundLinesService(
      dataSource.getRepository(OutboundShipmentLine),
      new TenantContextService(),
      inventory as InventoryService | undefined,
    );
  }

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [OutboundShipmentLine],
    });
    await dataSource.initialize();
    recordTransaction = jest.fn().mockResolvedValue({});
    ensureMaterial = jest.fn().mockResolvedValue({});
    build({ recordTransaction, ensureMaterial } as unknown as Partial<InventoryService>);
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('adds, lists and removes lines', async () => {
    const a = await lines.addLine('ship-1', {
      partNumber: 'FG-1',
      quantity: 10,
    });
    await lines.addLine('ship-1', {
      partNumber: 'FG-2',
      quantity: 5,
      uom: 'PZ',
    });
    expect((await lines.listLines('ship-1')).map((l) => l.partNumber)).toEqual([
      'FG-1',
      'FG-2',
    ]);
    expect(a.inventoryPosted).toBe(false);
    expect(a.warehouseId).toBe('WH-FG');

    await lines.removeLine(a.id);
    expect((await lines.listLines('ship-1')).map((l) => l.partNumber)).toEqual([
      'FG-2',
    ]);
  });

  it('posts a finished-goods goods-issue per line and flips inventoryPosted', async () => {
    await lines.addLine('ship-1', {
      partNumber: 'FG-1',
      quantity: 10,
      lotNumber: 'L1',
    });
    await lines.addLine('ship-1', { partNumber: 'FG-2', quantity: 5 });

    const res = await lines.postShipmentInventory('ship-1', 'tester');
    expect(res).toEqual({ posted: 2, failed: 0, skipped: 0 });
    expect(recordTransaction).toHaveBeenCalledTimes(2);
    expect(recordTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ISSUE',
        partNumber: 'FG-1',
        quantity: 10,
        fromWarehouseId: 'WH-FG',
        lotNumber: 'L1',
        referenceType: 'OUTBOUND_SHIPMENT',
      }),
    );
    const after = await lines.listLines('ship-1');
    expect(
      after.every((l) => l.inventoryPosted && l.quantityShipped === l.quantity),
    ).toBe(true);
  });

  it('is best-effort: a failing posting does not block the others or throw', async () => {
    recordTransaction
      .mockRejectedValueOnce(
        new Error('Material FG-X not found in Master Data'),
      )
      .mockResolvedValueOnce({});
    await lines.addLine('ship-1', { partNumber: 'FG-X', quantity: 4 });
    await lines.addLine('ship-1', { partNumber: 'FG-OK', quantity: 4 });

    const res = await lines.postShipmentInventory('ship-1', 'tester');
    expect(res).toEqual({ posted: 1, failed: 1, skipped: 0 });
    const byPart = Object.fromEntries(
      (await lines.listLines('ship-1')).map((l) => [
        l.partNumber,
        l.inventoryPosted,
      ]),
    );
    expect(byPart).toEqual({ 'FG-X': false, 'FG-OK': true });
  });

  it('is idempotent — already-posted lines are skipped on a second run', async () => {
    await lines.addLine('ship-1', { partNumber: 'FG-1', quantity: 10 });
    await lines.postShipmentInventory('ship-1', 'tester');
    recordTransaction.mockClear();

    const res = await lines.postShipmentInventory('ship-1', 'tester');
    expect(res).toEqual({ posted: 0, failed: 0, skipped: 1 });
    expect(recordTransaction).not.toHaveBeenCalled();
  });

  it('receiveStock stocks each line as FG (ensureMaterial + RECEIVE into WH-FG)', async () => {
    await lines.addLine('ship-1', { partNumber: 'FG-1', quantity: 10 });
    await lines.addLine('ship-1', { partNumber: 'FG-2', quantity: 4 });
    const res = await lines.receiveStock('ship-1');
    expect(res).toEqual({ received: 2 });
    expect(ensureMaterial).toHaveBeenCalledTimes(2);
    expect(recordTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'RECEIVE', partNumber: 'FG-1', quantity: 10, toWarehouseId: 'WH-FG' }),
    );
  });

  it('no-ops when inventory is not wired in', async () => {
    build(undefined);
    await lines.addLine('ship-1', { partNumber: 'FG-1', quantity: 10 });
    expect(await lines.postShipmentInventory('ship-1', 'tester')).toEqual({
      posted: 0,
      failed: 0,
      skipped: 0,
    });
  });
});
