/* eslint-disable @typescript-eslint/no-explicit-any */
/** Build Chart.js datasets from a Fortune-sheet range (A1 notation). */

export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'doughnut' | 'scatter' | 'radar' | 'polarArea';
export type LegendPos = 'top' | 'bottom' | 'left' | 'right' | 'none';

export interface ChartConfig {
  id: string;
  type: ChartType;
  title: string;
  range: string;       // e.g. "A1:C8"
  sheetIndex: number;  // which sheet the range refers to
  legend?: LegendPos;  // posición de la leyenda (def. bottom)
  stacked?: boolean;   // barras/area apiladas
  palette?: string;    // nombre de paleta (def. brand)
}

export const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: 'bar', label: 'Barras' },
  { value: 'line', label: 'Líneas' },
  { value: 'area', label: 'Área' },
  { value: 'pie', label: 'Pastel' },
  { value: 'doughnut', label: 'Dona' },
  { value: 'radar', label: 'Radar' },
  { value: 'polarArea', label: 'Polar' },
  { value: 'scatter', label: 'Dispersión' },
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
const num = (v: any) => (typeof v === 'number' ? v : (v == null || v === '' ? null : Number(v))) ?? 0;

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

  const labels: string[] = [];
  for (let r = rng.r1 + 1; r <= maxRow; r++) labels.push(String(get(r, rng.c1) ?? ''));

  const isPie = cfg.type === 'pie' || cfg.type === 'doughnut' || cfg.type === 'polarArea';
  const isArea = cfg.type === 'area';
  const isRadar = cfg.type === 'radar';
  const datasets: any[] = [];
  let si = 0;
  for (let c = rng.c1 + 1; c <= rng.c2; c++) {
    const data: number[] = [];
    for (let r = rng.r1 + 1; r <= maxRow; r++) data.push(num(get(r, c)));
    const name = String(get(rng.r1, c) ?? `Serie ${c - rng.c1}`);
    const color = pal[si % pal.length];
    datasets.push(isPie
      ? { label: name, data, backgroundColor: data.map((_, i) => pal[i % pal.length]), borderWidth: 1 }
      : {
        label: name, data,
        backgroundColor: (isArea || isRadar) ? hexA(color, 0.25) : color,
        borderColor: color, borderWidth: 2,
        fill: isArea || isRadar,
        tension: isArea || cfg.type === 'line' ? 0.3 : 0,
        pointRadius: isArea || cfg.type === 'line' ? 2 : 3,
      });
    si++;
    if (isPie) break; // pie/doughnut/polar usan una sola serie
  }
  if (!datasets.length) return null;
  return { labels, datasets };
}

/** Tipo real de Chart.js para un ChartConfig (área se dibuja como línea rellena). */
export function chartJsType(t: ChartType): string {
  return t === 'area' ? 'line' : t;
}
