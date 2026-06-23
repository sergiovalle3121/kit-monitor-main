/**
 * Pure preventive-maintenance scheduling math (no DB, no side-effects) so the
 * recurrence and the due-window semaphore can be unit-tested in isolation and
 * reused by the service, the cron task and (mirrored) the UI.
 */
import type { PmFrequencyType } from './entities/pm-plan.entity';

export const PM_FREQUENCY_TYPES: PmFrequencyType[] = ['DAYS', 'WEEKS', 'MONTHS'];

export type PmDueStatus = 'OK' | 'DUE_SOON' | 'OVERDUE';

/** Días de la ventana "por vencer" por defecto (configurable por env). */
export const PM_DUE_SOON_DAYS = (() => {
  const n = Number(process.env.MAINTENANCE_PM_DUE_SOON_DAYS);
  return Number.isFinite(n) && n >= 0 ? n : 7;
})();

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Suma un intervalo de frecuencia a una fecha base. MONTHS respeta el fin de mes
 * (p.ej. 31-ene + 1 mes = 28/29-feb) recortando el día si se desborda, como hace
 * la aritmética de calendario estándar.
 */
export function addInterval(
  base: Date,
  type: PmFrequencyType,
  value: number,
): Date {
  const v = Math.max(1, Math.trunc(value || 0));
  const d = new Date(base.getTime());
  if (type === 'DAYS') {
    d.setDate(d.getDate() + v);
  } else if (type === 'WEEKS') {
    d.setDate(d.getDate() + v * 7);
  } else {
    // MONTHS — fija al fin de mes si el día original no existe en el mes destino.
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + v);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
  }
  return d;
}

/**
 * Próxima fecha de vencimiento de un PM. Base = última realización (si existe) o
 * la fecha de arranque/hoy. Pura: el llamador decide la base.
 */
export function computeNextDueDate(
  base: Date,
  type: PmFrequencyType,
  value: number,
): Date {
  return addInterval(base, type, value);
}

/**
 * Semáforo de un PM por su próxima fecha: VENCIDO (pasada), POR VENCER (dentro de
 * la ventana) o VIGENTE. Sin fecha → VIGENTE (aún no programado).
 */
export function pmDueStatus(
  nextDueDate: Date | string | null | undefined,
  now: number = Date.now(),
  windowDays: number = PM_DUE_SOON_DAYS,
): PmDueStatus {
  if (!nextDueDate) return 'OK';
  const t = new Date(nextDueDate).getTime();
  if (Number.isNaN(t)) return 'OK';
  if (t < now) return 'OVERDUE';
  if (t <= now + windowDays * DAY_MS) return 'DUE_SOON';
  return 'OK';
}
