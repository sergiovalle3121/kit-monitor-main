/**
 * Pure reliability math (MTTR / MTBF) shared by the global KPIs and the
 * per-asset detail. Single source of truth so MTTR is computed identically
 * everywhere (no duplication) and the formulas can be unit-tested in isolation.
 */

const HOUR_MS = 3_600_000;

/** Minimal shape needed from a maintenance order (works on the entity as-is). */
export interface ReliabilityOrderLike {
  status: string;
  type: string;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
  created_at?: Date | string | null;
  downtimeMinutes?: number | null;
}

function ms(v: Date | string | null | undefined): number {
  if (!v) return NaN;
  return new Date(v).getTime();
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * MTTR (horas): promedio de la duración de reparación de las órdenes completadas
 * — de `startedAt` (o creación, si nunca se marcó en progreso) a `completedAt`.
 * Idéntico al cálculo histórico de los KPIs globales. `null` si no hay datos.
 */
export function mttrHoursFrom(orders: ReliabilityOrderLike[]): number | null {
  let sum = 0;
  let count = 0;
  for (const o of orders) {
    if (o.status !== 'COMPLETED' || !o.completedAt) continue;
    const start = ms(o.startedAt ?? o.created_at ?? null);
    const end = ms(o.completedAt);
    if (Number.isNaN(start) || Number.isNaN(end)) continue;
    const hrs = (end - start) / HOUR_MS;
    if (hrs >= 0) {
      sum += hrs;
      count += 1;
    }
  }
  return count > 0 ? round1(sum / count) : null;
}

/**
 * MTBF (horas): tiempo medio entre fallas, derivado del delta entre órdenes
 * CORRECTIVAS consecutivas (por `created_at`, el momento en que se levantó la
 * falla). Necesita ≥2 fallas; si no, `null`. No inventa uptime/telemetría.
 */
export function mtbfHoursFrom(orders: ReliabilityOrderLike[]): number | null {
  const times = orders
    .filter((o) => o.type === 'CORRECTIVE')
    .map((o) => ms(o.created_at ?? null))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  if (times.length < 2) return null;
  let sum = 0;
  for (let i = 1; i < times.length; i++) sum += times[i] - times[i - 1];
  return round1(sum / (times.length - 1) / HOUR_MS);
}

export interface AssetReliability {
  /** Fallas = órdenes correctivas del activo. */
  failures: number;
  mttrHours: number | null;
  mtbfHours: number | null;
  totalDowntimeMinutes: number;
  lastFailureAt: string | null;
  openOrders: number;
}

/** Confiabilidad consolidada de un activo a partir de su historial de órdenes. */
export function assetReliabilityFrom(
  orders: ReliabilityOrderLike[],
): AssetReliability {
  const corrective = orders.filter((o) => o.type === 'CORRECTIVE');
  const failureTimes = corrective
    .map((o) => ms(o.created_at ?? null))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  const totalDowntimeMinutes = orders.reduce(
    (s, o) => s + Number(o.downtimeMinutes ?? 0),
    0,
  );
  const openOrders = orders.filter(
    (o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED',
  ).length;
  return {
    failures: corrective.length,
    mttrHours: mttrHoursFrom(orders),
    mtbfHours: mtbfHoursFrom(orders),
    totalDowntimeMinutes,
    lastFailureAt: failureTimes.length
      ? new Date(failureTimes[failureTimes.length - 1]).toISOString()
      : null,
    openOrders,
  };
}
