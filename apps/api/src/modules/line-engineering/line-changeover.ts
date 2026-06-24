/**
 * Pure, side-effect-free model-changeover (SMED) estimate for a line (Fase 41).
 *
 * Building on the flex-line analysis (Fase 40), this estimates the effort to
 * switch a shared line from one model to another: stations that must be set up
 * (the next model uses, this one didn't), torn down (this model used, the next
 * won't), and retooled (a shared station whose expected part changes). It does
 * this for every ordered pair of models on the line and returns the changeover
 * MATRIX — the input a planner needs to sequence models so total changeover is
 * minimized (the layout side of Heijunka / level scheduling).
 *
 * Kept pure so the set diff + cost roll-up can be unit-tested without a DB.
 */

export interface ChangeoverStation {
  station: string;
  /** Expected part at the station for this model; a change here is a retool. */
  np: string | null;
}

export interface ChangeoverModel {
  label: string;
  stations: ChangeoverStation[];
}

export interface ChangeoverPair {
  from: string;
  to: string;
  added: number;
  removed: number;
  retooled: number;
  unchanged: number;
  changeoverSec: number;
}

export interface ChangeoverResult {
  labels: string[];
  pairs: ChangeoverPair[];
  /** matrix[i][j] = changeover seconds going from model i to model j (0 on the
   * diagonal). */
  matrix: number[][];
  worstSec: number;
  /** Smallest non-zero changeover — the cheapest model-to-model switch. */
  bestSec: number;
  setupSec: number;
  teardownSec: number;
  retoolSec: number;
}

export interface ChangeoverOptions {
  /** Seconds to set up a station the next model adds. */
  setupSec?: number;
  /** Seconds to tear down a station the next model drops. */
  teardownSec?: number;
  /** Seconds to retool a shared station whose expected part changes. */
  retoolSec?: number;
}

function round(n: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.round((Number(n) || 0) * f) / f;
}

function pos(n: unknown, fallback: number): number {
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

export function changeoverMatrix(
  models: ChangeoverModel[],
  opts: ChangeoverOptions = {},
): ChangeoverResult {
  const valid = (models ?? []).filter((m) => m && m.label);
  const setupSec = pos(opts.setupSec, 300);
  const teardownSec = pos(opts.teardownSec, 120);
  const retoolSec = pos(opts.retoolSec, 180);

  const labels = valid.map((m) => m.label);
  // station → np map per model (last np wins if a station repeats).
  const maps = valid.map((m) => {
    const map = new Map<string, string | null>();
    for (const s of m.stations ?? []) map.set(s.station, s.np ?? null);
    return map;
  });

  const n = valid.length;
  const matrix: number[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => 0),
  );
  const pairs: ChangeoverPair[] = [];

  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      if (i === j) continue;
      const a = maps[i];
      const b = maps[j];
      let added = 0;
      let removed = 0;
      let retooled = 0;
      let unchanged = 0;
      // Stations the target needs: new (set up) or shared (retool / unchanged).
      for (const [station, bnp] of b) {
        if (!a.has(station)) {
          added += 1;
        } else if ((a.get(station) ?? null) !== (bnp ?? null)) {
          retooled += 1;
        } else {
          unchanged += 1;
        }
      }
      // Stations only the source had → torn down.
      for (const station of a.keys()) {
        if (!b.has(station)) removed += 1;
      }
      const changeoverSec = round(
        added * setupSec + removed * teardownSec + retooled * retoolSec,
      );
      matrix[i][j] = changeoverSec;
      pairs.push({
        from: labels[i],
        to: labels[j],
        added,
        removed,
        retooled,
        unchanged,
        changeoverSec,
      });
    }
  }

  const offDiag = pairs.map((p) => p.changeoverSec);
  const worstSec = offDiag.length ? Math.max(...offDiag) : 0;
  const nonZero = offDiag.filter((v) => v > 0);
  const bestSec = nonZero.length ? Math.min(...nonZero) : 0;

  return {
    labels,
    pairs,
    matrix,
    worstSec,
    bestSec,
    setupSec: round(setupSec),
    teardownSec: round(teardownSec),
    retoolSec: round(retoolSec),
  };
}
