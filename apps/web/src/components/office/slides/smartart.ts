/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Generador tipo «SmartArt»: convierte una lista de texto en un diagrama
 * editable (proceso, ciclo, jerarquía, lista, pirámide). Cada diagrama es un
 * `Group` de Fabric con prop `smart = { kind, items }` para reabrir el editor.
 * Se construye con primitivas nativas → exporta a formas reales en .pptx.
 */
import { Group, Rect, Circle, Line, Polygon, FabricText } from 'fabric';

export type SmartKind = 'process' | 'cycle' | 'hierarchy' | 'list' | 'pyramid';
export interface SmartSpec { kind: SmartKind; items: string[] }

export const SMART_PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#7c3aed', '#ec4899', '#14b8a6', '#f97316'];

export const SMART_KINDS: { value: SmartKind; label: string; hint: string }[] = [
  { value: 'process', label: 'Proceso', hint: 'Pasos secuenciales →' },
  { value: 'list', label: 'Lista', hint: 'Puntos apilados' },
  { value: 'cycle', label: 'Ciclo', hint: 'Flujo circular' },
  { value: 'hierarchy', label: 'Jerarquía', hint: 'Organigrama' },
  { value: 'pyramid', label: 'Pirámide', hint: 'Niveles' },
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

function sizeFor(s: string, boxW: number): number {
  const len = String(s).length || 1;
  const byWidth = (boxW * 1.7) / len;
  return Math.max(11, Math.min(20, byWidth));
}
