/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * «Tabla de datos» (Data Table) — el otro análisis de hipótesis de Excel: evalúa una fórmula
 * para muchos valores de una (o dos) celdas de entrada y devuelve la rejilla de resultados.
 * Complementa a «Buscar objetivo» (§39). Reutiliza `evalOverSheet` (§36); es PURO sobre una
 * COPIA de la hoja, así que se prueba sin navegador.
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
function asNum(ev: { result?: any; error?: string }): number {
  if (ev.error) return NaN;
  const n = typeof ev.result === 'number' ? ev.result : Number(ev.result);
  return Number.isFinite(n) ? n : NaN;
}

export interface DataTable1 { ok: boolean; results?: number[]; error?: string }
export interface DataTable2 { ok: boolean; matrix?: number[][]; error?: string }

/** Tabla de datos de UNA variable: la fórmula evaluada para cada valor de la celda de entrada. */
export function dataTable1(sheet: any, formulaA1: string, inputCellA1: string, values: number[]): DataTable1 {
  const fp = parseRange(formulaA1), ip = parseRange(inputCellA1);
  if (!fp || !ip) return { ok: false, error: 'Referencia de celda inválida.' };
  const formula = getFormula(sheet, fp.r1, fp.c1);
  if (!formula) return { ok: false, error: 'La celda de fórmula no contiene una fórmula.' };
  const w = clone(sheet);
  const results = values.map((v) => { setCellRaw(w, ip.r1, ip.c1, v); return asNum(evalOverSheet(w, formula)); });
  return { ok: true, results };
}

/** Tabla de datos de DOS variables: matriz `matrix[i][j]` con fila=rowValues[i], columna=colValues[j]. */
export function dataTable2(sheet: any, formulaA1: string, rowInputA1: string, colInputA1: string, rowValues: number[], colValues: number[]): DataTable2 {
  const fp = parseRange(formulaA1), rp = parseRange(rowInputA1), cp = parseRange(colInputA1);
  if (!fp || !rp || !cp) return { ok: false, error: 'Referencia de celda inválida.' };
  const formula = getFormula(sheet, fp.r1, fp.c1);
  if (!formula) return { ok: false, error: 'La celda de fórmula no contiene una fórmula.' };
  const w = clone(sheet);
  const matrix = rowValues.map((rv) => colValues.map((cv) => {
    setCellRaw(w, rp.r1, rp.c1, rv);
    setCellRaw(w, cp.r1, cp.c1, cv);
    return asNum(evalOverSheet(w, formula));
  }));
  return { ok: true, matrix };
}
