// ─────────────────────────────────────────────────────────────────────────────
// Traffic (Tráfico) types — mirror the backend `traffic` module + the transport
// fields of the outbound spine. Source of truth:
//   apps/api/src/modules/traffic/** and outbound/entities/shipment.entity.ts
// ─────────────────────────────────────────────────────────────────────────────

export type CarrierMode = "GROUND" | "OCEAN" | "AIR" | "PARCEL" | "COURIER";
export type CarrierStatus = "active" | "inactive";

export interface Carrier {
  id: string;
  code: string;
  name: string;
  scac: string | null;
  taxId: string | null;
  mode: CarrierMode;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  status: CarrierStatus;
  notes: string | null;
}

export type VehicleType =
  | "DRY_VAN"
  | "REEFER"
  | "FLATBED"
  | "CONTAINER_20"
  | "CONTAINER_40"
  | "BOX_TRUCK"
  | "VAN"
  | "OTHER";
export type VehicleStatus = "available" | "assigned" | "maintenance" | "inactive";

export interface Vehicle {
  id: string;
  plate: string;
  economicNumber: string | null;
  type: VehicleType;
  carrierId: string | null;
  carrierName: string | null;
  maxWeightKg: number | null;
  maxVolumeM3: number | null;
  vin: string | null;
  status: VehicleStatus;
  notes: string | null;
}

export type DriverStatus = "available" | "assigned" | "inactive";

export interface Driver {
  id: string;
  name: string;
  licenseNumber: string | null;
  licenseType: string | null;
  phone: string | null;
  idDocument: string | null;
  carrierId: string | null;
  carrierName: string | null;
  status: DriverStatus;
  notes: string | null;
}

export type DockType = "shipping" | "receiving" | "both";
export type DockStatus = "available" | "occupied" | "maintenance" | "inactive";

export interface LoadingDock {
  id: string;
  code: string;
  name: string | null;
  buildingId: string | null;
  buildingName: string | null;
  type: DockType;
  status: DockStatus;
  notes: string | null;
}

// Subset of the outbound shipment used by the assignment tab.
export interface OutboundShipmentLite {
  id: string;
  folio: string | null;
  title: string;
  customerName: string | null;
  status: string;
  carrier: string | null;
  carrierId: string | null;
  vehicleId: string | null;
  vehiclePlate: string | null;
  vehicleType: string | null;
  driverId: string | null;
  driverName: string | null;
  dockId: string | null;
  dockCode: string | null;
  transportAssignedAt: string | null;
}

export type MasterKind = "carriers" | "vehicles" | "drivers" | "docks";
