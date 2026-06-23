/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Generador de mazos «EMS-native» (Fase 4): convierte datos reales de
 * mission-control y de calidad en una presentación lista — un deck JSON v2 que
 * abre el editor de slides. Las tablas y gráficos se construyen con los mismos
 * builders del editor, así que son NATIVOS (editables y exportables a .pptx).
 * Solo navegador (instancia Fabric para serializar tablas/gráficos); se importa
 * bajo demanda.
 */
import { buildTableGroup, type TableSpec } from '@/components/office/slides/table';
import { buildChartGroup, type ChartSpec } from '@/components/office/slides/chart';

const CW = 960;
const THEME = { bg: '#ffffff', surface: '#eef2ff', text: '#111827', muted: '#6b7280', accent: '#2563eb', heading: 'Georgia, serif', body: 'sans-serif' };
const GREEN = '#10b981', AMBER = '#f59e0b', RED = '#ef4444', VIOLET = '#7c3aed';

// Fabric v7 serializa `type` en PascalCase; el editor/export usan minúsculas.
function lc(o: any): any {
  if (o && typeof o === 'object') {
    if (typeof o.type === 'string') o.type = o.type.toLowerCase();
    if (Array.isArray(o.objects)) o.objects.forEach(lc);
  }
  return o;
}

type Obj = any;
interface Slide { version: '7'; objects: Obj[]; background: string }

function text(t: string, x: number, y: number, w: number, opts: { size?: number; bold?: boolean; color?: string; align?: 'left' | 'center' | 'right'; font?: string } = {}): Obj {
  return { type: 'textbox', version: '7', text: t, left: x, top: y, width: w, fontSize: opts.size ?? 24, fontWeight: opts.bold ? 'bold' : 'normal', fill: opts.color ?? THEME.text, textAlign: opts.align ?? 'left', fontFamily: opts.font ?? THEME.body };
}
function rect(x: number, y: number, w: number, h: number, fill: string, rx = 0): Obj {
  return { type: 'rect', version: '7', left: x, top: y, width: w, height: h, fill, rx, ry: rx };
}
function tableObj(spec: TableSpec, x: number, y: number, w?: number): Obj {
  const g: any = buildTableGroup(spec, { left: x, top: y, width: w });
  return lc(g.toObject(['tableSpec']));
}
function chartObj(spec: ChartSpec, x: number, y: number, w: number, h: number): Obj {
  const g: any = buildChartGroup(spec, { left: x, top: y, width: w, height: h });
  return lc(g.toObject(['chartSpec']));
}

function header(title: string): Obj[] {
  return [rect(56, 64, 90, 8, THEME.accent, 4), text(title, 56, 80, 848, { size: 34, bold: true, font: THEME.heading })];
}
function titleSlide(title: string, subtitle: string): Slide {
  return {
    version: '7', background: THEME.bg, objects: [
      rect(0, 470, CW, 70, THEME.accent),
      text(title, 90, 190, 780, { size: 54, bold: true, font: THEME.heading }),
      text(subtitle, 90, 290, 780, { size: 24, color: THEME.muted }),
    ],
  };
}
function kpiSlide(title: string, kpis: { label: string; value: string; color?: string }[]): Slide {
  const objs: Obj[] = header(title);
  const n = Math.max(1, Math.min(kpis.length, 5));
  const gap = 24, m = 56, cw = (CW - 2 * m - (n - 1) * gap) / n;
  kpis.slice(0, n).forEach((k, i) => {
    const x = m + i * (cw + gap), y = 175, h = 200;
    objs.push(rect(x, y, cw, h, THEME.surface, 16));
    objs.push(rect(x, y, cw, 6, k.color ?? THEME.accent, 3));
    objs.push(text(k.value, x, y + 52, cw, { size: 40, bold: true, align: 'center', color: k.color ?? THEME.text }));
    objs.push(text(k.label, x + 8, y + 132, cw - 16, { size: 16, align: 'center', color: THEME.muted }));
  });
  return { version: '7', background: THEME.bg, objects: objs };
}
function tableSlide(title: string, head: string[], rows: string[][], accent = THEME.accent): Slide {
  const cells = [head, ...rows];
  const spec: TableSpec = { rows: cells.length, cols: head.length, cells, header: true, banded: true, accent };
  return { version: '7', background: THEME.bg, objects: [...header(title), tableObj(spec, 56, 150, Math.min(848, Math.max(420, 170 * head.length)))] };
}
function chartSlide(title: string, spec: ChartSpec): Slide {
  return { version: '7', background: THEME.bg, objects: [...header(title), chartObj(spec, 120, 140, 720, 350)] };
}
function bulletSlide(title: string, bullets: string[]): Slide {
  return { version: '7', background: THEME.bg, objects: [...header(title), text(bullets.map((b) => `• ${b}`).join('\n'), 56, 160, 848, { size: 24 })] };
}

function deck(slides: Slide[], footer: string) {
  return {
    version: 2, slides, notes: slides.map(() => ''), ratio: '16:9', theme: 'light',
    transition: 'fade', transitions: slides.map(() => 'fade'), transDurs: slides.map(() => 500),
    advanceAfters: slides.map(() => 0), loop: false, footer, showNumbers: true, sections: slides.map(() => null),
  };
}
const today = () => new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });

// ── Deck de revisión de línea (mission-control) ─────────────────────────────
export interface LineReviewInput {
  overall: string;
  kpis: { activeLines: number; wip: number | string; openAlerts: number; materialRisk: number; inventory: number | string };
  lines: { name: string; model?: string; status: string; bottleneck?: boolean }[];
  shortages: { partNumber: string; description?: string; severity?: string }[];
  trend: { label: string; value: number }[];
  alerts: { title: string; severity?: string; status?: string }[];
}
export function buildLineReviewDeck(input: LineReviewInput) {
  const slides: Slide[] = [];
  slides.push(titleSlide('Revisión de línea', `War room · ${today()} · ${input.overall}`));
  slides.push(kpiSlide('Indicadores', [
    { label: 'Líneas activas', value: String(input.kpis.activeLines) },
    { label: 'WIP total', value: String(input.kpis.wip) },
    { label: 'Alertas abiertas', value: String(input.kpis.openAlerts), color: input.kpis.openAlerts > 0 ? AMBER : GREEN },
    { label: 'Riesgo de material', value: String(input.kpis.materialRisk), color: input.kpis.materialRisk > 0 ? AMBER : GREEN },
    { label: 'Inventario', value: String(input.kpis.inventory) },
  ]));
  if (input.lines.length) slides.push(tableSlide('Líneas de producción', ['Línea', 'Modelo', 'Estado'], input.lines.slice(0, 10).map((l) => [l.name, l.model ?? '—', l.bottleneck ? 'Cuello de botella' : (l.status || 'activa')])));
  if (input.shortages.length) slides.push(tableSlide('Riesgo de material', ['Parte', 'Descripción', 'Severidad'], input.shortages.slice(0, 10).map((s) => [s.partNumber, s.description ?? '—', s.severity ?? 'riesgo']), AMBER));
  if (input.trend.length) slides.push(chartSlide('Tendencia · gobernanza', { type: 'line', title: '', labels: input.trend.map((p) => p.label), series: [{ name: 'Valor', data: input.trend.map((p) => p.value) }], legend: false }));
  slides.push(input.alerts.length
    ? bulletSlide('Alertas en vivo', input.alerts.slice(0, 8).map((a) => `${a.title}${a.severity ? ` · ${a.severity}` : ''}${a.status ? ` (${a.status})` : ''}`))
    : bulletSlide('Conclusiones', ['Operación dentro de parámetros.', 'Sin alertas críticas abiertas.']));
  return deck(slides, 'Revisión de línea');
}

// ── Deck de calidad / PPAP ──────────────────────────────────────────────────
export interface QualityInput {
  period: string;
  kpis: { fpy: string; yieldPct: string; fails: number; openNcr: number; critical: number; affected: number };
  pareto: { label: string; count: number }[];
  trend: { label: string; count: number }[];
  byModel: { label: string; count: number }[];
  openNcrs: { ncrNumber: string; partNumber: string; model?: string; severity: string; affected: number }[];
}
export function buildQualityDeck(input: QualityInput) {
  const slides: Slide[] = [];
  slides.push(titleSlide('Calidad · Revisión', `${input.period} · ${today()}`));
  slides.push(kpiSlide('Indicadores de calidad', [
    { label: 'First-Pass Yield', value: input.kpis.fpy, color: GREEN },
    { label: 'Yield total', value: input.kpis.yieldPct, color: GREEN },
    { label: 'Fallas de prueba', value: String(input.kpis.fails), color: input.kpis.fails > 0 ? RED : GREEN },
    { label: 'NCR abiertas', value: String(input.kpis.openNcr), color: input.kpis.critical > 0 ? RED : THEME.muted },
    { label: 'Pzas afectadas', value: String(input.kpis.affected), color: VIOLET },
  ]));
  if (input.pareto.length) slides.push(chartSlide('Pareto de defectos', { type: 'bar', title: '', labels: input.pareto.slice(0, 8).map((p) => p.label), series: [{ name: 'Cantidad', data: input.pareto.slice(0, 8).map((p) => p.count) }], palette: [RED], legend: false }));
  if (input.trend.length) slides.push(chartSlide('Tendencia de no-conformidades', { type: 'bar', title: '', labels: input.trend.map((p) => p.label), series: [{ name: 'NCRs', data: input.trend.map((p) => p.count) }], palette: [AMBER], legend: false }));
  if (input.byModel.length) slides.push(chartSlide('Defectos por modelo', { type: 'hbar', title: '', labels: input.byModel.slice(0, 8).map((p) => p.label), series: [{ name: 'NCRs', data: input.byModel.slice(0, 8).map((p) => p.count) }], palette: [VIOLET], legend: false }));
  slides.push(input.openNcrs.length
    ? tableSlide('NCR abiertas', ['NCR', 'Parte', 'Modelo', 'Sev.', 'Pzas'], input.openNcrs.slice(0, 10).map((n) => [n.ncrNumber, n.partNumber, n.model ?? '—', n.severity, String(n.affected)]), AMBER)
    : bulletSlide('Conclusiones', ['Sin NCR abiertas en el periodo.', 'Indicadores dentro de meta.']));
  return deck(slides, 'Calidad · Revisión');
}
