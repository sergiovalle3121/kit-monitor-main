/**
 * State machine for EHS safety incidents.
 *
 * REPORTED ─▶ INVESTIGATING ─▶ ACTION_PENDING ─▶ CLOSED
 *    │              │   ▲              │
 *    │              │   └──────────────┘  (rework)
 *    └─▶ CLOSED (trivial/near-miss)   └─▶ CANCELLED (duplicate/invalid)
 *
 * Pure + side-effect free for isolated unit testing.
 */

export type IncidentStatus =
  | 'REPORTED'
  | 'INVESTIGATING'
  | 'ACTION_PENDING'
  | 'CLOSED'
  | 'CANCELLED';

export const INCIDENT_STATUSES: IncidentStatus[] = [
  'REPORTED',
  'INVESTIGATING',
  'ACTION_PENDING',
  'CLOSED',
  'CANCELLED',
];

const TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  REPORTED: ['INVESTIGATING', 'CLOSED', 'CANCELLED'],
  INVESTIGATING: ['ACTION_PENDING', 'CLOSED', 'CANCELLED'],
  ACTION_PENDING: ['CLOSED', 'INVESTIGATING'],
  CLOSED: [],
  CANCELLED: [],
};

export function isTerminal(status: IncidentStatus): boolean {
  return TRANSITIONS[status]?.length === 0;
}

export function canTransition(
  from: IncidentStatus,
  to: IncidentStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStates(from: IncidentStatus): IncidentStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function assertTransition(
  from: IncidentStatus,
  to: IncidentStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Cannot move a safety incident from ${from} to ${to}. ` +
        `Allowed: ${nextStates(from).join(', ') || '(none — terminal)'}.`,
    );
  }
}
