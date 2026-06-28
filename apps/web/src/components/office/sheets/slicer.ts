/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * AXOS Sheets slicers and timeline filters — pure persistable model over Fortune-Sheet `celldata`.
 *
 * `AxosSlicer` filters a table by selected unique values from one field, while
 * `AxosTimelineFilter` filters date-like fields by a `[from, to]` window. Both are
 * intentionally stored as workbook/sheet JSON metadata so autosave, import/export
 * metadata, pivot refresh, and the inspector can share the same foundation.
 */
import { parseRange } from '@/lib/office/charts';
import type { PivotConfig } from '@/lib/office/sheetOps';

export interface AxosSlicer {
  id: string;
  kind: 'slicer';
  range: string;        // table range including header
  colRel: number;       // relative column inside range
  header: string;       // header/field label
  selected: string[] | null; // null = all values
}

export interface AxosTimelineFilter {
  id: string;
  kind: 'timeline';
  range: string;
  colRel: number;
  header: string;
  from?: string | null; // ISO date, date serial, or empty = no lower bound
  to?: string | null;   // ISO date, date serial, or empty = no upper bound
}

// Backward-compatible aliases for existing editor metadata.
export type Slicer = AxosSlicer;
export type Timeline = AxosTimelineFilter;
export type AxosSheetFilter = AxosSlicer | AxosTimelineFilter;

export interface AxosFilterSummary {
  hiddenRows: Record<number, number>;
  hiddenCount: number;
  visibleCount: number;
  evaluatedRows: number;
}

/** Display value for value buttons and field comparisons. */
function disp(v: any): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return String(v.m ?? v.v ?? '');
  return String(v);
}

/** Converts numbers, Date instances, ISO dates, and Excel serial dates to comparable epoch ms. */
export function axosDateValue(v: any): number | null {
  const raw = v && typeof v === 'object' ? (v.v ?? v.m) : v;
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === 'number') {
    // Excel serial date support: 25569 = 1970-01-01. Keep large timestamps intact.
    if (raw > 0 && raw < 100000) return Math.round((raw - 25569) * 86400000);
    return raw;
  }
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const d = Date.parse(s);
  if (!Number.isNaN(d)) return d;
  const n = Number(s);
  return Number.isNaN(n) ? null : axosDateValue(n);
}

const dateNum = (s?: string | null): number | null => (s == null || s === '') ? null : axosDateValue(s);

/** Map `"r_c" → cell value` for O(1) access. */
function cellMap(sheet: any): Map<string, any> {
  const m = new Map<string, any>();
  for (const cd of sheet?.celldata ?? []) m.set(`${cd.r}_${cd.c}`, cd.v);
  return m;
}

function fieldNameFor(sheet: any, range: string, colRel: number): string | null {
  const rng = parseRange(range); if (!rng) return null;
  return disp(cellMap(sheet).get(`${rng.r1}_${rng.c1 + colRel}`)) || null;
}

/** Unique non-empty values for a column in a table range, sorted naturally. */
export function uniqueValuesForRange(sheet: any, range: string, colRel: number): string[] {
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

/** Backward-compatible name used by the current floating slicer UI. */
export const slicerValues = uniqueValuesForRange;

export function rowPassesTimeline(value: any, filter: Pick<AxosTimelineFilter, 'from' | 'to'>): boolean {
  const n = axosDateValue(value);
  if (n == null) return false;
  const lo = dateNum(filter.from), hi = dateNum(filter.to);
  if (lo != null && n < lo) return false;
  if (hi != null && n > hi) return false;
  return true;
}

function passSlicer(map: Map<string, any>, rng: any, s: AxosSlicer, r: number): boolean {
  if (s.selected == null) return true;
  if (s.selected.length === 0) return false;
  return s.selected.includes(disp(map.get(`${r}_${rng.c1 + s.colRel}`)));
}

function passTimeline(map: Map<string, any>, rng: any, t: AxosTimelineFilter, r: number): boolean {
  return rowPassesTimeline(map.get(`${r}_${rng.c1 + t.colRel}`), t);
}

export function summarizeAxosFilters(sheet: any): AxosFilterSummary {
  const slicers: AxosSlicer[] = Array.isArray(sheet?.slicers) ? sheet.slicers : [];
  const timelines: AxosTimelineFilter[] = Array.isArray(sheet?.timelines) ? sheet.timelines : [];
  const all = [...slicers, ...timelines];
  const hiddenRows: Record<number, number> = {};
  if (!all.length) return { hiddenRows, hiddenCount: 0, visibleCount: 0, evaluatedRows: 0 };
  const map = cellMap(sheet);
  let r1 = Infinity, r2 = -Infinity;
  for (const f of all) { const rng = parseRange(f.range); if (rng) { r1 = Math.min(r1, rng.r1 + 1); r2 = Math.max(r2, rng.r2); } }
  if (!Number.isFinite(r1)) return { hiddenRows, hiddenCount: 0, visibleCount: 0, evaluatedRows: 0 };
  let hiddenCount = 0;
  for (let r = r1; r <= r2; r++) {
    let visible = true;
    for (const s of slicers) { const rng = parseRange(s.range); if (rng && !passSlicer(map, rng, s, r)) { visible = false; break; } }
    if (visible) for (const t of timelines) { const rng = parseRange(t.range); if (rng && !passTimeline(map, rng, t, r)) { visible = false; break; } }
    if (!visible) { hiddenRows[r] = 0; hiddenCount++; }
  }
  const evaluatedRows = r2 - r1 + 1;
  return { hiddenRows, hiddenCount, visibleCount: evaluatedRows - hiddenCount, evaluatedRows };
}

/** Applies sheet-level filters by updating Fortune-Sheet row-hidden metadata. */
export function applySlicers(sheet: any): number {
  if (!sheet) return 0;
  sheet.config = sheet.config || {};
  const summary = summarizeAxosFilters(sheet);
  if (summary.hiddenCount) sheet.config.rowhidden = summary.hiddenRows;
  else delete sheet.config.rowhidden;
  return summary.hiddenCount;
}

/** Applies value slicers to a pivot config without mutating it. Timeline filters remain row-level until pivot date filters are modeled. */
export function applySlicersToPivotConfig(sheet: any, cfg: PivotConfig, slicers: AxosSlicer[] = sheet?.slicers ?? []): PivotConfig {
  const filters = [...(cfg.filters ?? [])];
  for (const slicer of slicers) {
    if (slicer.selected == null) continue;
    const field = fieldNameFor(sheet, slicer.range, slicer.colRel) ?? slicer.header;
    if (!field) continue;
    const include = [...slicer.selected];
    const idx = filters.findIndex((f) => f.field === field);
    if (idx >= 0) filters[idx] = { field, include };
    else filters.push({ field, include });
  }
  return { ...cfg, filters };
}

const uid = () => `ax_${Math.random().toString(36).slice(2, 9)}`;

export function makeSlicer(range: string, colRel: number, header: string): AxosSlicer {
  return { id: uid(), kind: 'slicer', range, colRel, header, selected: null };
}

export function makeTimeline(range: string, colRel: number, header: string): AxosTimelineFilter {
  return { id: uid(), kind: 'timeline', range, colRel, header, from: null, to: null };
}
