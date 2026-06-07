/**
 * State machine for purchase orders (Procurement).
 *
 * DRAFT ─▶ ISSUED ─▶ ACKNOWLEDGED ─▶ RECEIVED ─▶ CLOSED
 *   │         │            │
 *   └─────────┴────────────┴─▶ CANCELLED
 *
 * Pure + side-effect free for isolated unit testing.
 */

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'ACKNOWLEDGED'
  | 'RECEIVED'
  | 'CLOSED'
  | 'CANCELLED';

export const PURCHASE_ORDER_STATUSES: PurchaseOrderStatus[] = [
  'DRAFT',
  'ISSUED',
  'ACKNOWLEDGED',
  'RECEIVED',
  'CLOSED',
  'CANCELLED',
];

const TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  DRAFT: ['ISSUED', 'CANCELLED'],
  ISSUED: ['ACKNOWLEDGED', 'RECEIVED', 'CANCELLED'],
  ACKNOWLEDGED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
};

export function isTerminal(status: PurchaseOrderStatus): boolean {
  return TRANSITIONS[status]?.length === 0;
}

export function canTransition(
  from: PurchaseOrderStatus,
  to: PurchaseOrderStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStates(
  from: PurchaseOrderStatus,
): PurchaseOrderStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function assertTransition(
  from: PurchaseOrderStatus,
  to: PurchaseOrderStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Cannot move a purchase order from ${from} to ${to}. ` +
        `Allowed: ${nextStates(from).join(', ') || '(none — terminal)'}.`,
    );
  }
}
