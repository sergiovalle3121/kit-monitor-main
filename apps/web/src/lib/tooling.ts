/**
 * Tipos y helpers de presentación compartidos del módulo Tooling (herramentales).
 * Centraliza el semáforo de vida en disparos y la proyección de mantenimiento
 * preventivo para que la lista y el detalle hablen el mismo idioma.
 */

export type ToolStatus = 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'RETIRED';
export type ToolType = 'MOLD' | 'FIXTURE' | 'STENCIL' | 'GAUGE' | 'OTHER';

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
}

export interface ToolingKpis {
  total: number;
  active: number;
  inMaintenance: number;
  retired: number;
  nearEol: number;
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
