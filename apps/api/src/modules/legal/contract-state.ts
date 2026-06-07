/**
 * State machine for legal contracts.
 *
 * DRAFT ─▶ ACTIVE ─▶ EXPIRED ─▶ ACTIVE   (renewal)
 *   │         │          │
 *   │         └──────────┴─▶ TERMINATED
 *   └─▶ CANCELLED
 *
 * Pure + side-effect free for isolated unit testing.
 */

export type ContractStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'TERMINATED'
  | 'CANCELLED';

export const CONTRACT_STATUSES: ContractStatus[] = [
  'DRAFT',
  'ACTIVE',
  'EXPIRED',
  'TERMINATED',
  'CANCELLED',
];

const TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  DRAFT: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['EXPIRED', 'TERMINATED'],
  EXPIRED: ['ACTIVE', 'TERMINATED'], // renew or formally terminate
  TERMINATED: [],
  CANCELLED: [],
};

export function isTerminal(status: ContractStatus): boolean {
  return TRANSITIONS[status]?.length === 0;
}

export function canTransition(
  from: ContractStatus,
  to: ContractStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStates(from: ContractStatus): ContractStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function assertTransition(
  from: ContractStatus,
  to: ContractStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Cannot move a contract from ${from} to ${to}. ` +
        `Allowed: ${nextStates(from).join(', ') || '(none — terminal)'}.`,
    );
  }
}
