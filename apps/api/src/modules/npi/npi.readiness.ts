/**
 * NPI readiness aggregator — a PURE, side-effect-free function that folds the
 * release signals that already exist elsewhere (BOM approval, FAI first piece,
 * line balance + documentation completeness, standard time, AVL coverage) into
 * a per-criterion READY / NOT_READY / UNKNOWN verdict plus a global `gateReady`.
 *
 * Honesty rule: a signal the caller could not resolve cheaply arrives as `null`
 * and is reported UNKNOWN — it is NEVER assumed good. `gateReady` is therefore
 * true only when EVERY criterion is READY. This is ADVISORY: it informs, it
 * never blocks or forces a product-model activation.
 *
 * No DB, no NestJS — fully unit-testable. The service resolves the raw signals
 * read-only and hands them here.
 */

export type ReadinessStatus = 'READY' | 'NOT_READY' | 'UNKNOWN';

/** Line balance efficiency at/above which a line counts as balanced (0..1). */
export const LINE_BALANCE_OK = 0.85;
/** Layout documentation completeness required to be READY (0..1, fully documented). */
export const LINE_COMPLETENESS_OK = 1;
/** Fraction of BOM parts that must have an APPROVED source to be READY (0..1). */
export const AVL_COVERAGE_OK = 1;

/** Raw signals the service resolves read-only from existing modules. */
export interface ReadinessSignals {
  /** Best BOM header status for the model (DRAFT/…/ACTIVE) or null if none. */
  bomStatus?: string | null;
  /** Aggregated FAI result for the model (PASS/FAIL/PENDING) or null if none. */
  faiStatus?: string | null;
  /** Line balance efficiency, 0..1, or null when no routing exists. */
  lineBalancePct?: number | null;
  /** Layout documentation completeness, 0..1, or null when no routing exists. */
  lineCompletenessPct?: number | null;
  /** Whether every routed station has a standard time (>0), or null if unknown. */
  stdTimeComplete?: boolean | null;
  /** Fraction of BOM parts with an APPROVED source, 0..1, or null if no BOM. */
  avlCoverage?: number | null;
}

export interface ReadinessCriterion {
  key: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
}

export interface ReadinessReport {
  criteria: ReadinessCriterion[];
  /** True only when every criterion is READY. */
  gateReady: boolean;
  readyCount: number;
  notReadyCount: number;
  unknownCount: number;
  /** Keys of criteria that are NOT_READY (the hard blockers). */
  blockers: string[];
  /** Keys of criteria that could not be resolved (UNKNOWN — verify manually). */
  unknowns: string[];
}

/** Worst-of fold: NOT_READY dominates UNKNOWN, which dominates READY. */
function worst(statuses: ReadinessStatus[]): ReadinessStatus {
  if (statuses.includes('NOT_READY')) return 'NOT_READY';
  if (statuses.includes('UNKNOWN')) return 'UNKNOWN';
  return 'READY';
}

/** READY when `value` ≥ `threshold`; UNKNOWN when null; else NOT_READY. */
function thresholdStatus(
  value: number | null | undefined,
  threshold: number,
): ReadinessStatus {
  if (value == null || !Number.isFinite(value)) return 'UNKNOWN';
  return value >= threshold ? 'READY' : 'NOT_READY';
}

function pct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'desconocido';
  return `${Math.round(value * 1000) / 10}%`;
}

const BOM_READY = new Set(['APPROVED', 'ACTIVE']);

function bomCriterion(status: string | null | undefined): ReadinessCriterion {
  let s: ReadinessStatus;
  let detail: string;
  if (!status) {
    s = 'UNKNOWN';
    detail = 'Sin BOM para el modelo.';
  } else if (BOM_READY.has(status)) {
    s = 'READY';
    detail = `BOM ${status}.`;
  } else {
    s = 'NOT_READY';
    detail = `BOM en estado ${status} (se requiere APPROVED o ACTIVE).`;
  }
  return { key: 'bom', label: 'BOM aprobada', status: s, detail };
}

function faiCriterion(status: string | null | undefined): ReadinessCriterion {
  let s: ReadinessStatus;
  let detail: string;
  if (!status) {
    s = 'UNKNOWN';
    detail = 'Sin FAI registrada para el modelo.';
  } else if (status === 'PASS') {
    s = 'READY';
    detail = 'FAI (primera pieza) aprobada.';
  } else {
    s = 'NOT_READY';
    detail = `FAI en estado ${status} (se requiere PASS).`;
  }
  return { key: 'fai', label: 'FAI / primera pieza', status: s, detail };
}

function lineCriterion(signals: ReadinessSignals): ReadinessCriterion {
  const balance = thresholdStatus(signals.lineBalancePct, LINE_BALANCE_OK);
  const completeness = thresholdStatus(
    signals.lineCompletenessPct,
    LINE_COMPLETENESS_OK,
  );
  const status = worst([balance, completeness]);
  const detail =
    `Balance ${pct(signals.lineBalancePct)} (min ${pct(LINE_BALANCE_OK)}), ` +
    `documentación ${pct(signals.lineCompletenessPct)} (min ${pct(LINE_COMPLETENESS_OK)}).`;
  return { key: 'line', label: 'Línea balanceada', status, detail };
}

function stdTimeCriterion(
  complete: boolean | null | undefined,
): ReadinessCriterion {
  let s: ReadinessStatus;
  let detail: string;
  if (complete == null) {
    s = 'UNKNOWN';
    detail = 'Sin ruteo para evaluar tiempos estándar.';
  } else if (complete) {
    s = 'READY';
    detail = 'Todas las estaciones tienen tiempo estándar.';
  } else {
    s = 'NOT_READY';
    detail = 'Hay estaciones sin tiempo estándar.';
  }
  return { key: 'standardTime', label: 'Tiempo estándar', status: s, detail };
}

function avlCriterion(coverage: number | null | undefined): ReadinessCriterion {
  const status = thresholdStatus(coverage, AVL_COVERAGE_OK);
  const detail =
    coverage == null
      ? 'Sin BOM/partes para evaluar fuentes aprobadas (AVL).'
      : `Cobertura AVL ${pct(coverage)} (min ${pct(AVL_COVERAGE_OK)}).`;
  return { key: 'avl', label: 'Fuentes aprobadas (AVL)', status, detail };
}

/**
 * Fold the raw signals into the advisory readiness report. Five criteria, one
 * per signal group: bom, fai, line (balance + completeness), standardTime, avl.
 */
export function evaluateReadiness(signals: ReadinessSignals): ReadinessReport {
  const criteria: ReadinessCriterion[] = [
    bomCriterion(signals.bomStatus),
    faiCriterion(signals.faiStatus),
    lineCriterion(signals),
    stdTimeCriterion(signals.stdTimeComplete),
    avlCriterion(signals.avlCoverage),
  ];

  const readyCount = criteria.filter((c) => c.status === 'READY').length;
  const notReadyCount = criteria.filter((c) => c.status === 'NOT_READY').length;
  const unknownCount = criteria.filter((c) => c.status === 'UNKNOWN').length;

  return {
    criteria,
    gateReady: readyCount === criteria.length,
    readyCount,
    notReadyCount,
    unknownCount,
    blockers: criteria
      .filter((c) => c.status === 'NOT_READY')
      .map((c) => c.key),
    unknowns: criteria.filter((c) => c.status === 'UNKNOWN').map((c) => c.key),
  };
}
