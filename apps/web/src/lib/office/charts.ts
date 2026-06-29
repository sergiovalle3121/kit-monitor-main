/* eslint-disable @typescript-eslint/no-explicit-any */
/** Build Chart.js datasets from a Fortune-sheet range (A1 notation). */

export type ChartType = 'column' | 'bar' | 'line' | 'area' | 'pie' | 'doughnut' | 'pareto' | 'gauge' | 'scatter' | 'radar' | 'polarArea' | 'bubble' | 'combo';
export type LegendPos = 'top' | 'bottom' | 'left' | 'right' | 'none';
export type SeriesKind = 'bar' | 'line' | 'area';

/** Ajustes por serie (para combos, eje secundario y color). */
export interface SeriesOpt { type?: SeriesKind; axis?: 'y' | 'y1'; color?: string }

export type ChartSourceKind = 'range' | 'table' | 'pivot';
export interface ChartSource { kind: ChartSourceKind; id?: string; label?: string }

export interface ChartConfig {
  id: string;
  type: ChartType;
  title: string;
  range: string;       // e.g. "A1:C8"
  sheetIndex: number;  // which sheet the range refers to
  legend?: LegendPos;  // posición de la leyenda (def. bottom)
  stacked?: boolean;   // barras/area apiladas
  palette?: string;    // nombre de paleta (def. brand)
  xTitle?: string;     // título del eje X
  yTitle?: string;     // título del eje Y primario
  y1Title?: string;    // título del eje Y secundario
  series?: SeriesOpt[]; // ajustes por serie (combo / eje secundario / color)
  source?: ChartSource; // rango libre, tabla guardada o resultado de pivot
}

export const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: 'column', label: 'Columnas' },
  { value: 'bar', label: 'Barras' },
  { value: 'line', label: 'Líneas' },
  { value: 'area', label: 'Área' },
  { value: 'combo', label: 'Combinado (barras + líneas)' },
  { value: 'pie', label: 'Pastel' },
  { value: 'doughnut', label: 'Dona' },
  { value: 'pareto', label: 'Pareto' },
  { value: 'gauge', label: 'Gauge' },
  { value: 'radar', label: 'Radar' },
  { value: 'polarArea', label: 'Polar' },
  { value: 'scatter', label: 'Dispersión' },
  { value: 'bubble', label: 'Burbuja' },
];

/** Paletas de color seleccionables para las gráficas. */
export const PALETTES: Record<string, string[]> = {
  brand: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#7c3aed', '#ec4899', '#14b8a6', '#f97316'],
  ocean: ['#0ea5e9', '#2563eb', '#14b8a6', '#06b6d4', '#6366f1', '#0d9488', '#3b82f6', '#22d3ee'],
  sunset: ['#f97316', '#ef4444', '#f59e0b', '#ec4899', '#e11d48', '#fb7185', '#fbbf24', '#f43f5e'],
  forest: ['#16a34a', '#65a30d', '#10b981', '#84cc16', '#15803d', '#22c55e', '#4d7c0f', '#34d399'],
  mono: ['#111827', '#374151', '#6b7280', '#9ca3af', '#4b5563', '#1f2937', '#d1d5db', '#9ca3af'],
};

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
const num = (v: any) => { const n = typeof v === 'number' ? v : (v == null || v === '' ? NaN : Number(v)); return Number.isFinite(n) ? n : 0; };

const hexA = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};

/** Returns a Chart.js `data` object, or null when the range is invalid/empty. */
export function buildChartData(sheet: any, cfg: ChartConfig): any | null {
  const rng = parseRange(cfg.range);
  if (!rng || !sheet) return null;
  const pal = PALETTES[cfg.palette || 'brand'] || PALETTES.brand;
  const map = cellMap(sheet);
  const get = (r: number, c: number) => map.get(`${r},${c}`);
  const maxRow = Math.min(rng.r2, rng.r1 + 1000);

  if (cfg.type === 'scatter') {
    const data: { x: number; y: number }[] = [];
    for (let r = rng.r1 + 1; r <= maxRow; r++) {
      data.push({ x: num(get(r, rng.c1)), y: num(get(r, rng.c1 + 1)) });
    }
    return { datasets: [{ label: String(get(rng.r1, rng.c1 + 1) ?? 'Datos'), data, backgroundColor: pal[0] }] };
  }

  if (cfg.type === 'bubble') {
    // Columnas: X, Y, Tamaño. Escala el radio a 4–24 px.
    const raw: { x: number; y: number; s: number }[] = [];
    for (let r = rng.r1 + 1; r <= maxRow; r++) raw.push({ x: num(get(r, rng.c1)), y: num(get(r, rng.c1 + 1)), s: num(get(r, rng.c1 + 2)) });
    const sizes = raw.map((p) => p.s); const smin = sizes.length ? Math.min(...sizes) : 0, smax = sizes.length ? Math.max(...sizes) : 1;
    const data = raw.map((p) => ({ x: p.x, y: p.y, r: 4 + ((p.s - smin) / (smax - smin || 1)) * 20 }));
    return { datasets: [{ label: String(get(rng.r1, rng.c1 + 1) ?? 'Datos'), data, backgroundColor: hexA(pal[0], 0.55), borderColor: pal[0] }] };
  }

  const labels: string[] = [];
  for (let r = rng.r1 + 1; r <= maxRow; r++) labels.push(String(get(r, rng.c1) ?? ''));

  if (cfg.type === 'gauge') {
    let value = 0;
    let label = String(get(rng.r1 + 1, rng.c1) ?? get(rng.r1, rng.c1 + 1) ?? 'Valor');
    for (let r = rng.r1 + 1; r <= maxRow; r++) {
      const n = num(get(r, rng.c1 + 1));
      if (Number.isFinite(n)) { value = Math.max(0, Math.min(100, n)); label = String(get(r, rng.c1) ?? label); break; }
    }
    return { labels: [label, 'Restante'], datasets: [{ label, data: [value, Math.max(0, 100 - value)], backgroundColor: [pal[0], '#e5e7eb'], borderWidth: 0, circumference: 180, rotation: 270 }] };
  }

  const isPie = cfg.type === 'pie' || cfg.type === 'doughnut' || cfg.type === 'polarArea';
  const isRadar = cfg.type === 'radar';
  const datasets: any[] = [];
  if (cfg.type === 'pareto') {
    const points: { label: string; value: number }[] = [];
    for (let r = rng.r1 + 1; r <= maxRow; r++) points.push({ label: String(get(r, rng.c1) ?? ''), value: num(get(r, rng.c1 + 1)) });
    points.sort((a, b) => b.value - a.value);
    const total = points.reduce((sum, p) => sum + p.value, 0) || 1;
    let running = 0;
    return { labels: points.map((p) => p.label), datasets: [
      { label: String(get(rng.r1, rng.c1 + 1) ?? 'Valor'), data: points.map((p) => p.value), backgroundColor: pal[0], borderColor: pal[0], borderWidth: 1, yAxisID: 'y' },
      { label: 'Acumulado %', type: 'line', data: points.map((p) => { running += p.value; return Math.round((running / total) * 1000) / 10; }), borderColor: pal[2] ?? '#f59e0b', backgroundColor: pal[2] ?? '#f59e0b', tension: 0.25, yAxisID: 'y1' },
    ] };
  }

  let si = 0;
  for (let c = rng.c1 + 1; c <= rng.c2; c++) {
    const data: number[] = [];
    for (let r = rng.r1 + 1; r <= maxRow; r++) data.push(num(get(r, c)));
    const name = String(get(rng.r1, c) ?? `Serie ${c - rng.c1}`);
    const opt = cfg.series?.[si] ?? {};
    const color = opt.color || pal[si % pal.length];
    // Tipo efectivo de la serie: en «combo», cada serie define el suyo (def. barra).
    const kind: SeriesKind = cfg.type === 'combo' ? (opt.type ?? (si === 0 ? 'bar' : 'line'))
      : cfg.type === 'area' ? 'area' : cfg.type === 'line' ? 'line' : (cfg.type === 'bar' || cfg.type === 'column') ? 'bar' : 'bar';
    const isAreaSeries = kind === 'area';
    if (isPie) {
      datasets.push({ label: name, data, backgroundColor: data.map((_, i) => pal[i % pal.length]), borderWidth: 1 });
      break; // pie/doughnut/polar usan una sola serie
    }
    if (isRadar) {
      datasets.push({ label: name, data, backgroundColor: hexA(color, 0.25), borderColor: color, borderWidth: 2, fill: true });
      si++; continue;
    }
    datasets.push({
      label: name, data,
      type: cfg.type === 'combo' ? (isAreaSeries ? 'line' : kind) : undefined,
      backgroundColor: isAreaSeries ? hexA(color, 0.25) : color,
      borderColor: color, borderWidth: 2,
      fill: isAreaSeries,
      tension: isAreaSeries || kind === 'line' ? 0.3 : 0,
      pointRadius: isAreaSeries || kind === 'line' ? 2 : 3,
      yAxisID: opt.axis === 'y1' ? 'y1' : 'y',
    });
    si++;
  }
  if (!datasets.length) return null;
  return { labels, datasets };
}

/** ¿Alguna serie usa el eje secundario? */
export function usesSecondaryAxis(cfg: ChartConfig): boolean {
  return cfg.type === 'pareto' || !!cfg.series?.some((s) => s?.axis === 'y1');
}

/** Nombres de las series (cabeceras de columnas 2..n del rango). Para el editor. */
export function seriesLabels(sheet: any, range: string): string[] {
  const rng = parseRange(range); if (!rng || !sheet) return [];
  const map = cellMap(sheet);
  const out: string[] = [];
  for (let c = rng.c1 + 1; c <= rng.c2; c++) out.push(String(map.get(`${rng.r1},${c}`) ?? `Serie ${c - rng.c1}`));
  return out;
}

/** Tipo real de Chart.js para un ChartConfig (área→línea; combo→barra base). */
export function chartJsType(t: ChartType): string {
  return t === 'area' ? 'line' : t === 'combo' || t === 'column' || t === 'pareto' ? 'bar' : t === 'gauge' ? 'doughnut' : t;
}
