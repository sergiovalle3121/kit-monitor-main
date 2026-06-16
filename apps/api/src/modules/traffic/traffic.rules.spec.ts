import {
  CARRIER_MODES,
  DOCK_STATUSES,
  DOCK_TYPES,
  DRIVER_STATUSES,
  VEHICLE_STATUSES,
  VEHICLE_TYPES,
  checkCarrierAssignable,
  checkDockAssignable,
  checkDriverAssignable,
  checkVehicleAssignable,
} from './traffic.rules';

describe('traffic.rules — vocabularies', () => {
  it('exposes stable vocabularies', () => {
    expect(VEHICLE_TYPES).toContain('DRY_VAN');
    expect(VEHICLE_TYPES).toContain('CONTAINER_40');
    expect(VEHICLE_STATUSES).toEqual(['available', 'assigned', 'maintenance', 'inactive']);
    expect(DRIVER_STATUSES).toEqual(['available', 'assigned', 'inactive']);
    expect(DOCK_STATUSES).toEqual(['available', 'occupied', 'maintenance', 'inactive']);
    expect(DOCK_TYPES).toEqual(['shipping', 'receiving', 'both']);
    expect(CARRIER_MODES).toContain('GROUND');
  });
});

describe('traffic.rules — assignment poka-yoke', () => {
  it('rejects a missing piece', () => {
    expect(checkVehicleAssignable(null)?.field).toBe('vehicleId');
    expect(checkDriverAssignable(undefined)?.field).toBe('driverId');
    expect(checkDockAssignable(null)?.field).toBe('dockId');
    expect(checkCarrierAssignable(null)?.field).toBe('carrierId');
  });

  it('blocks an inactive carrier', () => {
    expect(checkCarrierAssignable({ status: 'active' })).toBeNull();
    expect(checkCarrierAssignable({ status: 'inactive' })?.reason).toMatch(/inactivo/i);
  });

  it('blocks a unit in maintenance or inactive', () => {
    expect(checkVehicleAssignable({ status: 'available' })).toBeNull();
    expect(checkVehicleAssignable({ status: 'maintenance' })?.reason).toMatch(/mantenimiento/i);
    expect(checkVehicleAssignable({ status: 'inactive' })?.reason).toMatch(/inactiva/i);
  });

  it('blocks a unit already assigned elsewhere, but allows re-confirming the same shipment', () => {
    expect(checkVehicleAssignable({ status: 'assigned' })?.reason).toMatch(/otro embarque/i);
    expect(checkVehicleAssignable({ status: 'assigned' }, { allowReassignSame: true })).toBeNull();
  });

  it('blocks an inactive driver and one busy elsewhere', () => {
    expect(checkDriverAssignable({ status: 'available' })).toBeNull();
    expect(checkDriverAssignable({ status: 'inactive' })?.reason).toMatch(/inactivo/i);
    expect(checkDriverAssignable({ status: 'assigned' })?.reason).toMatch(/otro embarque/i);
    expect(checkDriverAssignable({ status: 'assigned' }, { allowReassignSame: true })).toBeNull();
  });

  it('blocks a receiving-only, out-of-service, or occupied dock', () => {
    expect(checkDockAssignable({ status: 'available', type: 'shipping' })).toBeNull();
    expect(checkDockAssignable({ status: 'available', type: 'both' })).toBeNull();
    expect(checkDockAssignable({ status: 'available', type: 'receiving' })?.reason).toMatch(/recibo/i);
    expect(checkDockAssignable({ status: 'maintenance', type: 'shipping' })?.reason).toMatch(/mantenimiento/i);
    expect(checkDockAssignable({ status: 'occupied', type: 'shipping' })?.reason).toMatch(/ocupado/i);
    expect(checkDockAssignable({ status: 'occupied', type: 'shipping' }, { allowReassignSame: true })).toBeNull();
  });
});
