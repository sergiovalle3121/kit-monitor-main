/**
 * State machine for maintenance work orders (CMMS).
 *
 * OPEN ─▶ IN_PROGRESS ─▶ COMPLETED
 *   │          │  ▲
 *   │          │  └── (reopen)
 *   └─▶ CANCELLED ◀─┘
 *
 * Pure + side-effect free for isolated unit testing.
 */

export type MaintenanceOrderStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export const MAINTENANCE_ORDER_STATUSES: MaintenanceOrderStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

const TRANSITIONS: Record<MaintenanceOrderStatus, MaintenanceOrderStatus[]> = {
  OPEN: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'OPEN', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function isTerminal(status: MaintenanceOrderStatus): boolean {
  return TRANSITIONS[status]?.length === 0;
}

export function canTransition(
  from: MaintenanceOrderStatus,
  to: MaintenanceOrderStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStates(
  from: MaintenanceOrderStatus,
): MaintenanceOrderStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function assertTransition(
  from: MaintenanceOrderStatus,
  to: MaintenanceOrderStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Cannot move a maintenance order from ${from} to ${to}. ` +
        `Allowed: ${nextStates(from).join(', ') || '(none — terminal)'}.`,
    );
  }
}
