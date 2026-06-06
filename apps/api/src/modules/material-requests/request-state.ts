/**
 * Pure state-machine helpers for the materials pull system (Phase 1B).
 *
 * Production raises a material request against a published kit's PickList; the
 * warehouse authorizes or rejects it. Keeping the legal transitions in one
 * side-effect-free place makes them trivially unit-testable and reused by the
 * service.
 */

export type MaterialRequestStatus =
  | 'pending'
  | 'authorized'
  | 'rejected'
  | 'fulfilled'
  | 'cancelled';

export const MATERIAL_REQUEST_TRANSITIONS: Record<
  MaterialRequestStatus,
  MaterialRequestStatus[]
> = {
  pending: ['authorized', 'rejected', 'cancelled'],
  authorized: ['fulfilled', 'cancelled'],
  rejected: [],
  fulfilled: [],
  cancelled: [],
};

export function canTransition(
  from: MaterialRequestStatus,
  to: MaterialRequestStatus,
): boolean {
  return MATERIAL_REQUEST_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Throws a descriptive error if the transition is not allowed. */
export function assertTransition(
  from: MaterialRequestStatus,
  to: MaterialRequestStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Cannot move a material request from "${from}" to "${to}".`,
    );
  }
}

export function isTerminal(status: MaterialRequestStatus): boolean {
  return MATERIAL_REQUEST_TRANSITIONS[status]?.length === 0;
}
