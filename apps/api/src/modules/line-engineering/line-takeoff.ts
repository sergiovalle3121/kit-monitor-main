/**
 * Pure, side-effect-free bill-of-materials / quantity take-off for a layout
 * (Fase 42 — CAD 3D).
 *
 * The CAD editor lets the planner drop stations and a rich library of equipment
 * (benches, conveyors, racks, robots, walls, columns, AGVs…) and draw walls.
 * This turns that arrangement into an engineering take-off: how many of each
 * thing, how much floor each occupies, how much of the footprint is used, and
 * the total run of wall — the numbers a layout review actually needs.
 *
 * Kept pure (no DB, no HTTP) so the area/utilisation maths is unit-testable.
 * All areas are returned in the layout's squared unit (e.g. mm²); the caller
 * formats to m² for display.
 */

export interface TakeoffFootprint {
  footprintW: number;
  footprintH: number;
  unit: string;
}

export interface TakeoffStation {
  x: number | null;
  y: number | null;
  w: number | null;
  h: number | null;
}

export interface TakeoffAsset {
  kind: string;
  w: number;
  h: number;
}

export interface TakeoffAnnotation {
  type: string;
}

export interface TakeoffInput {
  footprint: TakeoffFootprint;
  stations: TakeoffStation[];
  assets: TakeoffAsset[];
  annotations?: TakeoffAnnotation[];
}

/** One row of the equipment take-off, grouped by kind. */
export interface TakeoffKindLine {
  kind: string;
  count: number;
  /** Combined footprint area of every item of this kind, in unit². */
  areaUnit2: number;
}

export interface Takeoff {
  unit: string;
  footprintAreaUnit2: number;
  totalStations: number;
  placedStations: number;
  stationAreaUnit2: number;
  equipmentCount: number;
  /** Equipment grouped by kind, sorted by descending count then kind. */
  byKind: TakeoffKindLine[];
  equipmentAreaUnit2: number;
  /** Physical floor occupied = stations + equipment, excluding flat markings. */
  usedAreaUnit2: number;
  /** usedArea / footprintArea, 0–100 (clamped), rounded to 1 decimal. */
  utilizationPct: number;
  /** Total run of drawn walls (sum of wall lengths) in unit. */
  wallTotalLengthUnit: number;
  dimCount: number;
}

/** Flat floor markings that occupy no real footprint (excluded from "used"). */
const FLAT_KINDS = new Set(['zone', 'agvpath']);

const num = (v: number | null | undefined): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : 0;

const round = (v: number, d = 0): number => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

/**
 * Compute the quantity take-off for a layout arrangement. Stations without a
 * placement (x/y null) are counted in the total but contribute no area.
 */
export function computeTakeoff(input: TakeoffInput): Takeoff {
  const fp = input.footprint;
  const footprintAreaUnit2 = Math.max(0, num(fp.footprintW) * num(fp.footprintH));

  const stations = input.stations ?? [];
  const placed = stations.filter((s) => s.x !== null && s.y !== null);
  const stationAreaUnit2 = placed.reduce(
    (acc, s) => acc + num(s.w) * num(s.h),
    0,
  );

  const assets = input.assets ?? [];
  const byKindMap = new Map<string, { count: number; area: number }>();
  let equipmentAreaUnit2 = 0;
  let wallTotalLengthUnit = 0;
  for (const a of assets) {
    const kind = String(a.kind || 'box');
    const area = num(a.w) * num(a.h);
    const cur = byKindMap.get(kind) ?? { count: 0, area: 0 };
    cur.count += 1;
    cur.area += area;
    byKindMap.set(kind, cur);
    if (!FLAT_KINDS.has(kind)) equipmentAreaUnit2 += area;
    if (kind === 'wall') wallTotalLengthUnit += Math.max(num(a.w), num(a.h));
  }

  const byKind: TakeoffKindLine[] = [...byKindMap.entries()]
    .map(([kind, v]) => ({ kind, count: v.count, areaUnit2: round(v.area) }))
    .sort((p, q) => q.count - p.count || p.kind.localeCompare(q.kind));

  const usedAreaUnit2 = stationAreaUnit2 + equipmentAreaUnit2;
  const utilizationPct =
    footprintAreaUnit2 > 0
      ? round(Math.min(100, (usedAreaUnit2 / footprintAreaUnit2) * 100), 1)
      : 0;

  const dimCount = (input.annotations ?? []).filter((a) => a.type === 'dim')
    .length;

  return {
    unit: fp.unit || 'mm',
    footprintAreaUnit2: round(footprintAreaUnit2),
    totalStations: stations.length,
    placedStations: placed.length,
    stationAreaUnit2: round(stationAreaUnit2),
    equipmentCount: assets.length,
    byKind,
    equipmentAreaUnit2: round(equipmentAreaUnit2),
    usedAreaUnit2: round(usedAreaUnit2),
    utilizationPct,
    wallTotalLengthUnit: round(wallTotalLengthUnit),
    dimCount,
  };
}
