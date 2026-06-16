// ─────────────────────────────────────────────────────────────────────────────
// Traffic (Tráfico) — pure domain rules for the logistics master data: status /
// type vocabularies and the assignment poka-yoke (a unit/driver/dock/carrier must
// be operationally usable before it can be tied to a shipment). Side-effect free
// so the service and the specs share ONE source of truth, exactly like
// outbound/shipment-state.ts. The DB-dependent checks (existence, "already
// assigned") live in the service; everything testable in isolation lives here.
// ─────────────────────────────────────────────────────────────────────────────

// ── Carrier (Transportista) ──────────────────────────────────────────────────
export type CarrierMode = 'GROUND' | 'OCEAN' | 'AIR' | 'PARCEL' | 'COURIER';
export const CARRIER_MODES: CarrierMode[] = ['GROUND', 'OCEAN', 'AIR', 'PARCEL', 'COURIER'];

export type CarrierStatus = 'active' | 'inactive';
export const CARRIER_STATUSES: CarrierStatus[] = ['active', 'inactive'];

// ── Vehicle (Unidad) ─────────────────────────────────────────────────────────
export type VehicleType =
  | 'DRY_VAN' // caja seca
  | 'REEFER' // refrigerado
  | 'FLATBED' // plataforma
  | 'CONTAINER_20' // contenedor 20'
  | 'CONTAINER_40' // contenedor 40'
  | 'BOX_TRUCK' // rabón / torton
  | 'VAN' // camioneta
  | 'OTHER';
export const VEHICLE_TYPES: VehicleType[] = [
  'DRY_VAN',
  'REEFER',
  'FLATBED',
  'CONTAINER_20',
  'CONTAINER_40',
  'BOX_TRUCK',
  'VAN',
  'OTHER',
];

export type VehicleStatus = 'available' | 'assigned' | 'maintenance' | 'inactive';
export const VEHICLE_STATUSES: VehicleStatus[] = ['available', 'assigned', 'maintenance', 'inactive'];

// ── Driver (Chofer / Operador) ───────────────────────────────────────────────
export type DriverStatus = 'available' | 'assigned' | 'inactive';
export const DRIVER_STATUSES: DriverStatus[] = ['available', 'assigned', 'inactive'];

// ── Loading dock (Andén) ─────────────────────────────────────────────────────
export type DockType = 'shipping' | 'receiving' | 'both';
export const DOCK_TYPES: DockType[] = ['shipping', 'receiving', 'both'];

export type DockStatus = 'available' | 'occupied' | 'maintenance' | 'inactive';
export const DOCK_STATUSES: DockStatus[] = ['available', 'occupied', 'maintenance', 'inactive'];

// ── Assignment poka-yoke (pure) ──────────────────────────────────────────────
// One issue = one reason why a piece cannot be tied to a shipment. The service
// turns a non-null issue into a BadRequest; the UI can surface `field`.
export interface AssignabilityIssue {
  field: 'carrierId' | 'vehicleId' | 'driverId' | 'dockId';
  reason: string;
}

export function checkCarrierAssignable(c?: { status: CarrierStatus } | null): AssignabilityIssue | null {
  if (!c) return { field: 'carrierId', reason: 'Transportista no encontrado.' };
  if (c.status === 'inactive') return { field: 'carrierId', reason: 'El transportista está inactivo.' };
  return null;
}

export function checkVehicleAssignable(
  v?: { status: VehicleStatus } | null,
  opts: { allowReassignSame?: boolean } = {},
): AssignabilityIssue | null {
  if (!v) return { field: 'vehicleId', reason: 'Unidad no encontrada.' };
  if (v.status === 'maintenance') return { field: 'vehicleId', reason: 'La unidad está en mantenimiento.' };
  if (v.status === 'inactive') return { field: 'vehicleId', reason: 'La unidad está inactiva.' };
  // 'assigned' to THIS shipment is fine (re-confirm); to ANOTHER is blocked in the service.
  if (v.status === 'assigned' && !opts.allowReassignSame)
    return { field: 'vehicleId', reason: 'La unidad ya está asignada a otro embarque.' };
  return null;
}

export function checkDriverAssignable(
  d?: { status: DriverStatus } | null,
  opts: { allowReassignSame?: boolean } = {},
): AssignabilityIssue | null {
  if (!d) return { field: 'driverId', reason: 'Chofer no encontrado.' };
  if (d.status === 'inactive') return { field: 'driverId', reason: 'El chofer está inactivo.' };
  if (d.status === 'assigned' && !opts.allowReassignSame)
    return { field: 'driverId', reason: 'El chofer ya está asignado a otro embarque.' };
  return null;
}

export function checkDockAssignable(
  k?: { status: DockStatus; type: DockType } | null,
  opts: { allowReassignSame?: boolean } = {},
): AssignabilityIssue | null {
  if (!k) return { field: 'dockId', reason: 'Andén no encontrado.' };
  if (k.status === 'maintenance') return { field: 'dockId', reason: 'El andén está en mantenimiento.' };
  if (k.status === 'inactive') return { field: 'dockId', reason: 'El andén está inactivo.' };
  if (k.type === 'receiving') return { field: 'dockId', reason: 'El andén es de recibo, no de embarque.' };
  if (k.status === 'occupied' && !opts.allowReassignSame)
    return { field: 'dockId', reason: 'El andén ya está ocupado por otro embarque.' };
  return null;
}
