/**
 * Pure, side-effect-free spatial line-cohesion analysis for the 2D layout (Fase 46).
 *
 * A plant layout usually hosts several logical production lines at once. A good
 * arrangement keeps each line's stations grouped in their own contiguous region;
 * a bad one scatters a line across the floor or interleaves two lines, which
 * tangles material flow and confuses operators. No other analysis looks at the
 * `line` grouping spatially — this one does:
 *
 *  - per line, how tightly its stations pack (footprint area vs the area of the
 *    bounding box that encloses them — the "fill"),
 *  - "intruders": a station sitting inside a DIFFERENT line's region,
 *  - line regions that overlap each other,
 *  - a single cohesion index 0..100.
 *
 * Kept pure so the rules can be unit-tested without a database or a canvas.
 */

export interface CohesionStation {
  id: string;
  station: string; // human label
  line: string;
  /** Footprint centre, in layout units. */
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export interface CohesionInput {
  stations: CohesionStation[];
}

export interface CohesionGroup {
  line: string;
  stationCount: number;
  /** Footprint area / bounding-box area, 0..100 — how tightly the line packs. */
  fillPct: number;
  bboxW: number;
  bboxH: number;
  cx: number; // region centroid
  cy: number;
}

export interface CohesionIntruder {
  id: string;
  station: string;
  line: string;
  insideLine: string;
}

export interface CohesionResult {
  placedCount: number;
  lineCount: number;
  /** One entry per line, most scattered (lowest fill) first. */
  groups: CohesionGroup[];
  /** Stations whose centre falls inside another line's region. */
  intruders: CohesionIntruder[];
  /** Count of line-region pairs that overlap in 2D. */
  overlapPairs: number;
  /** Headline index: 100 * (1 - intruders / placed). */
  cohesionPct: number;
  /** True when every line keeps to its own region (no intruders). */
  cohesive: boolean;
  /** The least-compact line, or null when nothing is placed. */
  mostScattered: { line: string; fillPct: number } | null;
  issues: string[];
}

interface Box { minX: number; minY: number; maxX: number; maxY: number }

function round(n: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round((Number(n) || 0) * f) / f;
}

const overlaps = (a: Box, b: Box): boolean =>
  a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;

const contains = (b: Box, x: number, y: number): boolean =>
  x > b.minX && x < b.maxX && y > b.minY && y < b.maxY;

/** Analyse how well each logical line keeps to its own region of the floor. */
export function computeCohesion(input: CohesionInput): CohesionResult {
  const stations = (input.stations ?? []).filter(
    (s) => Number.isFinite(s.cx) && Number.isFinite(s.cy) && s.w > 0 && s.h > 0,
  );
  const placedCount = stations.length;

  // Group stations by line, in first-seen order.
  const order: string[] = [];
  const byLine = new Map<string, CohesionStation[]>();
  for (const s of stations) {
    if (!byLine.has(s.line)) {
      byLine.set(s.line, []);
      order.push(s.line);
    }
    byLine.get(s.line)!.push(s);
  }

  const boxes = new Map<string, Box>();
  const groups: CohesionGroup[] = order.map((line) => {
    const items = byLine.get(line)!;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let footprintArea = 0;
    let sumX = 0;
    let sumY = 0;
    for (const s of items) {
      const x0 = s.cx - s.w / 2;
      const x1 = s.cx + s.w / 2;
      const y0 = s.cy - s.h / 2;
      const y1 = s.cy + s.h / 2;
      if (x0 < minX) minX = x0;
      if (y0 < minY) minY = y0;
      if (x1 > maxX) maxX = x1;
      if (y1 > maxY) maxY = y1;
      footprintArea += s.w * s.h;
      sumX += s.cx;
      sumY += s.cy;
    }
    boxes.set(line, { minX, minY, maxX, maxY });
    const bboxW = maxX - minX;
    const bboxH = maxY - minY;
    const bboxArea = bboxW * bboxH;
    const fillPct = bboxArea > 0 ? round(Math.min(100, (100 * footprintArea) / bboxArea)) : 100;
    return {
      line,
      stationCount: items.length,
      fillPct,
      bboxW: round(bboxW),
      bboxH: round(bboxH),
      cx: round(sumX / items.length),
      cy: round(sumY / items.length),
    };
  });

  // Intruders: a station whose centre lies inside a different line's region.
  const intruders: CohesionIntruder[] = [];
  for (const s of stations) {
    for (const line of order) {
      if (line === s.line) continue;
      if (contains(boxes.get(line)!, s.cx, s.cy)) {
        intruders.push({ id: s.id, station: s.station, line: s.line, insideLine: line });
        break; // count a station once even if it falls inside several regions
      }
    }
  }

  // Overlapping line regions (unordered pairs).
  let overlapPairs = 0;
  for (let i = 0; i < order.length; i++) {
    for (let j = i + 1; j < order.length; j++) {
      if (overlaps(boxes.get(order[i])!, boxes.get(order[j])!)) overlapPairs++;
    }
  }

  const cohesionPct = placedCount > 0 ? round(100 * (1 - intruders.length / placedCount)) : 0;
  const cohesive = placedCount > 0 && intruders.length === 0;

  const sortedGroups = [...groups].sort((a, b) => a.fillPct - b.fillPct);
  const mostScattered = sortedGroups.length ? { line: sortedGroups[0].line, fillPct: sortedGroups[0].fillPct } : null;

  const issues: string[] = [];
  if (placedCount === 0) {
    issues.push('No hay estaciones colocadas que evaluar');
  } else {
    if (intruders.length) issues.push(`${intruders.length} estación(es) intercaladas en otra línea`);
    if (overlapPairs) issues.push(`${overlapPairs} par(es) de líneas con regiones traslapadas`);
    if (mostScattered && mostScattered.fillPct < 25 && order.length >= 1) {
      issues.push(`Línea ${mostScattered.line} muy dispersa (${mostScattered.fillPct}% de aprovechamiento)`);
    }
  }

  return {
    placedCount,
    lineCount: order.length,
    groups: sortedGroups,
    intruders,
    overlapPairs,
    cohesionPct,
    cohesive,
    mostScattered,
    issues,
  };
}
