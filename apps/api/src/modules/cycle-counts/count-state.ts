/**
 * State machine for cycle counts (inventory accuracy).
 *
 * OPEN ─▶ COUNTED ─▶ RECONCILED   (matched / accepted as-is)
 *   │         │
 *   │         └─▶ ADJUSTED        (inventory corrected to the count)
 *   └─▶ CANCELLED
 *
 * Pure + side-effect free for isolated unit testing.
 */

export type CycleCountStatus =
  | 'OPEN'
  | 'COUNTED'
  | 'RECONCILED'
  | 'ADJUSTED'
  | 'CANCELLED';

export const CYCLE_COUNT_STATUSES: CycleCountStatus[] = [
  'OPEN',
  'COUNTED',
  'RECONCILED',
  'ADJUSTED',
  'CANCELLED',
];

const TRANSITIONS: Record<CycleCountStatus, CycleCountStatus[]> = {
  OPEN: ['COUNTED', 'CANCELLED'],
  COUNTED: ['RECONCILED', 'ADJUSTED'],
  RECONCILED: [],
  ADJUSTED: [],
  CANCELLED: [],
};

export function isTerminal(status: CycleCountStatus): boolean {
  return TRANSITIONS[status]?.length === 0;
}

export function canTransition(
  from: CycleCountStatus,
  to: CycleCountStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStates(from: CycleCountStatus): CycleCountStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function assertTransition(
  from: CycleCountStatus,
  to: CycleCountStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Cannot move a cycle count from ${from} to ${to}. ` +
        `Allowed: ${nextStates(from).join(', ') || '(none — terminal)'}.`,
    );
  }
}
