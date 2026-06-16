/**
 * OEE — pure, side-effect-free math (Block H). The single source of the OEE
 * formula so the service, the control-tower feed and the tests all agree.
 *
 *   Availability = Run Time / Planned Time     (Run Time = Planned − Downtime)
 *   Performance  = Ideal Run Time / Run Time   (Ideal = ideal cycle × pieces)
 *   Quality      = Good Pieces / Total Pieces
 *   OEE          = Availability × Performance × Quality
 *
 * Every factor is clamped to [0, 1] (a line running faster than its ideal cycle,
 * or with more downtime than planned time, never produces a >100% / negative
 * factor). All inputs are coerced defensively so a missing/garbage value degrades
 * to 0 instead of NaN.
 */

/** Categorised downtime reasons (shared with the downtime entity / DTO). */
export const DOWNTIME_REASONS = [
  'EQUIPMENT',
  'MATERIAL',
  'QUALITY',
  'CHANGEOVER',
  'NO_OPERATOR',
  'OTHER',
] as const;
export type DowntimeReason = (typeof DOWNTIME_REASONS)[number];

export interface OeeInput {
  /** Scheduled production time for the window, in minutes (shift − planned stops). */
  plannedTimeMin: number;
  /** Unplanned stops + changeover, in minutes. */
  downtimeMin: number;
  /** Ideal cycle time per piece, in seconds (the WO takt). */
  idealCycleSec: number;
  /** Total pieces produced (good + bad). */
  totalPieces: number;
  /** Good pieces (total − scrap/reject). Clamped into [0, totalPieces]. */
  goodPieces: number;
}

export interface OeeBreakdown {
  availability: number; // 0..1
  performance: number; // 0..1
  quality: number; // 0..1
  oee: number; // 0..1
  runTimeMin: number;
  idealRunTimeMin: number;
  plannedTimeMin: number;
  downtimeMin: number;
  totalPieces: number;
  goodPieces: number;
}

function num(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

/** Clamp a ratio into [0, 1]; NaN/negative → 0, +∞ → 1. */
export function clamp01(n: number): number {
  if (Number.isNaN(n) || n <= 0) return 0;
  return n > 1 ? 1 : n;
}

function round(n: number, dp = 4): number {
  const f = Math.pow(10, dp);
  return Math.round((Number(n) || 0) * f) / f;
}

export function computeOee(input: OeeInput): OeeBreakdown {
  const plannedTimeMin = Math.max(0, num(input.plannedTimeMin));
  const downtimeMin = Math.max(0, num(input.downtimeMin));
  const idealCycleSec = Math.max(0, num(input.idealCycleSec));
  const totalPieces = Math.max(0, num(input.totalPieces));
  const goodPieces = Math.min(Math.max(0, num(input.goodPieces)), totalPieces);

  const runTimeMin = Math.max(0, plannedTimeMin - downtimeMin);
  const idealRunTimeMin = (idealCycleSec * totalPieces) / 60;

  const availability =
    plannedTimeMin > 0 ? clamp01(runTimeMin / plannedTimeMin) : 0;
  const performance =
    runTimeMin > 0 ? clamp01(idealRunTimeMin / runTimeMin) : 0;
  // No production → no quality signal; report 0 (OEE is 0 anyway via performance).
  const quality = totalPieces > 0 ? clamp01(goodPieces / totalPieces) : 0;
  const oee = availability * performance * quality;

  return {
    availability: round(availability),
    performance: round(performance),
    quality: round(quality),
    oee: round(oee),
    runTimeMin: round(runTimeMin, 2),
    idealRunTimeMin: round(idealRunTimeMin, 2),
    plannedTimeMin: round(plannedTimeMin, 2),
    downtimeMin: round(downtimeMin, 2),
    totalPieces: round(totalPieces, 2),
    goodPieces: round(goodPieces, 2),
  };
}

/**
 * Pieces-weighted average ideal cycle (sec) across a mix of work orders, so a
 * line running several models still satisfies `idealCycleSec × totalPieces =
 * Σ(takt_i × pieces_i)` and the single OEE formula above holds at line level.
 */
export function weightedIdealCycleSec(
  parts: { taktSec: number; pieces: number }[],
): number {
  let idealRunSec = 0;
  let pieces = 0;
  for (const p of parts) {
    const t = Math.max(0, num(p.taktSec));
    const q = Math.max(0, num(p.pieces));
    idealRunSec += t * q;
    pieces += q;
  }
  return pieces > 0 ? idealRunSec / pieces : 0;
}
