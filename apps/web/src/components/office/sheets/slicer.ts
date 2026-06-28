/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Segmentaciones de datos (slicers) y escala de tiempo — núcleo PURO sobre `celldata`.
 *
 * Persisted AXOS models live in workbook/sheet JSON as `AxosSlicer` and
 * `AxosTimelineFilter`. Legacy aliases (`Slicer`, `Timeline`) remain exported so
 * existing SheetEditor wiring and stored documents keep working.
 */
import { parseRange } from '@/lib/office/charts';
import type { PivotConfig } from '@/lib/office/sheetOps';

export interface AxosSlicer {
  id: string;
  range: string;        // rango de la tabla (incluye encabezado)
  colRel: number;       // columna relativa dentro del rango
  header: string;       // etiqueta (texto del encabezado)
  selected: string[] | null; // valores marcados; `null` = todos
  targetPivotIds?: string[]; // vacío/undefined = puede aplicar a cualquier pivot del mismo rango
}

export interface AxosTimelineFilter {
  id: string;
  range: string;
  colRel: number;
  header: string;
  from?: string | null; // ISO/serial; vacío = sin límite inferior
  to?: string | null;
  targetPivotIds?: string[];
}

export type Slicer = AxosSlicer;
export type Timeline = AxosTimelineFilter;
export type AxosDateFilter = Pick<AxosTimelineFilter, 'from' | 'to'>;

/** Valor de presentación de una celda (texto). */
function disp(v: any): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return String(v.m ?? v.v ?? '');
  return String(v);
}

/** Convierte a número (fecha serial, timestamp o fecha parseable) para comparar escalas de tiempo. */
function toDateComparable(v: any): number | null {
  const raw = v && typeof v === 'object' ? (v.v ?? v.m) : v;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (raw instanceof Date) return raw.getTime();
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const d = Date.parse(s);
  if (!Number.isNaN(d)) return d;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

export const dateFilterBoundary = (s?: string | null): number | null => toDateComparable(s);

/** Mapa `"r_c" → celda` para acceso O(1). */
function cellMap(sheet: any): Map<string, any> {
  const m = new Map<string, any>();
  for (const cd of sheet?.celldata ?? []) m.set(`${cd.r}_${cd.c}`, cd.v);
  return m;
}

function headerAt(sheet: any, range: string, colRel: number): string {
  const rng = parseRange(range); if (!rng) return '';
  return disp(cellMap(sheet).get(`${rng.r1}_${rng.c1 + colRel}`));
}

/** Valores distintos (ordenados) de la columna de un slicer — el conjunto de botones. */
export function slicerValues(sheet: any, range: string, colRel: number): string[] {
  const rng = parseRange(range); if (!rng) return [];
  const map = cellMap(sheet);
  const c = rng.c1 + colRel;
  const seen = new Set<string>();
  for (let r = rng.r1 + 1; r <= rng.r2; r++) {
    const s = disp(map.get(`${r}_${c}`));
    if (s !== '') seen.add(s);
  }
  return Array.from(seen).sort((a, b) => {
    const na = Number(a), nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b, 'es', { numeric: true });
  });
}

export const axosUniqueValues = slicerValues;

export function matchesAxosDateFilter(raw: any, filter: AxosDateFilter): boolean {
  const n = toDateComparable(raw);
  if (n == null) return false;
  const lo = dateFilterBoundary(filter.from), hi = dateFilterBoundary(filter.to);
  if (lo != null && n < lo) return false;
  if (hi != null && n > hi) return false;
  return true;
}

/** Devuelve los valores únicos de una columna que caen dentro de un filtro de fecha. */
export function dateFilteredValues(sheet: any, range: string, colRel: number, filter: AxosDateFilter): string[] {
  const rng = parseRange(range); if (!rng) return [];
  const map = cellMap(sheet);
  const c = rng.c1 + colRel;
  const seen = new Set<string>();
  for (let r = rng.r1 + 1; r <= rng.r2; r++) {
    const raw = map.get(`${r}_${c}`);
    if (matchesAxosDateFilter(raw, filter)) seen.add(disp(raw));
  }
  return Array.from(seen).sort((a, b) => (dateFilterBoundary(a) ?? 0) - (dateFilterBoundary(b) ?? 0));
}

function passSlicer(map: Map<string, any>, rng: any, s: AxosSlicer, r: number): boolean {
  if (s.selected == null) return true;
  if (s.selected.length === 0) return false;
  return s.selected.includes(disp(map.get(`${r}_${rng.c1 + s.colRel}`)));
}

function passTimeline(map: Map<string, any>, rng: any, t: AxosTimelineFilter, r: number): boolean {
  return matchesAxosDateFilter(map.get(`${r}_${rng.c1 + t.colRel}`), t);
}

/**
 * Recalcula `sheet.config.rowhidden` a partir de TODOS los slicers y escalas de tiempo de la hoja.
 * Combina con Y. Devuelve el nº de filas ocultas.
 */
export function applySlicers(sheet: any): number {
  if (!sheet) return 0;
  const slicers: AxosSlicer[] = Array.isArray(sheet.slicers) ? sheet.slicers : [];
  const timelines: AxosTimelineFilter[] = Array.isArray(sheet.timelines) ? sheet.timelines : [];
  sheet.config = sheet.config || {};
  const hidden: Record<number, number> = {};
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

function shouldApplyToPivot(filter: AxosSlicer | AxosTimelineFilter, pivotId?: string): boolean {
  return !pivotId || !filter.targetPivotIds?.length || filter.targetPivotIds.includes(pivotId);
}

/**
 * Projects AXOS slicer/timeline state into a pivot config without mutating the original config.
 * Timeline filters are represented as pivot include-filters over the date column values that pass
 * the selected date window, so the existing pivot engine remains unchanged.
 */
export function applySlicersToPivotConfig(sheet: any, pivot: PivotConfig, filters: { slicers?: AxosSlicer[]; timelines?: AxosTimelineFilter[]; pivotId?: string } = {}): PivotConfig {
  const next: PivotConfig = { ...pivot, filters: [...(pivot.filters ?? [])] };
  const merge = (field: string, include: string[]) => {
    const ix = next.filters!.findIndex((f) => f.field === field);
    if (ix >= 0) {
      const existing = new Set(next.filters![ix].include.map(String));
      next.filters![ix] = { field, include: include.filter((v) => existing.has(String(v))) };
    } else next.filters!.push({ field, include });
  };
  for (const s of filters.slicers ?? []) {
    if (!shouldApplyToPivot(s, filters.pivotId) || s.selected == null) continue;
    merge(s.header || headerAt(sheet, s.range, s.colRel), s.selected.map(String));
  }
  for (const t of filters.timelines ?? []) {
    if (!shouldApplyToPivot(t, filters.pivotId)) continue;
    merge(t.header || headerAt(sheet, t.range, t.colRel), dateFilteredValues(sheet, t.range, t.colRel, t));
  }
  return next;
}

const uid = () => Math.random().toString(36).slice(2, 9);

export function makeSlicer(range: string, colRel: number, header: string): AxosSlicer {
  return { id: uid(), range, colRel, header, selected: null };
}

export function makeTimeline(range: string, colRel: number, header: string): AxosTimelineFilter {
  return { id: uid(), range, colRel, header, from: null, to: null };
}
