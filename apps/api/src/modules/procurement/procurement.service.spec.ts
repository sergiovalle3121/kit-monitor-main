import { DataSource } from 'typeorm';
import { ProcurementService } from './procurement.service';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

describe('ProcurementService (integration)', () => {
  let dataSource: DataSource;
  let service: ProcurementService;
  const year = new Date().getFullYear();

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [PurchaseOrder, DocumentSequence],
    });
    await dataSource.initialize();

    const ctx = new TenantContextService();
    const numbering = new DocumentNumberingService(
      dataSource.getRepository(DocumentSequence),
      dataSource,
      ctx,
    );
    service = new ProcurementService(
      dataSource.getRepository(PurchaseOrder),
      ctx,
      numbering,
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('creates a PO with a PO folio and DRAFT status', async () => {
    const po = await service.create({ title: 'Resistencias 0402', supplierName: 'Acme', totalValue: 12500 });
    expect(po.folio).toBe(`PO-${year}-000001`);
    expect(po.status).toBe('DRAFT');
    expect(po.supplierName).toBe('Acme');
  });

  it('drives the lifecycle and stamps issued/received dates', async () => {
    const po = await service.create({ title: 'Conectores' });
    const issued = await service.transition(po.id, { status: 'ISSUED' });
    expect(issued.issuedAt).toBeTruthy();
    await service.transition(po.id, { status: 'ACKNOWLEDGED', promisedDate: '2026-07-01' });
    const received = await service.transition(po.id, { status: 'RECEIVED' });
    expect(received.receivedDate).toBeTruthy();
    const closed = await service.transition(po.id, { status: 'CLOSED' });
    expect(closed.status).toBe('CLOSED');
  });

  it('rejects an illegal transition', async () => {
    const po = await service.create({ title: 'Salto inválido' });
    await expect(
      service.transition(po.id, { status: 'RECEIVED' }),
    ).rejects.toThrow(/Cannot move a purchase order/);
  });

  it('computes procurement KPIs (open, awaiting, overdue, committed)', async () => {
    // Open issued PO, overdue (required in the past).
    const a = await service.create({ title: 'Tardía', totalValue: 1000, requiredDate: '2020-01-01' });
    await service.transition(a.id, { status: 'ISSUED' });
    // Draft PO (open, committed).
    await service.create({ title: 'Borrador', totalValue: 500 });

    const kpis = await service.kpis();
    expect(kpis.open).toBe(2); // DRAFT + ISSUED
    expect(kpis.awaitingReceipt).toBe(1); // ISSUED
    expect(kpis.overdue).toBe(1); // issued + past required
    expect(kpis.committedValue).toBe(1500);
  });
});
