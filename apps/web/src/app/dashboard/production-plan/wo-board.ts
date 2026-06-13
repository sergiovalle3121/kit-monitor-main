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
