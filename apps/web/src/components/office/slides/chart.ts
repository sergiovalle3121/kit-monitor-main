/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Motor de gráficos para las diapositivas. Un gráfico es un `Group` de Fabric
 * que lleva una prop custom `chartSpec` (datos + tipo). Se dibuja con
 * primitivas nativas (rect/línea/polilínea/path/texto) para que rasterice en
 * PDF/PNG/presentación; el export .pptx lo convierte en un gráfico nativo
 * editable de PowerPoint usando el mismo `chartSpec`. Sin dependencias nuevas.
 */
import { Group, Rect, Line, Polyline, Polygon, Path, Circle, FabricText } from 'fabric';

export type ChartType = 'bar' | 'line' | 'area' | 'pie';
export interface ChartSeries { name: string; data: number[] }
export interface ChartSpec {
  type: ChartType;
  title: string;
  labels: string[];
  series: ChartSeries[];
  palette?: string[];
}

export const CHART_PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#7c3aed', '#ec4899', '#14b8a6', '#f97316'];

export const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: 'bar', label: 'Barras' },
  { value: 'line', label: 'Líneas' },
  { value: 'area', label: 'Área' },
  { value: 'pie', label: 'Pastel' },
];

export function defaultChartSpec(): ChartSpec {
  return {
    type: 'bar',
    title: 'Gráfico',
    labels: ['Trim 1', 'Trim 2', 'Trim 3', 'Trim 4'],
    series: [
      { name: 'Serie 1', data: [12, 19, 9, 17] },
      { name: 'Serie 2', data: [8, 11, 14, 6] },
    ],
  };
}

export function isChart(o: any): boolean {
  return !!o && o.type === 'group' && !!o.chartSpec;
}

const niceNum = (n: number) => {
  if (!isFinite(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 1000) return `${Math.round(n / 100) / 10}k`;
  return `${Math.round(n * 100) / 100}`;
};

interface BuildOpts { width?: number; height?: number; left?: number; top?: number; text?: string; font?: string }

/** Construye (o reconstruye) el `Group` de Fabric que representa el gráfico. */
export function buildChartGroup(spec: ChartSpec, opts: BuildOpts = {}): any {
  const W = opts.width ?? 480;
  const H = opts.height ?? 300;
  const tc = opts.text ?? '#334155';
  const font = opts.font ?? 'sans-serif';
  const grid = '#e5e7eb';
  const axis = '#cbd5e1';
  const pal = spec.palette ?? CHART_PALETTE;
  const kids: any[] = [];

  const txt = (s: string, x: number, y: number, size: number, color: string, o: any = {}) =>
    new FabricText(String(s), { left: x, top: y, fontSize: size, fill: color, fontFamily: font, originX: 'left', originY: 'top', ...o });

  // Tarjeta de fondo (da unidad visual al gráfico).
  kids.push(new Rect({ left: 0, top: 0, width: W, height: H, fill: '#ffffff', rx: 14, ry: 14, stroke: grid, strokeWidth: 1 }));

  const hasTitle = !!spec.title?.trim();
  if (hasTitle) kids.push(txt(spec.title, W / 2, 12, 15, tc, { originX: 'center', fontWeight: 'bold' }));

  if (spec.type === 'pie') {
    buildPie(spec, kids, { W, H, tc, font, pal, padT: hasTitle ? 36 : 14 });
  } else {
    buildCartesian(spec, kids, { W, H, tc, font, pal, grid, axis, padT: hasTitle ? 36 : 16 });
  }

  // Leyenda (centrada abajo).
  const legendItems = spec.type === 'pie' ? spec.labels : spec.series.map((s) => s.name);
  buildLegend(legendItems, kids, { W, H, tc, font, pal });

  const g = new Group(kids, { subTargetCheck: false } as any);
  g.set({ left: opts.left ?? 120, top: opts.top ?? 90 });
  (g as any).chartSpec = spec;
  g.setCoords();
  return g;
}

function buildCartesian(spec: ChartSpec, kids: any[], ctx: any) {
  const { W, H, tc, font, pal, grid, axis, padT } = ctx;
  const padL = 46, padR = 16, padB = 50;
  const plotL = padL, plotR = W - padR, plotT = padT, plotB = H - padB;
  const plotW = plotR - plotL, plotH = plotB - plotT;
  const nCat = Math.max(1, spec.labels.length);

  const all = spec.series.flatMap((s) => s.data.filter((v) => typeof v === 'number' && isFinite(v)));
  const rawMax = all.length ? Math.max(...all) : 1;
  const rawMin = Math.min(0, all.length ? Math.min(...all) : 0);
  const max = rawMax === rawMin ? rawMax + 1 : rawMax;
  const range = max - rawMin || 1;
  const y = (v: number) => plotB - ((v - rawMin) / range) * plotH;

  // Cuadrícula + etiquetas del eje Y.
  for (let t = 0; t <= 4; t++) {
    const val = rawMin + (range * t) / 4;
    const yy = y(val);
    kids.push(new Line([plotL, yy, plotR, yy], { stroke: grid, strokeWidth: 1 }));
    kids.push(new FabricText(niceNum(val), { left: plotL - 6, top: yy, fontSize: 10, fill: tc, fontFamily: font, originX: 'right', originY: 'center', opacity: 0.8 }));
  }
  // Eje X.
  kids.push(new Line([plotL, plotB, plotR, plotB], { stroke: axis, strokeWidth: 1.5 }));

  if (spec.type === 'bar') {
    const groupW = plotW / nCat;
    const nSer = Math.max(1, spec.series.length);
    const bw = (groupW * 0.72) / nSer;
    const base = y(0);
    spec.series.forEach((s, si) => {
      for (let ci = 0; ci < nCat; ci++) {
        const v = s.data[ci] ?? 0;
        const x = plotL + ci * groupW + groupW * 0.14 + si * bw;
        const top = y(v);
        kids.push(new Rect({ left: x, top: Math.min(base, top), width: Math.max(1, bw * 0.9), height: Math.max(1, Math.abs(base - top)), fill: pal[si % pal.length], rx: 2, ry: 2 }));
      }
    });
  } else {
    const xAt = (ci: number) => (nCat === 1 ? plotL + plotW / 2 : plotL + (ci * plotW) / (nCat - 1));
    spec.series.forEach((s, si) => {
      const color = pal[si % pal.length];
      const pts = spec.labels.map((_, ci) => ({ x: xAt(ci), y: y(s.data[ci] ?? 0) }));
      if (spec.type === 'area') {
        const poly = [...pts, { x: xAt(nCat - 1), y: y(0) }, { x: xAt(0), y: y(0) }];
        kids.push(new Polygon(poly, { fill: hexA(color, 0.22), stroke: '', selectable: false } as any));
      }
      kids.push(new Polyline(pts, { stroke: color, strokeWidth: 2.5, fill: '', selectable: false } as any));
      pts.forEach((p) => kids.push(new Circle({ left: p.x, top: p.y, radius: 3, fill: color, originX: 'center', originY: 'center' })));
    });
  }

  // Etiquetas del eje X.
  const step = plotW / nCat;
  spec.labels.forEach((lb, ci) => {
    const cx = spec.type === 'bar' ? plotL + ci * step + step / 2 : (nCat === 1 ? plotL + plotW / 2 : plotL + (ci * plotW) / (nCat - 1));
    kids.push(new FabricText(String(lb), { left: cx, top: plotB + 7, fontSize: 10, fill: tc, fontFamily: font, originX: 'center', originY: 'top', opacity: 0.85 }));
  });
}

function buildPie(spec: ChartSpec, kids: any[], ctx: any) {
  const { W, H, pal, padT } = ctx;
  const data = (spec.series[0]?.data ?? []).map((v) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : 0));
  const total = data.reduce((a, b) => a + b, 0);
  const cx = W / 2, cy = padT + (H - padT - 56) / 2, r = Math.min(W - 40, H - padT - 70) / 2;
  if (total <= 0) return;
  const nonZero = data.filter((v) => v > 0).length;
  if (nonZero === 1) {
    const idx = data.findIndex((v) => v > 0);
    kids.push(new Circle({ left: cx, top: cy, radius: r, fill: pal[idx % pal.length], originX: 'center', originY: 'center' }));
    return;
  }
  let a0 = -Math.PI / 2;
  data.forEach((v, i) => {
    if (v <= 0) return;
    const a1 = a0 + (v / total) * Math.PI * 2;
    kids.push(new Path(wedgePath(cx, cy, r, a0, a1), { fill: pal[i % pal.length], stroke: '#ffffff', strokeWidth: 1.5 } as any));
    a0 = a1;
  });
}

function buildLegend(items: string[], kids: any[], ctx: any) {
  const { W, H, tc, font, pal } = ctx;
  if (!items.length) return;
  const y = H - 26;
  const sw = 11, gap = 6, pad = 16;
  const widths = items.map((s) => sw + gap + approxTextWidth(String(s), 10) + pad);
  const total = widths.reduce((a, b) => a + b, 0);
  let x = Math.max(8, (W - total) / 2);
  items.forEach((s, i) => {
    kids.push(new Rect({ left: x, top: y, width: sw, height: sw, fill: pal[i % pal.length], rx: 2, ry: 2 }));
    kids.push(new FabricText(String(s), { left: x + sw + gap, top: y + sw / 2, fontSize: 10, fill: tc, fontFamily: font, originX: 'left', originY: 'center' }));
    x += widths[i];
  });
}

function wedgePath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
}
function approxTextWidth(s: string, size: number) { return s.length * size * 0.58; }
function hexA(hex: string, a: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
