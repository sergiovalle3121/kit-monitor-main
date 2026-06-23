/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Funciones de **base de datos** de Excel (`DSUM`, `DCOUNT`, `DGET`…). `@formulajs/formulajs@2.9.3`
 * las trae rotas (revientan con `#ERROR!`). Operan sobre tres argumentos:
 *
 *   • `base`: rango cuya PRIMERA fila son los encabezados de campo.
 *   • `campo`: nombre de columna (texto) o índice 1-based (número).
 *   • `criterios`: rango cuya primera fila son encabezados; cada fila siguiente es una condición.
 *     Dentro de una fila las condiciones se combinan con **Y**; entre filas, con **O**. Reutiliza
 *     `matchesCriterion` (operadores `>`, `<=`, `<>`… y comodines `*`/`?`).
 *
 * Como el parser evalúa los argumentos ANTES de llamar, la función recibe `base`/`criterios` como
 * **matrices 2D** ya evaluadas: se implementan como funciones personalizadas (sin necesidad de
 * acceso a la hoja) y ganan al fallback roto de formulajs vía `getFunction`.
 */
import { toNum, matchesCriterion } from './formulaEngine';
import { to2D } from './modernFunctions';

/** Índice 0-based de la columna del campo (por nombre de encabezado o por número 1-based). */
function fieldIndex(headers: any[], field: any): number {
  if (typeof field === 'number') return Math.trunc(field) - 1;
  const hs = headers.map((h) => String(h ?? '').trim().toLowerCase());
  return hs.indexOf(String(field ?? '').trim().toLowerCase());
}

/** Filas de datos (sin encabezado) que cumplen los criterios. */
function selectRows(base: any[][], criteria: any[][]): any[][] {
  const headers = base[0] ?? [];
  const hmap = headers.map((h) => String(h ?? '').trim().toLowerCase());
  const cHeaders = (criteria[0] ?? []).map((h) => hmap.indexOf(String(h ?? '').trim().toLowerCase()));
  const cRows = criteria.slice(1);
  const active = cRows.filter((r) => r.some((v) => v !== null && v !== undefined && v !== ''));
  const dataRows = base.slice(1);
  if (active.length === 0) return dataRows; // sin condiciones → todos los registros
  return dataRows.filter((row) => active.some((cr) => {
    for (let j = 0; j < cr.length; j++) {
      const cv = cr[j];
      if (cv === null || cv === undefined || cv === '') continue;
      const col = cHeaders[j];
      if (col < 0 || !matchesCriterion(row[col], cv)) return false;
    }
    return true;
  }));
}

/** Valores del campo en las filas seleccionadas, o `null` si el campo no existe. */
function fieldValues(params: any[]): any[] | null {
  const base = to2D(params[0]);
  const criteria = to2D(params[2]);
  const idx = fieldIndex(base[0] ?? [], params[1]);
  if (idx < 0 || idx >= (base[0]?.length ?? 0)) return null;
  return selectRows(base, criteria).map((r) => r[idx]);
}
const nums = (vals: any[]): number[] => vals.map(toNum).filter((x): x is number => x !== null);

function variance(arr: number[], sample: boolean): number | null {
  const n = arr.length; if (n < (sample ? 2 : 1)) return null;
  const mean = arr.reduce((a, b) => a + b, 0) / n;
  const ss = arr.reduce((a, b) => a + (b - mean) ** 2, 0);
  return ss / (sample ? n - 1 : n);
}

const FIELD_ERR = '#VALUE!';

function DSUM(p: any[]): any { const v = fieldValues(p); if (v === null) return FIELD_ERR; return nums(v).reduce((a, b) => a + b, 0); }
function DCOUNT(p: any[]): any { const v = fieldValues(p); if (v === null) return FIELD_ERR; return nums(v).length; }
function DCOUNTA(p: any[]): any { const v = fieldValues(p); if (v === null) return FIELD_ERR; return v.filter((x) => x !== null && x !== undefined && x !== '').length; }
function DAVERAGE(p: any[]): any { const v = fieldValues(p); if (v === null) return FIELD_ERR; const n = nums(v); return n.length ? n.reduce((a, b) => a + b, 0) / n.length : '#DIV/0!'; }
function DMAX(p: any[]): any { const v = fieldValues(p); if (v === null) return FIELD_ERR; const n = nums(v); return n.length ? Math.max(...n) : 0; }
function DMIN(p: any[]): any { const v = fieldValues(p); if (v === null) return FIELD_ERR; const n = nums(v); return n.length ? Math.min(...n) : 0; }
function DPRODUCT(p: any[]): any { const v = fieldValues(p); if (v === null) return FIELD_ERR; const n = nums(v); return n.length ? n.reduce((a, b) => a * b, 1) : 0; }
function DGET(p: any[]): any { const v = fieldValues(p); if (v === null) return FIELD_ERR; const nz = v.filter((x) => x !== null && x !== undefined && x !== ''); if (nz.length === 0) return '#VALUE!'; if (nz.length > 1) return '#NUM!'; return nz[0]; }
function DSTDEV(p: any[]): any { const v = fieldValues(p); if (v === null) return FIELD_ERR; const r = variance(nums(v), true); return r === null ? '#DIV/0!' : Math.sqrt(r); }
function DSTDEVP(p: any[]): any { const v = fieldValues(p); if (v === null) return FIELD_ERR; const r = variance(nums(v), false); return r === null ? '#DIV/0!' : Math.sqrt(r); }
function DVAR(p: any[]): any { const v = fieldValues(p); if (v === null) return FIELD_ERR; const r = variance(nums(v), true); return r === null ? '#DIV/0!' : r; }
function DVARP(p: any[]): any { const v = fieldValues(p); if (v === null) return FIELD_ERR; const r = variance(nums(v), false); return r === null ? '#DIV/0!' : r; }

/** Registro para fusionar en CUSTOM_FUNCTIONS. */
export const DB_FUNCTIONS: Record<string, (params: any[]) => any> = {
  DSUM, DCOUNT, DCOUNTA, DAVERAGE, DMAX, DMIN, DPRODUCT, DGET, DSTDEV, DSTDEVP, DVAR, DVARP,
};
