// ─────────────────────────────────────────────────────────────────────────────
// Shipping (embarques) types — mirror the real backend entities & payloads of the
// `shipping` module (zero mock). Source of truth:
//   apps/api/src/modules/shipping/{shipping.controller.ts, shipping.service.ts,
//   entities/{shipment,shipment-item,packing-list}.entity.ts}
// Kept in sync by hand because `packages/contracts` is not established yet.
// ─────────────────────────────────────────────────────────────────────────────

// ShipmentStatus — shipment.entity.ts (the DB stores the lowercase values).
export type ShipmentStatus =
  | "planning"
  | "staged"
  | "loading"
  | "dispatched"
  | "closed";

// Shipment — shipment.entity.ts. `GET /shipping` returns these (no items).
export interface Shipment {
  id: number;
  shipmentNumber: string;
  status: ShipmentStatus;
  customer: string;
  carrier?: string | null;
  truckPlate?: string | null;
  driverName?: string | null;
  dockNumber?: string | null;
  trackingNumber?: string | null;
  route?: string | null;
  scheduledAt?: string | null;
  loadingStartedAt?: string | null;
  dispatchedAt?: string | null;
  dispatchedBy?: string | null;
  manifestData?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

// ShipmentItem — shipment-item.entity.ts.
export interface ShipmentItem {
  id: number;
  partNumber: string;
  quantity: number;
  lotNumber?: string | null;
  workOrder?: string | null;
  fromWarehouseId?: string | null;
  fromLocation?: string | null;
}

// PackingList — packing-list.entity.ts.
export interface PackingList {
  id: number;
  packingListNumber: string;
  customer: string;
  items: { partNumber: string; quantity: number }[] | null;
  status: string;
  generatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// `GET /shipping/:id` → shipment spread + items + packingLists (shipping.service.findOne).
export interface ShipmentDetail extends Shipment {
  items: ShipmentItem[];
  packingLists: PackingList[];
}

// ── Payloads (DTOs are `any` on the backend; these are the fields it consumes) ──

// POST /shipping — create(dto: Partial<Shipment>). `customer` is NOT NULL in the DB.
export interface CreateShipmentInput {
  customer: string;
  carrier?: string;
  route?: string;
  dockNumber?: string;
  scheduledAt?: string;
}

// POST /shipping/:id/items — addItem. Backend enforces eligibility (only
// holdStatus='available' FG stock in WH-FG) and auto-promotes the shipment to STAGED.
export interface AddItemInput {
  partNumber: string;
  quantity: number;
  lotNumber?: string;
  workOrder?: string;
  fromLocation?: string;
}

// PATCH /shipping/:id/start-loading — manifestDto is Object.assign'd onto the
// shipment, then status→LOADING + loadingStartedAt set.
export interface StartLoadingInput {
  carrier?: string;
  truckPlate?: string;
  driverName?: string;
  dockNumber?: string;
  trackingNumber?: string;
  route?: string;
}

// POST /shipping/:id/discrepancy — records an operational exception (no status change).
export interface DiscrepancyInput {
  type: string;
  detail: string;
  actor: string;
}

// Inventory position (progressive-enhancement for the staging picker) — subset of
// apps/api/src/modules/inventory/entities/inventory-position.entity.ts. The
// `available` getter is NOT serialized → compute onHand − allocated on the client.
export interface InventoryPosition {
  id: number;
  partNumber: string;
  warehouseId: string;
  location: string;
  onHand: number;
  allocated: number;
  holdStatus: string;
  lotNumber?: string | null;
}
