/**
 * Stages a serialized unit moves through once it leaves the MES assembly line.
 *
 * This is the *weave* (Eslabón 1): Assembly → Pruebas → Empaque/Disposición.
 * It deliberately does NOT model burn-in, failure probability or any decision
 * tree (that is Eslabón 2). A unit is queued for test, and the test result is
 * the only thing that picks its next stop:
 *
 *   AWAITING_TEST ──PASS──▶ READY_FOR_PACKAGING   (→ Empaque)
 *                 ──FAIL──▶ IN_DISPOSITION        (→ holds/disposition)
 *
 * A failed unit that is reworked and retested can be routed again (a later PASS
 * sends it to packaging), so routing is idempotent and re-entrant by serial.
 */
export type UnitFlowStage =
  | 'AWAITING_TEST'
  | 'READY_FOR_PACKAGING'
  | 'IN_DISPOSITION';

export type UnitFlowDestination = 'PACKAGING' | 'DISPOSITION';

export type UnitTestResult = 'PASS' | 'FAIL';

export const UNIT_FLOW_STAGES: readonly UnitFlowStage[] = [
  'AWAITING_TEST',
  'READY_FOR_PACKAGING',
  'IN_DISPOSITION',
] as const;

/** Stage a unit lands in after a test result is registered. */
export function stageForResult(result: UnitTestResult): UnitFlowStage {
  return result === 'PASS' ? 'READY_FOR_PACKAGING' : 'IN_DISPOSITION';
}

/** Downstream destination a test result routes the unit to. */
export function destinationForResult(
  result: UnitTestResult,
): UnitFlowDestination {
  return result === 'PASS' ? 'PACKAGING' : 'DISPOSITION';
}

/** A unit that has been routed (left the test queue). */
export function isRouted(stage: UnitFlowStage): boolean {
  return stage === 'READY_FOR_PACKAGING' || stage === 'IN_DISPOSITION';
}
