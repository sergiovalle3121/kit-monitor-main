// Pure helpers for the WO board (muro de WOs). These derive an operational read
// of each work order — schedule (ahead/behind) and Clear-to-Build — from data
// that ALREADY exists in the platform, so the board stays a thin composition
// over existing endpoints (no backend changes):
//   • production-plan  → the WO itself (qty, takt, dates, fai/quality flags)
//   • bom/headers      → active BOM + components (Clear-to-Build · material)
//   • inventory/positions → on-hand per part (Clear-to-Build · material)
//
// Everything here is a pure function so the board logic is predictable and the
// page stays declarative.

const round = (n: number, dp = 2): number => {
  const f = 10 ** dp;
  return Math.round((Number(n) || 0) * f) / f;
};

const startOfDay = (d: Date): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

// ── Schedule (adelantado / atrasado) ─────────────────────────────────────────

export interface ScheduleInput {
  status: string;
  scheduledDate: string | null;
  quantityCompleted: number;
  taktTargetSec?: number | null;
  startedAt?: string | null;
}

export type ScheduleState =
  | 'done'
  | 'cancelled'
  | 'late'
  | 'due-today'
  | 'on-track'
  | 'unscheduled';

/** Pace vs takt: only meaningful for a running WO with a real takt + start. */
export interface Pace {
  state: 'ahead' | 'on-pace' | 'behind';
  deltaUnits: number; // completed − expected (negative = behind)
  expected: number;
}

export interface ScheduleInfo {
  state: ScheduleState;
  label: string;
  daysDelta: number | null; // due − today, in days (negative = overdue)
  pace: Pace | null;
}

/**
 * Read of where a WO stands against its plan. Schedule comes from the due date
 * vs today; when the WO is running with a target takt we also compute pace
 * (units produced vs units expected by now) — the textbook "ahead/behind" of a
 * live line. When there is no due date / no takt we say so honestly.
 */
export function computeSchedule(wo: ScheduleInput, now: Date = new Date()): ScheduleInfo {
  if (wo.status === 'COMPLETED') return { state: 'done', label: 'Completada', daysDelta: null, pace: null };
  if (wo.status === 'CANCELLED') return { state: 'cancelled', label: 'Cancelada', daysDelta: null, pace: null };

  let pace: Pace | null = null;
  const takt = Number(wo.taktTargetSec ?? 0);
  if (wo.status === 'IN_EXECUTION' && takt > 0 && wo.startedAt) {
    const started = new Date(wo.startedAt).getTime();
    if (!Number.isNaN(started)) {
      const elapsedSec = Math.max(0, (now.getTime() - started) / 1000);
      const expected = Math.floor(elapsedSec / takt);
      const deltaUnits = (Number(wo.quantityCompleted) || 0) - expected;
      const state: Pace['state'] = deltaUnits >= 1 ? 'ahead' : deltaUnits <= -1 ? 'behind' : 'on-pace';
      pace = { state, deltaUnits, expected };
    }
  }

  if (!wo.scheduledDate) return { state: 'unscheduled', label: 'Sin fecha', daysDelta: null, pace };
  const due = startOfDay(new Date(wo.scheduledDate));
  if (Number.isNaN(due.getTime())) return { state: 'unscheduled', label: 'Sin fecha', daysDelta: null, pace };

  const today = startOfDay(now);
  const daysDelta = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (daysDelta < 0) return { state: 'late', label: `Atrasada · ${Math.abs(daysDelta)} d`, daysDelta, pace };
  if (daysDelta === 0) return { state: 'due-today', label: 'Vence hoy', daysDelta, pace };
  return {
    state: 'on-track',
    label: daysDelta === 1 ? 'Vence mañana' : `Vence en ${daysDelta} d`,
    daysDelta,
    pace,
  };
}

export function paceLabel(pace: Pace): string {
  if (pace.state === 'ahead') return `+${pace.deltaUnits} u vs ritmo`;
  if (pace.state === 'behind') return `${pace.deltaUnits} u vs ritmo`;
  return 'a ritmo';
}

// ── Clear-to-Build (semáforo) ────────────────────────────────────────────────
// Compone el veredicto desde tres fuentes que YA existen, sin backend nuevo:
//   • BOM activo       → GET /bom/headers?status=ACTIVE   (modelo → componentes)
//   • Material         → GET /inventory/positions          (parte → disponible)
//   • FAI              → flag en la propia WO
// La retención de calidad (qualityClear) también bloquea: sería deshonesto pintar
// verde con un hold de calidad activo, así que entra en el veredicto.

export interface ClearWorkOrder {
  model: string;
  quantityPlanned: number;
  quantityCompleted: number;
  faiRequired: boolean;
  faiApproved: boolean;
  qualityClear: boolean;
  status: string;
}

export interface BomComponentLite {
  componentNumber: string;
  description?: string | null;
  quantity: number;
  usageFactor: number;
  unit?: string | null;
}
export interface BomHeaderLite {
  id: number;
  model: string;
  revision: string;
  status: string;
  baseQuantity: number;
  components?: BomComponentLite[] | null;
}
export interface InventoryPositionLite {
  partNumber: string;
  onHand: number;
  allocated: number;
  holdStatus?: string | null;
}

export type CheckState = 'ok' | 'partial' | 'fail' | 'pending' | 'na' | 'unknown';
export type ClearStatus = 'go' | 'caution' | 'no-go' | 'unknown';

export interface ShortageLine {
  partNumber: string;
  description?: string | null;
  required: number;
  available: number;
  shortage: number;
  unit: string;
}

export interface ClearToBuild {
  status: ClearStatus;
  bom: { state: CheckState; headerId?: number; revision?: string };
  material: { state: CheckState; totalParts: number; shortParts: number; lines: ShortageLine[] };
  fai: { state: CheckState };
  quality: { state: CheckState };
  reasons: string[];
}

/** partNumber → cantidad disponible (onHand − allocated, solo holdStatus `available`). */
export function buildInventoryMap(positions: InventoryPositionLite[] | null | undefined): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of positions ?? []) {
    if (p.holdStatus && p.holdStatus !== 'available') continue;
    const avail = Math.max(0, (Number(p.onHand) || 0) - (Number(p.allocated) || 0));
    map.set(p.partNumber, (map.get(p.partNumber) ?? 0) + avail);
  }
  return map;
}

/** modelo → primer BOM ACTIVE encontrado (con sus componentes). */
export function buildActiveBomMap(headers: BomHeaderLite[] | null | undefined): Map<string, BomHeaderLite> {
  const map = new Map<string, BomHeaderLite>();
  for (const h of headers ?? []) {
    if (h.status !== 'ACTIVE') continue;
    if (!map.has(h.model)) map.set(h.model, h);
  }
  return map;
}

/**
 * Veredicto Clear-to-Build de una WO. Explota el BOM activo contra la cantidad
 * por construir (planeada − hecha) y lo compara con el disponible en inventario.
 */
export function computeClearToBuild(
  wo: ClearWorkOrder,
  bomByModel: Map<string, BomHeaderLite>,
  invByPart: Map<string, number>,
): ClearToBuild {
  const reasons: string[] = [];
  const header = bomByModel.get(wo.model);

  // BOM activo
  const bomOk = !!header;
  const bom = { state: (bomOk ? 'ok' : 'fail') as CheckState, headerId: header?.id, revision: header?.revision };
  if (!bomOk) reasons.push('Sin BOM activo para el modelo.');

  // Material disponible (explota BOM activo vs disponible en inventario)
  const remaining = Math.max(0, (Number(wo.quantityPlanned) || 0) - (Number(wo.quantityCompleted) || 0));
  const lines: ShortageLine[] = [];
  let totalParts = 0;
  let shortParts = 0;
  let material: ClearToBuild['material'];
  if (!header) {
    material = { state: 'unknown', totalParts: 0, shortParts: 0, lines: [] };
  } else {
    const base = header.baseQuantity > 0 ? header.baseQuantity : 1;
    for (const c of header.components ?? []) {
      totalParts++;
      const perUnit = ((Number(c.quantity) || 0) * (Number(c.usageFactor) || 1)) / base;
      const required = round(perUnit * remaining, 2);
      const available = invByPart.get(c.componentNumber) ?? 0;
      const shortage = round(Math.max(0, required - available), 2);
      if (shortage > 0) {
        shortParts++;
        lines.push({
          partNumber: c.componentNumber,
          description: c.description ?? null,
          required,
          available,
          shortage,
          unit: c.unit ?? 'EA',
        });
      }
    }
    lines.sort((a, b) => b.shortage - a.shortage);
    const state: CheckState =
      totalParts === 0 ? 'unknown' : shortParts === 0 ? 'ok' : shortParts === totalParts ? 'fail' : 'partial';
    material = { state, totalParts, shortParts, lines };
    if (shortParts > 0) reasons.push(`${shortParts} de ${totalParts} materiales con faltante.`);
  }

  // FAI
  let faiState: CheckState;
  if (!wo.faiRequired) faiState = 'na';
  else if (wo.faiApproved) faiState = 'ok';
  else {
    faiState = 'pending';
    reasons.push('Primera pieza (FAI) sin aprobar.');
  }

  // Calidad (hold)
  const qualityOk = wo.qualityClear !== false;
  const quality = { state: (qualityOk ? 'ok' : 'fail') as CheckState };
  if (!qualityOk) reasons.push('Retención de calidad activa.');

  // Veredicto
  let status: ClearStatus;
  if (!bomOk || material.state === 'fail' || !qualityOk) status = 'no-go';
  else if (material.state === 'partial' || faiState === 'pending') status = 'caution';
  else if (material.state === 'unknown') status = 'unknown';
  else status = 'go';

  return { status, bom, material, fai: { state: faiState }, quality, reasons };
}
