/**
 * HR / Capital Humano — pure workforce-analytics math.
 *
 * Self-contained, dependency-free functions that turn raw people data into the
 * decisions an HR analyst / generalist makes in an EMS (contract manufacturing)
 * plant: turnover, early attrition, absenteeism, tenure, span of control, the
 * 9-box talent grid, flight-risk and the cross-domain STAFFING-RISK score that
 * feeds the "Palantir-style" decision layer.
 *
 * Everything here is pure (no DB, no Date.now side effects unless passed in) so
 * it is unit-tested in isolation — the service just composes these over rows.
 */

export type LaborType = 'DIRECT' | 'INDIRECT';
export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type PotentialRating = 'LOW' | 'MED' | 'HIGH';

export const DAY_MS = 86_400_000;

export function round(value: number, digits = 1): number {
  const p = Math.pow(10, digits);
  return Math.round((value + Number.EPSILON) * p) / p;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function mean(values: number[]): number {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

export function daysBetween(from: Date | string | null, to: Date | string | null): number | null {
  if (!from || !to) return null;
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / DAY_MS));
}

/** Tenure in whole years (decimal) from hireDate to a reference date. */
export function tenureYears(hireDate: Date | string | null, asOf: Date): number {
  const d = daysBetween(hireDate, asOf);
  return d === null ? 0 : round(d / 365, 2);
}

export type TenureBand = '<3m' | '3-12m' | '1-3y' | '3-5y' | '5y+';

export function tenureBand(years: number): TenureBand {
  if (years < 0.25) return '<3m';
  if (years < 1) return '3-12m';
  if (years < 3) return '1-3y';
  if (years < 5) return '3-5y';
  return '5y+';
}

/**
 * Annualized turnover %, the headline HR metric.
 *   (separations / average headcount) projected to a full year.
 * windowDays lets a 90-day or 30-day window be annualized consistently.
 */
export function annualizedTurnover(separations: number, avgHeadcount: number, windowDays: number): number {
  if (avgHeadcount <= 0 || windowDays <= 0) return 0;
  return round((separations / avgHeadcount) * (365 / windowDays) * 100, 1);
}

/**
 * Early attrition % — share of new hires that leave within `earlyDays` (90 by
 * default). In EMS this is THE number: it exposes bad selection/onboarding and
 * is the most expensive churn (you pay to hire + train, get nothing back).
 */
export function earlyAttritionRate(earlySeparations: number, hires: number): number {
  if (hires <= 0) return 0;
  return round((earlySeparations / hires) * 100, 1);
}

/** Absenteeism % = lost hours / scheduled hours over the window. */
export function absenteeismRate(lostHours: number, scheduledHours: number): number {
  if (scheduledHours <= 0) return 0;
  return round((lostHours / scheduledHours) * 100, 1);
}

/** Direct : indirect headcount ratio (e.g. 6.0 means 6 direct per indirect). */
export function directIndirectRatio(direct: number, indirect: number): number {
  if (indirect <= 0) return direct > 0 ? direct : 0;
  return round(direct / indirect, 2);
}

export function spanOfControl(reports: number, managers: number): number {
  if (managers <= 0) return 0;
  return round(reports / managers, 1);
}

export function timeToFillDays(openedDate: Date | string | null, filledDate: Date | string | null): number | null {
  return daysBetween(openedDate, filledDate);
}

// ── 9-box talent grid ────────────────────────────────────────────────────────

export interface NineBoxCell {
  /** 1..9 — row-major from low/low (1) to high/high (9). */
  index: number;
  performanceBand: PotentialRating; // reuse LOW/MED/HIGH
  potentialBand: PotentialRating;
  key: string;
  label: string;
  action: string;
}

/** Maps a 1..5 performance score to a LOW/MED/HIGH band. */
export function performanceBand(score: number): PotentialRating {
  if (score >= 4) return 'HIGH';
  if (score >= 3) return 'MED';
  return 'LOW';
}

const BAND_ORDER: Record<PotentialRating, number> = { LOW: 0, MED: 1, HIGH: 2 };

const NINE_BOX: Record<string, { key: string; label: string; action: string }> = {
  'HIGH|HIGH': { key: 'STAR', label: 'Estrella', action: 'Retener y acelerar — plan de sucesión' },
  'HIGH|MED': { key: 'HIGH_IMPACT', label: 'Alto impacto', action: 'Estirar con proyectos / rotación' },
  'HIGH|LOW': { key: 'EXPERT', label: 'Especialista experto', action: 'Retener; reconocer maestría técnica' },
  'MED|HIGH': { key: 'EMERGING', label: 'Alto potencial', action: 'Desarrollar — candidato a promoción' },
  'MED|MED': { key: 'CORE', label: 'Colaborador clave', action: 'Mantener motivado; columna vertebral' },
  'MED|LOW': { key: 'SOLID', label: 'Sólido', action: 'Mejora continua en el rol' },
  'LOW|HIGH': { key: 'ENIGMA', label: 'Enigma', action: 'Diagnosticar bloqueo — coaching' },
  'LOW|MED': { key: 'DEVELOP', label: 'En desarrollo', action: 'Plan de mejora con metas claras' },
  'LOW|LOW': { key: 'RISK', label: 'Riesgo', action: 'PIP / decisión — acción requerida' },
};

export function nineBoxCell(performanceScore: number, potential: PotentialRating): NineBoxCell {
  const perf = performanceBand(performanceScore);
  const meta = NINE_BOX[`${perf}|${potential}`];
  const index = BAND_ORDER[perf] * 3 + BAND_ORDER[potential] + 1;
  return { index, performanceBand: perf, potentialBand: potential, ...meta };
}

// ── Flight-risk (attrition propensity, per employee) ─────────────────────────

export interface FlightRiskInput {
  tenureYearsValue: number;
  absences90d: number; // count of absence events in last 90 days
  lateCount90d: number;
  engagementScore: number | null; // 0..100, null = unknown
  hadRecentReview: boolean;
  laborType: LaborType;
}

export interface FlightRisk {
  score: number; // 0..100
  band: RiskBand;
  drivers: string[];
}

/**
 * Heuristic flight-risk: short tenure + rising absenteeism + low engagement +
 * no recent recognition raise the score. Direct labor (line operators) churns
 * faster, so it carries a small base premium. Transparent + tunable on purpose:
 * the goal is an explainable signal an HR analyst can defend, not a black box.
 */
export function flightRiskScore(input: FlightRiskInput): FlightRisk {
  const drivers: string[] = [];
  let score = input.laborType === 'DIRECT' ? 14 : 8;

  if (input.tenureYearsValue < 0.25) {
    score += 28;
    drivers.push('Antigüedad < 3 meses');
  } else if (input.tenureYearsValue < 1) {
    score += 16;
    drivers.push('Antigüedad < 1 año');
  } else if (input.tenureYearsValue > 8) {
    score += 6;
    drivers.push('Posible meseta de carrera');
  }

  const tardiness = input.absences90d * 9 + input.lateCount90d * 4;
  if (tardiness > 0) {
    score += Math.min(34, tardiness);
    if (input.absences90d >= 2) drivers.push(`${input.absences90d} ausencias en 90d`);
    if (input.lateCount90d >= 3) drivers.push(`${input.lateCount90d} retardos en 90d`);
  }

  if (input.engagementScore !== null) {
    if (input.engagementScore < 50) {
      score += 22;
      drivers.push('Engagement bajo');
    } else if (input.engagementScore < 70) {
      score += 10;
    } else if (input.engagementScore >= 85) {
      score -= 8;
    }
  }

  if (!input.hadRecentReview) {
    score += 6;
    drivers.push('Sin evaluación reciente');
  }

  const bounded = clamp(Math.round(score), 0, 100);
  return { score: bounded, band: riskBand(bounded), drivers };
}

// ── Staffing-risk (cross-domain: HR → production readiness) ───────────────────

export interface StaffingRiskInput {
  headcount: number; // current active in the cell (area/shift/line)
  openOpenings: number; // unfilled requisition openings for the cell
  attritionRatePct: number; // annualized turnover for the cell
  absenteeismRatePct: number; // recent absenteeism for the cell
  skillCoveragePct: number; // % of stations/skills with a certified operator (0..100)
}

export interface StaffingRisk {
  score: number; // 0..100 (higher = more at risk of starving the line)
  band: RiskBand;
  gapPct: number; // open openings as % of (headcount + openings)
  recommendation: string;
  drivers: string[];
}

/**
 * STAFFING-RISK is the bridge from HR data to operational decisions: "will this
 * area/shift/line have the certified people to run the build plan?" It fuses the
 * vacancy gap, turnover momentum, absenteeism and skill coverage into one score
 * + a recommendation. This is the signal the Decision-Intelligence layer crosses
 * with demand to flag programs at risk because of PEOPLE, not material.
 */
export function staffingRiskScore(input: StaffingRiskInput): StaffingRisk {
  const denom = input.headcount + input.openOpenings;
  const gapPct = denom > 0 ? round((input.openOpenings / denom) * 100, 1) : 0;
  const drivers: string[] = [];

  let score = 0;
  score += Math.min(40, gapPct * 1.4);
  if (gapPct >= 10) drivers.push(`Brecha de plantilla ${gapPct}%`);

  score += Math.min(28, input.attritionRatePct * 0.5);
  if (input.attritionRatePct >= 25) drivers.push(`Rotación ${round(input.attritionRatePct)}%`);

  score += Math.min(18, input.absenteeismRatePct * 2.2);
  if (input.absenteeismRatePct >= 5) drivers.push(`Ausentismo ${round(input.absenteeismRatePct)}%`);

  const coverageGap = clamp(100 - input.skillCoveragePct, 0, 100);
  score += Math.min(24, coverageGap * 0.3);
  if (input.skillCoveragePct < 80 && input.skillCoveragePct > 0) {
    drivers.push(`Cobertura de skills ${round(input.skillCoveragePct)}%`);
  }

  const bounded = clamp(Math.round(score), 0, 100);
  const band = riskBand(bounded);
  return {
    score: bounded,
    band,
    gapPct,
    drivers,
    recommendation: staffingRecommendation(band, gapPct, input.attritionRatePct),
  };
}

function staffingRecommendation(band: RiskBand, gapPct: number, attrition: number): string {
  if (band === 'CRITICAL') return 'Acción inmediata: acelerar contratación y plan de retención';
  if (band === 'HIGH') {
    return gapPct >= attrition
      ? 'Priorizar vacantes abiertas y cross-training'
      : 'Lanzar retención: rotación por encima de lo sano';
  }
  if (band === 'MEDIUM') return 'Monitorear; preparar pipeline de candidatos';
  return 'Estable';
}

export function riskBand(score: number): RiskBand {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}
