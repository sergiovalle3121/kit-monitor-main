/**
 * State machine for outbound shipments (Logistics / Embarque).
 *
 * PACKING ─▶ READY ─▶ SHIPPED ─▶ DELIVERED
 *    │         │
 *    └─────────┴─▶ CANCELLED
 *
 * Pure + side-effect free for isolated unit testing.
 */

export type OutboundShipmentStatus =
  | 'PACKING'
  | 'READY'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export const SHIPMENT_STATUSES: OutboundShipmentStatus[] = [
  'PACKING',
  'READY',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
];

const TRANSITIONS: Record<OutboundShipmentStatus, OutboundShipmentStatus[]> = {
  PACKING: ['READY', 'CANCELLED'],
  READY: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export function isTerminal(status: OutboundShipmentStatus): boolean {
  return TRANSITIONS[status]?.length === 0;
}

export function canTransition(
  from: OutboundShipmentStatus,
  to: OutboundShipmentStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStates(from: OutboundShipmentStatus): OutboundShipmentStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function assertTransition(
  from: OutboundShipmentStatus,
  to: OutboundShipmentStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Cannot move a shipment from ${from} to ${to}. ` +
        `Allowed: ${nextStates(from).join(', ') || '(none — terminal)'}.`,
    );
  }
}
