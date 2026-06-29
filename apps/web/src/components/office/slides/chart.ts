/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Motor de gráficos para las diapositivas. Un gráfico es un `Group` de Fabric
 * que lleva una prop custom `chartSpec` (datos + tipo). Se dibuja con
 * primitivas nativas (rect/línea/polilínea/path/texto) para que rasterice en
 * PDF/PNG/presentación; el export .pptx lo convierte en un gráfico nativo
 * editable de PowerPoint usando el mismo `chartSpec`. Sin dependencias nuevas.
 */
import { Group, Rect, Line, Polyline, Polygon, Path, Circle, FabricText } from 'fabric';

export type ChartType = 'bar' | 'hbar' | 'line' | 'area' | 'pie' | 'doughnut' | 'scatter' | 'bubble' | 'radar' | 'pareto' | 'waterfall' | 'gauge';
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
  presetId?: string;
  presetLabel?: string;
  presetCategory?: string;
  sourceStatus?: 'static' | 'contract-pending' | 'live';
}

export interface IndustrialChartPreset {
  id: string;
  label: string;
  category: 'production' | 'quality' | 'supplier' | 'inventory' | 'npi' | 'review';
  description: string;
  spec: ChartSpec;
}

export type ChartHealthSeverity = 'info' | 'warning' | 'critical';
export interface ChartHealthIssue { severity: ChartHealthSeverity; message: string }
export interface ChartHealth {
  status: 'ready' | 'review' | 'blocked';
  nativePptx: boolean;
  usesFirstSeriesOnly: boolean;
  pointCount: number;
  seriesCount: number;
  labelCount: number;
  issues: ChartHealthIssue[];
  exportSummary: string;
}

export const CHART_PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#7c3aed', '#ec4899', '#14b8a6', '#f97316'];
export const CHART_PALETTES: { id: string; colors: string[] }[] = [
  { id: 'Marca', colors: CHART_PALETTE },
  { id: 'Océano', colors: ['#0ea5e9', '#2563eb', '#14b8a6', '#06b6d4', '#6366f1', '#0d9488', '#3b82f6', '#22d3ee'] },
  { id: 'Atardecer', colors: ['#f97316', '#ef4444', '#f59e0b', '#ec4899', '#e11d48', '#fb7185', '#fbbf24', '#f43f5e'] },
  { id: 'Bosque', colors: ['#16a34a', '#65a30d', '#10b981', '#84cc16', '#15803d', '#22c55e', '#4d7c0f', '#34d399'] },
  { id: 'Mono', colors: ['#111827', '#374151', '#6b7280', '#9ca3af', '#4b5563', '#1f2937', '#d1d5db', '#e5e7eb'] },
  { id: 'AXOS Produccion', colors: ['#2563eb', '#14b8a6', '#f59e0b', '#64748b', '#0f766e', '#38bdf8', '#334155', '#f97316'] },
  { id: 'Calidad', colors: ['#ef4444', '#f59e0b', '#2563eb', '#10b981', '#7c3aed', '#64748b', '#fb7185', '#22c55e'] },
  { id: 'Proveedor', colors: ['#7c3aed', '#2563eb', '#10b981', '#f59e0b', '#ef4444', '#14b8a6', '#64748b', '#a855f7'] },
];

export const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: 'bar', label: 'Barras' },
  { value: 'hbar', label: 'Barras horiz.' },
  { value: 'line', label: 'Líneas' },
  { value: 'area', label: 'Área' },
  { value: 'pie', label: 'Pastel' },
  { value: 'doughnut', label: 'Dona' },
  { value: 'scatter', label: 'Dispersión' },
  { value: 'bubble', label: 'Burbujas' },
  { value: 'radar', label: 'Radar' },
  { value: 'pareto', label: 'Pareto' },
  { value: 'waterfall', label: 'Waterfall' },
  { value: 'gauge', label: 'Gauge' },
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

export const INDUSTRIAL_CHART_PRESETS: IndustrialChartPreset[] = [
  {
    id: 'oee-trend',
    label: 'OEE trend',
    category: 'production',
    description: 'Disponibilidad, rendimiento y calidad por turno.',
    spec: {
      type: 'line',
      title: 'OEE trend por turno',
      labels: ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'],
      series: [
        { name: 'OEE', data: [78, 82, 80, 85, 87] },
        { name: 'Target', data: [85, 85, 85, 85, 85] },
      ],
      palette: CHART_PALETTES.find((p) => p.id === 'AXOS Produccion')?.colors,
      legend: true,
      showValues: true,
      presetId: 'oee-trend',
      presetLabel: 'OEE trend',
      presetCategory: 'production',
      sourceStatus: 'contract-pending',
    },
  },
  {
    id: 'pareto-defects',
    label: 'Pareto defectos',
    category: 'quality',
    description: 'Defectos ordenados con acumulado para quality review.',
    spec: {
      type: 'pareto',
      title: 'Pareto de defectos',
      labels: ['Soldadura', 'Componente', 'Polaridad', 'ICT', 'Etiqueta', 'Mecanico'],
      series: [{ name: 'Defectos', data: [42, 28, 18, 11, 7, 4] }],
      palette: CHART_PALETTES.find((p) => p.id === 'Calidad')?.colors,
      legend: true,
      showValues: true,
      presetId: 'pareto-defects',
      presetLabel: 'Pareto defectos',
      presetCategory: 'quality',
      sourceStatus: 'contract-pending',
    },
  },
  {
    id: 'supplier-score-radar',
    label: 'Radar proveedor',
    category: 'supplier',
    description: 'Scorecard de calidad, entrega, costo y respuesta.',
    spec: {
      type: 'radar',
      title: 'Supplier scorecard',
      labels: ['Calidad', 'OTD', 'Costo', 'Respuesta', 'PPAP', 'Riesgo'],
      series: [
        { name: 'Proveedor A', data: [92, 86, 78, 84, 90, 72] },
        { name: 'Target', data: [90, 90, 85, 85, 90, 80] },
      ],
      palette: CHART_PALETTES.find((p) => p.id === 'Proveedor')?.colors,
      legend: true,
      showValues: false,
      presetId: 'supplier-score-radar',
      presetLabel: 'Radar proveedor',
      presetCategory: 'supplier',
      sourceStatus: 'contract-pending',
    },
  },
  {
    id: 'inventory-abc',
    label: 'Inventory ABC',
    category: 'inventory',
    description: 'Valor de inventario por clasificacion ABC.',
    spec: {
      type: 'doughnut',
      title: 'Inventario ABC',
      labels: ['A', 'B', 'C', 'Exceso', 'Obsoleto'],
      series: [{ name: 'Valor', data: [62, 21, 9, 6, 2] }],
      palette: ['#2563eb', '#14b8a6', '#f59e0b', '#ef4444', '#64748b'],
      legend: true,
      showValues: true,
      presetId: 'inventory-abc',
      presetLabel: 'Inventory ABC',
      presetCategory: 'inventory',
      sourceStatus: 'contract-pending',
    },
  },
  {
    id: 'plan-vs-actual',
    label: 'Plan vs actual',
    category: 'production',
    description: 'Produccion planeada contra salida real por dia.',
    spec: {
      type: 'bar',
      title: 'Plan vs actual',
      labels: ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'],
      series: [
        { name: 'Plan', data: [1200, 1250, 1300, 1280, 1320] },
        { name: 'Actual', data: [1160, 1215, 1270, 1305, 1290] },
      ],
      palette: CHART_PALETTES.find((p) => p.id === 'AXOS Produccion')?.colors,
      legend: true,
      showValues: false,
      presetId: 'plan-vs-actual',
      presetLabel: 'Plan vs actual',
      presetCategory: 'production',
      sourceStatus: 'contract-pending',
    },
  },
  {
    id: 'test-yield',
    label: 'Test yield',
    category: 'quality',
    description: 'Yield de prueba por estacion o familia.',
    spec: {
      type: 'area',
      title: 'Test yield',
      labels: ['ICT', 'FCT', 'Burn-in', 'Final'],
      series: [
        { name: 'Yield %', data: [96.4, 94.8, 97.1, 98.2] },
        { name: 'Target', data: [97, 97, 97, 97] },
      ],
      palette: ['#10b981', '#2563eb', '#f59e0b', '#ef4444'],
      legend: true,
      showValues: true,
      presetId: 'test-yield',
      presetLabel: 'Test yield',
      presetCategory: 'quality',
      sourceStatus: 'contract-pending',
    },
  },
  {
    id: 'downtime-breakdown',
    label: 'Downtime',
    category: 'production',
    description: 'Minutos de paro por causa principal.',
    spec: {
      type: 'hbar',
      title: 'Downtime por causa',
      labels: ['Cambio modelo', 'Material', 'Equipo', 'Calidad', 'Mantenimiento'],
      series: [{ name: 'Minutos', data: [65, 44, 38, 24, 18] }],
      palette: ['#f59e0b', '#2563eb', '#ef4444', '#10b981', '#64748b'],
      legend: false,
      showValues: true,
      presetId: 'downtime-breakdown',
      presetLabel: 'Downtime',
      presetCategory: 'production',
      sourceStatus: 'contract-pending',
    },
  },
  {
    id: 'npi-readiness-gauge',
    label: 'NPI readiness',
    category: 'npi',
    description: 'Indicador ejecutivo de readiness contra gate objetivo.',
    spec: {
      type: 'gauge',
      title: 'NPI launch readiness',
      labels: ['Readiness'],
      series: [{ name: 'Readiness', data: [82, 100] }],
      palette: ['#10b981', '#e5e7eb', '#f59e0b', '#ef4444'],
      legend: false,
      showValues: true,
      presetId: 'npi-readiness-gauge',
      presetLabel: 'NPI readiness',
      presetCategory: 'npi',
      sourceStatus: 'contract-pending',
    },
  },
  {
    id: 'quality-cost-waterfall',
    label: 'Costo calidad',
    category: 'quality',
    description: 'Impacto acumulado por scrap, retrabajo y contencion.',
    spec: {
      type: 'waterfall',
      title: 'Costo de calidad',
      labels: ['Base', 'Scrap', 'Retrabajo', 'Sorting', 'Recuperacion', 'Total'],
      series: [{ name: 'USD k', data: [18, 9, 6, 4, -5, 32] }],
      palette: CHART_PALETTES.find((p) => p.id === 'Calidad')?.colors,
      legend: true,
      showValues: true,
      presetId: 'quality-cost-waterfall',
      presetLabel: 'Costo calidad',
      presetCategory: 'quality',
      sourceStatus: 'contract-pending',
    },
  },
  {
    id: 'mrp-shortage-burn',
    label: 'MRP shortage',
    category: 'inventory',
    description: 'Shortages abiertos y comprometidos por semana.',
    spec: {
      type: 'bar',
      title: 'MRP shortage burn-down',
      labels: ['W1', 'W2', 'W3', 'W4'],
      series: [
        { name: 'Abiertos', data: [46, 34, 22, 14] },
        { name: 'Comprometidos', data: [18, 21, 16, 10] },
      ],
      stacked: true,
      palette: ['#ef4444', '#f59e0b', '#2563eb', '#10b981'],
      legend: true,
      showValues: true,
      presetId: 'mrp-shortage-burn',
      presetLabel: 'MRP shortage',
      presetCategory: 'inventory',
      sourceStatus: 'contract-pending',
    },
  },
];

const FIRST_SERIES_TYPES = new Set<ChartType>(['pie', 'doughnut', 'pareto', 'waterfall', 'gauge']);
const NATIVE_PPTX_TYPES = new Set<ChartType>(['bar', 'hbar', 'line', 'area', 'pie', 'doughnut']);
const APPROXIMATED_PPTX_TYPES = new Set<ChartType>(['scatter', 'bubble', 'radar', 'pareto', 'waterfall', 'gauge']);

export function cloneChartSpec(spec: ChartSpec): ChartSpec {
  return {
    type: spec.type,
    title: spec.title,
    labels: spec.labels.slice(),
    series: spec.series.map((x) => ({ name: x.name, data: x.data.slice() })),
    palette: spec.palette?.slice(),
    stacked: spec.stacked,
    legend: spec.legend,
    showValues: spec.showValues,
    presetId: spec.presetId,
    presetLabel: spec.presetLabel,
    presetCategory: spec.presetCategory,
    sourceStatus: spec.sourceStatus,
  };
}

export function getIndustrialChartPreset(id?: string): IndustrialChartPreset | undefined {
  return INDUSTRIAL_CHART_PRESETS.find((preset) => preset.id === id);
}

export function chartPresetSpec(id: string): ChartSpec | undefined {
  const preset = getIndustrialChartPreset(id);
  return preset ? cloneChartSpec(preset.spec) : undefined;
}

export function analyzeChartSpec(spec: ChartSpec): ChartHealth {
  const issues: ChartHealthIssue[] = [];
  const seriesCount = spec.series.length;
  const labelCount = spec.labels.length;
  const pointCount = spec.series.reduce((sum, series) => sum + series.data.length, 0);
  const usesFirstSeriesOnly = FIRST_SERIES_TYPES.has(spec.type);
  const nativePptx = NATIVE_PPTX_TYPES.has(spec.type);

  if (!labelCount) issues.push({ severity: 'critical', message: 'Agrega al menos una categoria para que el grafico pueda renderizarse.' });
  if (!seriesCount) issues.push({ severity: 'critical', message: 'Agrega al menos una serie de datos.' });
  if (seriesCount > 0 && pointCount === 0) issues.push({ severity: 'critical', message: 'Las series no contienen valores numericos.' });

  if (usesFirstSeriesOnly && seriesCount > 1) {
    issues.push({ severity: 'warning', message: 'Este tipo usa solo la primera serie; las series adicionales no se veran en canvas ni PPTX.' });
  }
  if (APPROXIMATED_PPTX_TYPES.has(spec.type)) {
    issues.push({ severity: 'warning', message: 'PPTX exportara este grafico como una aproximacion editable, no como el tipo exacto de PowerPoint.' });
  }

  const labelSet = new Set(spec.labels.map((label) => normalizeChartLabel(label)));
  if (labelSet.size < spec.labels.length) issues.push({ severity: 'info', message: 'Hay categorias duplicadas; revisa si el resumen ejecutivo debe consolidarlas.' });
  if (labelCount > 8 && ['bar', 'hbar', 'line', 'area', 'pareto'].includes(spec.type)) {
    issues.push({ severity: 'info', message: 'Muchas categorias pueden saturar el slide; considera agrupar el resto.' });
  }
  for (const series of spec.series) {
    if (series.data.length !== labelCount) {
      issues.push({ severity: 'warning', message: `La serie "${series.name || 'sin nombre'}" no coincide con el numero de categorias.` });
    }
    if (!series.name.trim()) issues.push({ severity: 'info', message: 'Hay una serie sin nombre; PowerPoint mostrara una leyenda generica.' });
  }

  const firstSeriesValues = spec.series[0]?.data ?? [];
  if (['pie', 'doughnut', 'gauge', 'pareto', 'radar'].includes(spec.type) && firstSeriesValues.some((value) => value < 0)) {
    issues.push({ severity: 'warning', message: 'Este tipo no representa valores negativos con fidelidad; usa barras o waterfall.' });
  }
  if (spec.sourceStatus === 'contract-pending') {
    issues.push({ severity: 'info', message: 'Preset AXOS con contrato pendiente: los datos son editables hasta conectar la fuente real.' });
  }

  const status = issues.some((issue) => issue.severity === 'critical')
    ? 'blocked'
    : issues.some((issue) => issue.severity === 'warning')
      ? 'review'
      : 'ready';
  return {
    status,
    nativePptx,
    usesFirstSeriesOnly,
    pointCount,
    seriesCount,
    labelCount,
    issues,
    exportSummary: nativePptx ? 'PPTX nativo editable' : 'PPTX editable aproximado',
  };
}

function normalizeChartLabel(label: string): string {
  return String(label).trim().toLowerCase();
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
  } else if (spec.type === 'pareto') {
    buildPareto(spec, kids, { W, H, tc, font, pal, grid, axis, padT: hasTitle ? 36 : 16, showValues: !!spec.showValues });
  } else if (spec.type === 'waterfall') {
    buildWaterfall(spec, kids, { W, H, tc, font, pal, grid, axis, padT: hasTitle ? 36 : 16, showValues: !!spec.showValues });
  } else if (spec.type === 'gauge') {
    buildGauge(spec, kids, { W, H, tc, font, pal, padT: hasTitle ? 36 : 16, showValues: !!spec.showValues });
  } else if (spec.type === 'scatter' || spec.type === 'bubble') {
    buildScatter(spec, kids, { W, H, tc, font, pal, grid, axis, padT: hasTitle ? 36 : 16, showValues: !!spec.showValues, bubble: spec.type === 'bubble' });
  } else if (spec.type === 'radar') {
    buildRadar(spec, kids, { W, H, tc, font, pal, grid, padT: hasTitle ? 36 : 16, showValues: !!spec.showValues });
  } else {
    buildCartesian(spec, kids, { W, H, tc, font, pal, grid, axis, padT: hasTitle ? 36 : 16, horizontal: spec.type === 'hbar', stacked: !!spec.stacked, showValues: !!spec.showValues });
  }

  // Leyenda (centrada abajo).
  if (spec.legend !== false) {
    const legendItems = spec.type === 'pareto' ? ['Frecuencia', 'Acumulado %'] : spec.type === 'waterfall' ? ['Incremento', 'Disminución', 'Total'] : spec.type === 'gauge' ? [] : isPie ? spec.labels : spec.series.map((s) => s.name);
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
        const barH = bh * (stacked ? 1 : 0.9);
        kids.push(new Rect({ left, top, width: Math.max(1, w), height: Math.max(1, barH), fill: pal[si % pal.length], rx: 2, ry: 2 }));
        if (showValues && v && !stacked) valLabel(kids, niceNum(v), v >= 0 ? left + w + 9 : left - 9, top + barH / 2, font, tc);
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



function buildScatter(spec: ChartSpec, kids: any[], ctx: any) {
  const { W, H, tc, font, pal, grid, axis, padT, showValues, bubble } = ctx;
  const padL = 46, padR = 20, padB = 50;
  const plotL = padL, plotR = W - padR, plotT = padT, plotB = H - padB;
  const plotW = plotR - plotL, plotH = plotB - plotT;
  const nCat = Math.max(1, spec.labels.length);
  const all = spec.series.flatMap((s) => s.data.filter((v) => typeof v === 'number' && isFinite(v)));
  const vMax = all.length ? Math.max(...all) : 1;
  const vMin = Math.min(0, all.length ? Math.min(...all) : 0);
  const range = vMax === vMin ? 1 : vMax - vMin;
  const xAt = (ci: number) => (nCat === 1 ? plotL + plotW / 2 : plotL + (ci * plotW) / (nCat - 1));
  const yAt = (v: number) => plotB - ((v - vMin) / range) * plotH;
  const maxAbs = Math.max(1, ...all.map((v) => Math.abs(v)));

  for (let t = 0; t <= 4; t++) {
    const val = vMin + (range * t) / 4, yy = yAt(val);
    kids.push(new Line([plotL, yy, plotR, yy], { stroke: grid, strokeWidth: 1 }));
    kids.push(new FabricText(niceNum(val), { left: plotL - 6, top: yy, fontSize: 10, fill: tc, fontFamily: font, originX: 'right', originY: 'center', opacity: 0.8 }));
  }
  kids.push(new Line([plotL, plotB, plotR, plotB], { stroke: axis, strokeWidth: 1.5 }));
  kids.push(new Line([plotL, plotT, plotL, plotB], { stroke: axis, strokeWidth: 1.2 }));

  spec.series.forEach((s, si) => {
    const color = pal[si % pal.length];
    spec.labels.forEach((_, ci) => {
      const v = Number(s.data[ci] ?? 0);
      const x = xAt(ci), y = yAt(v);
      const r = bubble ? 4 + (Math.abs(v) / maxAbs) * 9 : 4;
      kids.push(new Circle({ left: x, top: y, radius: r, fill: bubble ? hexA(color, 0.55) : color, stroke: color, strokeWidth: bubble ? 1.5 : 0, originX: 'center', originY: 'center' }));
      if (showValues && v) valLabel(kids, niceNum(v), x, y - r - 8, font, tc);
    });
  });

  spec.labels.forEach((lb, ci) => kids.push(new FabricText(String(lb), { left: xAt(ci), top: plotB + 7, fontSize: 10, fill: tc, fontFamily: font, originX: 'center', originY: 'top', opacity: 0.85 })));
}

function buildRadar(spec: ChartSpec, kids: any[], ctx: any) {
  const { W, H, tc, font, pal, grid, padT, showValues } = ctx;
  const labels = spec.labels.length ? spec.labels : ['A'];
  const n = labels.length;
  const cx = W / 2, cy = padT + (H - padT - 54) / 2;
  const r = Math.max(24, Math.min(W - 80, H - padT - 76) / 2);
  const all = spec.series.flatMap((s) => s.data.filter((v) => typeof v === 'number' && isFinite(v) && v >= 0));
  const max = Math.max(1, ...(all.length ? all : [1]));
  const point = (i: number, value: number) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / n;
    const rr = (Math.max(0, value) / max) * r;
    return { x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, a };
  };

  for (let ring = 1; ring <= 4; ring++) {
    const rr = (r * ring) / 4;
    const pts = labels.map((_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / n;
      return { x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr };
    });
    kids.push(new Polygon(pts, { fill: '', stroke: grid, strokeWidth: 1, selectable: false } as any));
  }
  labels.forEach((lb, i) => {
    const p = point(i, max);
    kids.push(new Line([cx, cy, p.x, p.y], { stroke: grid, strokeWidth: 1 }));
    kids.push(new FabricText(String(lb), { left: cx + Math.cos(p.a) * (r + 16), top: cy + Math.sin(p.a) * (r + 16), fontSize: 10, fill: tc, fontFamily: font, originX: 'center', originY: 'center', opacity: 0.85 }));
  });

  spec.series.forEach((s, si) => {
    const color = pal[si % pal.length];
    const pts = labels.map((_, i) => point(i, Number(s.data[i] ?? 0)));
    kids.push(new Polygon(pts.map(({ x, y }) => ({ x, y })), { fill: hexA(color, 0.18), stroke: color, strokeWidth: 2.2, selectable: false } as any));
    pts.forEach((p, i) => { kids.push(new Circle({ left: p.x, top: p.y, radius: 3, fill: color, originX: 'center', originY: 'center' })); if (showValues && (s.data[i] ?? 0)) valLabel(kids, niceNum(s.data[i]), p.x, p.y - 9, font, tc); });
  });
}

function buildPareto(spec: ChartSpec, kids: any[], ctx: any) {
  const { W, H, tc, font, pal, grid, axis, padT, showValues } = ctx;
  const raw = spec.labels.map((label, i) => ({ label, value: Math.max(0, Number(spec.series[0]?.data[i] ?? 0)) }))
    .sort((a, b) => b.value - a.value);
  const total = raw.reduce((a, x) => a + x.value, 0) || 1;
  const padL = 46, padR = 34, padB = 50;
  const plotL = padL, plotR = W - padR, plotT = padT, plotB = H - padB;
  const plotW = plotR - plotL, plotH = plotB - plotT;
  const max = Math.max(1, ...raw.map((x) => x.value));
  const y = (v: number) => plotB - (v / max) * plotH;
  for (let t = 0; t <= 4; t++) {
    const val = (max * t) / 4, yy = y(val);
    kids.push(new Line([plotL, yy, plotR, yy], { stroke: grid, strokeWidth: 1 }));
    kids.push(new FabricText(niceNum(val), { left: plotL - 6, top: yy, fontSize: 10, fill: tc, fontFamily: font, originX: 'right', originY: 'center', opacity: 0.8 }));
    kids.push(new FabricText(`${Math.round((t / 4) * 100)}%`, { left: plotR + 8, top: yy, fontSize: 10, fill: tc, fontFamily: font, originX: 'left', originY: 'center', opacity: 0.7 }));
  }
  kids.push(new Line([plotL, plotB, plotR, plotB], { stroke: axis, strokeWidth: 1.5 }));
  const n = Math.max(1, raw.length), step = plotW / n, bw = step * 0.58;
  let acc = 0;
  const linePts: { x: number; y: number }[] = [];
  raw.forEach((d, i) => {
    const x = plotL + i * step + (step - bw) / 2;
    const top = y(d.value);
    kids.push(new Rect({ left: x, top, width: bw, height: Math.max(1, plotB - top), fill: pal[0], rx: 2, ry: 2 }));
    if (showValues) valLabel(kids, niceNum(d.value), x + bw / 2, top - 8, font, tc);
    acc += d.value;
    linePts.push({ x: x + bw / 2, y: plotB - (acc / total) * plotH });
    kids.push(new FabricText(String(d.label), { left: x + bw / 2, top: plotB + 7, fontSize: 10, fill: tc, fontFamily: font, originX: 'center', originY: 'top', opacity: 0.85 }));
  });
  kids.push(new Polyline(linePts, { stroke: pal[3] ?? '#ef4444', strokeWidth: 2.5, fill: '', selectable: false } as any));
  linePts.forEach((p) => kids.push(new Circle({ left: p.x, top: p.y, radius: 3, fill: pal[3] ?? '#ef4444', originX: 'center', originY: 'center' })));
}

function buildWaterfall(spec: ChartSpec, kids: any[], ctx: any) {
  const { W, H, tc, font, pal, grid, axis, padT, showValues } = ctx;
  const vals = (spec.series[0]?.data ?? []).map((x) => Number(x) || 0);
  const totals: number[] = [];
  vals.reduce((a, v, i) => { const n = a + v; totals[i] = n; return n; }, 0);
  const all = [0, ...totals, ...totals.map((t, i) => t - vals[i])];
  const min = Math.min(0, ...all), max = Math.max(1, ...all);
  const padL = 46, padR = 16, padB = 50;
  const plotL = padL, plotR = W - padR, plotT = padT, plotB = H - padB;
  const plotW = plotR - plotL, plotH = plotB - plotT;
  const y = (v: number) => plotB - ((v - min) / (max - min || 1)) * plotH;
  for (let t = 0; t <= 4; t++) {
    const val = min + ((max - min) * t) / 4, yy = y(val);
    kids.push(new Line([plotL, yy, plotR, yy], { stroke: grid, strokeWidth: 1 }));
    kids.push(new FabricText(niceNum(val), { left: plotL - 6, top: yy, fontSize: 10, fill: tc, fontFamily: font, originX: 'right', originY: 'center', opacity: 0.8 }));
  }
  kids.push(new Line([plotL, y(0), plotR, y(0)], { stroke: axis, strokeWidth: 1.5 }));
  const n = Math.max(1, vals.length), step = plotW / n, bw = step * 0.55;
  let running = 0;
  vals.forEach((v, i) => {
    const next = running + v;
    const x = plotL + i * step + (step - bw) / 2;
    const top = Math.min(y(running), y(next));
    const h = Math.abs(y(running) - y(next));
    const color = i === vals.length - 1 ? (pal[6] ?? '#14b8a6') : v >= 0 ? (pal[1] ?? '#10b981') : (pal[3] ?? '#ef4444');
    kids.push(new Rect({ left: x, top, width: bw, height: Math.max(1, h), fill: color, rx: 2, ry: 2 }));
    if (i < vals.length - 1) kids.push(new Line([x + bw, y(next), x + step, y(next)], { stroke: axis, strokeWidth: 1, strokeDashArray: [3, 3] }));
    if (showValues) valLabel(kids, niceNum(v), x + bw / 2, top - 8, font, tc);
    kids.push(new FabricText(String(spec.labels[i] ?? i + 1), { left: x + bw / 2, top: plotB + 7, fontSize: 10, fill: tc, fontFamily: font, originX: 'center', originY: 'top', opacity: 0.85 }));
    running = next;
  });
}

function buildGauge(spec: ChartSpec, kids: any[], ctx: any) {
  const { W, H, tc, font, pal, padT, showValues } = ctx;
  const value = Math.max(0, Number(spec.series[0]?.data[0] ?? 0));
  const max = Math.max(value, Number(spec.series[0]?.data[1] ?? 100) || 100);
  const pct = Math.max(0, Math.min(1, value / max));
  const cx = W / 2, cy = padT + (H - padT - 38) * 0.72;
  const r = Math.min(W * 0.38, (H - padT - 58) * 0.78);
  const stroke = Math.max(16, r * 0.16);
  kids.push(new Path(arcPath(cx, cy, r, Math.PI, 0), { fill: '', stroke: '#e5e7eb', strokeWidth: stroke, strokeLineCap: 'round' } as any));
  kids.push(new Path(arcPath(cx, cy, r, Math.PI, Math.PI + pct * Math.PI), { fill: '', stroke: pal[0], strokeWidth: stroke, strokeLineCap: 'round' } as any));
  const ang = Math.PI + pct * Math.PI;
  kids.push(new Line([cx, cy, cx + Math.cos(ang) * (r - stroke * 0.75), cy + Math.sin(ang) * (r - stroke * 0.75)], { stroke: tc, strokeWidth: 3, strokeLineCap: 'round' } as any));
  kids.push(new Circle({ left: cx, top: cy, radius: 5, fill: tc, originX: 'center', originY: 'center' }));
  kids.push(new FabricText(showValues ? `${niceNum(value)} / ${niceNum(max)}` : `${Math.round(pct * 100)}%`, { left: cx, top: cy + 18, fontSize: 28, fill: pal[0], fontFamily: font, originX: 'center', originY: 'top', fontWeight: 'bold' }));
  kids.push(new FabricText(String(spec.labels[0] ?? 'Valor'), { left: cx, top: cy + 54, fontSize: 12, fill: tc, fontFamily: font, originX: 'center', originY: 'top', opacity: 0.75 }));
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
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
    if (showValues) valLabel(kids, '100%', cx, doughnut ? cy - r * 0.78 : cy, font, doughnut ? tc : '#ffffff');
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
