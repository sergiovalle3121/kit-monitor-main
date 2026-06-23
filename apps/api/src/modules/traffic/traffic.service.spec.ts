import { DataSource } from 'typeorm';
import { TrafficService } from './traffic.service';
import { Carrier } from './entities/carrier.entity';
import { Vehicle } from './entities/vehicle.entity';
import { Driver } from './entities/driver.entity';
import { LoadingDock } from './entities/loading-dock.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { checkDockAssignable } from './traffic.rules';

/**
 * Traffic service (integration) — the dock board operational layer. Mirrors the
 * outbound spec harness (in-memory sqlite, synchronize). Covers the two acceptance
 * cases: assigning a shipment to a dock (it becomes OCCUPIED and cannot be
 * reassigned until released) and the dock assignment rule from traffic.rules.ts.
 */
describe('TrafficService — dock board (integration)', () => {
  let dataSource: DataSource;
  let service: TrafficService;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [Carrier, Vehicle, Driver, LoadingDock],
    });
    await dataSource.initialize();
    const ctx = new TenantContextService();
    service = new TrafficService(
      dataSource.getRepository(Carrier),
      dataSource.getRepository(Vehicle),
      dataSource.getRepository(Driver),
      dataSource.getRepository(LoadingDock),
      ctx,
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('assigns a shipment to a dock: it becomes OCCUPIED, ages, and cannot be reassigned until released', async () => {
    const dock = await service.createDock({ code: 'D-1', type: 'shipping' });
    // Free + shipping → assignable.
    expect(checkDockAssignable(dock)).toBeNull();

    // Occupy it (exactly what outbound.assignTransport does on dock assignment).
    await service.setDockStatus(dock.id, 'occupied');
    const occupied = await service.getDock(dock.id);
    expect(occupied.status).toBe('occupied');
    expect(occupied.occupiedAt).toBeTruthy(); // aging clock started

    // Poka-yoke now blocks re-assigning the same dock to another shipment.
    expect(checkDockAssignable(occupied)?.field).toBe('dockId');
    expect(checkDockAssignable(occupied)?.reason).toMatch(/ocupado/i);
    // …unless we are re-confirming the SAME shipment.
    expect(checkDockAssignable(occupied, { allowReassignSame: true })).toBeNull();

    // Release frees it and stops the aging clock → assignable again.
    await service.setDockStatus(dock.id, 'available');
    const freed = await service.getDock(dock.id);
    expect(freed.status).toBe('available');
    expect(freed.occupiedAt).toBeNull();
    expect(freed.loadingStartedAt).toBeNull();
    expect(checkDockAssignable(freed)).toBeNull();
  });

  it('enforces the dock assignment rule (receiving / maintenance / inactive cannot ship)', async () => {
    const receiving = await service.createDock({ code: 'R-1', type: 'receiving' });
    expect(checkDockAssignable(receiving)?.reason).toMatch(/recibo/i);

    const inMaint = await service.createDock({ code: 'D-2', type: 'shipping' });
    await service.setDockStatus(inMaint.id, 'maintenance');
    expect(checkDockAssignable(await service.getDock(inMaint.id))?.reason).toMatch(/mantenimiento/i);

    const offline = await service.createDock({ code: 'D-3', type: 'shipping' });
    await service.updateDock(offline.id, { status: 'inactive' });
    expect(checkDockAssignable(await service.getDock(offline.id))?.reason).toMatch(/inactivo/i);

    // A plain shipping/both door that's free stays assignable.
    const both = await service.createDock({ code: 'D-4', type: 'both' });
    expect(checkDockAssignable(both)).toBeNull();
  });

  it('marks an occupied dock EN CARGA and clears the marker on release', async () => {
    const dock = await service.createDock({ code: 'D-5', type: 'shipping' });
    await service.setDockStatus(dock.id, 'occupied');

    const loading = await service.startLoading(dock.id);
    expect(loading.loadingStartedAt).toBeTruthy();

    // Cannot mark a free dock as loading.
    const free = await service.createDock({ code: 'D-6', type: 'shipping' });
    await expect(service.startLoading(free.id)).rejects.toThrow(/ocupado/i);

    // Releasing the dock clears both the aging and the loading clocks.
    await service.setDockStatus(dock.id, 'available');
    expect((await service.getDock(dock.id)).loadingStartedAt).toBeNull();
  });

  it('keeps plate/code unique within scope (business validation)', async () => {
    await service.createVehicle({ plate: 'ABC-123', type: 'DRY_VAN' });
    await expect(service.createVehicle({ plate: 'ABC-123' })).rejects.toThrow(/Ya existe/i);

    await service.createDock({ code: 'D-7' });
    await expect(service.createDock({ code: 'D-7' })).rejects.toThrow(/Ya existe/i);
  });
});
