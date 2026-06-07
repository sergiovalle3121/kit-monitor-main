/**
 * Quality hold / NCR lifecycle for the material-review board (MRB).
 *
 * HELD ─▶ MRB_REVIEW ─▶ DISPOSITIONED ─▶ CLOSED
 *                              │
 *                              ├─▶ REWORK ─▶ REINSPECT ─▶ CLOSED
 *                              │                 └─▶ REWORK (re-inspect failed)
 *                              └─▶ (USE_AS_IS / SCRAP / RTV / SORT) ─▶ CLOSED
 *
 * Pure + side-effect free.
 */

export type HoldStatus =
  | 'HELD'
  | 'MRB_REVIEW'
  | 'DISPOSITIONED'
  | 'REWORK'
  | 'REINSPECT'
  | 'CLOSED'
  | 'CANCELLED';

export const HOLD_STATUSES: HoldStatus[] = [
  'HELD',
  'MRB_REVIEW',
  'DISPOSITIONED',
  'REWORK',
  'REINSPECT',
  'CLOSED',
  'CANCELLED',
];

/** MRB dispositions. */
export type Disposition =
  | 'USE_AS_IS'
  | 'REWORK'
  | 'REPAIR'
  | 'SCRAP'
  | 'RTV'
  | 'SORT';

export const DISPOSITIONS: Disposition[] = ['USE_AS_IS', 'REWORK', 'REPAIR', 'SCRAP', 'RTV', 'SORT'];

const TRANSITIONS: Record<HoldStatus, HoldStatus[]> = {
  HELD: ['MRB_REVIEW', 'CANCELLED'],
  MRB_REVIEW: ['DISPOSITIONED', 'CANCELLED'],
  DISPOSITIONED: ['REWORK', 'CLOSED'],
  REWORK: ['REINSPECT', 'CANCELLED'],
  REINSPECT: ['CLOSED', 'REWORK'],
  CLOSED: [],
  CANCELLED: [],
};

export function nextStates(from: HoldStatus): HoldStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function canTransition(from: HoldStatus, to: HoldStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminal(status: HoldStatus): boolean {
  return (TRANSITIONS[status]?.length ?? 0) === 0;
}

export function assertTransition(from: HoldStatus, to: HoldStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `No se puede mover el hold de ${from} a ${to}. ` +
        `Permitido: ${nextStates(from).join(', ') || '(ninguno — terminal)'}.`,
    );
  }
}

/** Dispositions that require a physical rework loop before closing. */
export function needsRework(disposition: Disposition): boolean {
  return disposition === 'REWORK' || disposition === 'REPAIR';
}

/** USE_AS_IS must carry a deviation/waiver note. */
export function requiresWaiver(disposition: Disposition): boolean {
  return disposition === 'USE_AS_IS';
}

/** RTV opens a supplier corrective action (SCAR) + debit note. */
export function requiresScar(disposition: Disposition): boolean {
  return disposition === 'RTV';
}
