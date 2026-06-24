/**
 * Pure, side-effect-free layout-review consolidation for the dossier (Fase 49).
 *
 * The module computes a dozen layout analyses in isolation and the dossier
 * (Fase 39) already packages report + manning + cost + station table. This adds
 * the missing piece: a single review summary that rolls the health scorecard and
 * the spatial analyses (circulation, continuity, cohesion, density) into one
 * headline grade, a flat index table, and a de-duplicated, ordered "punch-list"
 * of findings — the actionable list a reviewer signs off against. Situational
 * checks are skipped when they don't apply (no connectors → no continuity
 * findings; a single line → no cohesion findings), so the list stays honest.
 *
 * Kept pure so the ordering/de-duplication can be unit-tested without a DB.
 */

export interface ReviewInput {
  score: number;
  grade: string;
  /** Hard blockers from the scorecard (overlaps, off-plan, nothing placed). */
  blockers: string[];
  readinessPct: number;
  balancePct: number | null;
  circulation: { clearancePct: number; tightPairs: number } | null;
  continuity: { continuityPct: number; issues: string[]; hasFlow: boolean } | null;
  cohesion: { cohesionPct: number; issues: string[]; multiLine: boolean } | null;
  density: { utilizationPct: number; issues: string[] } | null;
}

export interface LayoutReviewSummary {
  score: number;
  grade: string;
  /** Grade A or B — releasable on the headline (blockers already cap to C). */
  releasable: boolean;
  indices: {
    readinessPct: number;
    balancePct: number | null;
    circulationPct: number | null;
    continuityPct: number | null;
    cohesionPct: number | null;
    utilizationPct: number | null;
  };
  /** De-duplicated, ordered punch-list across every analysis. */
  findings: string[];
}

/** Roll the scorecard + spatial analyses into one review summary (pure). */
export function consolidateReview(input: ReviewInput): LayoutReviewSummary {
  const findings: string[] = [];
  const seen = new Set<string>();
  const add = (msg: string) => {
    const m = (msg ?? '').trim();
    if (m && !seen.has(m)) {
      seen.add(m);
      findings.push(m);
    }
  };

  // Hard blockers first — these gate the release.
  for (const b of input.blockers ?? []) add(b);

  // Circulation: tight aisles (overlaps already surface as scorecard blockers).
  if (input.circulation && input.circulation.tightPairs > 0) {
    add(`${input.circulation.tightPairs} par(es) de objetos demasiado juntos`);
  }
  // Flow continuity — only when there is a flow to judge.
  if (input.continuity && input.continuity.hasFlow) {
    for (const i of input.continuity.issues ?? []) add(i);
  }
  // Line cohesion — only meaningful with more than one line.
  if (input.cohesion && input.cohesion.multiLine) {
    for (const i of input.cohesion.issues ?? []) add(i);
  }
  // Floor occupancy — skip the "nothing placed" note (the readiness blocker covers it).
  if (input.density) {
    for (const i of input.density.issues ?? []) {
      if (i !== 'No hay nada colocado que evaluar') add(i);
    }
  }

  return {
    score: input.score,
    grade: input.grade,
    releasable: input.grade === 'A' || input.grade === 'B',
    indices: {
      readinessPct: input.readinessPct,
      balancePct: input.balancePct,
      circulationPct: input.circulation ? input.circulation.clearancePct : null,
      continuityPct: input.continuity && input.continuity.hasFlow ? input.continuity.continuityPct : null,
      cohesionPct: input.cohesion && input.cohesion.multiLine ? input.cohesion.cohesionPct : null,
      utilizationPct: input.density ? input.density.utilizationPct : null,
    },
    findings,
  };
}
