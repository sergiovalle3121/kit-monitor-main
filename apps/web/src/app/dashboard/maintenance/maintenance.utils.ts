// ─────────────────────────────────────────────────────────────────────────────
// Pure maintenance helpers: status/type/priority/criticality metadata, the work
// order state machine (mirrors apps/api/.../order-state.ts so the UI only offers
// valid transitions), and KPI/agenda derivation. Side-effect free so they can be
// reused across the overview, assets, orders and preventive views — and tested.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  Asset,
  AssetCriticality,
  AssetStatus,
  MaintenanceOrder,
  MaintenanceOrderStatus,
  MaintenancePriority,
  MaintenanceType,
} from "./maintenance.types";

// ── Paleta compartida ────────────────────────────────────────────────────────
export const COLORS = {
  green: "#10b981",
  amber: "#f59e0b",
  orange: "#f97316",
  violet: "#7c3aed",
  blue: "#3b82f6",
  cyan: "#06b6d4",
  gray: "#6b7280",
  red: "#ef4444",
} as const;

// ── Order status ─────────────────────────────────────────────────────────────
export const ORDER_STATUS_META: Record<
  MaintenanceOrderStatus,
  { label: string; color: string }
> = {
  OPEN: { label: "Abierta", color: COLORS.gray },
  IN_PROGRESS: { label: "En progreso", color: COLORS.violet },
  COMPLETED: { label: "Completada", color: COLORS.green },
  CANCELLED: { label: "Cancelada", color: COLORS.red },
};

export const ORDER_STATUS_ORDER: MaintenanceOrderStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

// ── Type ─────────────────────────────────────────────────────────────────────
export const TYPE_META: Record<
  MaintenanceType,
  { label: string; color: string }
> = {
  PREVENTIVE: { label: "Preventivo", color: COLORS.blue },
  CORRECTIVE: { label: "Correctivo", color: COLORS.orange },
  PREDICTIVE: { label: "Predictivo", color: COLORS.cyan },
};

export const TYPE_ORDER: MaintenanceType[] = [
  "PREVENTIVE",
  "CORRECTIVE",
  "PREDICTIVE",
];

// ── Priority ─────────────────────────────────────────────────────────────────
export const PRIORITY_META: Record<
  MaintenancePriority,
  { label: string; color: string }
> = {
  LOW: { label: "Baja", color: COLORS.green },
  MEDIUM: { label: "Media", color: COLORS.amber },
  HIGH: { label: "Alta", color: COLORS.red },
};

export const PRIORITY_ORDER: MaintenancePriority[] = ["LOW", "MEDIUM", "HIGH"];
const PRIORITY_RANK: Record<MaintenancePriority, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

// ── Asset criticality ────────────────────────────────────────────────────────
export const CRITICALITY_META: Record<
  AssetCriticality,
  { label: string; color: string }
> = {
  LOW: { label: "Baja", color: COLORS.green },
  MEDIUM: { label: "Media", color: COLORS.amber },
  HIGH: { label: "Alta", color: COLORS.orange },
  CRITICAL: { label: "Crítica", color: COLORS.red },
};

export const CRITICALITY_ORDER: AssetCriticality[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];

// ── Asset status ─────────────────────────────────────────────────────────────
export const ASSET_STATUS_META: Record<
  AssetStatus,
  { label: string; color: string }
> = {
  RUNNING: { label: "Operativo", color: COLORS.green },
  IDLE: { label: "Inactivo", color: COLORS.amber },
  DOWN: { label: "Avería", color: COLORS.red },
  RETIRED: { label: "Retirado", color: COLORS.gray },
};

export const ASSET_STATUS_ORDER: AssetStatus[] = [
  "RUNNING",
  "IDLE",
  "DOWN",
  "RETIRED",
];

// ── Máquina de estados de la orden ───────────────────────────────────────────
// Espejo EXACTO de TRANSITIONS en apps/api/.../order-state.ts. La UI sólo ofrece
// transiciones válidas; el backend las vuelve a validar con assertTransition().
const ORDER_TRANSITIONS: Record<
  MaintenanceOrderStatus,
  MaintenanceOrderStatus[]
> = {
  OPEN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "OPEN", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function nextOrderStates(
  from: MaintenanceOrderStatus,
): MaintenanceOrderStatus[] {
  return ORDER_TRANSITIONS[from] ?? [];
}

export function isOrderTerminal(status: MaintenanceOrderStatus): boolean {
  return nextOrderStates(status).length === 0;
}

/** Una orden "viva" es la que sigue consumiendo backlog (ni cerrada ni cancelada). */
export function isOrderActive(status: MaintenanceOrderStatus): boolean {
  return status !== "COMPLETED" && status !== "CANCELLED";
}

export function isOverdue(o: MaintenanceOrder, now = Date.now()): boolean {
  return (
    isOrderActive(o.status) &&
    !!o.dueDate &&
    new Date(o.dueDate).getTime() < now
  );
}

/** Orden de prioridad → vencimiento → creación, para listas de trabajo. */
export function compareWorkOrders(
  a: MaintenanceOrder,
  b: MaintenanceOrder,
): number {
  const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (pr !== 0) return pr;
  const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
  const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
  if (ad !== bd) return ad - bd;
  const ac = a.created_at ? new Date(a.created_at).getTime() : 0;
  const bc = b.created_at ? new Date(b.created_at).getTime() : 0;
  return bc - ac;
}

// ── KPIs derivados de la lista en vivo (complementan GET /maintenance/kpis) ───

/** Backlog = trabajo abierto + en progreso (lo que falta por cerrar). */
export function backlogCount(orders: MaintenanceOrder[]): number {
  return orders.filter((o) => isOrderActive(o.status)).length;
}

export interface AssetLoadRow {
  key: string;
  assetId: string | null;
  assetName: string;
  open: number;
  inProgress: number;
  total: number;
  down: boolean;
}

/**
 * "Órdenes abiertas por activo": agrupa el trabajo vivo por activo para ver dónde
 * se concentra la carga. Marca `down` si el activo está en avería (cruce con la
 * lista de activos). Ordenado por carga descendente.
 */
export function openOrdersByAsset(
  orders: MaintenanceOrder[],
  assets: Asset[] = [],
): AssetLoadRow[] {
  const downIds = new Set(
    assets.filter((a) => a.status === "DOWN").map((a) => a.id),
  );
  const downNames = new Set(
    assets.filter((a) => a.status === "DOWN").map((a) => a.name),
  );
  const map = new Map<string, AssetLoadRow>();
  for (const o of orders) {
    if (!isOrderActive(o.status)) continue;
    const key = o.assetId ?? `name:${o.assetName ?? ""}`;
    const name = o.assetName ?? "Sin activo";
    const row =
      map.get(key) ??
      {
        key,
        assetId: o.assetId,
        assetName: name,
        open: 0,
        inProgress: 0,
        total: 0,
        down:
          (o.assetId ? downIds.has(o.assetId) : false) || downNames.has(name),
      };
    if (o.status === "OPEN") row.open += 1;
    if (o.status === "IN_PROGRESS") row.inProgress += 1;
    row.total += 1;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

/** Cuenta de órdenes por tipo (mezcla preventivo/correctivo/predictivo). */
export function typeMix(
  orders: MaintenanceOrder[],
): Record<MaintenanceType, number> {
  const out: Record<MaintenanceType, number> = {
    PREVENTIVE: 0,
    CORRECTIVE: 0,
    PREDICTIVE: 0,
  };
  for (const o of orders) out[o.type] += 1;
  return out;
}

// ── MTBF / fallas por equipo (derivado de órdenes correctivas reales) ─────────
// Una "falla" = una orden CORRECTIVA. El MTBF (tiempo medio entre fallas) se
// calcula con el delta entre fallas consecutivas de un activo (por `created_at`,
// el momento en que se levantó la orden). Sólo se reporta MTBF con ≥2 fallas;
// con una sola se reporta el conteo. Todo del lado cliente sobre datos reales:
// no inventa uptime ni telemetría que el sistema no captura.
export interface AssetMtbfRow {
  key: string;
  assetId: string | null;
  assetName: string;
  failures: number;
  mtbfHours: number | null;
  lastFailureAt: string | null;
}

export function mtbfByAsset(orders: MaintenanceOrder[]): AssetMtbfRow[] {
  const byAsset = new Map<string, MaintenanceOrder[]>();
  for (const o of orders) {
    if (o.type !== "CORRECTIVE") continue;
    const key = o.assetId ?? `name:${o.assetName ?? ""}`;
    const arr = byAsset.get(key) ?? [];
    arr.push(o);
    byAsset.set(key, arr);
  }
  const rows: AssetMtbfRow[] = [];
  for (const [key, list] of byAsset) {
    const times = list
      .map((o) => (o.created_at ? new Date(o.created_at).getTime() : NaN))
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => a - b);
    let mtbfHours: number | null = null;
    if (times.length >= 2) {
      let sum = 0;
      for (let i = 1; i < times.length; i++) sum += times[i] - times[i - 1];
      mtbfHours = Math.round((sum / (times.length - 1) / 3_600_000) * 10) / 10;
    }
    rows.push({
      key,
      assetId: list[0].assetId,
      assetName: list[0].assetName ?? "Sin activo",
      failures: list.length,
      mtbfHours,
      lastFailureAt: times.length
        ? new Date(times[times.length - 1]).toISOString()
        : null,
    });
  }
  return rows.sort((a, b) => b.failures - a.failures);
}

/** MTBF de flota: promedio de los MTBF por activo que tienen ≥2 fallas (o null). */
export function fleetMtbfHours(orders: MaintenanceOrder[]): number | null {
  const rows = mtbfByAsset(orders).filter((r) => r.mtbfHours != null);
  if (!rows.length) return null;
  const sum = rows.reduce((s, r) => s + (r.mtbfHours as number), 0);
  return Math.round((sum / rows.length) * 10) / 10;
}

/** Horas legibles: bajo 48 h en horas, arriba en días. */
export function fmtHours(h?: number | null): string {
  if (h == null) return "—";
  if (h < 48) return `${h} h`;
  return `${Math.round((h / 24) * 10) / 10} d`;
}

// ── Agenda preventiva (a partir de dueDate real, sin programador en backend) ──
export type DueBucketKey =
  | "overdue"
  | "thisWeek"
  | "upcoming"
  | "noDate"
  | "done";

export interface DueBuckets {
  overdue: MaintenanceOrder[];
  thisWeek: MaintenanceOrder[];
  upcoming: MaintenanceOrder[];
  noDate: MaintenanceOrder[];
  done: MaintenanceOrder[];
}

export const DUE_BUCKET_META: Record<
  DueBucketKey,
  { label: string; color: string }
> = {
  overdue: { label: "Vencidas", color: COLORS.red },
  thisWeek: { label: "Próximos 7 días", color: COLORS.amber },
  upcoming: { label: "Más adelante", color: COLORS.blue },
  noDate: { label: "Sin fecha", color: COLORS.gray },
  done: { label: "Completadas", color: COLORS.green },
};

export const DUE_BUCKET_ORDER: DueBucketKey[] = [
  "overdue",
  "thisWeek",
  "upcoming",
  "noDate",
  "done",
];

/** Reparte órdenes en cubos por su fecha de vencimiento (agenda tipo calendario). */
export function bucketByDue(
  orders: MaintenanceOrder[],
  now = Date.now(),
): DueBuckets {
  const weekAhead = now + 7 * 24 * 3_600_000;
  const buckets: DueBuckets = {
    overdue: [],
    thisWeek: [],
    upcoming: [],
    noDate: [],
    done: [],
  };
  for (const o of orders) {
    if (o.status === "COMPLETED") {
      buckets.done.push(o);
      continue;
    }
    if (o.status === "CANCELLED") continue;
    if (!o.dueDate) {
      buckets.noDate.push(o);
      continue;
    }
    const t = new Date(o.dueDate).getTime();
    if (t < now) buckets.overdue.push(o);
    else if (t <= weekAhead) buckets.thisWeek.push(o);
    else buckets.upcoming.push(o);
  }
  const byDue = (a: MaintenanceOrder, b: MaintenanceOrder) =>
    (a.dueDate ? new Date(a.dueDate).getTime() : 0) -
    (b.dueDate ? new Date(b.dueDate).getTime() : 0);
  buckets.overdue.sort(byDue);
  buckets.thisWeek.sort(byDue);
  buckets.upcoming.sort(byDue);
  return buckets;
}

// ── Fechas ───────────────────────────────────────────────────────────────────
export function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export function fmtDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

/** Texto relativo corto en días respecto a hoy (para vencimientos). */
export function dueLabel(value?: string | null, now = Date.now()): string {
  if (!value) return "Sin fecha";
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return "Sin fecha";
  const days = Math.round((t - now) / (24 * 3_600_000));
  if (days === 0) return "Vence hoy";
  if (days === 1) return "Vence mañana";
  if (days === -1) return "Venció ayer";
  if (days < 0) return `Venció hace ${Math.abs(days)} d`;
  return `Vence en ${days} d`;
}

/** Duración legible a partir de minutos de paro. */
export function fmtMinutes(min?: number | null): string {
  const m = Math.max(0, Math.round(min ?? 0));
  if (m === 0) return "0 min";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h} h` : `${h} h ${rem} min`;
}
