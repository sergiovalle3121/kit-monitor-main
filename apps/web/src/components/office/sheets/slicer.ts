/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Segmentaciones de datos (slicers) y escala de tiempo — núcleo PURO sobre `celldata`.
 *
 * Un **slicer** filtra una tabla por los **valores seleccionados** de una columna (botones tipo Excel);
 * una **escala de tiempo** filtra una columna de fecha por un **rango [desde, hasta]**. Varios slicers
 * sobre la misma tabla se combinan con **Y** (una fila se oculta si CUALQUIER slicer la rechaza). El
 * resultado se aplica ocultando filas con `sheet.config.rowhidden = { [fila]: 0 }` (convención
 * Fortune-Sheet). Lógica pura → testeable sin la rejilla.
 */
import { parseRange } from '@/lib/office/charts';

export interface Slicer {
  id: string;
  range: string;        // rango de la tabla (incluye encabezado)
  colRel: number;       // columna relativa dentro del rango
  header: string;       // etiqueta (texto del encabezado)
  selected: string[] | null; // valores marcados; `null` = todos
}

export interface Timeline {
  id: string;
  range: string;
  colRel: number;
  header: string;
  from?: string | null; // ISO/serial; vacío = sin límite inferior
  to?: string | null;
}

/** Valor de presentación de una celda (texto). */
function disp(v: any): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return String(v.m ?? v.v ?? '');
  return String(v);
}

/** Convierte a número (fecha serial o número) para comparar la escala de tiempo. */
function toNum(v: any): number | null {
  const raw = v && typeof v === 'object' ? (v.v ?? v.m) : v;
  if (typeof raw === 'number') return raw;
  if (raw instanceof Date) return raw.getTime();
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const d = Date.parse(s);
  if (!Number.isNaN(d)) return d;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

const dateNum = (s?: string | null): number | null => {
  if (s == null || s === '') return null;
  const d = Date.parse(String(s));
  if (!Number.isNaN(d)) return d;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
};

/** Mapa `"r_c" → celda` para acceso O(1). */
function cellMap(sheet: any): Map<string, any> {
  const m = new Map<string, any>();
  for (const cd of sheet?.celldata ?? []) m.set(`${cd.r}_${cd.c}`, cd.v);
  return m;
}

/** Valores distintos (ordenados) de la columna de un slicer — el conjunto de botones. */
export function slicerValues(sheet: any, range: string, colRel: number): string[] {
  const rng = parseRange(range); if (!rng) return [];
  const map = cellMap(sheet);
  const c = rng.c1 + colRel;
  const seen = new Set<string>();
  for (let r = rng.r1 + 1; r <= rng.r2; r++) { // +1: salta el encabezado
    const s = disp(map.get(`${r}_${c}`));
    if (s !== '') seen.add(s);
  }
  return Array.from(seen).sort((a, b) => {
    const na = Number(a), nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b, 'es');
  });
}

/** ¿La fila de datos `r` pasa el slicer de valores? */
function passSlicer(map: Map<string, any>, rng: any, s: Slicer, r: number): boolean {
  if (s.selected == null) return true;            // todos
  if (s.selected.length === 0) return false;      // ninguno → oculta todo
  return s.selected.includes(disp(map.get(`${r}_${rng.c1 + s.colRel}`)));
}

/** ¿La fila de datos `r` pasa la escala de tiempo? */
function passTimeline(map: Map<string, any>, rng: any, t: Timeline, r: number): boolean {
  const n = toNum(map.get(`${r}_${rng.c1 + t.colRel}`));
  if (n == null) return false;
  const lo = dateNum(t.from), hi = dateNum(t.to);
  if (lo != null && n < lo) return false;
  if (hi != null && n > hi) return false;
  return true;
}

/**
 * Recalcula `sheet.config.rowhidden` a partir de TODOS los slicers y escalas de tiempo de la hoja
 * (`sheet.slicers`, `sheet.timelines`). Combina con Y. Devuelve el nº de filas ocultas.
 */
export function applySlicers(sheet: any): number {
  if (!sheet) return 0;
  const slicers: Slicer[] = Array.isArray(sheet.slicers) ? sheet.slicers : [];
  const timelines: Timeline[] = Array.isArray(sheet.timelines) ? sheet.timelines : [];
  sheet.config = sheet.config || {};
  const hidden: Record<number, number> = {};
  // El rango de datos abarca el de todos los filtros (se asume una tabla común).
  const all = [...slicers, ...timelines];
  if (!all.length) { delete sheet.config.rowhidden; return 0; }
  const map = cellMap(sheet);
  let r1 = Infinity, r2 = -Infinity;
  for (const f of all) { const rng = parseRange(f.range); if (rng) { r1 = Math.min(r1, rng.r1 + 1); r2 = Math.max(r2, rng.r2); } }
  if (!Number.isFinite(r1)) return 0;
  let count = 0;
  for (let r = r1; r <= r2; r++) {
    let visible = true;
    for (const s of slicers) { const rng = parseRange(s.range); if (rng && !passSlicer(map, rng, s, r)) { visible = false; break; } }
    if (visible) for (const t of timelines) { const rng = parseRange(t.range); if (rng && !passTimeline(map, rng, t, r)) { visible = false; break; } }
    if (!visible) { hidden[r] = 0; count++; }
  }
  if (count) sheet.config.rowhidden = hidden; else delete sheet.config.rowhidden;
  return count;
}

const uid = () => Math.random().toString(36).slice(2, 9);

/** Crea un slicer (todos los valores marcados) para una columna de la tabla. */
export function makeSlicer(range: string, colRel: number, header: string): Slicer {
  return { id: uid(), range, colRel, header, selected: null };
}

/** Crea una escala de tiempo para una columna de fecha. */
export function makeTimeline(range: string, colRel: number, header: string): Timeline {
  return { id: uid(), range, colRel, header, from: null, to: null };
}
