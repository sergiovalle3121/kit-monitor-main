/* eslint-disable @typescript-eslint/no-explicit-any */

export type PptxExportPreflightSeverity = 'info' | 'warning' | 'danger';

export interface PptxExportPreflightOptions {
  includeNotes: boolean;
  includeHiddenSlides: boolean;
}

export interface PptxExportPreflightIssue {
  code: string;
  severity: PptxExportPreflightSeverity;
  title: string;
  detail: string;
  count?: number;
}

export interface PptxExportPreflightReport {
  slideCount: number;
  exportedSlideCount: number;
  hiddenSlideCount: number;
  notesCount: number;
  openCommentCount: number;
  commentCount: number;
  animationCount: number;
  transitionCount: number;
  nativeChartCount: number;
  nativeTableCount: number;
  smartArtCount: number;
  smartObjectCount: number;
  warningCount: number;
  dangerCount: number;
  exportReady: boolean;
  issues: PptxExportPreflightIssue[];
}

export interface PptxExportPayload {
  slides: any[];
  notes: string[];
  report: PptxExportPreflightReport;
}

export interface PptxExportPreflightInput {
  slides?: any[];
  notes?: string[];
  comments?: any[];
  transitions?: string[];
  pptxCompatibility?: { issues?: any[]; hasDanger?: boolean };
  options: PptxExportPreflightOptions;
}

function issue(code: string, severity: PptxExportPreflightSeverity, title: string, detail: string, count?: number): PptxExportPreflightIssue {
  return { code, severity, title, detail, ...(typeof count === 'number' && count > 0 ? { count } : {}) };
}

function isHiddenSlide(slide: any): boolean {
  return slide?.hidden === true || slide?.visible === false || slide?.skip === true || slide?.meta?.hidden === true;
}

function slideEntries(slides: any[], includeHiddenSlides: boolean): { slide: any; index: number }[] {
  return slides
    .map((slide, index) => ({ slide, index }))
    .filter(({ slide }) => includeHiddenSlides || !isHiddenSlide(slide));
}

function walkObjects(objects: any[] | undefined, visit: (object: any) => void) {
  for (const object of objects ?? []) {
    if (!object || typeof object !== 'object') continue;
    visit(object);
    if (Array.isArray(object.objects)) walkObjects(object.objects, visit);
  }
}

function isRealTransition(value: any): boolean {
  const v = String(value || '').trim();
  return !!v && v !== 'none';
}

function isMediaObject(object: any): boolean {
  const type = String(object?.type || '').toLowerCase();
  const src = String(object?.src || object?.source || '').toLowerCase();
  return type.includes('video') || type.includes('audio') || /\.(mp4|mov|avi|wmv|m4v|mp3|wav|m4a)(\?|#|$)/i.test(src);
}

function isUnsupportedPath(object: any): boolean {
  return String(object?.type || '').toLowerCase() === 'path' && !object?.shape;
}

function compatibilityIssueSeverity(raw: any): PptxExportPreflightSeverity {
  const value = String(raw?.severity || '').toLowerCase();
  return value === 'danger' || value === 'warning' ? value : 'info';
}

export function buildPptxExportPreflight(input: PptxExportPreflightInput): PptxExportPayload {
  const slides = Array.isArray(input.slides) ? input.slides : [];
  const notes = Array.isArray(input.notes) ? input.notes : [];
  const comments = Array.isArray(input.comments) ? input.comments : [];
  const entries = slideEntries(slides, input.options.includeHiddenSlides);
  const exportedSlides = entries.map(({ slide }) => slide);
  const exportedNotes = input.options.includeNotes ? entries.map(({ index }) => String(notes[index] || '')) : [];
  const issues: PptxExportPreflightIssue[] = [];

  const hiddenSlideCount = slides.filter(isHiddenSlide).length;
  const notesCount = entries.filter(({ index }) => String(notes[index] || '').trim()).length;
  const openCommentCount = comments.filter((comment) => comment && !comment.resolved && !comment.parentId).length;
  const commentCount = comments.filter((comment) => comment && !comment.parentId).length;
  const transitionCount = entries.filter(({ index }) => isRealTransition(input.transitions?.[index])).length;
  let animationCount = 0;
  let nativeChartCount = 0;
  let nativeTableCount = 0;
  let smartArtCount = 0;
  let smartObjectCount = 0;
  let mediaCount = 0;
  let unsupportedPathCount = 0;

  exportedSlides.forEach((slide) => {
    walkObjects(slide?.objects, (object) => {
      if (object.anim && object.anim !== 'none') animationCount += 1;
      if (object.chartSpec) nativeChartCount += 1;
      if (object.tableSpec) nativeTableCount += 1;
      if (object.smart) smartArtCount += 1;
      if (object.smartObject) smartObjectCount += 1;
      if (isMediaObject(object)) mediaCount += 1;
      if (isUnsupportedPath(object)) unsupportedPathCount += 1;
    });
  });

  if (!exportedSlides.length && slides.length) {
    issues.push(issue('no-exported-slides', 'danger', 'No slides selected for export', 'All slides are hidden and hidden-slide export is disabled.'));
  }

  if (hiddenSlideCount && !input.options.includeHiddenSlides) {
    issues.push(issue('hidden-slides-excluded', 'info', 'Hidden slides excluded', `${hiddenSlideCount} hidden slide(s) will not be exported.`, hiddenSlideCount));
  }

  if (input.options.includeNotes && notesCount) {
    issues.push(issue('speaker-notes-included', 'info', 'Speaker notes included', `${notesCount} slide(s) will export speaker notes.`, notesCount));
  } else if (!input.options.includeNotes && notesCount) {
    issues.push(issue('speaker-notes-skipped', 'warning', 'Speaker notes skipped', `${notesCount} slide(s) have notes, but notes export is disabled.`, notesCount));
  }

  if (openCommentCount) {
    issues.push(issue('comments-not-exported', 'warning', 'Comments stay in AXOS', `${openCommentCount} open review thread(s) are not written to PPTX yet.`, openCommentCount));
  }

  if (animationCount) {
    issues.push(issue('animations-not-exported', 'warning', 'Animations flatten on export', `${animationCount} object animation(s) remain available in AXOS but are not emitted as PowerPoint timelines yet.`, animationCount));
  }

  if (transitionCount) {
    issues.push(issue('transitions-not-exported', 'warning', 'Transitions flatten on export', `${transitionCount} slide transition(s) are used in AXOS presentation mode but are not emitted to PPTX yet.`, transitionCount));
  }

  if (smartArtCount) {
    issues.push(issue('smartart-shape-export', 'info', 'SmartArt exports as shapes', `${smartArtCount} SmartArt diagram(s) export as editable shapes, not native PowerPoint SmartArt.`, smartArtCount));
  }

  if (smartObjectCount) {
    issues.push(issue('smart-objects-static-export', 'info', 'Smart Objects export static', `${smartObjectCount} AXOS Smart Object(s) export as editable shapes without live data bindings.`, smartObjectCount));
  }

  if (mediaCount) {
    issues.push(issue('media-not-exported', 'danger', 'Timed media unsupported', `${mediaCount} audio/video object(s) cannot be exported to PPTX by the current writer.`, mediaCount));
  }

  if (unsupportedPathCount) {
    issues.push(issue('paths-skipped', 'warning', 'Freeform paths may be skipped', `${unsupportedPathCount} path object(s) do not map to a PowerPoint preset.`, unsupportedPathCount));
  }

  for (const raw of input.pptxCompatibility?.issues ?? []) {
    const severity = compatibilityIssueSeverity(raw);
    issues.push(issue(
      `import-${String(raw?.code || 'pptx-issue')}`,
      severity,
      severity === 'danger' ? 'Imported PPTX security blocker' : 'Imported PPTX compatibility note',
      String(raw?.message || raw?.code || 'Compatibility warning from the imported PPTX.'),
      typeof raw?.count === 'number' ? raw.count : undefined,
    ));
  }

  const warningCount = issues.filter((item) => item.severity === 'warning').length;
  const dangerCount = issues.filter((item) => item.severity === 'danger').length;

  return {
    slides: exportedSlides,
    notes: exportedNotes,
    report: {
      slideCount: slides.length,
      exportedSlideCount: exportedSlides.length,
      hiddenSlideCount,
      notesCount,
      openCommentCount,
      commentCount,
      animationCount,
      transitionCount,
      nativeChartCount,
      nativeTableCount,
      smartArtCount,
      smartObjectCount,
      warningCount,
      dangerCount,
      exportReady: exportedSlides.length > 0 && dangerCount === 0,
      issues,
    },
  };
}
