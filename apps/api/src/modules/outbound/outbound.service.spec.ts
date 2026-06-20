import { DataSource } from 'typeorm';
import { OutboundService } from './outbound.service';
import { Shipment } from './entities/shipment.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { TrafficService } from '../traffic/traffic.service';
import { Carrier } from '../traffic/entities/carrier.entity';
import { Vehicle } from '../traffic/entities/vehicle.entity';
import { Driver } from '../traffic/entities/driver.entity';
import { LoadingDock } from '../traffic/entities/loading-dock.entity';
import { PackingService } from '../packing/packing.service';
import { HandlingUnit } from '../packing/entities/handling-unit.entity';
import type { GenealogyService } from '../genealogy/genealogy.service';

describe('OutboundService (integration)', () => {
  let dataSource: DataSource;
  let service: OutboundService;
  let traffic: TrafficService;
  let packing: PackingService;
  let linkShipment: jest.Mock;
  const year = new Date().getFullYear();

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [
        Shipment,
        DocumentSequence,
        Carrier,
        Vehicle,
        Driver,
        LoadingDock,
        HandlingUnit,
      ],
    });
    await dataSource.initialize();

    const ctx = new TenantContextService();
    const numbering = new DocumentNumberingService(
      dataSource.getRepository(DocumentSequence),
      dataSource,
      ctx,
    );
    traffic = new TrafficService(
      dataSource.getRepository(Carrier),
      dataSource.getRepository(Vehicle),
      dataSource.getRepository(Driver),
      dataSource.getRepository(LoadingDock),
      ctx,
    );
    packing = new PackingService(
      dataSource.getRepository(HandlingUnit),
      ctx,
      numbering,
    );
    linkShipment = jest.fn().mockResolvedValue({});
    service = new OutboundService(
      dataSource.getRepository(Shipment),
      ctx,
      numbering,
      traffic,
      undefined,
      packing,
      undefined,
      { linkShipment } as unknown as GenealogyService,
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('creates a shipment with an SHP folio and PACKING status', async () => {
    const s = await service.create({
      title: 'PT Modelo X',
      customerName: 'Cliente A',
    });
    expect(s.folio).toBe(`SHP-${year}-000001`);
    expect(s.status).toBe('PACKING');
    expect(s.asn).toBeNull();
  });

  it('generates an ASN and stamps dates through the lifecycle', async () => {
    const s = await service.create({ title: 'Embarque' });
    await service.transition(s.id, { status: 'READY' });
    const shipped = await service.transition(s.id, {
      status: 'SHIPPED',
      trackingNumber: '1Z999',
    });
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

  it('blocks READY until every packed unit is scan-verified (Carga verificada)', async () => {
    const s = await service.create({ title: 'Con carga' });
    const unit = await packing.create({
      shipmentId: s.id,
      shipmentFolio: s.folio ?? undefined,
      type: 'CARTON',
      contents: [{ partNumber: 'PN-1', quantity: 1 }],
    });

    // Unscanned → the dock-loading poka-yoke blocks the READY transition.
    await expect(service.transition(s.id, { status: 'READY' })).rejects.toThrow(
      /faltan/i,
    );
    expect((await service.getOne(s.id)).status).toBe('PACKING');

    // Scan it onto the truck → READY is now allowed.
    await packing.verifyScan(s.id, unit.sscc!);
    const ready = await service.transition(s.id, { status: 'READY' });
    expect(ready.status).toBe('READY');
  });

  it('links shipped serials to the shipment for recall (genealogy)', async () => {
    const s = await service.create({
      title: 'Con series',
      customerName: 'Cliente A',
    });
    const unit = await packing.create({
      shipmentId: s.id,
      shipmentFolio: s.folio ?? undefined,
      type: 'CARTON',
      contents: [
        { partNumber: 'FG-1', quantity: 2, serials: ['SN-1', 'SN-2'] },
      ],
    });
    await packing.verifyScan(s.id, unit.sscc!);
    await service.transition(s.id, { status: 'READY' });
    await service.transition(s.id, { status: 'SHIPPED' });

    expect(linkShipment).toHaveBeenCalledTimes(2);
    expect(linkShipment).toHaveBeenCalledWith(
      expect.objectContaining({
        builtSerial: 'SN-1',
        shipmentId: s.id,
        customerName: 'Cliente A',
      }),
    );
  });

  it('computes outbound KPIs (to-ship, in-transit, overdue, OTD)', async () => {
    // Overdue shipment still packing (promised in the past).
    await service.create({ title: 'Tarde', promisedDate: '2020-01-01' });
    // One delivered on time.
    const ok = await service.create({
      title: 'A tiempo',
      promisedDate: '2999-01-01',
    });
    await service.transition(ok.id, { status: 'READY' });
    await service.transition(ok.id, { status: 'SHIPPED' });
    await service.transition(ok.id, { status: 'DELIVERED' });

    const kpis = await service.kpis();
    expect(kpis.toShip).toBe(1); // the packing one
    expect(kpis.overdue).toBe(1);
    expect(kpis.delivered).toBe(1);
    expect(kpis.otdPct).toBe(100); // delivered before promised
  });

  it('assigns transport (carrier/unit/driver/dock) and flips them to busy', async () => {
    const s = await service.create({ title: 'Con unidad' });
    const carrier = await traffic.createCarrier({
      code: 'DHL',
      name: 'DHL Supply Chain',
    });
    const vehicle = await traffic.createVehicle({
      plate: 'ABC-123',
      type: 'DRY_VAN',
    });
    const driver = await traffic.createDriver({ name: 'Juan Pérez' });
    const dock = await traffic.createDock({ code: 'D-1', type: 'shipping' });

    const assigned = await service.assignTransport(s.id, {
      carrierId: carrier.id,
      vehicleId: vehicle.id,
      driverId: driver.id,
      dockId: dock.id,
    });
    expect(assigned.carrier).toBe('DHL Supply Chain');
    expect(assigned.vehiclePlate).toBe('ABC-123');
    expect(assigned.driverName).toBe('Juan Pérez');
    expect(assigned.dockCode).toBe('D-1');
    expect(assigned.transportAssignedAt).toBeTruthy();

    expect((await traffic.getVehicle(vehicle.id)).status).toBe('assigned');
    expect((await traffic.getDriver(driver.id)).status).toBe('assigned');
    expect((await traffic.getDock(dock.id)).status).toBe('occupied');

    const released = await service.releaseTransport(s.id);
    expect(released.vehiclePlate).toBeNull();
    expect(released.dockCode).toBeNull();
    expect((await traffic.getVehicle(vehicle.id)).status).toBe('available');
    expect((await traffic.getDock(dock.id)).status).toBe('available');
  });

  it('blocks assigning a unit in maintenance (poka-yoke)', async () => {
    const s = await service.create({ title: 'Bloqueo' });
    const v = await traffic.createVehicle({ plate: 'XYZ-9', type: 'DRY_VAN' });
    await traffic.updateVehicle(v.id, { status: 'maintenance' });
    await expect(
      service.assignTransport(s.id, { vehicleId: v.id }),
    ).rejects.toThrow(/mantenimiento/i);
  });

  it('blocks assigning a unit already tied to another shipment', async () => {
    const a = await service.create({ title: 'A' });
    const b = await service.create({ title: 'B' });
    const v = await traffic.createVehicle({ plate: 'DUP-1', type: 'DRY_VAN' });
    await service.assignTransport(a.id, { vehicleId: v.id });
    await expect(
      service.assignTransport(b.id, { vehicleId: v.id }),
    ).rejects.toThrow(/otro embarque/i);
  });
});
