/**
 * Pure, side-effect-free unit-economics model for a line layout (Fase 35).
 *
 * Turns the physical/manning facts of a layout — operators, takt, floor area,
 * equipment count — into a transparent cost-per-unit estimate across the three
 * classic buckets: direct labor, floor space and amortized equipment (capex).
 * It is an *estimate*, parameterized by rates the planner supplies (exactly like
 * the what-if simulator takes time + demand), so two candidate layouts can be
 * compared on cost, not just on balance.
 *
 *   labor/unit = operators × (takt / 3600) × laborRate     (operator-hours × rate)
 *   space/unit = (area × spaceRate) / monthlyVolume
 *   capex/unit = (assets × assetCost / amortMonths) / monthlyVolume
 *
 * Kept pure so the arithmetic can be unit-tested without a database or a canvas.
 */

export interface CostInput {
  operatorCount: number;
  taktSec: number;
  footprintAreaM2: number;
  assetCount: number;
  stationCount: number;
}

export interface CostRates {
  /** Fully-loaded cost of one operator-hour. */
  laborCostPerHour?: number;
  /** Monthly cost of one square metre of floor. */
  spaceCostPerM2Month?: number;
  /** Capital cost of one piece of placed equipment. */
  assetUnitCost?: number;
  /** Units built per month; when omitted, derived from throughput × 160 h. */
  monthlyVolume?: number;
  /** Months over which to amortize the equipment capex. */
  amortizationMonths?: number;
}

export interface CostModel {
  taktSec: number;
  throughputPerHour: number;
  monthlyVolume: number;
  laborCostPerUnit: number;
  spaceCostPerUnit: number;
  capexPerUnit: number;
  totalCostPerUnit: number;
  laborCostPerMonth: number;
  spaceCostPerMonth: number;
  capexPerMonth: number;
  totalCostPerMonth: number;
  capexTotal: number;
  breakdownPct: { labor: number; space: number; capex: number };
  rates: {
    laborCostPerHour: number;
    spaceCostPerM2Month: number;
    assetUnitCost: number;
    amortizationMonths: number;
  };
}

function round(n: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.round((Number(n) || 0) * f) / f;
}

/** Approx working hours in a single-shift month — the default volume basis. */
const SHIFT_MONTH_HOURS = 160;

/** Metres per layout unit, for converting a footprint area to m². */
const UNIT_TO_M: Record<string, number> = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  in: 0.0254,
  ft: 0.3048,
};

/** Metres per one layout unit (unknown unit → mm). */
export function unitToMeters(unit: string): number {
  return UNIT_TO_M[(unit || 'mm').toLowerCase()] ?? UNIT_TO_M.mm;
}

/** Convert an area expressed in `unit²` to square metres (unknown unit → mm). */
export function areaToM2(area: number, unit: string): number {
  const f = unitToMeters(unit);
  return Math.max(0, Number(area) || 0) * f * f;
}

function pos(n: unknown, fallback: number): number {
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

export function costModel(input: CostInput, rates: CostRates = {}): CostModel {
  const takt = Math.max(0, Number(input.taktSec) || 0);
  const operators = Math.max(0, Number(input.operatorCount) || 0);
  const areaM2 = Math.max(0, Number(input.footprintAreaM2) || 0);
  const assets = Math.max(0, Math.floor(Number(input.assetCount) || 0));

  const laborRate = pos(rates.laborCostPerHour, 8);
  const spaceRate = pos(rates.spaceCostPerM2Month, 12);
  const assetCost = pos(rates.assetUnitCost, 5000);
  const amortMonths = Math.max(1, pos(rates.amortizationMonths, 36) || 36);

  const throughputPerHour = takt > 0 ? 3600 / takt : 0;
  const monthlyVolume =
    rates.monthlyVolume && rates.monthlyVolume > 0
      ? Math.floor(rates.monthlyVolume)
      : Math.round(throughputPerHour * SHIFT_MONTH_HOURS);

  // Per-unit costs.
  const laborCostPerUnit = takt > 0 ? operators * (takt / 3600) * laborRate : 0;
  const spaceCostPerMonth = areaM2 * spaceRate;
  const spaceCostPerUnit =
    monthlyVolume > 0 ? spaceCostPerMonth / monthlyVolume : 0;
  const capexTotal = assets * assetCost;
  const capexPerMonth = capexTotal / amortMonths;
  const capexPerUnit = monthlyVolume > 0 ? capexPerMonth / monthlyVolume : 0;
  const totalCostPerUnit = laborCostPerUnit + spaceCostPerUnit + capexPerUnit;

  // Monthly costs.
  const laborCostPerMonth = laborCostPerUnit * monthlyVolume;
  const totalCostPerMonth =
    laborCostPerMonth + spaceCostPerMonth + capexPerMonth;

  const pct = (part: number) =>
    totalCostPerUnit > 0 ? round((part / totalCostPerUnit) * 100, 1) : 0;

  return {
    taktSec: round(takt),
    throughputPerHour: round(throughputPerHour, 1),
    monthlyVolume,
    laborCostPerUnit: round(laborCostPerUnit),
    spaceCostPerUnit: round(spaceCostPerUnit),
    capexPerUnit: round(capexPerUnit),
    totalCostPerUnit: round(totalCostPerUnit),
    laborCostPerMonth: round(laborCostPerMonth),
    spaceCostPerMonth: round(spaceCostPerMonth),
    capexPerMonth: round(capexPerMonth),
    totalCostPerMonth: round(totalCostPerMonth),
    capexTotal: round(capexTotal),
    breakdownPct: {
      labor: pct(laborCostPerUnit),
      space: pct(spaceCostPerUnit),
      capex: pct(capexPerUnit),
    },
    rates: {
      laborCostPerHour: round(laborRate),
      spaceCostPerM2Month: round(spaceRate),
      assetUnitCost: round(assetCost),
      amortizationMonths: amortMonths,
    },
  };
}
