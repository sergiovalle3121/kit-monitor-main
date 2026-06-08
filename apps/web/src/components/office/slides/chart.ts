/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Motor de gráficos para las diapositivas. Un gráfico es un `Group` de Fabric
 * que lleva una prop custom `chartSpec` (datos + tipo). Se dibuja con
 * primitivas nativas (rect/línea/polilínea/path/texto) para que rasterice en
 * PDF/PNG/presentación; el export .pptx lo convierte en un gráfico nativo
 * editable de PowerPoint usando el mismo `chartSpec`. Sin dependencias nuevas.
 */
import { Group, Rect, Line, Polyline, Polygon, Path, Circle, FabricText } from 'fabric';

export type ChartType = 'bar' | 'hbar' | 'line' | 'area' | 'pie' | 'doughnut';
export interface ChartSeries { name: string; data: number[] }
export interface ChartSpec {
  type: ChartType;
  title: string;
  labels: string[];
  series: ChartSeries[];
  palette?: string[];
  stacked?: boolean;
  legend?: boolean;    // mostrar leyenda (def. true)
  showValues?: boolean; // etiquetas de valor
}

export const CHART_PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#7c3aed', '#ec4899', '#14b8a6', '#f97316'];
export const CHART_PALETTES: { id: string; colors: string[] }[] = [
  { id: 'Marca', colors: CHART_PALETTE },
  { id: 'Océano', colors: ['#0ea5e9', '#2563eb', '#14b8a6', '#06b6d4', '#6366f1', '#0d9488', '#3b82f6', '#22d3ee'] },
  { id: 'Atardecer', colors: ['#f97316', '#ef4444', '#f59e0b', '#ec4899', '#e11d48', '#fb7185', '#fbbf24', '#f43f5e'] },
  { id: 'Bosque', colors: ['#16a34a', '#65a30d', '#10b981', '#84cc16', '#15803d', '#22c55e', '#4d7c0f', '#34d399'] },
  { id: 'Mono', colors: ['#111827', '#374151', '#6b7280', '#9ca3af', '#4b5563', '#1f2937', '#d1d5db', '#e5e7eb'] },
];

export const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: 'bar', label: 'Barras' },
  { value: 'hbar', label: 'Barras horiz.' },
  { value: 'line', label: 'Líneas' },
  { value: 'area', label: 'Área' },
  { value: 'pie', label: 'Pastel' },
  { value: 'doughnut', label: 'Dona' },
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

  const isPie = spec.type === 'pie' || spec.type === 'doughnut';
  if (isPie) {
    buildPie(spec, kids, { W, H, tc, font, pal, padT: hasTitle ? 36 : 14, doughnut: spec.type === 'doughnut', showValues: !!spec.showValues });
  } else {
    buildCartesian(spec, kids, { W, H, tc, font, pal, grid, axis, padT: hasTitle ? 36 : 16, horizontal: spec.type === 'hbar', stacked: !!spec.stacked, showValues: !!spec.showValues });
  }

  // Leyenda (centrada abajo).
  if (spec.legend !== false) {
    const legendItems = isPie ? spec.labels : spec.series.map((s) => s.name);
    buildLegend(legendItems, kids, { W, H, tc, font, pal });
  }

  const g = new Group(kids, { subTargetCheck: false } as any);
  g.set({ left: opts.left ?? 120, top: opts.top ?? 90 });
  (g as any).chartSpec = spec;
  g.setCoords();
  return g;
}

function valLabel(kids: any[], s: string, x: number, y: number, font: string, tc: string) {
  kids.push(new FabricText(s, { left: x, top: y, fontSize: 9, fill: tc, fontFamily: font, originX: 'center', originY: 'center', fontWeight: 'bold', opacity: 0.85 }));
}

function buildCartesian(spec: ChartSpec, kids: any[], ctx: any) {
  const { W, H, tc, font, pal, grid, axis, padT, horizontal, stacked, showValues } = ctx;
  const padL = 46, padR = 16, padB = 50;
  const plotL = padL, plotR = W - padR, plotT = padT, plotB = H - padB;
  const plotW = plotR - plotL, plotH = plotB - plotT;
  const nCat = Math.max(1, spec.labels.length);
  const isBar = spec.type === 'bar' || spec.type === 'hbar';
  const nSer = Math.max(1, spec.series.length);

  // Rango de valores (suma por categoría si está apilado).
  let vMax: number, vMin: number;
  if (stacked && isBar) {
    const sums = spec.labels.map((_, ci) => spec.series.reduce((a, s) => a + Math.max(0, s.data[ci] ?? 0), 0));
    vMax = Math.max(1, ...sums); vMin = 0;
  } else {
    const all = spec.series.flatMap((s) => s.data.filter((v) => typeof v === 'number' && isFinite(v)));
    vMax = all.length ? Math.max(...all) : 1;
    vMin = Math.min(0, all.length ? Math.min(...all) : 0);
  }
  if (vMax === vMin) vMax += 1;
  const range = vMax - vMin || 1;

  if (horizontal) {
    const x = (v: number) => plotL + ((v - vMin) / range) * plotW;
    for (let t = 0; t <= 4; t++) {
      const val = vMin + (range * t) / 4, xx = x(val);
      kids.push(new Line([xx, plotT, xx, plotB], { stroke: grid, strokeWidth: 1 }));
      kids.push(new FabricText(niceNum(val), { left: xx, top: plotB + 6, fontSize: 10, fill: tc, fontFamily: font, originX: 'center', originY: 'top', opacity: 0.8 }));
    }
    kids.push(new Line([x(Math.max(vMin, 0)), plotT, x(Math.max(vMin, 0)), plotB], { stroke: axis, strokeWidth: 1.5 }));
    const groupH = plotH / nCat, bh = (groupH * 0.72) / (stacked ? 1 : nSer), base = x(0);
    const acc = spec.labels.map(() => 0);
    spec.series.forEach((s, si) => {
      for (let ci = 0; ci < nCat; ci++) {
        const v = s.data[ci] ?? 0;
        let left: number, w: number, top: number;
        if (stacked) { const x0 = x(acc[ci]), x1 = x(acc[ci] + Math.max(0, v)); left = Math.min(x0, x1); w = Math.abs(x1 - x0); acc[ci] += Math.max(0, v); top = plotT + ci * groupH + (groupH - bh) / 2; }
        else { const xv = x(v); left = Math.min(base, xv); w = Math.abs(xv - base); top = plotT + ci * groupH + groupH * 0.14 + si * bh; }
        kids.push(new Rect({ left, top, width: Math.max(1, w), height: Math.max(1, bh * (stacked ? 1 : 0.9)), fill: pal[si % pal.length], rx: 2, ry: 2 }));
        if (showValues && v) valLabel(kids, niceNum(v), left + w + 9, top + bh / 2, font, tc);
      }
    });
    spec.labels.forEach((lb, ci) => kids.push(new FabricText(String(lb), { left: plotL - 6, top: plotT + ci * groupH + groupH / 2, fontSize: 10, fill: tc, fontFamily: font, originX: 'right', originY: 'center', opacity: 0.85 })));
    return;
  }

  const y = (v: number) => plotB - ((v - vMin) / range) * plotH;
  for (let t = 0; t <= 4; t++) {
    const val = vMin + (range * t) / 4, yy = y(val);
    kids.push(new Line([plotL, yy, plotR, yy], { stroke: grid, strokeWidth: 1 }));
    kids.push(new FabricText(niceNum(val), { left: plotL - 6, top: yy, fontSize: 10, fill: tc, fontFamily: font, originX: 'right', originY: 'center', opacity: 0.8 }));
  }
  kids.push(new Line([plotL, plotB, plotR, plotB], { stroke: axis, strokeWidth: 1.5 }));

  if (isBar) {
    const groupW = plotW / nCat, bw = (groupW * 0.72) / (stacked ? 1 : nSer), base = y(0);
    const acc = spec.labels.map(() => 0);
    spec.series.forEach((s, si) => {
      for (let ci = 0; ci < nCat; ci++) {
        const v = s.data[ci] ?? 0;
        let left: number, top: number, h: number;
        if (stacked) { const y0 = y(acc[ci]), y1 = y(acc[ci] + Math.max(0, v)); top = Math.min(y0, y1); h = Math.abs(y1 - y0); acc[ci] += Math.max(0, v); left = plotL + ci * groupW + (groupW - bw) / 2; }
        else { const yv = y(v); top = Math.min(base, yv); h = Math.abs(base - yv); left = plotL + ci * groupW + groupW * 0.14 + si * bw; }
        kids.push(new Rect({ left, top, width: Math.max(1, bw * (stacked ? 1 : 0.9)), height: Math.max(1, h), fill: pal[si % pal.length], rx: 2, ry: 2 }));
        if (showValues && v) valLabel(kids, niceNum(v), left + (bw * (stacked ? 1 : 0.9)) / 2, top - 8, font, tc);
      }
    });
  } else {
    const xAt = (ci: number) => (nCat === 1 ? plotL + plotW / 2 : plotL + (ci * plotW) / (nCat - 1));
    spec.series.forEach((s, si) => {
      const color = pal[si % pal.length];
      const pts = spec.labels.map((_, ci) => ({ x: xAt(ci), y: y(s.data[ci] ?? 0) }));
      if (spec.type === 'area') kids.push(new Polygon([...pts, { x: xAt(nCat - 1), y: y(0) }, { x: xAt(0), y: y(0) }], { fill: hexA(color, 0.22), stroke: '', selectable: false } as any));
      kids.push(new Polyline(pts, { stroke: color, strokeWidth: 2.5, fill: '', selectable: false } as any));
      pts.forEach((p, ci) => { kids.push(new Circle({ left: p.x, top: p.y, radius: 3, fill: color, originX: 'center', originY: 'center' })); if (showValues && (s.data[ci] ?? 0)) valLabel(kids, niceNum(s.data[ci]), p.x, p.y - 10, font, tc); });
    });
  }

  const step = plotW / nCat;
  spec.labels.forEach((lb, ci) => {
    const cx = isBar ? plotL + ci * step + step / 2 : (nCat === 1 ? plotL + plotW / 2 : plotL + (ci * plotW) / (nCat - 1));
    kids.push(new FabricText(String(lb), { left: cx, top: plotB + 7, fontSize: 10, fill: tc, fontFamily: font, originX: 'center', originY: 'top', opacity: 0.85 }));
  });
}

function buildPie(spec: ChartSpec, kids: any[], ctx: any) {
  const { W, H, pal, padT, font, tc, doughnut, showValues } = ctx;
  const data = (spec.series[0]?.data ?? []).map((v) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : 0));
  const total = data.reduce((a, b) => a + b, 0);
  const cx = W / 2, cy = padT + (H - padT - 56) / 2, r = Math.min(W - 40, H - padT - 70) / 2;
  if (total <= 0) return;
  const nonZero = data.filter((v) => v > 0).length;
  if (nonZero === 1) {
    const idx = data.findIndex((v) => v > 0);
    kids.push(new Circle({ left: cx, top: cy, radius: r, fill: pal[idx % pal.length], originX: 'center', originY: 'center' }));
  } else {
    let a0 = -Math.PI / 2;
    data.forEach((v, i) => {
      if (v <= 0) return;
      const a1 = a0 + (v / total) * Math.PI * 2;
      kids.push(new Path(wedgePath(cx, cy, r, a0, a1), { fill: pal[i % pal.length], stroke: '#ffffff', strokeWidth: 1.5 } as any));
      if (showValues) {
        const am = (a0 + a1) / 2, lr = r * 0.62;
        valLabel(kids, `${Math.round((v / total) * 100)}%`, cx + lr * Math.cos(am), cy + lr * Math.sin(am), font, doughnut ? tc : '#ffffff');
      }
      a0 = a1;
    });
  }
  if (doughnut) kids.push(new Circle({ left: cx, top: cy, radius: r * 0.55, fill: '#ffffff', originX: 'center', originY: 'center' }));
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
