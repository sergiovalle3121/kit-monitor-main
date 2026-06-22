/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * «Derramar» (spill) una fórmula matricial dinámica a las celdas vecinas, estilo Excel 365.
 *
 * Las funciones de matriz (UNIQUE/SORT/FILTER/SEQUENCE/…) devuelven una matriz 2D, pero la
 * rejilla (Fortune-Sheet) no derrama sola a las celdas contiguas. Esta operación —de un solo
 * paso, como «transponer» o «tabla dinámica»— evalúa la fórmula de la celda ANCLA con el mismo
 * motor parcheado (lee los valores YA calculados de `celldata`) y ESCRIBE el resultado en el
 * bloque de celdas: el ancla conserva su fórmula (mostrando la esquina) y las vecinas reciben
 * valores estáticos marcados (`spillFrom`). Detecta `#SPILL!` si el rango destino está ocupado.
 *
 * Es PURA sobre el objeto de hoja (sin DOM), así que se prueba de cabo a rabo sin navegador
 * (ver `arraySpill.spec.ts`), igual que el resto del motor.
 */
import { Parser } from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';
import { parseRange } from '@/lib/office/charts';

installFormulaEngine();

/** Índice rápido `${r}_${c}` → celda de `celldata`. */
function celldataMap(sheet: any): Map<string, any> {
  const m = new Map<string, any>();
  for (const cd of sheet?.celldata ?? []) m.set(`${cd.r}_${cd.c}`, cd);
  return m;
}
/** Valor YA calculado de una celda (objeto `{v,m,f}` o primitivo). */
function computedAt(map: Map<string, any>, r: number, c: number): any {
  const cd = map.get(`${r}_${c}`);
  if (!cd) return null;
  const v = cd.v;
  if (v && typeof v === 'object') return v.v ?? v.m ?? null;
  return v ?? null;
}

/** Evalúa una fórmula sobre la hoja (lee valores calculados de `celldata`). */
export function evalOverSheet(sheet: any, formula: string): { result?: any; error?: string } {
  const map = celldataMap(sheet);
  const parser: any = new Parser();
  parser.on('callCellValue', (coord: any, _o: any, done: any) => done(computedAt(map, coord.row.index, coord.column.index) ?? 0));
  parser.on('callRangeValue', (s: any, e: any, _o: any, done: any) => {
    const out: any[][] = [];
    for (let r = s.row.index; r <= e.row.index; r++) { const row: any[] = []; for (let c = s.column.index; c <= e.column.index; c++) row.push(computedAt(map, r, c)); out.push(row); }
    done(out);
  });
  const res = parser.parse(String(formula).replace(/^=/, ''));
  return res.error ? { error: String(res.error) } : { result: res.result };
}

/** Cualquier resultado → matriz 2D (escalar → `[[v]]`; 1D → columna). */
function to2D(v: any): any[][] {
  if (Array.isArray(v)) { if (!v.length) return [[]]; return Array.isArray(v[0]) ? v : v.map((x: any) => [x]); }
  return [[v]];
}

export interface SpillResult { ok: boolean; error?: string; rows?: number; cols?: number }

/** Derrama la fórmula de la celda ancla (`anchorA1`) a un bloque de celdas. Muta `sheet`. */
export function applySpill(sheet: any, anchorA1: string): SpillResult {
  const pos = parseRange(anchorA1);
  if (!pos) return { ok: false, error: 'Celda inválida.' };
  const r0 = pos.r1, c0 = pos.c1;
  const anchorKey = `${r0}_${c0}`;
  sheet.celldata = sheet.celldata || [];
  const map = celldataMap(sheet);
  const anchor = map.get(anchorKey);
  const f = anchor?.v && typeof anchor.v === 'object' ? anchor.v.f : undefined;
  if (!f) return { ok: false, error: 'La celda no contiene una fórmula.' };

  const ev = evalOverSheet(sheet, f);
  if (ev.error) return { ok: false, error: `La fórmula da error: ${ev.error}` };
  const grid = to2D(ev.result);
  const rows = grid.length, cols = grid.reduce((m, r) => Math.max(m, r.length), 0);
  if (!rows || !cols) return { ok: false, error: 'La fórmula no produjo una matriz.' };

  // Conflicto #SPILL!: alguna celda destino (≠ ancla) tiene contenido propio (no de un derrame previo de esta ancla).
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    if (i === 0 && j === 0) continue;
    const cd = map.get(`${r0 + i}_${c0 + j}`);
    if (!cd) continue;
    const cv = cd.v;
    const raw = cv && typeof cv === 'object' ? (cv.v ?? cv.m) : cv;
    const fromHere = cv && typeof cv === 'object' && cv.spillFrom === anchorKey;
    if (raw != null && raw !== '' && !fromHere) return { ok: false, error: '#SPILL! — el rango de derrame no está vacío.' };
  }

  // Limpia derrames previos de esta ancla (no la propia ancla).
  sheet.celldata = sheet.celldata.filter((cd: any) => !(cd.v && typeof cd.v === 'object' && cd.v.spillFrom === anchorKey && !(cd.r === r0 && cd.c === c0)));
  const map2 = celldataMap(sheet);

  // Escribe el bloque: ancla conserva la fórmula (valor = esquina); vecinas = estáticas marcadas.
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const val = grid[i]?.[j] ?? null;
    if (i === 0 && j === 0) {
      const v = anchor.v as any;
      v.v = val; v.m = val == null ? '' : String(val); v.spillAnchor = true;
    } else {
      const key = `${r0 + i}_${c0 + j}`;
      let cd = map2.get(key);
      if (!cd) { cd = { r: r0 + i, c: c0 + j, v: {} }; sheet.celldata.push(cd); }
      cd.v = { v: val, m: val == null ? '' : String(val), spillFrom: anchorKey };
    }
  }
  return { ok: true, rows, cols };
}
