/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Correcciones de fidelidad de **fecha/hora** detectadas en la auditoría de valores conocidos:
 *
 *  • `HOUR`/`MINUTE`/`SECOND` de `@formulajs/formulajs@2.9.3` revientan con una hora en **texto**
 *    (`HOUR("13:45:30")` → `#VALUE!`), aunque Excel la parsea (→ 13). Aquí aceptan texto, número de
 *    serie (fracción de día) y `Date`.
 *  • `EDATE` no **ajusta al fin de mes**: `EDATE(31-ene, +1)` daba 2-mar en vez de 29-feb. Aquí se
 *    recorta el día al último del mes destino, como Excel.
 *
 * Se registran en `CUSTOM_FUNCTIONS` (ganan al fallback de formulajs).
 */
import { toNum } from './formulaEngine';

const DAYMS = 86400000;
const EPOCH = Date.UTC(1899, 11, 30); // serie 0 de Excel

/** Texto/serie/Date → componentes de hora, o null. */
function timeParts(v: any): { h: number; m: number; s: number } | null {
  if (typeof v === 'number') {
    const frac = v - Math.floor(v);
    const total = Math.round(frac * 86400);
    return { h: Math.floor(total / 3600) % 24, m: Math.floor(total / 60) % 60, s: total % 60 };
  }
  if (v instanceof Date) return { h: v.getUTCHours(), m: v.getUTCMinutes(), s: v.getUTCSeconds() };
  if (typeof v === 'string') {
    const m = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|A\.M\.|P\.M\.)?/i.exec(v.trim());
    if (!m) { const n = Number(v.trim()); return v.trim() !== '' && !isNaN(n) ? timeParts(n) : null; }
    let h = +m[1]; const mi = +m[2], se = m[3] ? +m[3] : 0; const ap = (m[4] || '').toUpperCase();
    if (ap.startsWith('P') && h < 12) h += 12;
    if (ap.startsWith('A') && h === 12) h = 0;
    return { h: h % 24, m: mi, s: se };
  }
  return null;
}

/** Texto ISO/serie/Date → Date (medianoche UTC), o null. */
function toDate(v: any): Date | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  if (typeof v === 'number') return new Date(EPOCH + Math.round(v) * DAYMS);
  if (typeof v === 'string') { const s = v.trim(); const n = Number(s); if (s !== '' && !isNaN(n)) return new Date(EPOCH + Math.round(n) * DAYMS); const d = new Date(s); return isNaN(d.getTime()) ? null : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); }
  return null;
}

function HOUR(p: any[]): any { const t = timeParts(p[0]); return t ? t.h : '#VALUE!'; }
function MINUTE(p: any[]): any { const t = timeParts(p[0]); return t ? t.m : '#VALUE!'; }
function SECOND(p: any[]): any { const t = timeParts(p[0]); return t ? t.s : '#VALUE!'; }

/** EDATE(inicio; meses) — suma meses recortando al último día del mes destino (como Excel). */
function EDATE(p: any[]): any {
  const d = toDate(p[0]); const months = Math.trunc(toNum(p[1]) ?? 0);
  if (!d) return '#VALUE!';
  const tot = d.getUTCMonth() + months;
  const ty = d.getUTCFullYear() + Math.floor(tot / 12);
  const tm = ((tot % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ty, tm, Math.min(d.getUTCDate(), lastDay)));
}

/** Registro para fusionar en CUSTOM_FUNCTIONS. */
export const DATETIME_FIX_FUNCTIONS: Record<string, (params: any[]) => any> = { HOUR, MINUTE, SECOND, EDATE };
