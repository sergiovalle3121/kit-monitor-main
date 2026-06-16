/**
 * First Article Inspection (FAI / primera pieza) lifecycle.
 *
 * PENDING ─▶ PASS   (first piece within tolerance + inspector signs → WO is freed)
 *    │
 *    └────▶ FAIL   (first piece rejected → WO stays blocked; open a new attempt)
 *
 * PASS / FAIL are terminal for a given attempt. A failed first piece is followed
 * by a NEW FAI record for the next attempt (full audit trail, like an NCR loop).
 * Pure + side-effect free.
 */

export type FaiResult = 'PENDING' | 'PASS' | 'FAIL';

export const FAI_RESULTS: FaiResult[] = ['PENDING', 'PASS', 'FAIL'];

const TRANSITIONS: Record<FaiResult, FaiResult[]> = {
  PENDING: ['PASS', 'FAIL'],
  PASS: [],
  FAIL: [],
};

export function nextStates(from: FaiResult): FaiResult[] {
  return TRANSITIONS[from] ?? [];
}

export function canTransition(from: FaiResult, to: FaiResult): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminal(result: FaiResult): boolean {
  return (TRANSITIONS[result]?.length ?? 0) === 0;
}

export function assertTransition(from: FaiResult, to: FaiResult): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `No se puede mover la FAI de ${from} a ${to}. ` +
        `Permitido: ${nextStates(from).join(', ') || '(ninguno — terminal)'}.`,
    );
  }
}

/** A single measured characteristic of the first piece. */
export interface FaiMeasurement {
  /** What was measured, e.g. "Altura de carcasa". */
  characteristic: string;
  /** Nominal / target value (informational). */
  nominal?: number | null;
  /** Lower spec limit — null = unbounded below. */
  lsl?: number | null;
  /** Upper spec limit — null = unbounded above. */
  usl?: number | null;
  /** The measured value. */
  actual: number;
  unit?: string | null;
  /** Computed: whether `actual` falls within [lsl, usl]. */
  pass?: boolean;
}

/** Evaluate one measurement against its spec limits (inclusive). */
export function evaluateMeasurement(m: FaiMeasurement): boolean {
  const actual = Number(m.actual);
  if (!Number.isFinite(actual)) return false;
  if (m.lsl != null && actual < Number(m.lsl)) return false;
  if (m.usl != null && actual > Number(m.usl)) return false;
  return true;
}

/** Stamp each measurement with its computed pass flag (non-mutating). */
export function evaluateMeasurements(ms: FaiMeasurement[]): FaiMeasurement[] {
  return (ms ?? []).map((m) => ({ ...m, pass: evaluateMeasurement(m) }));
}

/** A first piece may only be approved when every measurement is in tolerance. */
export function allWithinTolerance(ms: FaiMeasurement[]): boolean {
  return (ms ?? []).every((m) => evaluateMeasurement(m));
}
