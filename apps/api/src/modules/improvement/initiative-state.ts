/**
 * State machine for continuous-improvement initiatives (Kaizen / Lean / 6σ).
 *
 * DRAFT ─▶ IN_PROGRESS ─▶ IMPLEMENTED ─▶ VERIFIED ─▶ CLOSED
 *   │           ▲   │           │             │
 *   │           └───┴───────────┴─────────────┘   (rework: back to IN_PROGRESS)
 *   └─▶ CANCELLED ◀── (from any non-terminal state)
 *
 * Pure + side-effect free so the rules can be unit tested in isolation.
 */

export type InitiativeStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'IMPLEMENTED'
  | 'VERIFIED'
  | 'CLOSED'
  | 'CANCELLED';

export const INITIATIVE_STATUSES: InitiativeStatus[] = [
  'DRAFT',
  'IN_PROGRESS',
  'IMPLEMENTED',
  'VERIFIED',
  'CLOSED',
  'CANCELLED',
];

const TRANSITIONS: Record<InitiativeStatus, InitiativeStatus[]> = {
  DRAFT: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['IMPLEMENTED', 'CANCELLED'],
  IMPLEMENTED: ['VERIFIED', 'IN_PROGRESS'], // verify, or send back for rework
  VERIFIED: ['CLOSED', 'IN_PROGRESS'], // close, or reopen
  CLOSED: [],
  CANCELLED: [],
};

export function isTerminal(status: InitiativeStatus): boolean {
  return TRANSITIONS[status]?.length === 0;
}

export function canTransition(
  from: InitiativeStatus,
  to: InitiativeStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStates(from: InitiativeStatus): InitiativeStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function assertTransition(
  from: InitiativeStatus,
  to: InitiativeStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Cannot move an improvement initiative from ${from} to ${to}. ` +
        `Allowed: ${nextStates(from).join(', ') || '(none — terminal)'}.`,
    );
  }
}
