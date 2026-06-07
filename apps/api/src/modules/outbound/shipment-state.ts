/**
 * State machine for outbound shipments (Logistics / Embarque).
 *
 * PACKING ─▶ READY ─▶ SHIPPED ─▶ DELIVERED
 *    │         │
 *    └─────────┴─▶ CANCELLED
 *
 * Pure + side-effect free for isolated unit testing.
 */

export type ShipmentStatus =
  | 'PACKING'
  | 'READY'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export const SHIPMENT_STATUSES: ShipmentStatus[] = [
  'PACKING',
  'READY',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
];

const TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  PACKING: ['READY', 'CANCELLED'],
  READY: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export function isTerminal(status: ShipmentStatus): boolean {
  return TRANSITIONS[status]?.length === 0;
}

export function canTransition(
  from: ShipmentStatus,
  to: ShipmentStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStates(from: ShipmentStatus): ShipmentStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function assertTransition(
  from: ShipmentStatus,
  to: ShipmentStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Cannot move a shipment from ${from} to ${to}. ` +
        `Allowed: ${nextStates(from).join(', ') || '(none — terminal)'}.`,
    );
  }
}
