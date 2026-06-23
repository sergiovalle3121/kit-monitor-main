/**
 * NPI (New Product Introduction) lifecycle — phase order + gate decisions.
 *
 * A model is introduced through an ordered phase gate funnel:
 *
 *   QUOTE ─▶ DFM ─▶ EVT ─▶ DVT ─▶ PVT ─▶ MP
 *
 * Each phase owns one gate. A gate is decided PASSED / FAILED / WAIVED from
 * PENDING; a FAILED gate may be recovered (PASSED / WAIVED) after rework, while
 * PASSED and WAIVED are terminal — the same audit-trail shape as `fai-state`.
 *
 * Pure + side-effect free so the rules can be unit-tested without a database.
 * This module is ADVISORY: it never blocks or forces a product-model activation.
 */

// ── Phases ──────────────────────────────────────────────────────────────────

export const NPI_PHASES = ['QUOTE', 'DFM', 'EVT', 'DVT', 'PVT', 'MP'] as const;

export type NpiPhase = (typeof NPI_PHASES)[number];

/** The terminal phase (Mass Production) — its gate is the release gate. */
export const FINAL_PHASE: NpiPhase = 'MP';

export function isNpiPhase(value: unknown): value is NpiPhase {
  return (
    typeof value === 'string' &&
    (NPI_PHASES as readonly string[]).includes(value)
  );
}

/** Position of a phase in the legal order, or -1 when not a phase. */
export function phaseIndex(phase: string): number {
  return (NPI_PHASES as readonly string[]).indexOf(phase);
}

/** The next phase in the funnel, or null when already at MP / invalid. */
export function nextPhase(phase: string): NpiPhase | null {
  const i = phaseIndex(phase);
  if (i < 0 || i >= NPI_PHASES.length - 1) return null;
  return NPI_PHASES[i + 1];
}

export function isFinalPhase(phase: string): boolean {
  return phase === FINAL_PHASE;
}

/** True only when `to` is exactly the phase that follows `from`. */
export function canAdvancePhase(from: string, to: string): boolean {
  return nextPhase(from) === to;
}

/**
 * Order comparator for two phases: <0 if a precedes b, 0 if equal, >0 if a
 * follows b. Unknown phases sort last (returns +∞-ish) — honest, never crashes.
 */
export function comparePhases(a: string, b: string): number {
  const ia = phaseIndex(a);
  const ib = phaseIndex(b);
  const na = ia < 0 ? Number.MAX_SAFE_INTEGER : ia;
  const nb = ib < 0 ? Number.MAX_SAFE_INTEGER : ib;
  return na - nb;
}

// ── Project status ──────────────────────────────────────────────────────────

export type NpiProjectStatus = 'OPEN' | 'ON_HOLD' | 'RELEASED' | 'CANCELLED';

export const NPI_PROJECT_STATUSES: NpiProjectStatus[] = [
  'OPEN',
  'ON_HOLD',
  'RELEASED',
  'CANCELLED',
];

// ── Gate decisions ──────────────────────────────────────────────────────────

export type NpiGateStatus = 'PENDING' | 'PASSED' | 'FAILED' | 'WAIVED';

export const NPI_GATE_STATUSES: NpiGateStatus[] = [
  'PENDING',
  'PASSED',
  'FAILED',
  'WAIVED',
];

const GATE_TRANSITIONS: Record<NpiGateStatus, NpiGateStatus[]> = {
  PENDING: ['PASSED', 'FAILED', 'WAIVED'],
  // A failed gate can be recovered after rework (re-decision is part of the trail).
  FAILED: ['PASSED', 'WAIVED'],
  PASSED: [],
  WAIVED: [],
};

export function nextGateStates(from: NpiGateStatus): NpiGateStatus[] {
  return GATE_TRANSITIONS[from] ?? [];
}

export function canGateTransition(
  from: NpiGateStatus,
  to: NpiGateStatus,
): boolean {
  return GATE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isGateTerminal(status: NpiGateStatus): boolean {
  return (GATE_TRANSITIONS[status]?.length ?? 0) === 0;
}

/** A gate is "cleared" (does not block the phase) when PASSED or WAIVED. */
export function isGateCleared(status: NpiGateStatus): boolean {
  return status === 'PASSED' || status === 'WAIVED';
}

export function assertGateTransition(
  from: NpiGateStatus,
  to: NpiGateStatus,
): void {
  if (!canGateTransition(from, to)) {
    throw new Error(
      `No se puede mover el gate de ${from} a ${to}. ` +
        `Permitido: ${nextGateStates(from).join(', ') || '(ninguno — terminal)'}.`,
    );
  }
}
