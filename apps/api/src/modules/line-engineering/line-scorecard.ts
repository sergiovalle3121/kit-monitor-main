/**
 * Pure, side-effect-free layout health scorecard (Fase 44).
 *
 * The module already computes many layout metrics in isolation — placement
 * readiness, line balance, flow direction, clearance. A reviewer still has to
 * stitch them into "is this layout good enough to release?". This rolls the
 * available dimensions into one weighted 0–100 index with a letter grade, the
 * weakest dimensions to fix first, and hard blockers (overlaps, off-plan
 * objects, nothing placed) that cap the grade no matter how good the rest is.
 *
 * Each dimension is optional: when a metric can't be computed (e.g. no routing
 * yet → no balance) it's dropped and the remaining weights are renormalised, so
 * the score always reflects what's actually known. Kept pure for unit testing.
 */

export interface ScorecardInput {
  /** % of stations placed on the plan (0..100). */
  readinessPct: number | null;
  /** Line balance (0..100). */
  balancePct: number | null;
  /** Flow-direction efficiency (0..100). */
  directionalEfficiencyPct: number | null;
  /** Clearance / circulation index (0..100). */
  circulationPct: number | null;
  /** Overlapping object pairs (hard issue). */
  overlaps: number;
  /** Objects spilling past the footprint (hard issue). */
  outOfBounds: number;
}

export interface ScorecardDimension {
  key: string;
  label: string;
  score: number; // 0..100
  weight: number; // normalised share, 0..1
}

export type ScorecardGrade = 'A' | 'B' | 'C' | 'D';

export interface Scorecard {
  score: number; // 0..100 weighted over available dimensions
  grade: ScorecardGrade;
  dimensions: ScorecardDimension[];
  /** Up to two lowest-scoring dimensions, worst first. */
  weakest: { key: string; label: string; score: number }[];
  /** Hard issues that cap the grade at C until resolved. */
  blockers: string[];
  /** True when there is at least one dimension to score. */
  scored: boolean;
}

interface DimDef { key: string; label: string; weight: number; value: number | null }

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const round = (n: number, dp = 0): number => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

function gradeFor(score: number): ScorecardGrade {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  return 'D';
}

/** Roll the available layout metrics into a single graded readiness scorecard. */
export function computeScorecard(input: ScorecardInput): Scorecard {
  const defs: DimDef[] = [
    { key: 'readiness', label: 'Colocación', weight: 0.25, value: input.readinessPct },
    { key: 'balance', label: 'Balanceo', weight: 0.3, value: input.balancePct },
    { key: 'flow', label: 'Dirección de flujo', weight: 0.2, value: input.directionalEfficiencyPct },
    { key: 'circulation', label: 'Circulación', weight: 0.25, value: input.circulationPct },
  ];
  const available = defs.filter((d) => d.value !== null && Number.isFinite(d.value as number));
  const totalW = available.reduce((acc, d) => acc + d.weight, 0) || 1;

  const dimensions: ScorecardDimension[] = available.map((d) => ({
    key: d.key,
    label: d.label,
    score: round(clamp(d.value as number), 1),
    weight: round(d.weight / totalW, 3),
  }));

  let score = round(dimensions.reduce((acc, d) => acc + d.score * d.weight, 0), 1);

  const blockers: string[] = [];
  if ((input.overlaps || 0) > 0) blockers.push(`${input.overlaps} traslape(s)`);
  if ((input.outOfBounds || 0) > 0) blockers.push(`${input.outOfBounds} objeto(s) fuera del plano`);
  if (input.readinessPct !== null && input.readinessPct <= 0) blockers.push('Ninguna estación colocada');

  // A blocker means "not releasable" — cap the headline grade at C.
  let grade = gradeFor(score);
  if (blockers.length && (grade === 'A' || grade === 'B')) grade = 'C';

  const weakest = [...dimensions]
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .map((d) => ({ key: d.key, label: d.label, score: d.score }));

  if (!dimensions.length) score = 0;

  return { score, grade, dimensions, weakest, blockers, scored: dimensions.length > 0 };
}
