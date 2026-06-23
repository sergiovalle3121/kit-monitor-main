/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Funciones de fecha **internacionales** de Excel: `WORKDAY.INTL` y `NETWORKDAYS.INTL`. Ausentes en
 * `@formulajs/formulajs@2.9.3` (`#NAME?`). A diferencia de `WORKDAY`/`NETWORKDAYS` (fin de semana
 * fijo Sáb-Dom), aceptan un **fin de semana configurable**: un código numérico (1–7, 11–17) o una
 * **máscara de 7 caracteres** `"0000011"` (Lun…Dom, `1` = no laborable), más una lista de festivos.
 *
 * Aritmética de días en UTC (evita saltos por horario de verano). Devuelven objetos `Date` (como las
 * funciones legadas), que la rejilla formatea como fecha.
 */
import { flatten, toNum } from './formulaEngine';

const DAY = 86400000;
const EPOCH = Date.UTC(1899, 11, 30); // día de serie 0 de Excel

/** Convierte número de serie / cadena ISO / Date a un Date (medianoche UTC), o null. */
function toDate(v: any): Date | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  if (typeof v === 'number') return new Date(EPOCH + Math.round(v) * DAY);
  if (typeof v === 'string') {
    const s = v.trim();
    const n = Number(s);
    if (s !== '' && !isNaN(n)) return new Date(EPOCH + Math.round(n) * DAY);
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  return null;
}

// Códigos numéricos de fin de semana → días JS (`getUTCDay`: Dom=0 … Sáb=6).
const WK_CODES: Record<number, number[]> = {
  1: [6, 0], 2: [0, 1], 3: [1, 2], 4: [2, 3], 5: [3, 4], 6: [4, 5], 7: [5, 6],
  11: [0], 12: [1], 13: [2], 14: [3], 15: [4], 16: [5], 17: [6],
};

/** Conjunto de días de fin de semana (0–6) a partir del argumento `weekend`, o null si es inválido. */
function weekendSet(w: any): Set<number> | null {
  if (w === undefined || w === null || w === '') return new Set([6, 0]);
  if (typeof w === 'string' && /^[01]{7}$/.test(w)) {
    const map = [1, 2, 3, 4, 5, 6, 0]; // posición 0=Lun … 6=Dom → getUTCDay
    const s = new Set<number>();
    for (let i = 0; i < 7; i++) if (w[i] === '1') s.add(map[i]);
    return s;
  }
  const n = toNum(w);
  if (n !== null && WK_CODES[n]) return new Set(WK_CODES[n]);
  return null;
}

/** Conjunto de claves de día (serie) de los festivos. */
function holidaySet(arg: any): Set<number> {
  const s = new Set<number>();
  if (arg === undefined) return s;
  for (const v of flatten(arg)) { const d = toDate(v); if (d) s.add(Math.round((d.getTime() - EPOCH) / DAY)); }
  return s;
}
const serial = (d: Date): number => Math.round((d.getTime() - EPOCH) / DAY);

/** WORKDAY.INTL(inicio; días; [fin_de_semana]; [festivos]) → fecha laborable desplazada. */
export function WORKDAY_INTL(params: any[]): any {
  const start = toDate(params[0]); if (!start) return '#VALUE!';
  const days = Math.trunc(toNum(params[1]) ?? 0);
  const wk = weekendSet(params[2]); if (!wk) return '#NUM!';
  const hol = holidaySet(params[3]);
  let cur = serial(start);
  let remaining = Math.abs(days);
  const step = days >= 0 ? 1 : -1;
  while (remaining > 0) {
    cur += step;
    const d = new Date(EPOCH + cur * DAY);
    if (!wk.has(d.getUTCDay()) && !hol.has(cur)) remaining--;
  }
  return new Date(EPOCH + cur * DAY);
}

/** NETWORKDAYS.INTL(inicio; fin; [fin_de_semana]; [festivos]) → nº de días laborables (con signo). */
export function NETWORKDAYS_INTL(params: any[]): any {
  let a = toDate(params[0]); let b = toDate(params[1]);
  if (!a || !b) return '#VALUE!';
  const wk = weekendSet(params[2]); if (!wk) return '#NUM!';
  const hol = holidaySet(params[3]);
  let sign = 1;
  if (serial(a) > serial(b)) { const t = a; a = b; b = t; sign = -1; }
  let count = 0;
  for (let s = serial(a); s <= serial(b); s++) {
    const d = new Date(EPOCH + s * DAY);
    if (!wk.has(d.getUTCDay()) && !hol.has(s)) count++;
  }
  return sign * count;
}

/** Registro para fusionar en CUSTOM_FUNCTIONS (nombres con punto). */
export const DATE_INTL_FUNCTIONS: Record<string, (params: any[]) => any> = {
  'WORKDAY.INTL': WORKDAY_INTL, 'NETWORKDAYS.INTL': NETWORKDAYS_INTL,
};
