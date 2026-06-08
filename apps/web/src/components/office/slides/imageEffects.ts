/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Efectos de imagen sobre objetos `FabricImage` usando los filtros nativos de
 * Fabric (WebGL/2D, MIT). Los ajustes se guardan en una prop custom `imgFx`
 * del objeto para que persistan al serializar y se reapliquen al cargar.
 */
import { filters } from 'fabric';

export interface ImgFx {
  brightness: number; // -1..1
  contrast: number;   // -1..1
  saturation: number; // -1..1
  blur: number;       // 0..1
  grayscale: boolean;
  sepia: boolean;
  invert: boolean;
}

export const IMG_FX_DEFAULTS: ImgFx = {
  brightness: 0, contrast: 0, saturation: 0, blur: 0,
  grayscale: false, sepia: false, invert: false,
};

export function readImgFx(o: any): ImgFx {
  return { ...IMG_FX_DEFAULTS, ...(o?.imgFx || {}) };
}

/** Construye el arreglo de filtros de Fabric a partir de los ajustes. */
export function buildFilters(fx: ImgFx): any[] {
  const F: any = filters;
  const out: any[] = [];
  if (fx.grayscale) out.push(new F.Grayscale());
  if (fx.sepia) out.push(new F.Sepia());
  if (fx.invert) out.push(new F.Invert());
  if (fx.brightness) out.push(new F.Brightness({ brightness: clamp(fx.brightness, -1, 1) }));
  if (fx.contrast) out.push(new F.Contrast({ contrast: clamp(fx.contrast, -1, 1) }));
  if (fx.saturation) out.push(new F.Saturation({ saturation: clamp(fx.saturation, -1, 1) }));
  if (fx.blur) out.push(new F.Blur({ blur: clamp(fx.blur, 0, 1) }));
  return out;
}

/** Aplica los efectos al objeto imagen (in-place) y guarda los ajustes. */
export function applyImageEffects(img: any, fx: ImgFx) {
  if (!img) return;
  img.imgFx = { ...fx };
  try {
    img.filters = buildFilters(fx);
    img.applyFilters();
  } catch { /* el backend de filtros puede no estar disponible */ }
}

/** Recorta la imagen a una relación de aspecto (recorte centrado). */
export function cropToRatio(img: any, ratio: number) {
  if (!img || !img._element) return;
  const natW = img._element.naturalWidth || img.width || 0;
  const natH = img._element.naturalHeight || img.height || 0;
  if (!natW || !natH) return;
  let cw = natW, ch = natW / ratio;
  if (ch > natH) { ch = natH; cw = natH * ratio; }
  img.set({
    cropX: (natW - cw) / 2,
    cropY: (natH - ch) / 2,
    width: cw,
    height: ch,
  });
  img.setCoords?.();
}

/** Quita el recorte (vuelve a la imagen completa). */
export function resetCrop(img: any) {
  if (!img || !img._element) return;
  const natW = img._element.naturalWidth || img.width || 0;
  const natH = img._element.naturalHeight || img.height || 0;
  img.set({ cropX: 0, cropY: 0, width: natW, height: natH });
  img.setCoords?.();
}

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

export const CROP_RATIOS: { label: string; ratio: number }[] = [
  { label: '1:1 (cuadrado)', ratio: 1 },
  { label: '4:3', ratio: 4 / 3 },
  { label: '3:2', ratio: 3 / 2 },
  { label: '16:9', ratio: 16 / 9 },
  { label: '3:4 (vertical)', ratio: 3 / 4 },
  { label: '9:16 (vertical)', ratio: 9 / 16 },
];
