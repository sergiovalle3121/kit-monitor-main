/* eslint-disable @typescript-eslint/no-explicit-any */
import { sectionCount as countSections } from './sections';

export interface SlideDeckHealthInput {
  slides: any[];
  notes?: string[];
  sections?: (string | null)[];
  transitions?: string[];
  advanceAfters?: number[];
  comments?: { resolved?: boolean; parentId?: string | null }[];
  pptxIssues?: { message?: unknown; code?: unknown; severity?: unknown }[];
  hasPptxDanger?: boolean;
  current?: number;
  theme?: string;
  ratio?: string;
  layout?: string;
  masterObjects?: any[];
  width?: number;
  height?: number;
}

export interface SlideDeckHealth {
  slideCount: number;
  objectCount: number;
  commentsOpen: number;
  commentsResolved: number;
  pptxIssues: number;
  pptxIssueMessages: string[];
  emptySlides: number;
  currentEmpty: boolean;
  missingTitles: number;
  currentHasTitle: boolean;
  missingNotes: number;
  currentHasNotes: boolean;
  sections: number;
  sectionCount: number;
  smartObjects: number;
  smartObjectsContractPending: number;
  animatedObjects: number;
  animationCount: number;
  slidesWithAnimations: number;
  transitionSlides: number;
  transitionVariants: number;
  autoAdvanceSlides: number;
  hiddenObjects: number;
  lockedObjects: number;
  offCanvasObjects: number;
  imagesMissingAltText: number;
  readinessScore: number;
  readinessIssues: string[];
  exportReadiness: 'ready' | 'review' | 'blocked';
  exportWarnings: number;
  exportBlockers: number;
  exportSummary: string;
  master: boolean;
  theme: string;
  ratio: string;
  layout?: string;
}

function objectsOf(slide: any): any[] {
  return Array.isArray(slide?.objects) ? slide.objects.filter((o: any) => o && o.bgFill !== true) : [];
}

function textOf(o: any): string {
  return typeof o?.text === 'string' ? o.text.trim() : '';
}

function firstLine(text: string): string {
  return text.split('\n').map((s) => s.trim()).find(Boolean) || '';
}

export function getSlideTitle(slide: any): string {
  const objects = objectsOf(slide);
  const title = objects.find((o) => o?.ph === 'title' && textOf(o));
  if (title) return firstLine(textOf(title));
  const text = objects.find((o) => ['textbox', 'i-text', 'text'].includes(String(o?.type || '')) && textOf(o));
  return text ? firstLine(textOf(text)) : '';
}

function numeric(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function scaledDimension(o: any, key: 'width' | 'height'): number {
  const scale = numeric(key === 'width' ? o?.scaleX : o?.scaleY, 1);
  return Math.abs(numeric(o?.[key], 0) * scale);
}

function isOffCanvas(o: any, width: number, height: number): boolean {
  const left = numeric(o?.left, 0);
  const top = numeric(o?.top, 0);
  const w = scaledDimension(o, 'width');
  const h = scaledDimension(o, 'height');
  if (!w && !h) return false;
  const right = left + w;
  const bottom = top + h;
  return left < -4 || top < -4 || right > width + 4 || bottom > height + 4;
}

function smartObjectNeedsContract(o: any): boolean {
  const spec = o?.smartObject;
  if (!spec) return false;
  const source = String(spec?.binding?.source ?? spec?.source ?? '').trim().toLowerCase();
  if (!source || source === 'manual' || source === 'static' || source === 'none') return false;
  const updatedAt = String(spec?.binding?.lastUpdatedAt ?? spec?.lastUpdatedAt ?? '').trim();
  return !updatedAt;
}

function hasMissingImageAlt(o: any): boolean {
  if (String(o?.type || '') !== 'image') return false;
  return !String(o?.altText ?? o?.alt ?? o?.label ?? o?.assetId ?? '').trim();
}

function uniqueTransitions(slides: any[], transitions?: string[], fallback?: string): Set<string> {
  const out = new Set<string>();
  slides.forEach((slide, index) => {
    const t = String(transitions?.[index] ?? slide?.transition ?? fallback ?? 'fade').trim();
    if (t && t !== 'none') out.add(t);
  });
  return out;
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function analyzeSlideDeckHealth(input: SlideDeckHealthInput): SlideDeckHealth {
  const slides = Array.isArray(input.slides) && input.slides.length ? input.slides : [];
  const current = Math.min(Math.max(0, input.current ?? 0), Math.max(0, slides.length - 1));
  const width = input.width ?? 960;
  const height = input.height ?? (input.ratio === '4:3' ? 720 : 540);
  const slideObjects = slides.map(objectsOf);
  const allObjects = slideObjects.flat();
  const notes = input.notes ?? [];
  const comments = input.comments ?? [];
  const pptxIssues = input.pptxIssues ?? [];
  const pptxDanger = !!input.hasPptxDanger || pptxIssues.some((issue) => String(issue.severity ?? '').toLowerCase() === 'danger');
  const transitions = uniqueTransitions(slides, input.transitions, slides[0]?.transition);

  const emptySlides = slideObjects.filter((objects) => objects.length === 0).length;
  const missingTitles = slides.filter((slide) => !getSlideTitle(slide)).length;
  const missingNotes = slides.filter((_, i) => !String(notes[i] ?? '').trim()).length;
  const animatedBySlide = slideObjects.map((objects) => objects.filter((o) => o?.anim && o.anim !== 'none').length);
  const smartObjects = allObjects.filter((o) => !!o?.smartObject).length;
  const open = comments.filter((comment) => !comment.resolved && !comment.parentId).length;
  const resolved = comments.filter((comment) => comment.resolved && !comment.parentId).length;
  const hiddenObjects = allObjects.filter((o) => o?.visible === false).length;
  const lockedObjects = allObjects.filter((o) => !!o?.locked).length;
  const offCanvasObjects = allObjects.filter((o) => isOffCanvas(o, width, height)).length;
  const imagesMissingAltText = allObjects.filter(hasMissingImageAlt).length;
  const smartObjectsContractPending = allObjects.filter(smartObjectNeedsContract).length;
  const animatedObjects = animatedBySlide.reduce((sum, n) => sum + n, 0);
  const slidesWithAnimations = animatedBySlide.filter((n) => n > 0).length;
  const transitionSlides = slides.filter((slide, index) => {
    const t = String(input.transitions?.[index] ?? slide?.transition ?? '').trim();
    return t && t !== 'none';
  }).length;
  const autoAdvanceSlides = slides.filter((slide, index) => numeric(input.advanceAfters?.[index] ?? slide?.advanceAfter, 0) > 0).length;
  const transitionVariants = transitions.size;

  const readinessIssues = [
    emptySlides > 0 ? `${emptySlides} empty slide(s) need a layout or content.` : '',
    missingTitles > 0 ? `${missingTitles} slide(s) need a title for navigation and export.` : '',
    missingNotes > 0 ? `${missingNotes} slide(s) are missing speaker notes.` : '',
    open > 0 ? `${open} open review thread(s) should be resolved before release.` : '',
    pptxIssues.length > 0 ? `${pptxIssues.length} PPTX compatibility warning(s) need review.` : '',
    pptxDanger ? 'PPTX contains blocked content such as macros or unsafe embedded objects.' : '',
    offCanvasObjects > 0 ? `${offCanvasObjects} object(s) are outside the slide bounds.` : '',
    imagesMissingAltText > 0 ? `${imagesMissingAltText} image(s) are missing alt text or labels.` : '',
    smartObjectsContractPending > 0 ? `${smartObjectsContractPending} AXOS Smart Object(s) need a refresh/contract confirmation.` : '',
    transitionVariants > 2 ? `${transitionVariants} transition styles are used; standardize before executive review.` : '',
    hiddenObjects > 0 ? `${hiddenObjects} hidden object(s) should be confirmed before export.` : '',
  ].filter(Boolean);

  const readinessScore = clampScore(
    100
      - (emptySlides * 8)
      - (missingTitles * 5)
      - Math.min(16, missingNotes * 2)
      - (open * 3)
      - (pptxIssues.length * 2)
      - (pptxDanger ? 10 : 0)
      - (offCanvasObjects * 5)
      - (imagesMissingAltText * 3)
      - (smartObjectsContractPending * 4)
      - (transitionVariants > 2 ? 3 : 0)
      - Math.min(8, hiddenObjects),
  );
  const exportBlockers = emptySlides + offCanvasObjects + (pptxDanger ? 1 : 0);
  const exportWarnings = missingTitles + missingNotes + open + pptxIssues.length + hiddenObjects + imagesMissingAltText + smartObjectsContractPending;
  const exportReadiness: SlideDeckHealth['exportReadiness'] = exportBlockers > 0 || readinessScore < 65
    ? 'blocked'
    : exportWarnings > 0 || readinessScore < 85
      ? 'review'
      : 'ready';
  const exportSummary = exportReadiness === 'ready'
    ? 'Ready to export'
    : exportReadiness === 'review'
      ? `${exportWarnings} warning(s) before export`
      : `${exportBlockers} blocker(s) before export`;

  return {
    slideCount: slides.length,
    objectCount: allObjects.length,
    commentsOpen: open,
    commentsResolved: resolved,
    pptxIssues: pptxIssues.length,
    pptxIssueMessages: pptxIssues.map((issue) => String(issue.message || issue.code || 'PPTX warning')),
    emptySlides,
    currentEmpty: (slideObjects[current] ?? []).length === 0,
    missingTitles,
    currentHasTitle: !!getSlideTitle(slides[current]),
    missingNotes,
    currentHasNotes: !!String(notes[current] ?? '').trim(),
    sections: countSections(input.sections ?? []),
    sectionCount: countSections(input.sections ?? []),
    smartObjects,
    smartObjectsContractPending,
    animatedObjects,
    animationCount: animatedObjects,
    slidesWithAnimations,
    transitionSlides,
    transitionVariants,
    autoAdvanceSlides,
    hiddenObjects,
    lockedObjects,
    offCanvasObjects,
    imagesMissingAltText,
    readinessScore,
    readinessIssues,
    exportReadiness,
    exportWarnings,
    exportBlockers,
    exportSummary,
    master: objectsOf({ objects: input.masterObjects ?? [] }).length > 0,
    theme: input.theme ?? 'Default',
    ratio: input.ratio ?? '16:9',
    layout: input.layout,
  };
}
