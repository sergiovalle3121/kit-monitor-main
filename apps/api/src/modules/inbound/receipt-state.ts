/**
 * State machine for inbound receipts + IQC (Recibo / Inbound).
 *
 * RECEIVED ─▶ INSPECTING ─▶ RELEASED
 *    │            │
 *    │            └─▶ QUARANTINE ─▶ RELEASED (use-as-is/rework)
 *    │                     └─▶ REJECTED (RTV / scrap)
 *    └─▶ RELEASED (no IQC required)
 *
 * Pure + side-effect free for isolated unit testing.
 */

export type ReceiptStatus =
  | 'RECEIVED'
  | 'INSPECTING'
  | 'RELEASED'
  | 'QUARANTINE'
  | 'REJECTED';

export const RECEIPT_STATUSES: ReceiptStatus[] = [
  'RECEIVED',
  'INSPECTING',
  'RELEASED',
  'QUARANTINE',
  'REJECTED',
];

const TRANSITIONS: Record<ReceiptStatus, ReceiptStatus[]> = {
  RECEIVED: ['INSPECTING', 'RELEASED'],
  INSPECTING: ['RELEASED', 'QUARANTINE'],
  QUARANTINE: ['RELEASED', 'REJECTED'],
  RELEASED: [],
  REJECTED: [],
};

export function isTerminal(status: ReceiptStatus): boolean {
  return TRANSITIONS[status]?.length === 0;
}

export function canTransition(
  from: ReceiptStatus,
  to: ReceiptStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStates(from: ReceiptStatus): ReceiptStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function assertTransition(from: ReceiptStatus, to: ReceiptStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Cannot move a receipt from ${from} to ${to}. ` +
        `Allowed: ${nextStates(from).join(', ') || '(none — terminal)'}.`,
    );
  }
}
