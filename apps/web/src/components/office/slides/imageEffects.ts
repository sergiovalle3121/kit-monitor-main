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

export interface ImageFxPreset {
  id: string;
  label: string;
  description: string;
  fx: ImgFx;
}

export type ImageFxIssueSeverity = 'info' | 'warning';

export interface ImageFxIssue {
  code: string;
  severity: ImageFxIssueSeverity;
  message: string;
}

export interface ImageFxReadiness {
  activeCount: number;
  exportFidelity: 'native' | 'approximate';
  issues: ImageFxIssue[];
}

export const IMAGE_FX_PRESETS: ImageFxPreset[] = [
  { id: 'original', label: 'Original', description: 'Sin filtros.', fx: { ...IMG_FX_DEFAULTS } },
  { id: 'shopfloor-clarity', label: 'Claridad piso', description: 'Mejora contraste ligero para fotos de estacion.', fx: { ...IMG_FX_DEFAULTS, brightness: 0.08, contrast: 0.18, saturation: 0.08 } },
  { id: 'inspection-contrast', label: 'Inspeccion', description: 'Contraste alto para defectos y detalles.', fx: { ...IMG_FX_DEFAULTS, brightness: 0.04, contrast: 0.28, saturation: -0.08 } },
  { id: 'document-scan', label: 'Documento', description: 'Escaneo en blanco y negro para evidencia.', fx: { ...IMG_FX_DEFAULTS, brightness: 0.08, contrast: 0.35, grayscale: true } },
  { id: 'muted-background', label: 'Fondo tenue', description: 'Imagen secundaria para texto encima.', fx: { ...IMG_FX_DEFAULTS, brightness: -0.06, contrast: -0.08, saturation: -0.35, blur: 0.08 } },
  { id: 'safety-highlight', label: 'Safety', description: 'Color mas vivo para alertas visuales.', fx: { ...IMG_FX_DEFAULTS, contrast: 0.15, saturation: 0.25 } },
];

export function readImgFx(o: any): ImgFx {
  return { ...IMG_FX_DEFAULTS, ...(o?.imgFx || {}) };
}

export function imageFxPresetById(id: string): ImageFxPreset | undefined {
  return IMAGE_FX_PRESETS.find((preset) => preset.id === id);
}

export function countActiveImageEffects(fx: ImgFx): number {
  return [
    Math.abs(fx.brightness) > 0.001,
    Math.abs(fx.contrast) > 0.001,
    Math.abs(fx.saturation) > 0.001,
    fx.blur > 0.001,
    fx.grayscale,
    fx.sepia,
    fx.invert,
  ].filter(Boolean).length;
}

export function analyzeImageEffects(fx: ImgFx): ImageFxReadiness {
  const activeCount = countActiveImageEffects(fx);
  const issues: ImageFxIssue[] = [];
  if (activeCount > 0) {
    issues.push({
      code: 'pptx-image-effects',
      severity: 'info',
      message: 'PPTX export keeps the image editable, but native PowerPoint image effects may not match AXOS filters.',
    });
  }
  if (fx.blur > 0.28) {
    issues.push({ code: 'blur-readability', severity: 'warning', message: 'High blur can reduce visual-aid readability.' });
  }
  if (Math.abs(fx.brightness) > 0.5) {
    issues.push({ code: 'brightness-extreme', severity: 'warning', message: 'Extreme brightness can wash out inspection detail.' });
  }
  if (Math.abs(fx.contrast) > 0.5) {
    issues.push({ code: 'contrast-extreme', severity: 'warning', message: 'Extreme contrast can crush shadows or highlights.' });
  }
  if (Math.abs(fx.saturation) > 0.8) {
    issues.push({ code: 'saturation-extreme', severity: 'warning', message: 'Extreme saturation can distort product colors.' });
  }
  if (fx.invert && (fx.grayscale || fx.sepia)) {
    issues.push({ code: 'stacked-color-filters', severity: 'warning', message: 'Invert plus monochrome filters can be hard to interpret.' });
  }
  if (activeCount >= 4) {
    issues.push({ code: 'stacked-effects', severity: 'info', message: 'Multiple stacked filters may be harder to reproduce outside AXOS.' });
  }
  return { activeCount, exportFidelity: activeCount ? 'approximate' : 'native', issues };
}

export function imageEffectsSummary(fx: ImgFx): string {
  const report = analyzeImageEffects(fx);
  if (!report.activeCount) return 'Sin filtros activos';
  const warningCount = report.issues.filter((issue) => issue.severity === 'warning').length;
  return `${report.activeCount} filtro${report.activeCount === 1 ? '' : 's'} activo${report.activeCount === 1 ? '' : 's'}${warningCount ? ` · ${warningCount} alerta${warningCount === 1 ? '' : 's'}` : ''}`;
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
