import { DataSource } from 'typeorm';
import { TrafficService } from './traffic.service';
import { TrafficAppointmentsService } from './traffic-appointments.service';
import { Carrier } from './entities/carrier.entity';
import { Vehicle } from './entities/vehicle.entity';
import { Driver } from './entities/driver.entity';
import { LoadingDock } from './entities/loading-dock.entity';
import { DockAppointment } from './entities/dock-appointment.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

/**
 * Dock appointments (Citas) service integration — sqlite harness like the rest of
 * traffic. Covers create (resolve + denormalize + validate refs) and the gate
 * lifecycle (scheduled → arrived → completed) with the state-machine guard.
 */
describe('TrafficAppointmentsService (integration)', () => {
  let ds: DataSource;
  let traffic: TrafficService;
  let svc: TrafficAppointmentsService;

  beforeEach(async () => {
    ds = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [Carrier, Vehicle, Driver, LoadingDock, DockAppointment],
    });
    await ds.initialize();
    const ctx = new TenantContextService();
    traffic = new TrafficService(
      ds.getRepository(Carrier),
      ds.getRepository(Vehicle),
      ds.getRepository(Driver),
      ds.getRepository(LoadingDock),
      ctx,
    );
    svc = new TrafficAppointmentsService(
      ds.getRepository(DockAppointment),
      traffic,
      ctx,
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it('creates an appointment resolving + denormalizing dock/carrier/unit/driver', async () => {
    const dock = await traffic.createDock({ code: 'D-1', type: 'shipping' });
    const carrier = await traffic.createCarrier({
      code: 'DHL',
      name: 'DHL Supply Chain',
    });
    const vehicle = await traffic.createVehicle({
      plate: 'ABC-123',
      type: 'DRY_VAN',
    });
    const driver = await traffic.createDriver({ name: 'Juan Pérez' });

    const a = await svc.create({
      scheduledAt: new Date().toISOString(),
      dockId: dock.id,
      carrierId: carrier.id,
      vehicleId: vehicle.id,
      driverId: driver.id,
      shipmentRef: 'SHP-2026-000001',
    });

    expect(a.status).toBe('scheduled');
    expect(a.direction).toBe('outbound');
    expect(a.dockCode).toBe('D-1');
    expect(a.carrierName).toBe('DHL Supply Chain');
    expect(a.vehiclePlate).toBe('ABC-123');
    expect(a.driverName).toBe('Juan Pérez');
    expect(a.shipmentRef).toBe('SHP-2026-000001');
    expect(a.arrivedAt).toBeNull();
  });

  it('runs the gate lifecycle scheduled → arrived → completed and stamps timestamps', async () => {
    const a = await svc.create({ scheduledAt: new Date().toISOString() });

    const arrived = await svc.setStatus(a.id, 'arrived');
    expect(arrived.status).toBe('arrived');
    expect(arrived.arrivedAt).toBeTruthy();

    const completed = await svc.setStatus(a.id, 'completed');
    expect(completed.status).toBe('completed');
    expect(completed.completedAt).toBeTruthy();
  });

  it('rejects an illegal transition (cannot skip arrived)', async () => {
    const a = await svc.create({ scheduledAt: new Date().toISOString() });
    await expect(svc.setStatus(a.id, 'completed')).rejects.toThrow(
      /No se puede mover/i,
    );
  });

  it('validates that referenced pieces exist', async () => {
    await expect(
      svc.create({
        scheduledAt: new Date().toISOString(),
        dockId: 'does-not-exist',
      }),
    ).rejects.toThrow(/Andén no encontrado/i);
  });

  it('lists scheduled appointments and filters by status', async () => {
    await svc.create({ scheduledAt: new Date().toISOString() });
    const second = await svc.create({ scheduledAt: new Date().toISOString() });
    await svc.setStatus(second.id, 'cancelled');

    expect((await svc.list()).length).toBe(2);
    expect((await svc.list({ status: 'scheduled' })).length).toBe(1);
    expect((await svc.list({ status: 'cancelled' })).length).toBe(1);
  });
});
