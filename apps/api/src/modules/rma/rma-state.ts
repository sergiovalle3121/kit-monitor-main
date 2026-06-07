/**
 * State machine for customer RMA / complaint cases (Quality).
 *
 * OPEN ─▶ INVESTIGATING ─▶ DISPOSITION ─▶ CLOSED
 *   │           │
 *   └───────────┴─▶ CANCELLED
 *
 * Pure + side-effect free for isolated unit testing.
 */

export type RmaStatus =
  | 'OPEN'
  | 'INVESTIGATING'
  | 'DISPOSITION'
  | 'CLOSED'
  | 'CANCELLED';

export const RMA_STATUSES: RmaStatus[] = [
  'OPEN',
  'INVESTIGATING',
  'DISPOSITION',
  'CLOSED',
  'CANCELLED',
];

export const RMA_DISPOSITIONS = ['REPAIR', 'REPLACE', 'CREDIT', 'REJECT'] as const;
export type RmaDisposition = (typeof RMA_DISPOSITIONS)[number];

const TRANSITIONS: Record<RmaStatus, RmaStatus[]> = {
  OPEN: ['INVESTIGATING', 'CANCELLED'],
  INVESTIGATING: ['DISPOSITION', 'CANCELLED'],
  DISPOSITION: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
};

export function isTerminal(status: RmaStatus): boolean {
  return TRANSITIONS[status]?.length === 0;
}

export function canTransition(from: RmaStatus, to: RmaStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStates(from: RmaStatus): RmaStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function assertTransition(from: RmaStatus, to: RmaStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Cannot move an RMA case from ${from} to ${to}. ` +
        `Allowed: ${nextStates(from).join(', ') || '(none — terminal)'}.`,
    );
  }
}
