/* eslint-disable @typescript-eslint/no-explicit-any */

export type SlidePresentationQualitySeverity = 'info' | 'warning' | 'danger';

export interface SlidePresentationQualityIssue {
  code: string;
  severity: SlidePresentationQualitySeverity;
  slide: number;
  objectIndex?: number;
  title: string;
  detail: string;
}

export interface SlidePresentationQualityReport {
  score: number;
  issueCount: number;
  warningCount: number;
  dangerCount: number;
  totalWords: number;
  textObjects: number;
  slidesWithoutTitle: number;
  slidesWithoutNotes: number;
  denseTextSlides: number;
  smallTextObjects: number;
  lowContrastTextObjects: number;
  imagesMissingAltText: number;
  offCanvasObjects: number;
  currentSlideIssues: SlidePresentationQualityIssue[];
  issues: SlidePresentationQualityIssue[];
}

export interface SlidePresentationQualityInput {
  slides?: any[];
  notes?: string[];
  current?: number;
  width?: number;
  height?: number;
}

const DEFAULT_TEXT = '#111827';
const DEFAULT_BG = '#ffffff';
const MIN_BODY_FONT = 14;
const DENSE_WORD_LIMIT = 85;
const DENSE_LINE_LIMIT = 12;

function objectsOf(slide: any): any[] {
  return Array.isArray(slide?.objects) ? slide.objects.filter((o: any) => o && o.bgFill !== true) : [];
}

function textOf(object: any): string {
  return typeof object?.text === 'string' ? object.text.trim() : '';
}

function firstLine(text: string): string {
  return text.split('\n').map((line) => line.trim()).find(Boolean) || '';
}

function isTextObject(object: any): boolean {
  return ['textbox', 'i-text', 'text', 'fabrictext'].includes(String(object?.type || '').toLowerCase());
}

function isImageObject(object: any): boolean {
  return String(object?.type || '').toLowerCase() === 'image';
}

function isDecorativeText(object: any): boolean {
  return ['footer', 'date', 'slideNumber', 'logo', 'bar', 'accentBar'].includes(String(object?.ph || object?.masterRole || ''));
}

function numeric(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function scaledDimension(object: any, key: 'width' | 'height'): number {
  const scale = numeric(key === 'width' ? object?.scaleX : object?.scaleY, 1);
  return Math.abs(numeric(object?.[key], 0) * scale);
}

function effectiveFontSize(object: any): number {
  return Math.abs(numeric(object?.fontSize, 18) * numeric(object?.scaleY, 1));
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function lineCount(text: string): number {
  return text.split(/\n+/).filter((line) => line.trim()).length;
}

function hasExplicitSlideTitle(slide: any): boolean {
  return objectsOf(slide).some((object) => object?.ph === 'title' && !!firstLine(textOf(object)));
}

function isOffCanvas(object: any, width: number, height: number): boolean {
  const left = numeric(object?.left, 0);
  const top = numeric(object?.top, 0);
  const w = scaledDimension(object, 'width') || numeric(object?.radius, 0) * 2;
  const h = scaledDimension(object, 'height') || numeric(object?.radius, 0) * 2;
  if (!w && !h) return false;
  return left < -4 || top < -4 || left + w > width + 4 || top + h > height + 4;
}

function hasMissingImageAlt(object: any): boolean {
  if (!isImageObject(object)) return false;
  return !String(object?.altText ?? object?.alt ?? object?.label ?? object?.assetId ?? '').trim();
}

function colorFrom(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'object' && Array.isArray(value.colorStops) && value.colorStops[0]) {
    return colorFrom(value.colorStops[0].color);
  }
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  const shortHex = /^#([0-9a-f]{3})$/i.exec(raw);
  if (shortHex) {
    return `#${shortHex[1].split('').map((char) => `${char}${char}`).join('')}`.toLowerCase();
  }
  const hex = /^#([0-9a-f]{6})$/i.exec(raw);
  if (hex) return `#${hex[1].toLowerCase()}`;
  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i.exec(raw);
  if (rgb) {
    return `#${[rgb[1], rgb[2], rgb[3]].map((n) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, '0')).join('')}`;
  }
  return null;
}

function backgroundForSlide(slide: any): string {
  const direct = colorFrom(slide?.background);
  if (direct) return direct;
  const bg = Array.isArray(slide?.objects) ? slide.objects.find((object: any) => object?.bgFill === true) : null;
  return colorFrom(bg?.fill) || DEFAULT_BG;
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function channel(value: number): number {
  const scaled = value / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  const light = Math.max(a, b);
  const dark = Math.min(a, b);
  return (light + 0.05) / (dark + 0.05);
}

function contrastThreshold(object: any): number {
  const size = effectiveFontSize(object);
  const bold = object?.fontWeight === 'bold' || object?.fontWeight === 700;
  return size >= 24 || (bold && size >= 18) ? 3 : 4.5;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function issue(
  code: string,
  severity: SlidePresentationQualitySeverity,
  slide: number,
  title: string,
  detail: string,
  objectIndex?: number,
): SlidePresentationQualityIssue {
  return { code, severity, slide, title, detail, ...(typeof objectIndex === 'number' ? { objectIndex } : {}) };
}

export function analyzeSlidePresentationQuality(input: SlidePresentationQualityInput): SlidePresentationQualityReport {
  const slides = Array.isArray(input.slides) ? input.slides : [];
  const notes = Array.isArray(input.notes) ? input.notes : [];
  const current = Math.min(Math.max(0, input.current ?? 0), Math.max(0, slides.length - 1));
  const width = input.width ?? 960;
  const height = input.height ?? 540;
  const issues: SlidePresentationQualityIssue[] = [];
  let totalWords = 0;
  let textObjects = 0;
  let slidesWithoutTitle = 0;
  let slidesWithoutNotes = 0;
  let denseTextSlides = 0;
  let smallTextObjects = 0;
  let lowContrastTextObjects = 0;
  let imagesMissingAltText = 0;
  let offCanvasObjects = 0;

  slides.forEach((slide, slideIndex) => {
    const objects = objectsOf(slide);
    const bg = backgroundForSlide(slide);
    const slideTexts = objects.filter((object) => isTextObject(object) && textOf(object));
    const slideWords = slideTexts.reduce((sum, object) => sum + wordCount(textOf(object)), 0);
    const slideLines = slideTexts.reduce((sum, object) => sum + lineCount(textOf(object)), 0);
    totalWords += slideWords;
    textObjects += slideTexts.length;

    if (!hasExplicitSlideTitle(slide)) {
      slidesWithoutTitle += 1;
      issues.push(issue('missing-title', 'warning', slideIndex, 'Missing slide title', 'Add a title so search, outline, presenter view and export have a reliable label.'));
    }
    if (!String(notes[slideIndex] ?? '').trim()) {
      slidesWithoutNotes += 1;
      issues.push(issue('missing-notes', 'info', slideIndex, 'Missing speaker notes', 'Add speaker notes for presenter mode and handoff context.'));
    }
    if (slideWords > DENSE_WORD_LIMIT || slideLines > DENSE_LINE_LIMIT) {
      denseTextSlides += 1;
      issues.push(issue('dense-text', 'warning', slideIndex, 'Too much text on one slide', `${slideWords} words and ${slideLines} text lines may be hard to read in a plant review.`));
    }

    objects.forEach((object, objectIndex) => {
      if (isOffCanvas(object, width, height)) {
        offCanvasObjects += 1;
        issues.push(issue('off-canvas', 'danger', slideIndex, 'Object outside slide bounds', 'Move the object back onto the slide before export or presentation.', objectIndex));
      }
      if (hasMissingImageAlt(object)) {
        imagesMissingAltText += 1;
        issues.push(issue('missing-alt-text', 'warning', slideIndex, 'Image missing alt text', 'Add a label or alt text so visual aids and exported decks remain accessible.', objectIndex));
      }
      if (!isTextObject(object) || !textOf(object) || isDecorativeText(object)) return;
      const size = effectiveFontSize(object);
      if (size < MIN_BODY_FONT) {
        smallTextObjects += 1;
        issues.push(issue('small-text', 'warning', slideIndex, 'Text may be too small', `Effective font size is ${Math.round(size)}px; use at least ${MIN_BODY_FONT}px for presentation readability.`, objectIndex));
      }
      const fg = colorFrom(object.fill) || DEFAULT_TEXT;
      const ratio = contrastRatio(fg, bg);
      const threshold = contrastThreshold(object);
      if (ratio < threshold) {
        lowContrastTextObjects += 1;
        issues.push(issue('low-contrast', 'danger', slideIndex, 'Low contrast text', `Contrast ratio is ${ratio.toFixed(1)}:1; target ${threshold.toFixed(1)}:1 or higher.`, objectIndex));
      }
    });
  });

  const warningCount = issues.filter((item) => item.severity === 'warning').length;
  const dangerCount = issues.filter((item) => item.severity === 'danger').length;
  const score = clampScore(
    100
      - slidesWithoutTitle * 5
      - Math.min(12, slidesWithoutNotes * 2)
      - denseTextSlides * 6
      - smallTextObjects * 4
      - lowContrastTextObjects * 7
      - imagesMissingAltText * 3
      - offCanvasObjects * 6,
  );

  return {
    score,
    issueCount: issues.length,
    warningCount,
    dangerCount,
    totalWords,
    textObjects,
    slidesWithoutTitle,
    slidesWithoutNotes,
    denseTextSlides,
    smallTextObjects,
    lowContrastTextObjects,
    imagesMissingAltText,
    offCanvasObjects,
    currentSlideIssues: issues.filter((item) => item.slide === current),
    issues,
  };
}
