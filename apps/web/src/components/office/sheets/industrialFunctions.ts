/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * AXOS industrial spreadsheet functions.
 *
 * These are pure, deterministic helpers registered into the existing Fortune-Sheet
 * formula parser by `formulaEngine.ts`. They do not fetch ERP/MES data directly;
 * they compute manufacturing metrics over values already present in the workbook,
 * keeping formulas testable and safe for XLSX/imported sheets.
 */
const VALUE = '#VALUE!';
const DIV0 = '#DIV/0!';

function flatten(arg: any): any[] {
  if (Array.isArray(arg)) {
    const out: any[] = [];
    for (const x of arg) { if (Array.isArray(x)) out.push(...flatten(x)); else out.push(x); }
    return out;
  }
  return [arg];
}
function toNum(v: any): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
  return null;
}

function n(v: any): number | string {
  const x = toNum(v);
  return x === null ? VALUE : x;
}
function ratio(num: any, den: any): number | string {
  const a = n(num); const b = n(den);
  if (typeof a === 'string' || typeof b === 'string') return VALUE;
  if (b === 0) return DIV0;
  return a / b;
}
function sumNumbers(arg: any): number | string {
  let total = 0; let seen = false;
  for (const v of flatten(arg)) {
    if (v === '' || v == null) continue;
    const x = toNum(v);
    if (x === null) return VALUE;
    total += x; seen = true;
  }
  return seen ? total : 0;
}
function sampleStats(values: any): { mean: number; sigma: number } | string {
  const nums = flatten(values).map(toNum).filter((x): x is number => x !== null && Number.isFinite(x));
  if (nums.length < 2) return VALUE;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / (nums.length - 1);
  const sigma = Math.sqrt(variance);
  if (!Number.isFinite(sigma) || sigma === 0) return DIV0;
  return { mean, sigma };
}

/** AXOS_OEE(availability, performance, quality) → A × P × Q. */
export function AXOS_OEE(params: any[]): any {
  const [availability, performance, quality] = params.map(n);
  if ([availability, performance, quality].some((x) => typeof x === 'string')) return VALUE;
  return (availability as number) * (performance as number) * (quality as number);
}

/** AXOS_YIELD(good, total) → good / total. */
export function AXOS_YIELD(params: any[]): any { return ratio(params[0], params[1]); }

/** AXOS_SCRAP_RATE(scrap, total) → scrap / total. */
export function AXOS_SCRAP_RATE(params: any[]): any { return ratio(params[0], params[1]); }

/** AXOS_INVENTORY_TURNS(cogs, avgInventory) → COGS / average inventory. */
export function AXOS_INVENTORY_TURNS(params: any[]): any { return ratio(params[0], params[1]); }

/** AXOS_MARGIN(price, cost) → (price - cost) / price. */
export function AXOS_MARGIN(params: any[]): any {
  const price = n(params[0]); const cost = n(params[1]);
  if (typeof price === 'string' || typeof cost === 'string') return VALUE;
  if (price === 0) return DIV0;
  return (price - cost) / price;
}

/** AXOS_MARKUP(price, cost) → (price - cost) / cost. */
export function AXOS_MARKUP(params: any[]): any {
  const price = n(params[0]); const cost = n(params[1]);
  if (typeof price === 'string' || typeof cost === 'string') return VALUE;
  if (cost === 0) return DIV0;
  return (price - cost) / cost;
}

/** AXOS_COST_ROLLUP(qtyRange, costRange, [scrapRange]) → Σ qty × cost × (1 + scrap). */
export function AXOS_COST_ROLLUP(params: any[]): any {
  const qty = flatten(params[0]);
  const cost = flatten(params[1]);
  const scrap = params[2] === undefined ? [] : flatten(params[2]);
  const len = Math.max(qty.length, cost.length, scrap.length || 0);
  if (!qty.length || !cost.length || qty.length !== cost.length || (scrap.length > 0 && scrap.length !== len)) return VALUE;
  let total = 0;
  for (let i = 0; i < len; i++) {
    const q = n(qty[i]); const c = n(cost[i]); const s = scrap.length ? n(scrap[i]) : 0;
    if (typeof q === 'string' || typeof c === 'string' || typeof s === 'string') return VALUE;
    total += q * c * (1 + s);
  }
  return total;
}

/** AXOS_ABCD_CLASS(value, [aThreshold=0.8], [bThreshold=0.95], [cThreshold=1]) → A/B/C/D. */
export function AXOS_ABCD_CLASS(params: any[]): any {
  const value = n(params[0]);
  const a = params[1] === undefined ? 0.8 : n(params[1]);
  const b = params[2] === undefined ? 0.95 : n(params[2]);
  const c = params[3] === undefined ? 1 : n(params[3]);
  if ([value, a, b, c].some((x) => typeof x === 'string')) return VALUE;
  const v = value as number;
  if (v <= (a as number)) return 'A';
  if (v <= (b as number)) return 'B';
  if (v <= (c as number)) return 'C';
  return 'D';
}

/** AXOS_CPK(values, lowerSpec, upperSpec) → min((USL-mean)/(3σ), (mean-LSL)/(3σ)). */
export function AXOS_CPK(params: any[]): any {
  const stats = sampleStats(params[0]);
  const lsl = n(params[1]); const usl = n(params[2]);
  if (typeof stats === 'string') return stats;
  if (typeof lsl === 'string' || typeof usl === 'string') return VALUE;
  if (usl <= lsl) return VALUE;
  return Math.min((usl - stats.mean) / (3 * stats.sigma), (stats.mean - lsl) / (3 * stats.sigma));
}

/** AXOS_SUPPLIER_SCORE(otd, quality, cost, response, [weights]) → weighted score. */
export function AXOS_SUPPLIER_SCORE(params: any[]): any {
  const metrics = params.slice(0, 4).map(n);
  if (metrics.some((x) => typeof x === 'string')) return VALUE;
  const weightsRaw = params[4] === undefined ? [0.35, 0.35, 0.15, 0.15] : flatten(params[4]);
  const weights = weightsRaw.map(n);
  if (weights.length !== 4 || weights.some((x) => typeof x === 'string')) return VALUE;
  const totalWeight = (weights as number[]).reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return DIV0;
  return (metrics as number[]).reduce((acc, m, i) => acc + m * (weights[i] as number), 0) / totalWeight;
}

/** AXOS_CAPACITY_UTILIZATION(demandHours, capacityHours) → demand / capacity. */
export function AXOS_CAPACITY_UTILIZATION(params: any[]): any { return ratio(params[0], params[1]); }

/** AXOS_SHORTAGE(required, available, [incoming]) → max(required - available - incoming, 0). */
export function AXOS_SHORTAGE(params: any[]): any {
  const required = n(params[0]); const available = n(params[1]); const incoming = params[2] === undefined ? 0 : n(params[2]);
  if (typeof required === 'string' || typeof available === 'string' || typeof incoming === 'string') return VALUE;
  return Math.max(required - available - incoming, 0);
}

/** AXOS_SUM_VISIBLE(values) currently sums the supplied range; future filter-aware hook can refine this. */
export function AXOS_SUM_VISIBLE(params: any[]): any { return sumNumbers(params[0]); }

export const AXOS_INDUSTRIAL_FUNCTIONS: Record<string, (params: any[]) => any> = {
  AXOS_OEE,
  AXOS_YIELD,
  AXOS_SCRAP_RATE,
  AXOS_INVENTORY_TURNS,
  AXOS_MARGIN,
  AXOS_MARKUP,
  AXOS_COST_ROLLUP,
  AXOS_ABCD_CLASS,
  AXOS_CPK,
  AXOS_SUPPLIER_SCORE,
  AXOS_CAPACITY_UTILIZATION,
  AXOS_SHORTAGE,
  AXOS_SUM_VISIBLE,
};
