/**
 * Pure costing math for the cost-intelligence module (Block M — floor↔money).
 *
 * No DB, no Nest: just the deterministic arithmetic that turns shop-floor
 * facts (backflush consumption, line routing, quality holds) and master data
 * (standard cost) into COGS and material-usage variance. Kept pure so it can be
 * unit-tested without a database and reused by both the live endpoints and the
 * period-close snapshot.
 *
 * Money is rounded to cents and modeled as `number` (double precision),
 * consistent with the repo's other operational-finance entities (DECISIONS §4):
 * these are management/reporting figures, not double-entry accounting postings.
 */

/** Round a monetary amount to cents. */
export function roundCurrency(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/** Round to a given number of decimals (defaults to 4 for ratios). */
export function round(value: number, dp = 4): number {
  const f = Math.pow(10, dp);
  return Math.round((Number(value) || 0) * f) / f;
}

/** Default labor rate (USD / labor-hour) when no actual labor cost exists. */
export const DEFAULT_LABOR_RATE = 45;
/** Default overhead absorption rate applied to (material + labor). */
export const DEFAULT_OVERHEAD_RATE = 0.18;

export type LaborSource = 'ROLLUP_ACTUAL' | 'STANDARD_TIME_ESTIMATE';
export type OverheadSource = 'ROLLUP_ACTUAL' | 'RATE_ABSORPTION';

export interface ConsumptionFact {
  /** Part backflushed (null events contribute no material). */
  part: string | null;
  /** Station the unit was confirmed at (maps to a routing std time). */
  station: string;
  /** Finished units produced by the confirmation. */
  units: number;
  /** Material backflushed (= units × use factor). */
  backflushQty: number;
}

export interface StationFact {
  station: string;
  npExpected: string | null;
  useFactor: number;
  stdTimeSec: number;
}

export interface HoldFact {
  part: string;
  /** Quantity originally held. */
  qty: number;
  /** Quantity confirmed as scrap (0 until dispositioned). */
  scrapQty: number;
  disposition: string | null;
}

/**
 * Real material cost from backflush: Σ(backflushQty × standardCost(part)).
 * This is the live floor→money bridge — every operator confirmation moves it.
 */
export function materialActualCost(
  events: ConsumptionFact[],
  stdCostOf: (part: string) => number,
): number {
  let total = 0;
  for (const e of events) {
    if (!e.part) continue;
    total += Number(e.backflushQty ?? 0) * stdCostOf(e.part);
  }
  return roundCurrency(total);
}

/**
 * Planned material cost — the BOM rollup × planned quantity. The line routing is
 * the bill of material here: each station's expected NP consumes `useFactor` per
 * unit, so planned qty per part = Σ(useFactor) × quantityPlanned.
 */
export function materialPlanCost(
  stations: StationFact[],
  quantityPlanned: number,
  stdCostOf: (part: string) => number,
): number {
  let perUnit = 0;
  for (const s of stations) {
    if (!s.npExpected) continue;
    perUnit += Number(s.useFactor ?? 0) * stdCostOf(s.npExpected);
  }
  return roundCurrency(perUnit * Math.max(0, Number(quantityPlanned ?? 0)));
}

/** Planned material quantity per part = Σ(useFactor) × quantityPlanned. */
export function plannedQtyByPart(
  stations: StationFact[],
  quantityPlanned: number,
): Map<string, number> {
  const m = new Map<string, number>();
  const qty = Math.max(0, Number(quantityPlanned ?? 0));
  for (const s of stations) {
    if (!s.npExpected) continue;
    m.set(s.npExpected, (m.get(s.npExpected) ?? 0) + Number(s.useFactor ?? 0) * qty);
  }
  return m;
}

/** Actual backflushed quantity per part = Σ(backflushQty). */
export function actualQtyByPart(events: ConsumptionFact[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of events) {
    if (!e.part) continue;
    m.set(e.part, (m.get(e.part) ?? 0) + Number(e.backflushQty ?? 0));
  }
  return m;
}

export interface PartVariance {
  part: string;
  plannedQty: number;
  actualQty: number;
  standardCost: number;
  plannedCost: number;
  actualCost: number;
  /** actual − planned (positive = unfavorable, consumed more than planned). */
  usageVariance: number;
  qtyVariance: number;
}

/** Per-part material usage variance (plan vs backflushed actual, at std cost). */
export function usageVarianceByPart(
  stations: StationFact[],
  events: ConsumptionFact[],
  quantityPlanned: number,
  stdCostOf: (part: string) => number,
): PartVariance[] {
  const planned = plannedQtyByPart(stations, quantityPlanned);
  const actual = actualQtyByPart(events);
  const parts = new Set<string>([...planned.keys(), ...actual.keys()]);
  const rows: PartVariance[] = [];
  for (const part of parts) {
    const plannedQty = round(planned.get(part) ?? 0, 4);
    const actualQty = round(actual.get(part) ?? 0, 4);
    const standardCost = stdCostOf(part);
    const plannedCost = roundCurrency(plannedQty * standardCost);
    const actualCost = roundCurrency(actualQty * standardCost);
    rows.push({
      part,
      plannedQty,
      actualQty,
      standardCost,
      plannedCost,
      actualCost,
      usageVariance: roundCurrency(actualCost - plannedCost),
      qtyVariance: round(actualQty - plannedQty, 4),
    });
  }
  return rows.sort((a, b) => Math.abs(b.usageVariance) - Math.abs(a.usageVariance));
}

/**
 * Scrap cost from quality holds / NCR. Uses the confirmed scrap qty when the
 * hold has been dispositioned; falls back to the full held qty for a SCRAP
 * disposition that has not had its scrap qty recorded yet.
 */
export function scrapFromHolds(
  holds: HoldFact[],
  stdCostOf: (part: string) => number,
): { scrapQty: number; scrapCost: number } {
  let scrapQty = 0;
  let scrapCost = 0;
  for (const h of holds) {
    const qty =
      Number(h.scrapQty ?? 0) > 0
        ? Number(h.scrapQty)
        : h.disposition === 'SCRAP'
          ? Number(h.qty ?? 0)
          : 0;
    if (qty <= 0) continue;
    scrapQty += qty;
    scrapCost += qty * stdCostOf(h.part);
  }
  return { scrapQty: round(scrapQty, 4), scrapCost: roundCurrency(scrapCost) };
}

/** Earned standard labor hours = Σ(units × stationStdTimeSec) / 3600. */
export function standardLaborHours(
  events: ConsumptionFact[],
  stdTimeSecOf: (station: string) => number,
): number {
  let seconds = 0;
  for (const e of events) {
    seconds += Number(e.units ?? 0) * stdTimeSecOf(e.station);
  }
  return round(seconds / 3600, 4);
}

export interface CogsInput {
  materialActual: number;
  /** Actual labor cost from the cost rollup, if any cost items exist (>0). */
  rollupLabor: number;
  /** Actual overhead (+ energy) from the cost rollup, if any (>0). */
  rollupOverhead: number;
  standardLaborHours: number;
  laborRate: number;
  overheadRate: number;
}

export interface CogsResult {
  materialCost: number;
  laborCost: number;
  laborSource: LaborSource;
  overheadCost: number;
  overheadSource: OverheadSource;
  cogs: number;
}

/**
 * Assemble COGS: material (live from backflush) + labor + overhead.
 *
 * Labor prefers a real recorded labor cost (from the cost rollup) and otherwise
 * estimates it as earned standard hours × a parameterizable rate — there is no
 * time-clock in the system today. Overhead prefers a real recorded overhead and
 * otherwise absorbs a parameterizable rate over (material + labor).
 */
export function computeCogs(input: CogsInput): CogsResult {
  const materialCost = roundCurrency(input.materialActual);

  const useRollupLabor = Number(input.rollupLabor ?? 0) > 0;
  const laborCost = useRollupLabor
    ? roundCurrency(input.rollupLabor)
    : roundCurrency(input.standardLaborHours * input.laborRate);
  const laborSource: LaborSource = useRollupLabor
    ? 'ROLLUP_ACTUAL'
    : 'STANDARD_TIME_ESTIMATE';

  const useRollupOverhead = Number(input.rollupOverhead ?? 0) > 0;
  const overheadCost = useRollupOverhead
    ? roundCurrency(input.rollupOverhead)
    : roundCurrency((materialCost + laborCost) * input.overheadRate);
  const overheadSource: OverheadSource = useRollupOverhead
    ? 'ROLLUP_ACTUAL'
    : 'RATE_ABSORPTION';

  return {
    materialCost,
    laborCost,
    laborSource,
    overheadCost,
    overheadSource,
    cogs: roundCurrency(materialCost + laborCost + overheadCost),
  };
}

/** Per-unit cost = COGS / completed units (0 when nothing completed). */
export function unitCost(cogs: number, quantityCompleted: number): number {
  const qty = Number(quantityCompleted ?? 0);
  return qty > 0 ? roundCurrency(cogs / qty) : 0;
}
