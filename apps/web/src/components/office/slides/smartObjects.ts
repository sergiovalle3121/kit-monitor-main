/* eslint-disable @typescript-eslint/no-explicit-any */
import { Circle, Group, Line, Rect, Textbox } from 'fabric';

export type SmartObjectKind = 'kpiCard' | 'oeeGauge' | 'riskMatrix' | 'gantt' | 'kanbanBoard' | 'valueStream';

export interface SmartObjectSpec {
  kind: SmartObjectKind;
  title: string;
  subtitle?: string;
  value?: string;
  target?: string;
  status?: 'good' | 'warn' | 'bad';
  source?: string;
}

export const SMART_OBJECTS: { kind: SmartObjectKind; label: string; hint: string }[] = [
  { kind: 'kpiCard', label: 'KPI vivo', hint: 'Tarjeta KPI conectable a datos AXOS' },
  { kind: 'oeeGauge', label: 'OEE Gauge', hint: 'Medidor OEE para producción' },
  { kind: 'riskMatrix', label: 'Risk Matrix', hint: 'Matriz 3×3 de riesgo operacional' },
  { kind: 'gantt', label: 'Gantt', hint: 'Plan industrial por fases' },
  { kind: 'kanbanBoard', label: 'Kanban Board', hint: 'Flujo visual To Do / Doing / Done' },
  { kind: 'valueStream', label: 'Value Stream', hint: 'Flujo básico de valor / proceso' },
];

const palette = {
  good: '#10b981', warn: '#f59e0b', bad: '#ef4444', ink: '#0f172a', muted: '#64748b', surface: '#f8fafc', border: '#cbd5e1', accent: '#2563eb',
};

export function defaultSmartObject(kind: SmartObjectKind): SmartObjectSpec {
  if (kind === 'oeeGauge') return { kind, title: 'OEE', subtitle: 'Línea A · turno actual', value: '86%', target: 'Meta 85%', status: 'good', source: 'AXOS.production.oee' };
  if (kind === 'riskMatrix') return { kind, title: 'Riesgo de lanzamiento', subtitle: 'Severidad × probabilidad', value: 'Medio', status: 'warn', source: 'AXOS.quality.risk' };
  if (kind === 'gantt') return { kind, title: 'Launch readiness', subtitle: 'APQP / PPAP / SOP', value: '72%', status: 'warn', source: 'AXOS.engineering.launch' };
  if (kind === 'kanbanBoard') return { kind, title: 'Kanban de acciones', subtitle: 'Daily Production Meeting', value: '12 abiertas', status: 'warn', source: 'AXOS.actions' };
  if (kind === 'valueStream') return { kind, title: 'Value stream', subtitle: 'Recepción → Embarque', value: '4.2 días', target: 'Lead time', status: 'good', source: 'AXOS.routing' };
  return { kind, title: 'OEE Línea A', subtitle: 'Actualizado desde AXOS', value: '86%', target: 'Meta 85%', status: 'good', source: 'AXOS.production.oee' };
}

const txt = (text: string, left: number, top: number, width: number, size: number, fill = palette.ink, bold = false) => new Textbox(text, { left, top, width, fontSize: size, fill, fontFamily: 'Inter, sans-serif', fontWeight: bold ? 'bold' : 'normal', selectable: false, evented: false });
const rect = (left: number, top: number, width: number, height: number, fill: string, stroke = 'transparent') => new Rect({ left, top, width, height, rx: 14, ry: 14, fill, stroke, strokeWidth: stroke === 'transparent' ? 0 : 2, selectable: false, evented: false });

export function buildSmartObjectGroup(spec: SmartObjectSpec, pos: { left?: number; top?: number; accent?: string } = {}) {
  const accent = pos.accent || palette.accent;
  const status = palette[spec.status || 'good'];
  const children: any[] = [];
  if (spec.kind === 'kpiCard') {
    children.push(rect(0, 0, 260, 150, '#ffffff', palette.border), rect(0, 0, 8, 150, status), txt(spec.title, 22, 20, 210, 18, palette.muted, true), txt(spec.value || '—', 22, 52, 210, 44, palette.ink, true), txt(spec.target || spec.subtitle || '', 22, 112, 210, 16, palette.muted));
  } else if (spec.kind === 'oeeGauge') {
    children.push(rect(0, 0, 300, 180, '#ffffff', palette.border), txt(spec.title, 20, 18, 240, 20, palette.ink, true), new Circle({ left: 58, top: 58, radius: 78, fill: '#ecfdf5', stroke: status, strokeWidth: 14, startAngle: Math.PI, endAngle: 2 * Math.PI, selectable: false, evented: false } as any), txt(spec.value || '0%', 94, 86, 110, 38, palette.ink, true), txt(spec.target || '', 82, 132, 140, 15, palette.muted));
  } else if (spec.kind === 'riskMatrix') {
    children.push(rect(0, 0, 300, 220, '#ffffff', palette.border), txt(spec.title, 18, 14, 250, 18, palette.ink, true));
    const colors = ['#dcfce7', '#fef3c7', '#fee2e2'];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) children.push(new Rect({ left: 42 + c * 70, top: 58 + r * 45, width: 66, height: 40, fill: colors[Math.min(2, r + c > 2 ? 2 : r + c === 2 ? 1 : 0)], stroke: '#ffffff', strokeWidth: 2, selectable: false, evented: false }));
    children.push(txt('Probabilidad →', 82, 188, 150, 13, palette.muted), txt(spec.value || 'Medio', 112, 108, 120, 17, palette.ink, true));
  } else if (spec.kind === 'gantt') {
    children.push(rect(0, 0, 360, 190, '#ffffff', palette.border), txt(spec.title, 18, 14, 270, 18, palette.ink, true));
    ['APQP', 'PPAP', 'Run@Rate', 'SOP'].forEach((label, i) => { children.push(txt(label, 22, 52 + i * 30, 80, 13, palette.muted, true), new Rect({ left: 105 + i * 35, top: 52 + i * 30, width: 115, height: 16, rx: 8, ry: 8, fill: i < 2 ? accent : status, selectable: false, evented: false })); });
  } else if (spec.kind === 'kanbanBoard') {
    children.push(rect(0, 0, 360, 210, '#ffffff', palette.border), txt(spec.title, 18, 14, 270, 18, palette.ink, true));
    ['To do', 'Doing', 'Done'].forEach((h, i) => { children.push(txt(h, 28 + i * 112, 50, 90, 14, palette.ink, true), rect(22 + i * 112, 74, 96, 94, i === 2 ? '#ecfdf5' : '#f8fafc', palette.border), rect(34 + i * 112, 88, 72, 18, i === 0 ? '#dbeafe' : i === 1 ? '#fef3c7' : '#dcfce7')); });
  } else {
    children.push(rect(0, 0, 420, 170, '#ffffff', palette.border), txt(spec.title, 18, 14, 260, 18, palette.ink, true));
    ['Supplier', 'Receiving', 'Cell', 'Quality', 'Ship'].forEach((label, i) => { children.push(rect(22 + i * 78, 72, 62, 42, i === 2 ? '#dbeafe' : '#f8fafc', palette.border), txt(label, 26 + i * 78, 86, 54, 11, palette.ink, true)); if (i < 4) children.push(new Line([86 + i * 78, 93, 98 + i * 78, 93], { stroke: accent, strokeWidth: 4, selectable: false, evented: false })); });
  }
  const g = new Group(children, { left: pos.left ?? 160, top: pos.top ?? 130 } as any);
  (g as any).smartObject = spec;
  return g;
}

export function isSmartObject(o: any): boolean { return !!o && o.type === 'group' && !!o.smartObject; }
