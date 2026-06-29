import type { CycleCount } from './entities/cycle-count.entity';

export type CycleCountDiscrepancyDirection = 'SHORTAGE' | 'OVERAGE';
export type CycleCountDiscrepancySeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export type CycleCountDiscrepancyAction =
  | 'INVESTIGATE_SHORTAGE'
  | 'RECONCILE_OVERAGE';

export interface CycleCountDiscrepancyItem {
  id: string;
  folio: string | null;
  partNumber: string;
  location: string | null;
  programId: string | null;
  uom: string;
  systemQty: number;
  countedQty: number;
  variance: number;
  absVariance: number;
  relativeVariancePct: number | null;
  direction: CycleCountDiscrepancyDirection;
  severity: CycleCountDiscrepancySeverity;
  recommendedAction: CycleCountDiscrepancyAction;
  countedBy: string | null;
  countedAt: Date | null;
}

export interface CycleCountDiscrepancySummary {
  total: number;
  high: number;
  medium: number;
  low: number;
  shortages: number;
  overages: number;
  totalAbsVariance: number;
  netVariance: number;
}

export interface CycleCountDiscrepancyMonitor {
  generatedAt: string;
  summary: CycleCountDiscrepancySummary;
  items: CycleCountDiscrepancyItem[];
}

const SEVERITY_WEIGHT: Record<CycleCountDiscrepancySeverity, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function classifyCycleCountDiscrepancy(
  variance: number,
  systemQty: number,
): {
  absVariance: number;
  relativeVariancePct: number | null;
  severity: CycleCountDiscrepancySeverity;
} {
  const absVariance = Math.abs(variance);
  const relativeVariancePct =
    systemQty > 0 ? round2((absVariance / systemQty) * 100) : null;

  if (
    absVariance >= 100 ||
    (relativeVariancePct !== null && relativeVariancePct >= 20) ||
    (systemQty === 0 && absVariance > 0)
  ) {
    return { absVariance, relativeVariancePct, severity: 'HIGH' };
  }

  if (
    absVariance >= 10 ||
    (relativeVariancePct !== null && relativeVariancePct >= 5)
  ) {
    return { absVariance, relativeVariancePct, severity: 'MEDIUM' };
  }

  return { absVariance, relativeVariancePct, severity: 'LOW' };
}

export function toCycleCountDiscrepancyItem(
  count: CycleCount,
): CycleCountDiscrepancyItem | null {
  if (count.status !== 'COUNTED') return null;
  if (count.countedQty === null || count.variance === null) return null;

  const variance = Number(count.variance);
  if (!Number.isFinite(variance) || variance === 0) return null;

  const systemQty = Number(count.systemQty ?? 0);
  const countedQty = Number(count.countedQty);
  const { absVariance, relativeVariancePct, severity } =
    classifyCycleCountDiscrepancy(variance, systemQty);
  const direction: CycleCountDiscrepancyDirection =
    variance < 0 ? 'SHORTAGE' : 'OVERAGE';

  return {
    id: count.id,
    folio: count.folio,
    partNumber: count.partNumber,
    location: count.location,
    programId: count.programId,
    uom: count.uom,
    systemQty,
    countedQty,
    variance,
    absVariance,
    relativeVariancePct,
    direction,
    severity,
    recommendedAction:
      direction === 'SHORTAGE' ? 'INVESTIGATE_SHORTAGE' : 'RECONCILE_OVERAGE',
    countedBy: count.countedBy,
    countedAt: count.countedAt,
  };
}

export function buildCycleCountDiscrepancyMonitor(
  counts: CycleCount[],
  limit = 25,
): CycleCountDiscrepancyMonitor {
  const items = counts
    .map(toCycleCountDiscrepancyItem)
    .filter((item): item is CycleCountDiscrepancyItem => item !== null)
    .sort(
      (a, b) =>
        SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity] ||
        b.absVariance - a.absVariance ||
        a.partNumber.localeCompare(b.partNumber),
    )
    .slice(0, Math.max(1, limit));

  const summary = items.reduce<CycleCountDiscrepancySummary>(
    (acc, item) => {
      acc.total += 1;
      acc.totalAbsVariance += item.absVariance;
      acc.netVariance += item.variance;
      if (item.severity === 'HIGH') acc.high += 1;
      else if (item.severity === 'MEDIUM') acc.medium += 1;
      else acc.low += 1;
      if (item.direction === 'SHORTAGE') acc.shortages += 1;
      else acc.overages += 1;
      return acc;
    },
    {
      total: 0,
      high: 0,
      medium: 0,
      low: 0,
      shortages: 0,
      overages: 0,
      totalAbsVariance: 0,
      netVariance: 0,
    },
  );

  summary.totalAbsVariance = round2(summary.totalAbsVariance);
  summary.netVariance = round2(summary.netVariance);

  return {
    generatedAt: new Date().toISOString(),
    summary,
    items,
  };
}
