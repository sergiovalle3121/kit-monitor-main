import type { SlideDeckHealth } from './deckHealth';

export type PresenterReadinessLevel = 'ready' | 'review' | 'blocked';
export type PresenterReadinessSeverity = 'blocker' | 'warning' | 'info';

export interface PresenterReadinessIssue {
  id: string;
  severity: PresenterReadinessSeverity;
  label: string;
  detail: string;
  count?: number;
  action?: string;
}

export interface PresenterChecklistItem {
  label: string;
  ok: boolean;
  detail: string;
}

export interface PresenterReadiness {
  level: PresenterReadinessLevel;
  score: number;
  label: string;
  summary: string;
  blockers: number;
  warnings: number;
  infos: number;
  issues: PresenterReadinessIssue[];
  topIssues: PresenterReadinessIssue[];
  checklist: PresenterChecklistItem[];
  estimatedDurationSec: number;
  estimatedDurationLabel: string;
  notesCoverage: number;
  autoAdvanceSlides: number;
  animatedSlides: number;
}

export interface BuildPresenterReadinessInput {
  health: SlideDeckHealth;
  advanceAfters?: number[];
  transitionDurationMs?: number[];
  rehearsalSecondsPerSlide?: number;
}

const DEFAULT_REHEARSAL_SECONDS_PER_SLIDE = 75;

function numeric(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function issue(
  id: string,
  severity: PresenterReadinessSeverity,
  label: string,
  detail: string,
  count?: number,
  action?: string,
): PresenterReadinessIssue {
  return { id, severity, label, detail, count, action };
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  if (safe < 60) return `${safe}s`;
  const minutes = Math.floor(safe / 60);
  const rem = safe % 60;
  return rem ? `${minutes}m ${rem}s` : `${minutes}m`;
}

function severityRank(severity: PresenterReadinessSeverity): number {
  if (severity === 'blocker') return 0;
  if (severity === 'warning') return 1;
  return 2;
}

export function buildPresenterReadiness(input: BuildPresenterReadinessInput): PresenterReadiness {
  const health = input.health;
  const slideCount = Math.max(0, health.slideCount);
  const hasAdvanceSchedule = Array.isArray(input.advanceAfters);
  const advanceAfters = (input.advanceAfters ?? []).slice(0, slideCount).map((n) => Math.max(0, numeric(n, 0)));
  const transitionDurations = (input.transitionDurationMs ?? []).slice(0, slideCount).map((n) => Math.max(0, numeric(n, 0)) / 1000);
  const autoAdvanceSlides = hasAdvanceSchedule ? Math.max(health.autoAdvanceSlides, advanceAfters.filter((n) => n > 0).length) : health.autoAdvanceSlides;
  const manualSlides = hasAdvanceSchedule ? Math.max(0, slideCount - autoAdvanceSlides) : slideCount;
  const timedSeconds = advanceAfters.reduce((sum, n) => sum + n, 0);
  const transitionSeconds = transitionDurations.reduce((sum, n) => sum + n, 0);
  const rehearsalSeconds = Math.max(15, numeric(input.rehearsalSecondsPerSlide, DEFAULT_REHEARSAL_SECONDS_PER_SLIDE));
  const estimatedDurationSec = Math.round(timedSeconds + transitionSeconds + manualSlides * rehearsalSeconds);

  const issues: PresenterReadinessIssue[] = [];
  if (!slideCount) {
    issues.push(issue('no-slides', 'blocker', 'No slides', 'Create at least one slide before entering presenter mode.', 1, 'Add slide'));
  }
  if (health.emptySlides > 0) {
    issues.push(issue('empty-slides', 'blocker', 'Empty slides', `${health.emptySlides} slide(s) have no presentable content.`, health.emptySlides, 'Apply layout'));
  }
  if (health.offCanvasObjects > 0) {
    issues.push(issue('off-canvas', 'blocker', 'Off-canvas objects', `${health.offCanvasObjects} object(s) may be clipped during presentation.`, health.offCanvasObjects, 'Inspect bounds'));
  }
  if (health.missingTitles > 0) {
    issues.push(issue('missing-titles', 'warning', 'Missing titles', `${health.missingTitles} slide(s) need titles for navigation and audience context.`, health.missingTitles, 'Add titles'));
  }
  if (health.missingNotes > 0) {
    issues.push(issue('missing-notes', 'warning', 'Missing speaker notes', `${health.missingNotes} slide(s) have no speaker notes for the presenter view.`, health.missingNotes, 'Add notes'));
  }
  if (health.commentsOpen > 0) {
    issues.push(issue('open-comments', 'warning', 'Open review comments', `${health.commentsOpen} unresolved thread(s) may need review before the meeting.`, health.commentsOpen, 'Review comments'));
  }
  if (health.pptxIssues > 0) {
    issues.push(issue('pptx-warnings', 'warning', 'PPTX compatibility', `${health.pptxIssues} import/export compatibility warning(s) remain attached to this deck.`, health.pptxIssues, 'Review PPTX'));
  }
  if (health.smartObjectsContractPending > 0) {
    issues.push(issue('smart-object-contracts', 'warning', 'AXOS Smart Objects pending', `${health.smartObjectsContractPending} Smart Object(s) need source refresh or contract confirmation.`, health.smartObjectsContractPending, 'Refresh snapshot'));
  }
  if (health.imagesMissingAltText > 0) {
    issues.push(issue('missing-alt-text', 'warning', 'Image labels missing', `${health.imagesMissingAltText} image(s) are missing labels or alt text.`, health.imagesMissingAltText, 'Add labels'));
  }
  if (health.transitionVariants > 2) {
    issues.push(issue('transition-variety', 'warning', 'Transition variety', `${health.transitionVariants} transition styles are used; standardize for executive delivery.`, health.transitionVariants, 'Standardize transitions'));
  }
  if (health.hiddenObjects > 0) {
    issues.push(issue('hidden-objects', 'warning', 'Hidden objects', `${health.hiddenObjects} hidden object(s) should be confirmed before presenting.`, health.hiddenObjects, 'Open layers'));
  }
  if (autoAdvanceSlides > 0) {
    issues.push(issue('auto-advance', 'info', 'Auto-advance enabled', `${autoAdvanceSlides} slide(s) advance automatically during slideshow mode.`, autoAdvanceSlides, 'Check timing'));
  }
  if (health.animatedObjects > 0) {
    issues.push(issue('animations', 'info', 'Animations present', `${health.animatedObjects} animated object(s) across ${health.slidesWithAnimations} slide(s).`, health.animatedObjects, 'Preview animations'));
  }
  if (health.lockedObjects > 0) {
    issues.push(issue('locked-objects', 'info', 'Locked objects', `${health.lockedObjects} locked object(s) are included in the run of show.`, health.lockedObjects, 'Open layers'));
  }

  const blockers = issues.filter((it) => it.severity === 'blocker').length;
  const warnings = issues.filter((it) => it.severity === 'warning').length;
  const infos = issues.filter((it) => it.severity === 'info').length;
  const level: PresenterReadinessLevel = blockers ? 'blocked' : warnings ? 'review' : 'ready';
  const score = clampPercent(health.readinessScore - blockers * 6 - warnings * 2);
  const notesCoverage = slideCount ? clampPercent(((slideCount - health.missingNotes) / slideCount) * 100) : 0;
  const sortedIssues = [...issues].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  const label = level === 'ready' ? 'Presenter ready' : level === 'blocked' ? 'Presenter blocked' : 'Presenter review';
  const summary = level === 'ready'
    ? 'Ready for presenter mode.'
    : level === 'blocked'
      ? `${blockers} blocker(s) before presenter mode.`
      : `${warnings} warning(s) before presenter mode.`;

  return {
    level,
    score,
    label,
    summary,
    blockers,
    warnings,
    infos,
    issues: sortedIssues,
    topIssues: sortedIssues.slice(0, 4),
    checklist: [
      { label: 'Slide titles', ok: health.missingTitles === 0, detail: health.missingTitles ? `${health.missingTitles} missing` : 'All slides named' },
      { label: 'Speaker notes', ok: health.missingNotes === 0, detail: `${notesCoverage}% coverage` },
      { label: 'Review comments', ok: health.commentsOpen === 0, detail: health.commentsOpen ? `${health.commentsOpen} open` : 'No open threads' },
      { label: 'Canvas bounds', ok: health.offCanvasObjects === 0, detail: health.offCanvasObjects ? `${health.offCanvasObjects} off-canvas` : 'All visible' },
      { label: 'AXOS data', ok: health.smartObjectsContractPending === 0, detail: health.smartObjectsContractPending ? `${health.smartObjectsContractPending} pending` : 'No pending refresh' },
    ],
    estimatedDurationSec,
    estimatedDurationLabel: formatDuration(estimatedDurationSec),
    notesCoverage,
    autoAdvanceSlides,
    animatedSlides: health.slidesWithAnimations,
  };
}
