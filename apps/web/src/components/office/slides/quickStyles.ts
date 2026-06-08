/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Estilos rápidos de forma (galería tipo PowerPoint): combinaciones de relleno,
 * borde, esquinas y sombra que se aplican a la forma seleccionada. Datos +
 * función `apply` (usa Shadow/Gradient de Fabric). Sin dependencias nuevas.
 */
import type { CSSProperties } from 'react';
import { Shadow, Gradient } from 'fabric';

export interface QuickStyle {
  id: string;
  name: string;
  /** CSS para la miniatura de la galería. */
  preview: (accent: string) => CSSProperties;
  apply: (o: any, accent: string) => void;
}

function clearShadow(o: any) { o.set('shadow', null); }
function gradient(o: any, from: string, to: string) {
  const w = (o.width || 200) * (o.scaleX || 1);
  o.set('fill', new Gradient({ type: 'linear', gradientUnits: 'pixels', coords: { x1: 0, y1: 0, x2: w, y2: 0 }, colorStops: [{ offset: 0, color: from }, { offset: 1, color: to }] }));
}

export const QUICK_STYLES: QuickStyle[] = [
  {
    id: 'solid', name: 'Relleno sólido',
    preview: (a) => ({ background: a }),
    apply: (o, a) => { o.set({ fill: a, stroke: null, strokeWidth: 0 }); clearShadow(o); },
  },
  {
    id: 'soft', name: 'Sólido con sombra',
    preview: (a) => ({ background: a, boxShadow: '0 4px 8px rgba(0,0,0,0.3)' }),
    apply: (o, a) => { o.set({ fill: a, stroke: null, strokeWidth: 0 }); o.set('shadow', new Shadow({ color: 'rgba(0,0,0,0.3)', blur: 14, offsetX: 4, offsetY: 6 })); },
  },
  {
    id: 'outline', name: 'Contorno',
    preview: (a) => ({ background: '#fff', border: `2px solid ${a}` }),
    apply: (o, a) => { o.set({ fill: '#ffffff', stroke: a, strokeWidth: 2 }); clearShadow(o); },
  },
  {
    id: 'tint', name: 'Tinte suave',
    preview: (a) => ({ background: hexA(a, 0.18), border: `1.5px solid ${a}` }),
    apply: (o, a) => { o.set({ fill: hexA(a, 0.18), stroke: a, strokeWidth: 1.5 }); clearShadow(o); },
  },
  {
    id: 'dark', name: 'Oscuro',
    preview: () => ({ background: '#1f2937' }),
    apply: (o) => { o.set({ fill: '#1f2937', stroke: null, strokeWidth: 0 }); clearShadow(o); },
  },
  {
    id: 'gradient', name: 'Degradado',
    preview: (a) => ({ background: `linear-gradient(135deg, ${a}, #7c3aed)` }),
    apply: (o, a) => { gradient(o, a, '#7c3aed'); o.set({ stroke: null, strokeWidth: 0 }); clearShadow(o); },
  },
  {
    id: 'gradientShadow', name: 'Degradado + sombra',
    preview: (a) => ({ background: `linear-gradient(135deg, ${a}, #0ea5e9)`, boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }),
    apply: (o, a) => { gradient(o, a, '#0ea5e9'); o.set({ stroke: null, strokeWidth: 0 }); o.set('shadow', new Shadow({ color: 'rgba(0,0,0,0.28)', blur: 16, offsetX: 4, offsetY: 7 })); },
  },
  {
    id: 'glass', name: 'Cristal',
    preview: (a) => ({ background: hexA(a, 0.12), border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }),
    apply: (o, a) => { o.set({ fill: hexA(a, 0.12), stroke: '#ffffff', strokeWidth: 1 }); o.set('shadow', new Shadow({ color: 'rgba(0,0,0,0.18)', blur: 12, offsetX: 0, offsetY: 4 })); },
  },
  {
    id: 'paper', name: 'Papel',
    preview: () => ({ background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }),
    apply: (o) => { o.set({ fill: '#ffffff', stroke: '#e5e7eb', strokeWidth: 1 }); o.set('shadow', new Shadow({ color: 'rgba(0,0,0,0.12)', blur: 8, offsetX: 0, offsetY: 2 })); },
  },
  {
    id: 'bold', name: 'Borde grueso',
    preview: (a) => ({ background: '#fff', border: `3px solid ${a}` }),
    apply: (o, a) => { o.set({ fill: '#ffffff', stroke: a, strokeWidth: 4 }); clearShadow(o); },
  },
];

function hexA(hex: string, a: number) {
  const h = hex.replace('#', '');
  if (h.length < 6) return hex;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
