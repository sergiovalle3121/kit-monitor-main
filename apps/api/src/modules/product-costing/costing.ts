/**
 * Pure standard-cost roll-up math. Side-effect free (unit-testable). Combines the
 * material cost (from the BOM explosion) with labor (routing minutes × rate) and
 * overhead (a % of direct cost) into a standard cost breakdown.
 *
 * This is STANDARD product cost (what a unit *should* cost from master data),
 * complementary to `cost-rollup` which aggregates ACTUAL costs per work order.
 */

export interface CostingInputs {
  /** Rolled-up material cost for the whole build (from BOM explosion). */
  materialCost: number;
  /** Total standard labor minutes for the whole build (from routing). */
  laborMinutes: number;
  /** Labor rate, currency per hour. */
  laborRatePerHour: number;
  /** Overhead as a percentage of direct cost (material + labor). */
  overheadPct: number;
  /** Units this build represents (for the unit cost). */
  qty: number;
}

export interface CostBreakdownItem {
  category: 'MATERIAL' | 'LABOR' | 'OVERHEAD';
  amount: number;
  percentage: number;
}

export interface CostResult {
  materialCost: number;
  laborCost: number;
  laborMinutes: number;
  overheadCost: number;
  totalCost: number;
  /** total / qty. */
  unitCost: number;
  breakdown: CostBreakdownItem[];
}

const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const round4 = (n: number) => Math.round((n + Number.EPSILON) * 1e4) / 1e4;

export function computeStandardCost(inputs: CostingInputs): CostResult {
  const qty = inputs.qty > 0 ? inputs.qty : 1;
  const materialCost = Math.max(0, inputs.materialCost || 0);
  const laborMinutes = Math.max(0, inputs.laborMinutes || 0);
  const rate = Math.max(0, inputs.laborRatePerHour || 0);
  const ohPct = Math.max(0, inputs.overheadPct || 0);

  const laborCost = round((laborMinutes / 60) * rate);
  const direct = materialCost + laborCost;
  const overheadCost = round(direct * (ohPct / 100));
  const totalCost = round(materialCost + laborCost + overheadCost);

  const pct = (amount: number) =>
    totalCost > 0 ? round((amount / totalCost) * 100) : 0;

  return {
    materialCost: round(materialCost),
    laborCost,
    laborMinutes: round4(laborMinutes),
    overheadCost,
    totalCost,
    unitCost: round4(totalCost / qty),
    breakdown: [
      { category: 'MATERIAL', amount: round(materialCost), percentage: pct(materialCost) },
      { category: 'LABOR', amount: laborCost, percentage: pct(laborCost) },
      { category: 'OVERHEAD', amount: overheadCost, percentage: pct(overheadCost) },
    ],
  };
}
