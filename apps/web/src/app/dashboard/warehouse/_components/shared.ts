/**
 * Tipos, metadatos y utilidades compartidas del centro de surtido y devoluciones.
 * El cálculo de AGING/SLA vive aquí (cliente) para que el semáforo del Pull
 * Monitor avance en vivo; espeja la lógica pura del backend (pull.util.ts).
 */

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

export const BLUE = '#0a84ff';
export const TEAL = '#16a394';
export const VIOLET = '#7c5cff';
export const AMBER = '#f59e0b';
export const GREEN = '#10b981';
export const GRAY = '#6b7280';
export const RED = '#ef4444';

export const inputCls =
  'w-full rounded-xl px-3 py-2.5 text-sm bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/10 outline-none focus:border-[#0a84ff] transition-colors';

export type TaskType = 'put_away' | 'transfer' | 'pick' | 'confirm';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type ReturnStatus = 'pending' | 'completed' | 'cancelled';
export type Semaphore = 'green' | 'amber' | 'red';

/** Pull = warehouse_task decorado por /warehouse/pulls (aging/SLA + nombre de almacén). */
export interface Pull {
  id: number | string;
  taskNumber: string;
  type: TaskType | string;
  status: TaskStatus | string;
  partNumber: string;
  quantity?: number;
  lotNumber?: string | null;
  fromWarehouseId?: string | null;
  toWarehouseId?: string | null;
  fromLocation?: string | null;
  toLocation?: string | null;
  assignedTo?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  // Campos de pull
  project?: string | null;
  requestor?: string | null;
  urgent?: boolean;
  touches?: number;
  slaMinutes?: number | null;
  deliveredAt?: string | null;
  canceledAt?: string | null;
  createdAt?: string | null;
  // Decoración del servidor
  warehouseName?: string;
  warehouseCode?: string;
  agingMinutes?: number;
  slaBreached?: boolean;
  semaphore?: Semaphore;
}

export interface MaterialReturn {
  id: number | string;
  returnNumber: string;
  status: ReturnStatus | string;
  partNumber: string;
  description?: string | null;
  quantity?: number;
  uom?: string | null;
  batch?: string | null;
  vendor?: string | null;
  project?: string | null;
  fromLocation?: string | null;
  toWarehouseId?: string | null;
  toLocation?: string | null;
  reason?: string | null;
  notes?: string | null;
  restocked?: boolean;
  createdBy?: string | null;
  completedBy?: string | null;
  completedAt?: string | null;
  createdAt?: string | null;
}

export interface SupplyAnalytics {
  totals: {
    total: number;
    open: number;
    delivered: number;
    avgSupplyMinutes: number;
    avgTouches: number;
    pctOutOfSla: number;
  };
  byWarehouse: Array<{ warehouseId: string; warehouseName: string; open: number; delivered: number; avgSupplyMinutes: number; avgTouches: number; breachedOpen: number }>;
  byProject: Array<{ project: string; count: number; avgSupplyMinutes: number }>;
  perDay: Array<{ day: string; created: number; delivered: number }>;
  topParts: Array<{ partNumber: string; count: number }>;
}

export const TYPE_META: Record<string, { label: string; color: string }> = {
  put_away: { label: 'Acomodo', color: BLUE },
  transfer: { label: 'Traslado', color: VIOLET },
  pick: { label: 'Surtido', color: TEAL },
  confirm: { label: 'Confirmar', color: AMBER },
};
export const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: AMBER },
  in_progress: { label: 'En proceso', color: BLUE },
  completed: { label: 'Entregado', color: GREEN },
  cancelled: { label: 'Cancelado', color: RED },
};
export const RETURN_STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: 'Por confirmar', color: AMBER },
  completed: { label: 'Confirmada', color: GREEN },
  cancelled: { label: 'Cancelada', color: RED },
};
export const RETURN_REASONS = ['Sobrante de kit', 'Cambio de orden', 'Recuperable', 'Material erróneo', 'Exceso de surtido', 'Otro'];

export const TYPES: TaskType[] = ['put_away', 'transfer', 'pick', 'confirm'];
export const STATUSES: TaskStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'];

// ─── AGING / SLA (cliente, en vivo) ───────────────────────────────────────────
export const DEFAULT_PULL_SLA_MINUTES = 120;
export const PULL_SLA_WARN_RATIO = 0.75;

export function effectiveSla(slaMinutes?: number | null): number {
  return slaMinutes && slaMinutes > 0 ? slaMinutes : DEFAULT_PULL_SLA_MINUTES;
}

/** Minutos de aging: de createdAt a deliveredAt/canceledAt si cerró, o a `now`. */
export function computeAgingMinutes(p: Pull, now: number = Date.now()): number {
  if (!p.createdAt) return p.agingMinutes ?? 0;
  const start = new Date(p.createdAt).getTime();
  if (Number.isNaN(start)) return p.agingMinutes ?? 0;
  const closed = p.deliveredAt || p.canceledAt || (p.status === 'completed' ? p.deliveredAt : null);
  const end = closed ? new Date(closed).getTime() : now;
  const mins = Math.floor((end - start) / 60000);
  return mins > 0 ? mins : 0;
}

export function isSlaBreached(agingMinutes: number, slaMinutes?: number | null): boolean {
  return agingMinutes > effectiveSla(slaMinutes);
}

export function pullSemaphore(agingMinutes: number, slaMinutes?: number | null): Semaphore {
  const sla = effectiveSla(slaMinutes);
  if (agingMinutes > sla) return 'red';
  if (agingMinutes >= sla * PULL_SLA_WARN_RATIO) return 'amber';
  return 'green';
}

export const SEMAPHORE_COLOR: Record<Semaphore, string> = { green: GREEN, amber: AMBER, red: RED };

/** Formatea minutos como "1h 35m" / "45m". */
export function formatAging(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function fmtQty(n?: number): string {
  const v = n ?? 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

export function fmtTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Es un pull "abierto" (cuenta para la cola/aging). */
export function isOpen(p: Pull): boolean {
  return p.status === 'pending' || p.status === 'in_progress';
}
