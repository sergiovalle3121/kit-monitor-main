/**
 * Routing domain logic: status state machine + standard-time roll-up. Pure +
 * side-effect free (unit-testable). New prefixed tables (`rt_`), additive.
 */

export type RoutingStatus = 'DRAFT' | 'ACTIVE' | 'OBSOLETE';

export const ROUTING_STATUSES: RoutingStatus[] = ['DRAFT', 'ACTIVE', 'OBSOLETE'];

const TRANSITIONS: Record<RoutingStatus, RoutingStatus[]> = {
  DRAFT: ['ACTIVE', 'OBSOLETE'],
  ACTIVE: ['OBSOLETE'],
  OBSOLETE: ['ACTIVE'],
};

export function canTransition(from: RoutingStatus, to: RoutingStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStates(from: RoutingStatus): RoutingStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function assertTransition(from: RoutingStatus, to: RoutingStatus): void {
  if (from === to) throw new Error(`El ruteo ya está en ${from}.`);
  if (!canTransition(from, to)) {
    throw new Error(
      `No se puede mover un ruteo de ${from} a ${to}. ` +
        `Permitido: ${nextStates(from).join(', ') || '(ninguno)'}.`,
    );
  }
}

// ── Standard-time roll-up ────────────────────────────────────────────────────
export interface OperationTime {
  setupTimeMin?: number;
  runTimePerUnitMin?: number;
}

export interface RoutingTotals {
  /** Sum of all setup times (once per lot). */
  totalSetupMin: number;
  /** Sum of per-unit run times across operations. */
  totalRunPerUnitMin: number;
  /** Standard time for a lot of `qty`: Σsetup + Σrun × qty. */
  totalForQtyMin: number;
  operations: number;
}

const round = (n: number) => Math.round((n + Number.EPSILON) * 1e4) / 1e4;

export function rollupRoutingTime(
  ops: OperationTime[],
  qty: number,
): RoutingTotals {
  const q = qty > 0 ? qty : 1;
  let setup = 0;
  let runPer = 0;
  for (const op of ops) {
    setup += Math.max(0, op.setupTimeMin ?? 0);
    runPer += Math.max(0, op.runTimePerUnitMin ?? 0);
  }
  return {
    totalSetupMin: round(setup),
    totalRunPerUnitMin: round(runPer),
    totalForQtyMin: round(setup + runPer * q),
    operations: ops.length,
  };
}
