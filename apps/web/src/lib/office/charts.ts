/* eslint-disable @typescript-eslint/no-explicit-any */
/** Build Chart.js datasets from a Fortune-sheet range (A1 notation). */

export type ChartType = 'bar' | 'line' | 'pie' | 'doughnut' | 'scatter';

export interface ChartConfig {
  id: string;
  type: ChartType;
  title: string;
  range: string;       // e.g. "A1:C8"
  sheetIndex: number;  // which sheet the range refers to
}

export const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: 'bar', label: 'Barras' },
  { value: 'line', label: 'Líneas' },
  { value: 'pie', label: 'Pastel' },
  { value: 'doughnut', label: 'Dona' },
  { value: 'scatter', label: 'Dispersión' },
];

export const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#7c3aed', '#ec4899', '#14b8a6', '#f97316'];

function colToNum(s: string): number {
  let n = 0;
  for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
function parseRef(ref: string): { r: number; c: number } | null {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!m) return null;
  return { c: colToNum(m[1]), r: parseInt(m[2], 10) - 1 };
}
export function parseRange(range: string) {
  if (!range) return null;
  const [a, b] = range.toUpperCase().replace(/\s/g, '').split(':');
  const A = parseRef(a);
  const B = b ? parseRef(b) : A;
  if (!A || !B) return null;
  return { r1: Math.min(A.r, B.r), c1: Math.min(A.c, B.c), r2: Math.max(A.r, B.r), c2: Math.max(A.c, B.c) };
}

function cellMap(sheet: any): Map<string, any> {
  const m = new Map<string, any>();
  for (const cell of sheet?.celldata ?? []) {
    const v = cell.v;
    m.set(`${cell.r},${cell.c}`, v && typeof v === 'object' ? (v.v ?? v.m ?? null) : v);
  }
  return m;
}
const num = (v: any) => (typeof v === 'number' ? v : (v == null || v === '' ? null : Number(v))) ?? 0;

/** Returns a Chart.js `data` object, or null when the range is invalid/empty. */
export function buildChartData(sheet: any, cfg: ChartConfig): any | null {
  const rng = parseRange(cfg.range);
  if (!rng || !sheet) return null;
  const map = cellMap(sheet);
  const get = (r: number, c: number) => map.get(`${r},${c}`);
  const maxRow = Math.min(rng.r2, rng.r1 + 1000);

  if (cfg.type === 'scatter') {
    const data: { x: number; y: number }[] = [];
    for (let r = rng.r1 + 1; r <= maxRow; r++) {
      data.push({ x: num(get(r, rng.c1)), y: num(get(r, rng.c1 + 1)) });
    }
    return { datasets: [{ label: String(get(rng.r1, rng.c1 + 1) ?? 'Datos'), data, backgroundColor: PALETTE[0] }] };
  }

  const labels: string[] = [];
  for (let r = rng.r1 + 1; r <= maxRow; r++) labels.push(String(get(r, rng.c1) ?? ''));

  const isPie = cfg.type === 'pie' || cfg.type === 'doughnut';
  const datasets: any[] = [];
  let si = 0;
  for (let c = rng.c1 + 1; c <= rng.c2; c++) {
    const data: number[] = [];
    for (let r = rng.r1 + 1; r <= maxRow; r++) data.push(num(get(r, c)));
    const name = String(get(rng.r1, c) ?? `Serie ${c - rng.c1}`);
    datasets.push(isPie
      ? { label: name, data, backgroundColor: data.map((_, i) => PALETTE[i % PALETTE.length]) }
      : { label: name, data, backgroundColor: PALETTE[si % PALETTE.length], borderColor: PALETTE[si % PALETTE.length], borderWidth: 2 });
    si++;
    if (isPie) break; // pie/doughnut use a single series
  }
  if (!datasets.length) return null;
  return { labels, datasets };
}
