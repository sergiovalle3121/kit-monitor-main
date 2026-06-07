/**
 * State machine for CRM opportunities (sales pipeline).
 *
 * LEAD ─▶ QUALIFIED ─▶ PROPOSAL ─▶ WON
 *   │          │           │
 *   └──────────┴───────────┴─▶ LOST
 *
 * Pure + side-effect free for isolated unit testing.
 */

export type OpportunityStatus =
  | 'LEAD'
  | 'QUALIFIED'
  | 'PROPOSAL'
  | 'WON'
  | 'LOST';

export const OPPORTUNITY_STATUSES: OpportunityStatus[] = [
  'LEAD',
  'QUALIFIED',
  'PROPOSAL',
  'WON',
  'LOST',
];

const TRANSITIONS: Record<OpportunityStatus, OpportunityStatus[]> = {
  LEAD: ['QUALIFIED', 'LOST'],
  QUALIFIED: ['PROPOSAL', 'LOST'],
  PROPOSAL: ['WON', 'LOST'],
  WON: [],
  LOST: [],
};

export function isTerminal(status: OpportunityStatus): boolean {
  return TRANSITIONS[status]?.length === 0;
}

export function canTransition(
  from: OpportunityStatus,
  to: OpportunityStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStates(from: OpportunityStatus): OpportunityStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function assertTransition(
  from: OpportunityStatus,
  to: OpportunityStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Cannot move an opportunity from ${from} to ${to}. ` +
        `Allowed: ${nextStates(from).join(', ') || '(none — terminal)'}.`,
    );
  }
}

/** Default win-probability (%) for each open stage. */
export function defaultProbability(stage: OpportunityStatus): number {
  switch (stage) {
    case 'LEAD':
      return 10;
    case 'QUALIFIED':
      return 30;
    case 'PROPOSAL':
      return 60;
    case 'WON':
      return 100;
    case 'LOST':
      return 0;
    default:
      return 10;
  }
}
