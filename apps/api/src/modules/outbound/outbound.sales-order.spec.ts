import { DataSource } from 'typeorm';
import { OutboundService } from './outbound.service';
import { OutboundLinesService } from './outbound-lines.service';
import { Shipment } from './entities/shipment.entity';
import { OutboundShipmentLine } from './entities/outbound-shipment-line.entity';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import type { TrafficService } from '../traffic/traffic.service';
import type { ErpSdService } from '../erp-core/services/erp-sd.service';

describe('OutboundService — sales order link (SD)', () => {
  let ds: DataSource;
  let service: OutboundService;
  let lines: OutboundLinesService;
  let shipSO: jest.Mock;

  beforeEach(async () => {
    ds = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [Shipment, OutboundShipmentLine, DocumentSequence],
    });
    await ds.initialize();
    const ctx = new TenantContextService();
    const numbering = new DocumentNumberingService(
      ds.getRepository(DocumentSequence),
      ds,
      ctx,
    );
    lines = new OutboundLinesService(
      ds.getRepository(OutboundShipmentLine),
      ctx,
    );
    shipSO = jest.fn().mockResolvedValue({ status: 'shipped' });
    const sd = {
      listSOs: jest.fn().mockResolvedValue([
        {
          id: 7,
          soNumber: 'SO-7',
          customerName: 'Cliente A',
          status: 'confirmed',
        },
        { id: 8, soNumber: 'SO-8', customerName: 'B', status: 'draft' },
      ]),
      getSO: jest.fn().mockResolvedValue({
        id: 7,
        soNumber: 'SO-7',
        customerName: 'Cliente A',
        customerCode: 'C-A',
        currency: 'USD',
        lines: [
          {
            lineNo: 1,
            model: 'FG-1',
            description: 'Tablero',
            quantity: 10,
            qtyShipped: 0,
            unitPrice: 25,
          },
          {
            lineNo: 2,
            model: 'FG-2',
            description: null,
            quantity: 5,
            qtyShipped: 5,
            unitPrice: 10,
          },
        ],
      }),
      shipSO,
    } as unknown as ErpSdService;
    service = new OutboundService(
      ds.getRepository(Shipment),
      ctx,
      numbering,
      {} as unknown as TrafficService,
      undefined,
      undefined,
      lines,
      undefined,
      sd,
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it('lists only shippable sales orders', async () => {
    const open = await service.listOpenSalesOrders();
    expect(open.map((o) => o.soNumber)).toEqual(['SO-7']); // SO-8 is draft
  });

  it('creates a shipment from an SO with its open lines', async () => {
    const s = await service.createFromSalesOrder(7);
    expect(s.salesOrderId).toBe(7);
    expect(s.salesOrderNumber).toBe('SO-7');
    expect(s.customerName).toBe('Cliente A');
    const ls = await lines.listLines(s.id);
    expect(ls.map((l) => l.partNumber)).toEqual(['FG-1']); // FG-2 already fully shipped
    expect(ls[0].quantity).toBe(10);
    expect(ls[0].salesOrderLine).toBe('1');
    expect(ls[0].unitPrice).toBe(25);
  });

  it('on SHIPPED routes fulfilment through shipSO and marks lines shipped (no double-issue)', async () => {
    const s = await service.createFromSalesOrder(7);
    await service.transition(s.id, { status: 'READY' });
    await service.transition(s.id, { status: 'SHIPPED' });
    expect(shipSO).toHaveBeenCalledWith(
      7,
      { lines: [{ lineNo: 1, qty: 10 }] },
      expect.any(String),
    );
    expect((await lines.listLines(s.id)).every((l) => l.inventoryPosted)).toBe(
      true,
    );
  });
});
