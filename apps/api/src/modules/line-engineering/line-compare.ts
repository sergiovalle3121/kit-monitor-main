/**
 * Pure, side-effect-free scenario comparison for two layouts (Fase 37).
 *
 * The snapshot diff (Fase 17) compares geometry — what moved, was added or
 * removed. This compares the *analytics*: two candidate layouts (two revisions,
 * or two models on the same line) head to head across readiness, balance, floor
 * use, manning, cost and flow, scoring each KPI for whichever side wins and
 * returning an overall verdict. It is the capstone that makes the whole metric
 * suite actionable — "which layout is better, and on what?".
 *
 * Kept pure so the scoring can be unit-tested without a database or a canvas.
 */

export interface LayoutKpis {
  model: string;
  revision: string;
  stations: number;
  placed: number;
  readinessPct: number;
  utilizationPct: number;
  assetCount: number;
  flowDistance: number;
  crossings: number;
  overlaps: number;
  outOfBounds: number;
  balancePct: number | null;
  bottleneckStation: string | null;
  lineCycleTimeSec: number | null;
  operators: number | null;
  costPerUnit: number | null;
}

export interface KpiDelta {
  key: string;
  label: string;
  a: number | null;
  b: number | null;
  /** b − a, or null when either side is missing. */
  delta: number | null;
  lowerIsBetter: boolean;
  betterSide: 'a' | 'b' | 'tie' | 'na';
}

export interface LayoutComparison {
  a: LayoutKpis;
  b: LayoutKpis;
  deltas: KpiDelta[];
  scoreA: number;
  scoreB: number;
  verdict: 'a' | 'b' | 'tie';
}

interface KpiSpec {
  key: keyof LayoutKpis;
  label: string;
  lowerIsBetter: boolean;
}

/** The KPIs compared, in display order, with their "good" direction. */
const KPI_SPECS: KpiSpec[] = [
  { key: 'readinessPct', label: 'Readiness', lowerIsBetter: false },
  { key: 'balancePct', label: 'Balance', lowerIsBetter: false },
  { key: 'utilizationPct', label: 'Uso de piso', lowerIsBetter: false },
  { key: 'operators', label: 'Operadores', lowerIsBetter: true },
  { key: 'costPerUnit', label: 'Costo/unidad', lowerIsBetter: true },
  { key: 'lineCycleTimeSec', label: 'Ciclo de línea', lowerIsBetter: true },
  { key: 'flowDistance', label: 'Distancia de flujo', lowerIsBetter: true },
  { key: 'crossings', label: 'Cruces de flujo', lowerIsBetter: true },
  { key: 'overlaps', label: 'Traslapes', lowerIsBetter: true },
  { key: 'outOfBounds', label: 'Fuera de límites', lowerIsBetter: true },
];

const EPS = 1e-6;

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function compareLayouts(a: LayoutKpis, b: LayoutKpis): LayoutComparison {
  let scoreA = 0;
  let scoreB = 0;

  const deltas: KpiDelta[] = KPI_SPECS.map((spec) => {
    const av = num(a[spec.key]);
    const bv = num(b[spec.key]);
    if (av === null || bv === null) {
      return {
        key: spec.key,
        label: spec.label,
        a: av,
        b: bv,
        delta: null,
        lowerIsBetter: spec.lowerIsBetter,
        betterSide: 'na' as const,
      };
    }
    const delta = bv - av;
    let betterSide: 'a' | 'b' | 'tie';
    if (Math.abs(delta) < EPS) {
      betterSide = 'tie';
    } else if (spec.lowerIsBetter) {
      betterSide = bv < av ? 'b' : 'a';
    } else {
      betterSide = bv > av ? 'b' : 'a';
    }
    if (betterSide === 'a') scoreA += 1;
    else if (betterSide === 'b') scoreB += 1;
    return {
      key: spec.key,
      label: spec.label,
      a: av,
      b: bv,
      delta,
      lowerIsBetter: spec.lowerIsBetter,
      betterSide,
    };
  });

  const verdict: 'a' | 'b' | 'tie' =
    scoreA > scoreB ? 'a' : scoreB > scoreA ? 'b' : 'tie';

  return { a, b, deltas, scoreA, scoreB, verdict };
}
