import { DataSource } from 'typeorm';
import { OutboundService } from './outbound.service';
import { Shipment } from './entities/shipment.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

describe('OutboundService (integration)', () => {
  let dataSource: DataSource;
  let service: OutboundService;
  const year = new Date().getFullYear();

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [Shipment, DocumentSequence],
    });
    await dataSource.initialize();

    const ctx = new TenantContextService();
    const numbering = new DocumentNumberingService(
      dataSource.getRepository(DocumentSequence),
      dataSource,
      ctx,
    );
    service = new OutboundService(
      dataSource.getRepository(Shipment),
      ctx,
      numbering,
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('creates a shipment with an SHP folio and PACKING status', async () => {
    const s = await service.create({ title: 'PT Modelo X', customerName: 'Cliente A' });
    expect(s.folio).toBe(`SHP-${year}-000001`);
    expect(s.status).toBe('PACKING');
    expect(s.asn).toBeNull();
  });

  it('generates an ASN and stamps dates through the lifecycle', async () => {
    const s = await service.create({ title: 'Embarque' });
    await service.transition(s.id, { status: 'READY' });
    const shipped = await service.transition(s.id, { status: 'SHIPPED', trackingNumber: '1Z999' });
    expect(shipped.shippedDate).toBeTruthy();
    expect(shipped.asn).toBe(`ASN-${year}-000001`);
    expect(shipped.trackingNumber).toBe('1Z999');
    const delivered = await service.transition(s.id, { status: 'DELIVERED' });
    expect(delivered.deliveredDate).toBeTruthy();
  });

  it('rejects an illegal transition', async () => {
    const s = await service.create({ title: 'Salto inválido' });
    await expect(
      service.transition(s.id, { status: 'SHIPPED' }),
    ).rejects.toThrow(/Cannot move a shipment/);
  });

  it('computes outbound KPIs (to-ship, in-transit, overdue, OTD)', async () => {
    // Overdue shipment still packing (promised in the past).
    await service.create({ title: 'Tarde', promisedDate: '2020-01-01' });
    // One delivered on time.
    const ok = await service.create({ title: 'A tiempo', promisedDate: '2999-01-01' });
    await service.transition(ok.id, { status: 'READY' });
    await service.transition(ok.id, { status: 'SHIPPED' });
    await service.transition(ok.id, { status: 'DELIVERED' });

    const kpis = await service.kpis();
    expect(kpis.toShip).toBe(1); // the packing one
    expect(kpis.overdue).toBe(1);
    expect(kpis.delivered).toBe(1);
    expect(kpis.otdPct).toBe(100); // delivered before promised
  });
});
