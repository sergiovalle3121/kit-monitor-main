/**
 * Pure helpers for tooling life consumption (shots / strokes).
 * Kept separate so the math is unit-tested in isolation.
 */

export const TOOL_TYPES = ['MOLD', 'FIXTURE', 'STENCIL', 'GAUGE', 'OTHER'] as const;
export type ToolType = (typeof TOOL_TYPES)[number];

export const TOOL_STATUSES = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED'] as const;
export type ToolStatus = (typeof TOOL_STATUSES)[number];

/** Percentage of rated life consumed (0–100, rounded to 1 decimal). */
export function lifePercent(shotsUsed: number, lifeShots: number): number {
  const used = Math.max(0, Number(shotsUsed ?? 0));
  const life = Number(lifeShots ?? 0);
  if (life <= 0) return 0;
  return Math.round(Math.min(100, (used / life) * 100) * 10) / 10;
}

/** Shots remaining before reaching rated life (never negative). */
export function remainingShots(shotsUsed: number, lifeShots: number): number {
  const life = Number(lifeShots ?? 0);
  if (life <= 0) return 0;
  return Math.max(0, life - Math.max(0, Number(shotsUsed ?? 0)));
}

/** True when the tool is at/over the end-of-life warning threshold (default 80%). */
export function isNearEol(
  shotsUsed: number,
  lifeShots: number,
  thresholdPct = 80,
): boolean {
  return lifePercent(shotsUsed, lifeShots) >= thresholdPct;
}

export function isToolStatus(value: unknown): value is ToolStatus {
  return typeof value === 'string' && (TOOL_STATUSES as readonly string[]).includes(value);
}

// ── Calibración / PM (control IATF) ──────────────────────────────────────────

export const CALIBRATION_STATUSES = ['NONE', 'VALID', 'DUE_SOON', 'OVERDUE'] as const;
export type CalibrationStatus = (typeof CALIBRATION_STATUSES)[number];

/** Ventana por defecto (días) antes de la próxima calibración para marcar "por vencer". */
export const CALIBRATION_DUE_SOON_DAYS = 30;

/**
 * Días enteros desde `now` hasta `date` (negativo = en el pasado). `null` cuando
 * no hay fecha. Normaliza ambos extremos a inicio de día para evitar ruido por la
 * hora y diferencias de DST — las fechas de calibración son de granularidad día.
 */
export function daysUntil(
  date: Date | string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const startOfDay = (x: Date) => Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
  const MS = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(d) - startOfDay(now)) / MS);
}

/**
 * Estado de calibración derivado de la fecha de próxima calibración:
 *   NONE     — sin calibración registrada (fecha próxima nula)
 *   OVERDUE  — vencida (fecha en el pasado / hoy ya pasó)
 *   DUE_SOON — por vencer dentro de `windowDays`
 *   VALID    — vigente con holgura
 */
export function calibrationStatus(
  nextDate: Date | string | null | undefined,
  windowDays: number = CALIBRATION_DUE_SOON_DAYS,
  now: Date = new Date(),
): CalibrationStatus {
  const days = daysUntil(nextDate, now);
  if (days === null) return 'NONE';
  if (days < 0) return 'OVERDUE';
  if (days <= windowDays) return 'DUE_SOON';
  return 'VALID';
}
