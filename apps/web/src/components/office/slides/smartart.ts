/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Generador tipo «SmartArt»: convierte una lista de texto en un diagrama
 * editable (proceso, ciclo, jerarquía, lista, pirámide). Cada diagrama es un
 * `Group` de Fabric con prop `smart = { kind, items }` para reabrir el editor.
 * Se construye con primitivas nativas → exporta a formas reales en .pptx.
 */
import { Group, Rect, Circle, Line, Polygon, FabricText } from 'fabric';

export type SmartKind =
  | 'process'
  | 'cycle'
  | 'hierarchy'
  | 'list'
  | 'pyramid'
  | 'matrix'
  | 'target'
  | 'stepUp'
  | 'timeline'
  | 'funnel'
  | 'sipoc'
  | 'swimlane';
export interface SmartSpec { kind: SmartKind; items: string[] }

export const SMART_PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#7c3aed', '#ec4899', '#14b8a6', '#f97316'];

export const SMART_KINDS: { value: SmartKind; label: string; hint: string }[] = [
  { value: 'process', label: 'Proceso', hint: 'Pasos secuenciales →' },
  { value: 'list', label: 'Lista', hint: 'Puntos apilados' },
  { value: 'cycle', label: 'Ciclo', hint: 'Flujo circular' },
  { value: 'hierarchy', label: 'Jerarquía', hint: 'Organigrama' },
  { value: 'pyramid', label: 'Pirámide', hint: 'Niveles' },
  { value: 'matrix', label: 'Matriz', hint: 'Cuadrantes 2×2' },
  { value: 'target', label: 'Diana', hint: 'Anillos concéntricos' },
  { value: 'stepUp', label: 'Escalera', hint: 'Pasos ascendentes' },
  { value: 'timeline', label: 'Timeline', hint: 'Hitos de lanzamiento' },
  { value: 'funnel', label: 'Funnel', hint: 'Reduccion progresiva' },
  { value: 'sipoc', label: 'SIPOC', hint: 'Supplier/Input/Process/Output/Customer' },
  { value: 'swimlane', label: 'Swimlane', hint: 'Flujo por responsables' },
];

export function defaultSmartSpec(): SmartSpec {
  return { kind: 'process', items: ['Planear', 'Diseñar', 'Construir', 'Lanzar'] };
}

export function isSmart(o: any): boolean {
  return !!o && o.type === 'group' && !!o.smart;
}

interface Opts { width?: number; height?: number; left?: number; top?: number; text?: string; font?: string; palette?: string[] }

const text = (s: string, x: number, y: number, w: number, size: number, color: string, font: string, bold = false) =>
  new FabricText(String(s), { left: x, top: y, fontSize: size, fill: color, fontFamily: font, originX: 'center', originY: 'center', textAlign: 'center', fontWeight: bold ? 'bold' : 'normal', width: w });

export function buildSmartArt(spec: SmartSpec, opts: Opts = {}): any {
  const W = opts.width ?? 820;
  const H = opts.height ?? 360;
  const font = opts.font ?? 'sans-serif';
  const pal = opts.palette ?? SMART_PALETTE;
  const items = (spec.items || []).filter((s) => s != null).map((s) => String(s));
  const kids: any[] = [];
  const ctx = { W, H, font, pal, tc: opts.text ?? '#1f2937' };

  if (!items.length) items.push('Elemento');
  switch (spec.kind) {
    case 'process': process(items, kids, ctx); break;
    case 'list': list(items, kids, ctx); break;
    case 'cycle': cycle(items, kids, ctx); break;
    case 'hierarchy': hierarchy(items, kids, ctx); break;
    case 'pyramid': pyramid(items, kids, ctx); break;
    case 'matrix': matrix(items, kids, ctx); break;
    case 'target': target(items, kids, ctx); break;
    case 'stepUp': stepUp(items, kids, ctx); break;
    case 'timeline': timeline(items, kids, ctx); break;
    case 'funnel': funnel(items, kids, ctx); break;
    case 'sipoc': sipoc(items, kids, ctx); break;
    case 'swimlane': swimlane(items, kids, ctx); break;
  }

  const g = new Group(kids, { subTargetCheck: false } as any);
  g.set({ left: opts.left ?? 70, top: opts.top ?? 130 });
  (g as any).smart = { kind: spec.kind, items };
  g.setCoords();
  return g;
}

function process(items: string[], kids: any[], c: any) {
  const { W, H, font, pal } = c;
  const n = items.length;
  const gap = 30, boxH = Math.min(120, H * 0.5), y = (H - boxH) / 2;
  const boxW = (W - (n - 1) * gap) / n;
  items.forEach((it, i) => {
    const x = i * (boxW + gap);
    kids.push(new Rect({ left: x, top: y, width: boxW, height: boxH, fill: pal[i % pal.length], rx: 14, ry: 14 }));
    kids.push(text(it, x + boxW / 2, y + boxH / 2, boxW - 16, sizeFor(it, boxW), '#ffffff', font, true));
    if (i < n - 1) {
      const ax = x + boxW + gap / 2, ay = y + boxH / 2;
      kids.push(new Polygon([{ x: ax - 9, y: ay - 11 }, { x: ax + 9, y: ay }, { x: ax - 9, y: ay + 11 }], { fill: '#94a3b8' } as any));
    }
  });
}

function list(items: string[], kids: any[], c: any) {
  const { W, H, font, pal } = c;
  const n = items.length;
  const gap = 12, barH = Math.min(70, (H - (n - 1) * gap) / n);
  items.forEach((it, i) => {
    const y = i * (barH + gap);
    kids.push(new Rect({ left: 0, top: y, width: W, height: barH, fill: pal[i % pal.length], rx: barH / 2, ry: barH / 2 }));
    kids.push(new Circle({ left: barH / 2, top: y + barH / 2, radius: barH * 0.32, fill: '#ffffff', originX: 'center', originY: 'center' }));
    kids.push(new FabricText(String(i + 1), { left: barH / 2, top: y + barH / 2, fontSize: barH * 0.34, fill: pal[i % pal.length], fontFamily: font, fontWeight: 'bold', originX: 'center', originY: 'center' }));
    kids.push(new FabricText(it, { left: barH + 10, top: y + barH / 2, fontSize: Math.min(22, barH * 0.4), fill: '#ffffff', fontFamily: font, fontWeight: 'bold', originX: 'left', originY: 'center' }));
  });
}

function cycle(items: string[], kids: any[], c: any) {
  const { W, H, font, pal } = c;
  const n = items.length;
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 70;
  const nodeR = Math.max(34, Math.min(64, (2 * Math.PI * R) / (n * 2.6)));
  // Anillo de fondo.
  kids.push(new Circle({ left: cx, top: cy, radius: R, fill: '', stroke: '#cbd5e1', strokeWidth: 2, originX: 'center', originY: 'center' }));
  // Flechas direccionales (en el punto medio entre nodos).
  for (let i = 0; i < n; i++) {
    const mid = -90 + ((i + 0.5) * 360) / n;
    const a = (mid * Math.PI) / 180;
    const px = cx + R * Math.cos(a), py = cy + R * Math.sin(a);
    const t = a + Math.PI / 2; // tangente (horario)
    kids.push(new Polygon([
      { x: px + 11 * Math.cos(t), y: py + 11 * Math.sin(t) },
      { x: px - 9 * Math.cos(t) + 7 * Math.cos(a), y: py - 9 * Math.sin(t) + 7 * Math.sin(a) },
      { x: px - 9 * Math.cos(t) - 7 * Math.cos(a), y: py - 9 * Math.sin(t) - 7 * Math.sin(a) },
    ], { fill: '#94a3b8' } as any));
  }
  items.forEach((it, i) => {
    const a = ((-90 + (i * 360) / n) * Math.PI) / 180;
    const px = cx + R * Math.cos(a), py = cy + R * Math.sin(a);
    kids.push(new Circle({ left: px, top: py, radius: nodeR, fill: pal[i % pal.length], originX: 'center', originY: 'center' }));
    kids.push(text(it, px, py, nodeR * 1.8, sizeFor(it, nodeR * 1.8), '#ffffff', font, true));
  });
}

function hierarchy(items: string[], kids: any[], c: any) {
  const { W, H, font, pal } = c;
  const root = items[0];
  const children = items.slice(1);
  const boxH = 64, rootW = Math.min(260, W * 0.4);
  const rootX = (W - rootW) / 2, rootY = 0;
  kids.push(new Rect({ left: rootX, top: rootY, width: rootW, height: boxH, fill: pal[0], rx: 12, ry: 12 }));
  kids.push(text(root, rootX + rootW / 2, rootY + boxH / 2, rootW - 14, sizeFor(root, rootW), '#ffffff', font, true));
  if (!children.length) return;
  const n = children.length;
  const gap = 22, cw = Math.min(220, (W - (n - 1) * gap) / n), cy = H - boxH;
  const totalW = n * cw + (n - 1) * gap, startX = (W - totalW) / 2;
  const midY = rootY + boxH + (cy - (rootY + boxH)) / 2;
  children.forEach((it, i) => {
    const x = startX + i * (cw + gap), cxx = x + cw / 2;
    kids.push(new Line([W / 2, rootY + boxH, W / 2, midY], { stroke: '#cbd5e1', strokeWidth: 2 }));
    kids.push(new Line([W / 2, midY, cxx, midY], { stroke: '#cbd5e1', strokeWidth: 2 }));
    kids.push(new Line([cxx, midY, cxx, cy], { stroke: '#cbd5e1', strokeWidth: 2 }));
    kids.push(new Rect({ left: x, top: cy, width: cw, height: boxH, fill: pal[(i + 1) % pal.length], rx: 12, ry: 12 }));
    kids.push(text(it, cxx, cy + boxH / 2, cw - 14, sizeFor(it, cw), '#ffffff', font, true));
  });
}

function pyramid(items: string[], kids: any[], c: any) {
  const { W, H, font, pal } = c;
  const n = items.length;
  const levelH = H / n, cx = W / 2;
  items.forEach((it, i) => {
    const yTop = i * levelH, yBot = (i + 1) * levelH;
    const w0 = (W * i) / n, w1 = (W * (i + 1)) / n;
    kids.push(new Polygon([
      { x: cx - w0 / 2, y: yTop }, { x: cx + w0 / 2, y: yTop },
      { x: cx + w1 / 2, y: yBot }, { x: cx - w1 / 2, y: yBot },
    ], { fill: pal[i % pal.length], stroke: '#ffffff', strokeWidth: 2 } as any));
    kids.push(text(it, cx, yTop + levelH / 2, w1 - 16, Math.min(20, 14 + n), '#ffffff', font, true));
  });
}

function matrix(items: string[], kids: any[], c: any) {
  const { W, H, font, pal } = c;
  const cells = items.slice(0, 4);
  while (cells.length < 4) cells.push('');
  const gap = 8, cw = (W - gap) / 2, chh = (H - gap) / 2;
  cells.forEach((it, i) => {
    const cx = (i % 2) * (cw + gap), cy = Math.floor(i / 2) * (chh + gap);
    kids.push(new Rect({ left: cx, top: cy, width: cw, height: chh, fill: pal[i % pal.length], rx: 12, ry: 12 }));
    kids.push(text(it, cx + cw / 2, cy + chh / 2, cw - 20, sizeFor(it, cw), '#ffffff', font, true));
  });
}

function target(items: string[], kids: any[], c: any) {
  const { W, H, font, pal } = c;
  const n = Math.max(1, items.length);
  const cx = W / 2, cy = H / 2, maxR = Math.min(W, H) / 2 - 6;
  for (let i = 0; i < n; i++) {
    const r = (maxR * (n - i)) / n;
    kids.push(new Circle({ left: cx, top: cy, radius: r, fill: pal[i % pal.length], stroke: '#ffffff', strokeWidth: 2, originX: 'center', originY: 'center' }));
  }
  items.forEach((it, i) => {
    const r = (maxR * (n - i)) / n, bandTop = cy - r + ((maxR / n) / 2);
    kids.push(new FabricText(String(it), { left: cx, top: bandTop, fontSize: Math.min(15, (maxR / n) * 0.5), fill: '#ffffff', fontFamily: font, fontWeight: 'bold', originX: 'center', originY: 'center' }));
  });
}

function stepUp(items: string[], kids: any[], c: any) {
  const { W, H, font, pal } = c;
  const n = Math.max(1, items.length);
  const sw = W / n;
  items.forEach((it, i) => {
    const h = (H * (i + 1)) / n, top = H - h, x = i * sw;
    kids.push(new Rect({ left: x, top, width: sw - 6, height: h, fill: pal[i % pal.length], rx: 8, ry: 8 }));
    kids.push(text(it, x + (sw - 6) / 2, top + h / 2, sw - 16, sizeFor(it, sw), '#ffffff', font, true));
  });
}

function timeline(items: string[], kids: any[], c: any) {
  const { W, H, font, pal, tc } = c;
  const n = Math.max(1, items.length);
  const y = H / 2;
  const margin = 54;
  kids.push(new Line([margin, y, W - margin, y], { stroke: '#cbd5e1', strokeWidth: 4 }));
  items.forEach((it, i) => {
    const x = n === 1 ? W / 2 : margin + ((W - margin * 2) * i) / (n - 1);
    const topLabel = i % 2 === 0;
    kids.push(new Circle({ left: x, top: y, radius: 20, fill: pal[i % pal.length], stroke: '#ffffff', strokeWidth: 4, originX: 'center', originY: 'center' }));
    kids.push(new FabricText(String(i + 1), { left: x, top: y, fontSize: 15, fill: '#ffffff', fontFamily: font, fontWeight: 'bold', originX: 'center', originY: 'center' }));
    kids.push(new Line([x, y + (topLabel ? -24 : 24), x, y + (topLabel ? -64 : 64)], { stroke: '#cbd5e1', strokeWidth: 2 }));
    kids.push(text(it, x, y + (topLabel ? -82 : 82), Math.max(92, (W - margin * 2) / Math.max(1, n)), sizeFor(it, 120), tc, font, true));
  });
}

function funnel(items: string[], kids: any[], c: any) {
  const { W, H, font, pal } = c;
  const n = Math.max(1, items.length);
  const levelH = H / n;
  const cx = W / 2;
  items.forEach((it, i) => {
    const topW = W * (1 - i / (n + 1));
    const botW = W * (1 - (i + 1) / (n + 1));
    const yTop = i * levelH;
    const yBot = (i + 1) * levelH;
    kids.push(new Polygon([
      { x: cx - topW / 2, y: yTop },
      { x: cx + topW / 2, y: yTop },
      { x: cx + botW / 2, y: yBot },
      { x: cx - botW / 2, y: yBot },
    ], { fill: pal[i % pal.length], stroke: '#ffffff', strokeWidth: 2 } as any));
    kids.push(text(it, cx, yTop + levelH / 2, Math.max(120, botW - 16), Math.min(20, Math.max(13, levelH * 0.34)), '#ffffff', font, true));
  });
}

function sipoc(items: string[], kids: any[], c: any) {
  const { W, H, font, pal } = c;
  const labels = ['Supplier', 'Input', 'Process', 'Output', 'Customer'];
  const data = labels.map((label, i) => items[i] || label);
  const gap = 10;
  const cw = (W - gap * (data.length - 1)) / data.length;
  data.forEach((it, i) => {
    const x = i * (cw + gap);
    kids.push(new Rect({ left: x, top: 0, width: cw, height: H, fill: '#ffffff', stroke: '#cbd5e1', strokeWidth: 1.5, rx: 14, ry: 14 }));
    kids.push(new Rect({ left: x, top: 0, width: cw, height: 54, fill: pal[i % pal.length], rx: 14, ry: 14 }));
    kids.push(text(labels[i], x + cw / 2, 27, cw - 12, 15, '#ffffff', font, true));
    kids.push(text(it, x + cw / 2, H / 2 + 18, cw - 16, sizeFor(it, cw), '#1f2937', font, true));
    if (i < data.length - 1) {
      const ax = x + cw + gap / 2;
      kids.push(new Polygon([{ x: ax - 7, y: H / 2 - 9 }, { x: ax + 7, y: H / 2 }, { x: ax - 7, y: H / 2 + 9 }], { fill: '#94a3b8' } as any));
    }
  });
}

function swimlane(items: string[], kids: any[], c: any) {
  const { W, H, font, pal } = c;
  const parsed = items.map((it, i) => {
    const parts = String(it).split(':');
    return parts.length > 1
      ? { lane: parts[0].trim() || `Lane ${i + 1}`, task: parts.slice(1).join(':').trim() || `Task ${i + 1}` }
      : { lane: ['Plan', 'Make', 'Check'][i % 3], task: String(it) };
  });
  const lanes = Array.from(new Set(parsed.map((it) => it.lane))).slice(0, 4);
  const laneH = H / Math.max(1, lanes.length);
  const labelW = Math.min(150, W * 0.2);
  lanes.forEach((lane, laneIndex) => {
    const y = laneIndex * laneH;
    kids.push(new Rect({ left: 0, top: y, width: W, height: laneH, fill: laneIndex % 2 ? '#f8fafc' : '#ffffff', stroke: '#e5e7eb', strokeWidth: 1 }));
    kids.push(new Rect({ left: 0, top: y, width: labelW, height: laneH, fill: '#f1f5f9', stroke: '#e5e7eb', strokeWidth: 1 }));
    kids.push(text(lane, labelW / 2, y + laneH / 2, labelW - 16, 15, '#334155', font, true));
    const tasks = parsed.filter((it) => it.lane === lane);
    const slotW = (W - labelW - 24) / Math.max(1, tasks.length);
    tasks.forEach((it, taskIndex) => {
      const x = labelW + 12 + taskIndex * slotW;
      const boxW = Math.max(92, slotW - 14);
      kids.push(new Rect({ left: x, top: y + laneH * 0.22, width: boxW, height: laneH * 0.56, fill: pal[(laneIndex + taskIndex) % pal.length], rx: 12, ry: 12 }));
      kids.push(text(it.task, x + boxW / 2, y + laneH / 2, boxW - 16, sizeFor(it.task, boxW), '#ffffff', font, true));
      if (taskIndex < tasks.length - 1) {
        const ax = x + boxW + 7;
        kids.push(new Polygon([{ x: ax - 7, y: y + laneH / 2 - 8 }, { x: ax + 7, y: y + laneH / 2 }, { x: ax - 7, y: y + laneH / 2 + 8 }], { fill: '#94a3b8' } as any));
      }
    });
  });
}

function sizeFor(s: string, boxW: number): number {
  const len = String(s).length || 1;
  const byWidth = (boxW * 1.7) / len;
  return Math.max(11, Math.min(20, byWidth));
}
