/**
 * Pure, side-effect-free material-flow geometry for the 2D layout (Fase 10).
 *
 * Given placed stations (centers) and the flow connectors between them, this
 * builds the "spaghetti diagram" an industrial engineer uses to judge a layout:
 * how far material travels end to end, which hop is the longest, and how many
 * flow lines CROSS each other. Crossings are the tangle — fewer is better, and
 * a high count is the classic smell of a layout that needs rearranging.
 *
 * Kept pure so the rules can be unit-tested without a database or a canvas.
 */

export interface FlowNode {
  id: string;
  station: string;
  /** Center of the station footprint, in layout units. */
  x: number;
  y: number;
}

export interface FlowLink {
  from: string; // node id
  to: string; // node id
  kind?: string;
}

export interface FlowSegment {
  from: string;
  to: string;
  fromStation: string;
  toStation: string;
  distance: number;
  kind?: string;
}

export interface FlowAnalysis {
  totalDistance: number;
  segmentCount: number;
  longestSegment: FlowSegment | null;
  avgDistance: number;
  /** Links whose endpoints are not both placed — excluded from the geometry. */
  unplacedLinks: number;
  /** Pairs of flow segments that geometrically cross (the tangle). */
  crossings: number;
  segments: FlowSegment[];
}

function round(n: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.round((Number(n) || 0) * f) / f;
}

type Pt = { x: number; y: number };

function orient(a: Pt, b: Pt, c: Pt): number {
  const v = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(v) < 1e-9) return 0;
  return v > 0 ? 1 : -1;
}

/**
 * Proper segment intersection: true only when the segments cross at an interior
 * point. Segments that merely share a station endpoint (a normal junction) or
 * are collinear do NOT count — we only want genuine tangles.
 */
function segmentsCross(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const o1 = orient(p1, p2, p3);
  const o2 = orient(p1, p2, p4);
  const o3 = orient(p3, p4, p1);
  const o4 = orient(p3, p4, p2);
  if (o1 === 0 || o2 === 0 || o3 === 0 || o4 === 0) return false; // touching/collinear
  return o1 !== o2 && o3 !== o4;
}

export function flowAnalysis(
  nodes: FlowNode[],
  links: FlowLink[],
): FlowAnalysis {
  const byId = new Map((nodes ?? []).map((n) => [n.id, n]));
  const segments: FlowSegment[] = [];
  let unplacedLinks = 0;

  for (const l of links ?? []) {
    const a = byId.get(l.from);
    const b = byId.get(l.to);
    if (!a || !b) {
      unplacedLinks += 1;
      continue;
    }
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    segments.push({
      from: l.from,
      to: l.to,
      fromStation: a.station,
      toStation: b.station,
      distance: round(distance),
      kind: l.kind,
    });
  }

  const totalDistance = segments.reduce((s, x) => s + x.distance, 0);
  const longestSegment = segments.reduce<FlowSegment | null>(
    (best, x) => (!best || x.distance > best.distance ? x : best),
    null,
  );

  // Count crossing pairs. Two segments that share a node id can't cross at an
  // interior point in a meaningful way, so skip those pairs outright.
  let crossings = 0;
  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
      const s1 = segments[i];
      const s2 = segments[j];
      if (
        s1.from === s2.from ||
        s1.from === s2.to ||
        s1.to === s2.from ||
        s1.to === s2.to
      ) {
        continue;
      }
      const a = byId.get(s1.from)!;
      const b = byId.get(s1.to)!;
      const c = byId.get(s2.from)!;
      const d = byId.get(s2.to)!;
      if (segmentsCross(a, b, c, d)) crossings += 1;
    }
  }

  return {
    totalDistance: round(totalDistance),
    segmentCount: segments.length,
    longestSegment,
    avgDistance: segments.length ? round(totalDistance / segments.length) : 0,
    unplacedLinks,
    crossings,
    segments,
  };
}
