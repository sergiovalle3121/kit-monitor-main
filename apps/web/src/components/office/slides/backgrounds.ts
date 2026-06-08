/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Fondos de diapositiva con degradado. Se implementan como un `Rect` a sangre
 * completa, bloqueado y al fondo, marcado con `bgFill: true`. Al ser un objeto
 * normal, funciona en el editor, la presentación, el PDF/PNG y el .pptx (donde
 * aproxima al primer color del degradado). Sin dependencias nuevas.
 */
import { Rect, Gradient } from 'fabric';

export interface BgPreset { id: string; name: string; css: string; stops: { offset: number; color: string }[]; diag?: boolean }

export const BG_PRESETS: BgPreset[] = [
  { id: 'sunset', name: 'Atardecer', css: 'linear-gradient(135deg,#ff7e5f,#feb47b)', stops: [{ offset: 0, color: '#ff7e5f' }, { offset: 1, color: '#feb47b' }], diag: true },
  { id: 'ocean', name: 'Océano', css: 'linear-gradient(135deg,#2193b0,#6dd5ed)', stops: [{ offset: 0, color: '#2193b0' }, { offset: 1, color: '#6dd5ed' }], diag: true },
  { id: 'purple', name: 'Violeta', css: 'linear-gradient(135deg,#667eea,#764ba2)', stops: [{ offset: 0, color: '#667eea' }, { offset: 1, color: '#764ba2' }], diag: true },
  { id: 'night', name: 'Noche', css: 'linear-gradient(135deg,#0f2027,#203a43,#2c5364)', stops: [{ offset: 0, color: '#0f2027' }, { offset: 0.5, color: '#203a43' }, { offset: 1, color: '#2c5364' }], diag: true },
  { id: 'mint', name: 'Menta', css: 'linear-gradient(135deg,#56ab2f,#a8e063)', stops: [{ offset: 0, color: '#56ab2f' }, { offset: 1, color: '#a8e063' }], diag: true },
  { id: 'peach', name: 'Durazno', css: 'linear-gradient(135deg,#ffecd2,#fcb69f)', stops: [{ offset: 0, color: '#ffecd2' }, { offset: 1, color: '#fcb69f' }], diag: true },
  { id: 'slate', name: 'Pizarra', css: 'linear-gradient(135deg,#283048,#859398)', stops: [{ offset: 0, color: '#283048' }, { offset: 1, color: '#859398' }], diag: true },
  { id: 'rose', name: 'Rosa', css: 'linear-gradient(135deg,#f857a6,#ff5858)', stops: [{ offset: 0, color: '#f857a6' }, { offset: 1, color: '#ff5858' }], diag: true },
  { id: 'sky', name: 'Cielo', css: 'linear-gradient(180deg,#a1c4fd,#c2e9fb)', stops: [{ offset: 0, color: '#a1c4fd' }, { offset: 1, color: '#c2e9fb' }] },
  { id: 'gold', name: 'Oro', css: 'linear-gradient(135deg,#f7971e,#ffd200)', stops: [{ offset: 0, color: '#f7971e' }, { offset: 1, color: '#ffd200' }], diag: true },
];

export function isBgFill(o: any): boolean { return !!o && o.bgFill === true; }

export function makeBgRect(preset: BgPreset, w: number, h: number): any {
  const fill = new Gradient({
    type: 'linear', gradientUnits: 'pixels',
    coords: { x1: 0, y1: 0, x2: w, y2: preset.diag ? h : 0 },
    colorStops: preset.stops,
  });
  return new Rect({
    left: 0, top: 0, width: w, height: h, fill, selectable: false, evented: false,
    hoverCursor: 'default', bgFill: true,
  } as any);
}
