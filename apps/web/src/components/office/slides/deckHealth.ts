/* eslint-disable @typescript-eslint/no-explicit-any */

export type SlideDeckHealthSeverity = 'info' | 'warning' | 'danger';

export type SlideDeckHealthAction =
  | 'title'
  | 'layout'
  | 'notes'
  | 'comments'
  | 'layers'
  | 'animations'
  | 'pptx'
  | 'smartObject';

export interface SlideDeckHealthIssue {
  id: string;
  severity: SlideDeckHealthSeverity;
  label: string;
  detail: string;
  slideIndex?: number;
  objectId?: string;
  action?: SlideDeckHealthAction;
  count?: number;
}

export interface SlideDeckHealthInput {
  slides: any[];
  notes?: string[];
  comments?: any[];
  pptxCompatibility?: any;
  sections?: (string | null)[];
  transitions?: string[];
  currentIndex?: number;
  slideWidth?: number;
  slideHeight?: number;
}

export interface SlideDeckHealthReport {
  slideCount: number;
  objectCount: number;
  sectionCount: number;
  commentsOpen: number;
  commentsResolved: number;
  pptxIssues: number;
  pptxDangerIssues: number;
  pptxIssueMessages: string[];
  emptySlides: number;
  currentEmpty: boolean;
  missingTitles: number;
  currentHasTitle: boolean;
  missingNotes: number;
  currentMissingNotes: boolean;
  smartObjects: number;
  contractPendingSmartObjects: number;
  animations: number;
  transitions: number;
  hiddenObjects: number;
  lockedObjects: number;
  offCanvasObjects: number;
  missingAltText: number;
  largeImages: number;
  exportWarnings: number;
  issueCount: number;
  readinessScore: number;
  exportReady: boolean;
  issues: SlideDeckHealthIssue[];
}

const TEXT_TYPES = new Set(['textbox', 'i-text', 'text']);
const LARGE_IMAGE_SRC = 1_500_000;

function slideObjects(slide: any): any[] {
  return Array.isArray(slide?.objects) ? slide.objects.filter((o: any) => !o?.bgFill) : [];
}

function textValue(o: any): string {
  return TEXT_TYPES.has(String(o?.type || '').toLowerCase()) ? String(o?.text || '').trim() : '';
}

function slideTitle(slide: any): string {
  const title = slideObjects(slide).find((o) => textValue(o));
  return textValue(title);
}

function objectBounds(o: any) {
  const scaleX = typeof o?.scaleX === 'number' ? o.scaleX : 1;
  const scaleY = typeof o?.scaleY === 'number' ? o.scaleY : 1;
  const left = typeof o?.left === 'number' ? o.left : Math.min(Number(o?.x1 ?? 0), Number(o?.x2 ?? 0));
  const top = typeof o?.top === 'number' ? o.top : Math.min(Number(o?.y1 ?? 0), Number(o?.y2 ?? 0));
  const width = typeof o?.radius === 'number'
    ? o.radius * 2 * scaleX
    : Math.abs(Number(o?.width ?? Math.abs(Number(o?.x2 ?? 0) - Number(o?.x1 ?? 0))) * scaleX);
  const height = typeof o?.radius === 'number'
    ? o.radius * 2 * scaleY
    : Math.abs(Number(o?.height ?? Math.abs(Number(o?.y2 ?? 0) - Number(o?.y1 ?? 0))) * scaleY);
  return { left, top, right: left + width, bottom: top + height };
}

function isOffCanvas(o: any, width: number, height: number): boolean {
  if (o?.visible === false) return false;
  const b = objectBounds(o);
  const margin = 6;
  return b.right < -margin || b.bottom < -margin || b.left > width + margin || b.top > height + margin;
}

function objectId(o: any): string | undefined {
  const id = o?.id || o?.name || o?.commentId;
  return id ? String(id) : undefined;
}

function pptxIssues(report: any): any[] {
  return Array.isArray(report?.issues) ? report.issues : [];
}

function firstIndex<T>(items: T[], predicate: (item: T, index: number) => boolean): number | undefined {
  const idx = items.findIndex(predicate);
  return idx >= 0 ? idx : undefined;
}

export function buildSlideDeckHealth(input: SlideDeckHealthInput): SlideDeckHealthReport {
  const slides = Array.isArray(input.slides) && input.slides.length ? input.slides : [];
  const notes = Array.isArray(input.notes) ? input.notes : [];
  const comments = Array.isArray(input.comments) ? input.comments : [];
  const sections = Array.isArray(input.sections) ? input.sections : [];
  const transitionsInput = Array.isArray(input.transitions) ? input.transitions : [];
  const currentIndex = Math.max(0, Math.min(input.currentIndex ?? 0, Math.max(0, slides.length - 1)));
  const slideWidth = input.slideWidth ?? 960;
  const slideHeight = input.slideHeight ?? 540;
  const issues: SlideDeckHealthIssue[] = [];

  const objectsBySlide = slides.map(slideObjects);
  const objectCount = objectsBySlide.reduce((sum, objects) => sum + objects.length, 0);
  const emptyIndexes = objectsBySlide.map((objects, idx) => (objects.length ? -1 : idx)).filter((idx) => idx >= 0);
  const missingTitleIndexes = slides.map((slide, idx) => (slideTitle(slide) ? -1 : idx)).filter((idx) => idx >= 0);
  const missingNoteIndexes = slides.map((_, idx) => (String(notes[idx] || '').trim() ? -1 : idx)).filter((idx) => idx >= 0);
  const openComments = comments.filter((c) => !c?.resolved && !c?.parentId);
  const resolvedComments = comments.filter((c) => c?.resolved && !c?.parentId);
  const pptx = pptxIssues(input.pptxCompatibility);
  const pptxDangerIssues = pptx.filter((x) => x?.severity === 'danger').length;
  const pptxWarnings = pptx.filter((x) => x?.severity === 'warning').length;

  let smartObjects = 0;
  let contractPendingSmartObjects = 0;
  let animations = 0;
  let hiddenObjects = 0;
  let lockedObjects = 0;
  let offCanvasObjects = 0;
  let missingAltText = 0;
  let largeImages = 0;
  let firstOffCanvas: { slideIndex: number; object?: any } | undefined;
  let firstAltGap: { slideIndex: number; object?: any } | undefined;
  let firstHiddenOrLocked: { slideIndex: number; object?: any } | undefined;
  let firstSmartPending: { slideIndex: number; object?: any } | undefined;

  objectsBySlide.forEach((objects, slideIndex) => {
    objects.forEach((o) => {
      if (o?.smartObject) {
        smartObjects += 1;
        const source = String(o.smartObject.source || '');
        if (source.startsWith('AXOS.') && !o.smartObject.lastUpdatedAt) {
          contractPendingSmartObjects += 1;
          firstSmartPending ??= { slideIndex, object: o };
        }
      }
      if (o?.anim && o.anim !== 'none') animations += 1;
      if (o?.visible === false) {
        hiddenObjects += 1;
        firstHiddenOrLocked ??= { slideIndex, object: o };
      }
      if (o?.locked) {
        lockedObjects += 1;
        firstHiddenOrLocked ??= { slideIndex, object: o };
      }
      if (isOffCanvas(o, slideWidth, slideHeight)) {
        offCanvasObjects += 1;
        firstOffCanvas ??= { slideIndex, object: o };
      }
      if (String(o?.type || '').toLowerCase() === 'image') {
        if (!String(o?.alt || o?.label || o?.name || '').trim()) {
          missingAltText += 1;
          firstAltGap ??= { slideIndex, object: o };
        }
        if (typeof o?.src === 'string' && o.src.length > LARGE_IMAGE_SRC) largeImages += 1;
      }
    });
  });

  const transitions = transitionsInput.filter((t) => t && t !== 'none').length;
  const sectionCount = sections.filter((s) => String(s || '').trim()).length;

  if (emptyIndexes.length) {
    issues.push({
      id: 'empty-slides',
      severity: 'warning',
      label: 'Empty slides',
      detail: `${emptyIndexes.length} slide(s) have no editable content.`,
      slideIndex: emptyIndexes[0],
      action: 'layout',
      count: emptyIndexes.length,
    });
  }
  if (missingTitleIndexes.length) {
    issues.push({
      id: 'missing-titles',
      severity: 'warning',
      label: 'Missing slide titles',
      detail: `${missingTitleIndexes.length} slide(s) need a title for outline, review and export navigation.`,
      slideIndex: missingTitleIndexes[0],
      action: 'title',
      count: missingTitleIndexes.length,
    });
  }
  if (missingNoteIndexes.length) {
    issues.push({
      id: 'missing-notes',
      severity: 'info',
      label: 'Speaker notes gaps',
      detail: `${missingNoteIndexes.length} slide(s) do not have speaker notes.`,
      slideIndex: missingNoteIndexes[0],
      action: 'notes',
      count: missingNoteIndexes.length,
    });
  }
  if (openComments.length) {
    const slideIndex = firstIndex(openComments, (c) => typeof c?.slide === 'number');
    issues.push({
      id: 'open-comments',
      severity: 'warning',
      label: 'Open review comments',
      detail: `${openComments.length} unresolved thread(s) remain before release.`,
      slideIndex: slideIndex !== undefined ? openComments[slideIndex]?.slide : undefined,
      action: 'comments',
      count: openComments.length,
    });
  }
  if (pptxDangerIssues) {
    issues.push({
      id: 'pptx-danger',
      severity: 'danger',
      label: 'PPTX security risks',
      detail: `${pptxDangerIssues} imported PPTX issue(s) are marked high risk.`,
      action: 'pptx',
      count: pptxDangerIssues,
    });
  }
  if (pptxWarnings) {
    issues.push({
      id: 'pptx-warnings',
      severity: 'warning',
      label: 'PPTX compatibility warnings',
      detail: `${pptxWarnings} imported PPTX feature(s) may be skipped or approximated.`,
      action: 'pptx',
      count: pptxWarnings,
    });
  }
  if (animations) {
    issues.push({
      id: 'animation-export',
      severity: 'info',
      label: 'Animation export review',
      detail: `${animations} object animation(s) play in AXOS but may not export as native PPTX timing.`,
      slideIndex: firstIndex(objectsBySlide, (objects) => objects.some((o) => o?.anim && o.anim !== 'none')),
      action: 'animations',
      count: animations,
    });
  }
  if (transitions) {
    issues.push({
      id: 'transition-export',
      severity: 'info',
      label: 'Transition export review',
      detail: `${transitions} slide transition(s) should be checked before PPTX handoff.`,
      slideIndex: firstIndex(transitionsInput, (t) => !!t && t !== 'none'),
      action: 'pptx',
      count: transitions,
    });
  }
  if (offCanvasObjects) {
    issues.push({
      id: 'off-canvas-objects',
      severity: 'warning',
      label: 'Off-canvas objects',
      detail: `${offCanvasObjects} object(s) sit outside the slide bounds.`,
      slideIndex: firstOffCanvas?.slideIndex,
      objectId: objectId(firstOffCanvas?.object),
      action: 'layers',
      count: offCanvasObjects,
    });
  }
  if (missingAltText) {
    issues.push({
      id: 'missing-alt-text',
      severity: 'warning',
      label: 'Image alt text gaps',
      detail: `${missingAltText} image(s) need a label or alt text for controlled visual aids.`,
      slideIndex: firstAltGap?.slideIndex,
      objectId: objectId(firstAltGap?.object),
      action: 'layers',
      count: missingAltText,
    });
  }
  if (largeImages) {
    issues.push({
      id: 'large-images',
      severity: 'warning',
      label: 'Large embedded images',
      detail: `${largeImages} image(s) may make export and sync slow.`,
      action: 'layers',
      count: largeImages,
    });
  }
  if (hiddenObjects || lockedObjects) {
    issues.push({
      id: 'hidden-locked-objects',
      severity: 'info',
      label: 'Hidden or locked objects',
      detail: `${hiddenObjects} hidden and ${lockedObjects} locked object(s) need review before release.`,
      slideIndex: firstHiddenOrLocked?.slideIndex,
      objectId: objectId(firstHiddenOrLocked?.object),
      action: 'layers',
      count: hiddenObjects + lockedObjects,
    });
  }
  if (contractPendingSmartObjects) {
    issues.push({
      id: 'smart-object-contracts',
      severity: 'info',
      label: 'Smart Object contracts pending',
      detail: `${contractPendingSmartObjects} AXOS Smart Object(s) use data-source hints without a refreshed snapshot.`,
      slideIndex: firstSmartPending?.slideIndex,
      objectId: objectId(firstSmartPending?.object),
      action: 'smartObject',
      count: contractPendingSmartObjects,
    });
  }

  const exportWarnings = pptx.length + animations + transitions + missingAltText + largeImages + offCanvasObjects;
  const penalty =
    emptyIndexes.length * 8 +
    missingTitleIndexes.length * 5 +
    missingNoteIndexes.length * 2 +
    openComments.length * 3 +
    pptxDangerIssues * 12 +
    pptxWarnings * 4 +
    offCanvasObjects * 5 +
    missingAltText * 3 +
    largeImages * 3 +
    contractPendingSmartObjects * 2;
  const readinessScore = Math.max(0, Math.min(100, 100 - penalty));
  const exportReady = !pptxDangerIssues && !offCanvasObjects && !missingAltText && !largeImages;

  return {
    slideCount: slides.length,
    objectCount,
    sectionCount,
    commentsOpen: openComments.length,
    commentsResolved: resolvedComments.length,
    pptxIssues: pptx.length,
    pptxDangerIssues,
    pptxIssueMessages: pptx.map((x) => String(x?.message || x?.code || 'PPTX compatibility notice')),
    emptySlides: emptyIndexes.length,
    currentEmpty: objectsBySlide[currentIndex]?.length === 0,
    missingTitles: missingTitleIndexes.length,
    currentHasTitle: !!slideTitle(slides[currentIndex]),
    missingNotes: missingNoteIndexes.length,
    currentMissingNotes: !String(notes[currentIndex] || '').trim(),
    smartObjects,
    contractPendingSmartObjects,
    animations,
    transitions,
    hiddenObjects,
    lockedObjects,
    offCanvasObjects,
    missingAltText,
    largeImages,
    exportWarnings,
    issueCount: issues.length,
    readinessScore,
    exportReady,
    issues,
  };
}

export function describeDeckHealthIssue(issue: SlideDeckHealthIssue): string {
  const target = typeof issue.slideIndex === 'number' ? `Slide ${issue.slideIndex + 1}` : 'Deck';
  const object = issue.objectId ? ` - ${issue.objectId}` : '';
  return `${target}${object}: ${issue.label}`;
}
