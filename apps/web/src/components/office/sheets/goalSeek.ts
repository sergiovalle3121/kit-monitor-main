/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * «Buscar objetivo» (Goal Seek) — análisis de hipótesis de Excel: encuentra el valor de una
 * celda VARIABLE que hace que una celda de FÓRMULA alcance un valor OBJETIVO.
 *
 * Reutiliza `evalOverSheet` (el mismo motor parcheado sobre `celldata`) para evaluar la fórmula
 * con valores de prueba de la variable, y resuelve `f(x) = objetivo` con el método de la secante
 * (con reinicios y un respaldo de bisección si encuentra un cambio de signo). Es PURO sobre una
 * COPIA de la hoja hasta tener solución, así que se prueba sin navegador.
 *
 * Límite (documentado): recalcula SOLO la fórmula objetivo; si ésta depende de la variable a
 * través de OTRAS celdas con fórmula, esas no se recalculan (leen su valor horneado). Funciona
 * cuando la fórmula objetivo depende de la variable directamente o vía celdas de valor — el caso
 * habitual del análisis de hipótesis.
 */
import { evalOverSheet } from './arraySpill';
import { parseRange } from '@/lib/office/charts';

const clone = (x: any) => JSON.parse(JSON.stringify(x));

function getFormula(sheet: any, r: number, c: number): string | undefined {
  const cd = (sheet.celldata ?? []).find((x: any) => x.r === r && x.c === c);
  return cd?.v && typeof cd.v === 'object' ? cd.v.f : undefined;
}
function setCellRaw(sheet: any, r: number, c: number, value: number) {
  sheet.celldata = sheet.celldata || [];
  let cd = sheet.celldata.find((x: any) => x.r === r && x.c === c);
  if (!cd) { cd = { r, c, v: {} }; sheet.celldata.push(cd); }
  if (cd.v && typeof cd.v === 'object') { cd.v.v = value; cd.v.m = String(value); delete cd.v.f; }
  else cd.v = value;
}

export interface GoalSeekResult { ok: boolean; value?: number; result?: number; iterations?: number; error?: string }

/** Busca el valor de `variableA1` para que `formulaA1` valga `target`. Si converge, lo fija en `sheet`. */
export function goalSeek(sheet: any, formulaA1: string, target: number, variableA1: string, maxIter = 100, tol = 1e-7): GoalSeekResult {
  const fp = parseRange(formulaA1), vp = parseRange(variableA1);
  if (!fp || !vp) return { ok: false, error: 'Referencia de celda inválida.' };
  if (!Number.isFinite(target)) return { ok: false, error: 'El valor objetivo debe ser un número.' };
  const formula = getFormula(sheet, fp.r1, fp.c1);
  if (!formula) return { ok: false, error: 'La celda objetivo no contiene una fórmula.' };

  const work = clone(sheet);
  // f(x) = valor(fórmula con variable=x) − objetivo.
  const f = (x: number): number => {
    setCellRaw(work, vp.r1, vp.c1, x);
    const ev = evalOverSheet(work, formula);
    const n = typeof ev.result === 'number' ? ev.result : Number(ev.result);
    return Number.isFinite(n) ? n - target : NaN;
  };

  // Punto de partida: el valor actual de la variable (o 0).
  const cur = (() => { const cd = (sheet.celldata ?? []).find((x: any) => x.r === vp.r1 && x.c === vp.c1); const v = cd?.v && typeof cd.v === 'object' ? cd.v.v : cd?.v; const n = Number(v); return Number.isFinite(n) ? n : 0; })();

  let x0 = cur, f0 = f(x0);
  if (Number.isFinite(f0) && Math.abs(f0) <= tol) { setCellRaw(sheet, vp.r1, vp.c1, x0); return { ok: true, value: x0, result: f0 + target, iterations: 0 }; }
  let x1 = cur !== 0 ? cur * 1.1 + 1 : 1, f1 = f(x1);

  for (let i = 0; i < maxIter; i++) {
    if (!Number.isFinite(f1)) { x1 = (x0 + x1) / 2 || 1; f1 = f(x1); continue; }
    if (Math.abs(f1) <= tol) { setCellRaw(sheet, vp.r1, vp.c1, x1); return { ok: true, value: round(x1), result: round(f1 + target), iterations: i + 1 }; }
    const denom = f1 - f0;
    let x2: number;
    if (Math.abs(denom) < 1e-12) x2 = x1 + (Math.abs(x1) > 1 ? x1 * 0.01 : 0.1); // perturba si la pendiente es ~0
    else x2 = x1 - f1 * (x1 - x0) / denom;
    if (!Number.isFinite(x2) || Math.abs(x2) > 1e15) x2 = (x0 + x1) / 2; // diverge → recentra
    x0 = x1; f0 = f1; x1 = x2; f1 = f(x1);
  }
  // Último intento: ¿hay raíz exacta tras la última iteración?
  if (Number.isFinite(f1) && Math.abs(f1) <= 1e-4) { setCellRaw(sheet, vp.r1, vp.c1, round(x1)); return { ok: true, value: round(x1), result: round(f1 + target), iterations: maxIter }; }
  return { ok: false, error: 'No se encontró una solución (la celda puede no converger a ese objetivo).' };
}

function round(x: number): number { return Math.abs(x - Math.round(x)) < 1e-9 ? Math.round(x) : +x.toFixed(10); }
