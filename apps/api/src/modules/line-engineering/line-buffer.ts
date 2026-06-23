/**
 * Pure, side-effect-free WIP / decoupling-buffer planning for a line (Fase 33).
 *
 * Between two consecutive stations a little inventory "decouples" them: when one
 * stops, the buffer lets its neighbour keep working instead of immediately
 * starving (downstream) or blocking (upstream). This module sizes those buffers
 * from the routing's cycle times and the takt, reports the total decoupling WIP
 * and — via Little's law — the lead time that inventory adds, so the planner
 * sees the classic inventory-vs-throughput trade-off.
 *
 * The model is the transparent "coverage time" heuristic: a buffer should ride
 * through a stoppage of `coverageSec` at the line cadence, scaled by how tight
 * (close to cadence) the slower of the two stations runs — a near-takt station
 * recovers slowly and needs the full buffer, a fast one catches up and needs
 * less. Kept pure so the rules can be unit-tested without a database or canvas.
 */

export interface BufferStation {
  station: string;
  sequence: number;
  cycleTimeSec: number;
}

export interface BufferGap {
  fromStation: string;
  toStation: string;
  /** Recommended decoupling inventory between the two stations, in units. */
  recommendedUnits: number;
  /** How close the tighter (slower) station runs to the cadence, 0..100. */
  tightnessPct: number;
  /** True when the gap feeds or follows the bottleneck (protect it first). */
  critical: boolean;
}

export interface BufferPlan {
  /** The cadence used to size buffers: the takt, or the bottleneck cycle when
   * no takt is given. */
  cadenceSec: number;
  taktSec: number;
  coverageSec: number;
  bottleneckStation: string | null;
  gaps: BufferGap[];
  /** Sum of recommended units across all gaps — the total decoupling WIP. */
  totalWipUnits: number;
  /** Lead time that WIP adds at cadence (Little's law: WIP × cadence). */
  addedLeadTimeSec: number;
  criticalGaps: number;
}

function round(n: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.round((Number(n) || 0) * f) / f;
}

export interface BufferOptions {
  /** Target cadence; when ≤ 0 the bottleneck cycle time is used instead. */
  taktSec?: number;
  /** Stoppage duration each buffer should ride through, in seconds. */
  coverageSec?: number;
}

export function bufferPlan(
  stations: BufferStation[],
  opts: BufferOptions = {},
): BufferPlan {
  const route = (stations ?? [])
    .map((s) => ({
      station: s.station,
      sequence: Number(s.sequence) || 0,
      cycle: Math.max(0, Number(s.cycleTimeSec) || 0),
    }))
    .sort((a, b) => a.sequence - b.sequence);

  const takt = Math.max(0, Number(opts.taktSec) || 0);
  const coverageSec = Math.max(0, Number(opts.coverageSec ?? 120) || 0);

  const cycles = route.map((s) => s.cycle).filter((c) => c > 0);
  const bottleneckCycle = cycles.length ? Math.max(...cycles) : 0;
  const bottleneck =
    route.find((s) => s.cycle === bottleneckCycle && bottleneckCycle > 0) ??
    null;
  const cadence = takt > 0 ? takt : bottleneckCycle;

  // No cadence (no cycle times, no takt) or fewer than two stations → nothing
  // to decouple.
  if (cadence <= 0 || route.length < 2) {
    return {
      cadenceSec: round(cadence),
      taktSec: round(takt),
      coverageSec: round(coverageSec),
      bottleneckStation: bottleneck?.station ?? null,
      gaps: [],
      totalWipUnits: 0,
      addedLeadTimeSec: 0,
      criticalGaps: 0,
    };
  }

  const baseUnits = coverageSec / cadence; // units over the coverage window
  const gaps: BufferGap[] = [];
  for (let i = 0; i < route.length - 1; i += 1) {
    const a = route[i];
    const b = route[i + 1];
    const slower = Math.max(a.cycle, b.cycle);
    const tightness = Math.min(1, cadence > 0 ? slower / cadence : 0);
    const recommendedUnits = Math.max(1, Math.ceil(baseUnits * tightness));
    const critical =
      bottleneck !== null &&
      (a.station === bottleneck.station || b.station === bottleneck.station);
    gaps.push({
      fromStation: a.station,
      toStation: b.station,
      recommendedUnits,
      tightnessPct: round(tightness * 100, 1),
      critical,
    });
  }

  const totalWipUnits = gaps.reduce((s, g) => s + g.recommendedUnits, 0);
  return {
    cadenceSec: round(cadence),
    taktSec: round(takt),
    coverageSec: round(coverageSec),
    bottleneckStation: bottleneck?.station ?? null,
    gaps,
    totalWipUnits,
    addedLeadTimeSec: round(totalWipUnits * cadence),
    criticalGaps: gaps.filter((g) => g.critical).length,
  };
}
