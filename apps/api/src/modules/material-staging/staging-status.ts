/**
 * Pure helpers for material staging (kitting to line) and e-kanban replenishment.
 * Side-effect free so the rules are unit-testable.
 */

export type StagingStatus = 'PENDING' | 'STAGED' | 'SHORTAGE';

/** Derive a staging line's status from staged vs required quantity. */
export function deriveStagingStatus(
  requiredQty: number,
  stagedQty: number,
  shortageFlag = false,
): StagingStatus {
  if (shortageFlag) return 'SHORTAGE';
  if (Number(stagedQty) >= Number(requiredQty) && Number(requiredQty) > 0) return 'STAGED';
  if (Number(stagedQty) >= Number(requiredQty)) return 'STAGED'; // required 0 → trivially staged
  return 'PENDING';
}

/** True when on-hand at the station dropped to/under the kanban reorder point. */
export function belowKanban(stagedQty: number, minQty: number): boolean {
  return Number(minQty) > 0 && Number(stagedQty) <= Number(minQty);
}

export type ReplenishStatus = 'OPEN' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';

export const REPLENISH_STATUSES: ReplenishStatus[] = ['OPEN', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'];

const REPLENISH_TRANSITIONS: Record<ReplenishStatus, ReplenishStatus[]> = {
  OPEN: ['IN_TRANSIT', 'DELIVERED', 'CANCELLED'],
  IN_TRANSIT: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

export function canReplenishTransition(from: ReplenishStatus, to: ReplenishStatus): boolean {
  return REPLENISH_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertReplenishTransition(from: ReplenishStatus, to: ReplenishStatus): void {
  if (!canReplenishTransition(from, to)) {
    throw new Error(`No se puede mover el llamado de reposición de ${from} a ${to}.`);
  }
}
