/**
 * Tipos y helpers de presentación compartidos del módulo Tooling (herramentales).
 * Centraliza el semáforo de vida en disparos y la proyección de mantenimiento
 * preventivo para que la lista y el detalle hablen el mismo idioma.
 */

export type ToolStatus = 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'RETIRED';
export type ToolType = 'MOLD' | 'FIXTURE' | 'STENCIL' | 'GAUGE' | 'OTHER';
export type CalibrationStatus = 'NONE' | 'VALID' | 'DUE_SOON' | 'OVERDUE';

/** Préstamo activo embebido en el tool (lo que devuelve el backend al listar/detallar). */
export interface ActiveCheckout {
  id: string;
  workOrderId: string | null;
  workOrderFolio: string | null;
  workOrderModel: string | null;
  checkedOutAt: string;
  checkedOutBy: string | null;
  shotsAtCheckout: number;
}

/** Registro de préstamo completo (historial). */
export interface ToolCheckout extends ActiveCheckout {
  toolId: string;
  checkedInAt: string | null;
  checkedInBy: string | null;
  shotsAtCheckin: number | null;
  shotsDuring: number | null;
  notes: string | null;
}

/** Evento del historial de uso/auditoría (derivado del ledger). */
export interface ToolUsageEvent {
  at: string;
  action: string;
  actor: string | null;
  shotsUsed: number | null;
  shotsAdded: number | null;
}

export interface ToolHistory {
  tool: Tool;
  checkouts: ToolCheckout[];
  usage: ToolUsageEvent[];
}

export interface Tool {
  id: string;
  folio: string | null;
  name: string;
  type: ToolType;
  cavities: number;
  lifeShots: number;
  shotsUsed: number;
  status: ToolStatus;
  location?: string | null;
  programId?: string | null;
  lifePercent: number;
  remainingShots: number;
  nearEol: boolean;
  // Calibración / PM (aditivo; null en herramentales previos).
  lastCalibrationDate?: string | null;
  nextCalibrationDate?: string | null;
  calibrationIntervalDays?: number | null;
  lastPmDate?: string | null;
  nextPmDate?: string | null;
  calibrationStatus: CalibrationStatus;
  daysToCalibration: number | null;
  activeCheckout: ActiveCheckout | null;
}

export interface ToolingKpis {
  total: number;
  active: number;
  inMaintenance: number;
  retired: number;
  nearEol: number;
  onLoan: number;
  calibrationOverdue: number;
  calibrationDueSoon: number;
  avgLifeConsumedPct: number | null;
}

const GREEN = '#10b981';
const AMBER = '#f59e0b';
const BLUE = '#3b82f6';
const GRAY = '#6b7280';
const RED = '#ef4444';

export const TOOL_STATUS_META: Record<ToolStatus, { label: string; color: string }> = {
  AVAILABLE: { label: 'Disponible', color: GREEN },
  IN_USE: { label: 'En uso', color: BLUE },
  MAINTENANCE: { label: 'Mantenimiento', color: AMBER },
  RETIRED: { label: 'Retirado', color: GRAY },
};
export const TOOL_TYPE_LABEL: Record<ToolType, string> = {
  MOLD: 'Molde',
  FIXTURE: 'Fixture',
  STENCIL: 'Stencil',
  GAUGE: 'Galga',
  OTHER: 'Otro',
};
export const TOOL_STATUSES: ToolStatus[] = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED'];
export const TOOL_TYPES: ToolType[] = ['MOLD', 'FIXTURE', 'STENCIL', 'GAUGE', 'OTHER'];

/** Banda de color del medidor de vida: verde <70%, ámbar 70–90%, rojo >90%. */
export function lifeColor(pct: number): string {
  if (pct > 90) return RED;
  if (pct >= 70) return AMBER;
  return GREEN;
}

export type PmState = 'overdue' | 'due-soon' | 'ok';

/** Cadencia de PM usada en la proyección CLIENT-SIDE: un PM cada 25% de vida. */
export const PM_INTERVAL_PCT = 25;

export const PM_META: Record<PmState, { label: string; color: string }> = {
  overdue: { label: 'PM vencido', color: RED },
  'due-soon': { label: 'PM próximo', color: AMBER },
  ok: { label: 'PM al día', color: GREEN },
};

/**
 * Proyecta el estado de mantenimiento preventivo SÓLO a partir de shotsUsed,
 * asumiendo un PM cada PM_INTERVAL_PCT de la vida nominal. Es una aproximación
 * (el backend aún no registra eventos reales de PM) — la UI la etiqueta como tal.
 */
export function pmProjection(shotsUsed: number, lifeShots: number): {
  state: PmState;
  intervalShots: number;
  sinceShots: number;
  untilShots: number;
} {
  const life = Math.max(0, Number(lifeShots) || 0);
  const used = Math.max(0, Number(shotsUsed) || 0);
  const intervalShots = Math.max(1, Math.round((life * PM_INTERVAL_PCT) / 100));
  const sinceShots = life > 0 ? used % intervalShots : 0;
  const untilShots = Math.max(0, intervalShots - sinceShots);
  const sincePct = intervalShots > 0 ? (sinceShots / intervalShots) * 100 : 0;
  let state: PmState = 'ok';
  if (life > 0) {
    if (sincePct >= 90) state = 'overdue';
    else if (sincePct >= 70) state = 'due-soon';
  }
  return { state, intervalShots, sinceShots, untilShots };
}

// ── Calibración (IATF) — semáforo VIGENTE / POR VENCER / VENCIDA ──────────────

/** Ventana (días) que el backend usa para "por vencer"; espejo para la UI. */
export const CALIBRATION_DUE_SOON_DAYS = 30;

export const CALIBRATION_META: Record<
  CalibrationStatus,
  { label: string; color: string }
> = {
  NONE: { label: 'Sin registro', color: GRAY },
  VALID: { label: 'Vigente', color: GREEN },
  DUE_SOON: { label: 'Por vencer', color: AMBER },
  OVERDUE: { label: 'Vencida', color: RED },
};

/**
 * Estado de calibración derivado de la fecha próxima — fallback client-side por
 * si un tool llega sin el campo derivado (el backend ya lo calcula en `list`).
 */
export function calibrationStatusOf(
  nextDate?: string | null,
  windowDays = CALIBRATION_DUE_SOON_DAYS,
): CalibrationStatus {
  if (!nextDate) return 'NONE';
  const d = new Date(nextDate);
  if (Number.isNaN(d.getTime())) return 'NONE';
  const MS = 24 * 60 * 60 * 1000;
  const startOfDay = (x: Date) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
  const days = Math.round((startOfDay(d) - startOfDay(new Date())) / MS);
  if (days < 0) return 'OVERDUE';
  if (days <= windowDays) return 'DUE_SOON';
  return 'VALID';
}

/** Fecha corta y estable (es-MX, día/mes/año) o '—'. */
export function fmtDate(d?: string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}
