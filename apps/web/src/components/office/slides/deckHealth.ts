/* eslint-disable @typescript-eslint/no-explicit-any */
import { sectionCount as countSections } from './sections';

export type SlideExportReadiness = 'ready' | 'review' | 'blocked';

export interface SlideDeckHealthInput {
  slides: any[];
  notes?: string[];
  sections?: (string | null)[];
  transitions?: string[];
  advanceAfters?: number[];
  comments?: { resolved?: boolean; parentId?: string | null }[];
  pptxIssues?: { message?: unknown; code?: unknown }[];
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
  exportReadiness: SlideExportReadiness;
  exportWarnings: number;
  exportBlockers: number;
  exportSummary: string;
  master: boolean;
  theme: string;
  ratio: string;
  layout?: string;
}

function objectsOf(slide: any): any[] {
  return Array.isArray(slide?.objects) ? slide.objects.filter((object: any) => object && object.bgFill !== true) : [];
}

function textOf(object: any): string {
  return typeof object?.text === 'string' ? object.text.trim() : '';
}

function firstLine(text: string): string {
  return text.split('\n').map((line) => line.trim()).find(Boolean) || '';
}

export function getSlideTitle(slide: any): string {
  const objects = objectsOf(slide);
  const title = objects.find((object) => object?.ph === 'title' && textOf(object));
  if (title) return firstLine(textOf(title));

  const text = objects.find((object) => ['textbox', 'i-text', 'text'].includes(String(object?.type || '')) && textOf(object));
  return text ? firstLine(textOf(text)) : '';
}

function numeric(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function scaledDimension(object: any, key: 'width' | 'height'): number {
  const scale = numeric(key === 'width' ? object?.scaleX : object?.scaleY, 1);
  return Math.abs(numeric(object?.[key], 0) * scale);
}

function isOffCanvas(object: any, width: number, height: number): boolean {
  const left = numeric(object?.left, 0);
  const top = numeric(object?.top, 0);
  const objectWidth = scaledDimension(object, 'width');
  const objectHeight = scaledDimension(object, 'height');
  if (!objectWidth && !objectHeight) return false;

  const right = left + objectWidth;
  const bottom = top + objectHeight;
  return left < -4 || top < -4 || right > width + 4 || bottom > height + 4;
}

function smartObjectNeedsContract(object: any): boolean {
  const spec = object?.smartObject;
  if (!spec) return false;

  const source = String(spec?.binding?.source ?? spec?.source ?? '').trim().toLowerCase();
  if (!source || source === 'manual' || source === 'static' || source === 'none') return false;

  const lastUpdatedAt = String(spec?.binding?.lastUpdatedAt ?? spec?.lastUpdatedAt ?? '').trim();
  return !lastUpdatedAt;
}

function hasMissingImageAltText(object: any): boolean {
  if (String(object?.type || '') !== 'image') return false;
  return !String(object?.altText ?? object?.alt ?? object?.label ?? object?.assetId ?? '').trim();
}

function uniqueTransitions(slides: any[], transitions?: string[], fallback?: string): Set<string> {
  const out = new Set<string>();
  slides.forEach((slide, index) => {
    const transition = String(transitions?.[index] ?? slide?.transition ?? fallback ?? 'fade').trim();
    if (transition && transition !== 'none') out.add(transition);
  });
  return out;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
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
  const transitionSet = uniqueTransitions(slides, input.transitions, slides[0]?.transition);

  const emptySlides = slideObjects.filter((objects) => objects.length === 0).length;
  const missingTitles = slides.filter((slide) => !getSlideTitle(slide)).length;
  const missingNotes = slides.filter((_, index) => !String(notes[index] ?? '').trim()).length;
  const animatedBySlide = slideObjects.map((objects) => objects.filter((object) => object?.anim && object.anim !== 'none').length);
  const smartObjects = allObjects.filter((object) => !!object?.smartObject).length;
  const commentsOpen = comments.filter((comment) => !comment.resolved && !comment.parentId).length;
  const commentsResolved = comments.filter((comment) => comment.resolved && !comment.parentId).length;
  const hiddenObjects = allObjects.filter((object) => object?.visible === false).length;
  const lockedObjects = allObjects.filter((object) => !!object?.locked).length;
  const offCanvasObjects = allObjects.filter((object) => isOffCanvas(object, width, height)).length;
  const imagesMissingAltText = allObjects.filter(hasMissingImageAltText).length;
  const smartObjectsContractPending = allObjects.filter(smartObjectNeedsContract).length;
  const animatedObjects = animatedBySlide.reduce((sum, count) => sum + count, 0);
  const slidesWithAnimations = animatedBySlide.filter((count) => count > 0).length;
  const transitionSlides = slides.filter((slide, index) => {
    const transition = String(input.transitions?.[index] ?? slide?.transition ?? '').trim();
    return transition && transition !== 'none';
  }).length;
  const autoAdvanceSlides = slides.filter((slide, index) => numeric(input.advanceAfters?.[index] ?? slide?.advanceAfter, 0) > 0).length;
  const transitionVariants = transitionSet.size;

  const transitionVarietyWarning = transitionVariants > 2 ? 1 : 0;
  const readinessIssues = [
    emptySlides > 0 ? `${emptySlides} empty slide(s) need a layout or content.` : '',
    missingTitles > 0 ? `${missingTitles} slide(s) need a title for navigation and export.` : '',
    missingNotes > 0 ? `${missingNotes} slide(s) are missing speaker notes.` : '',
    commentsOpen > 0 ? `${commentsOpen} open review thread(s) should be resolved before release.` : '',
    pptxIssues.length > 0 ? `${pptxIssues.length} PPTX compatibility warning(s) need review.` : '',
    offCanvasObjects > 0 ? `${offCanvasObjects} object(s) are outside the slide bounds.` : '',
    imagesMissingAltText > 0 ? `${imagesMissingAltText} image(s) are missing alt text or labels.` : '',
    smartObjectsContractPending > 0 ? `${smartObjectsContractPending} AXOS Smart Object(s) need a refresh or contract confirmation.` : '',
    transitionVarietyWarning ? `${transitionVariants} transition styles are used; standardize before executive review.` : '',
    hiddenObjects > 0 ? `${hiddenObjects} hidden object(s) should be confirmed before export.` : '',
    lockedObjects > 0 ? `${lockedObjects} locked object(s) should be reviewed before handoff.` : '',
  ].filter(Boolean);

  const readinessScore = clampScore(
    100
      - (emptySlides * 8)
      - (missingTitles * 5)
      - Math.min(16, missingNotes * 2)
      - (commentsOpen * 3)
      - (pptxIssues.length * 2)
      - (offCanvasObjects * 5)
      - (imagesMissingAltText * 3)
      - (smartObjectsContractPending * 4)
      - (transitionVarietyWarning * 3)
      - Math.min(8, hiddenObjects)
      - Math.min(6, lockedObjects),
  );
  const exportBlockers = emptySlides + offCanvasObjects;
  const exportWarnings = missingTitles
    + missingNotes
    + commentsOpen
    + pptxIssues.length
    + hiddenObjects
    + lockedObjects
    + imagesMissingAltText
    + smartObjectsContractPending
    + transitionVarietyWarning;
  const exportReadiness: SlideExportReadiness = exportBlockers > 0 || readinessScore < 65
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
    commentsOpen,
    commentsResolved,
    pptxIssues: pptxIssues.length,
    pptxIssueMessages: pptxIssues.map((issue) => String(issue.message || issue.code || 'PPTX warning')),
    emptySlides,
    currentEmpty: (slideObjects[current] ?? []).length === 0,
    missingTitles,
    currentHasTitle: !!getSlideTitle(slides[current]),
    missingNotes,
    currentHasNotes: !!String(notes[current] ?? '').trim(),
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
