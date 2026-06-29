import type { AnimKind } from '../slideAssets';

export type AnimationChangeKey = 'anim' | 'animOrder' | 'animDur' | 'animDelay' | 'animStart' | 'animRepeat';
export type AnimationPreset = 'sequence' | 'clickReveal';

export interface SlideAnimationTimelineItem {
  idx: number;
  label: string;
  type: string;
  anim: string;
  order: number;
  dur: number;
  delay: number;
  start: string;
  repeat: number;
  kind: AnimKind;
}

export interface SlideAnimationTimelineEntry {
  idx: number;
  label: string;
  type: string;
  effect: string;
  kind: AnimKind;
  order: number;
  step: number;
  startMode: string;
  startMs: number;
  delayMs: number;
  durationMs: number;
  repeat: number;
  endMs: number;
  infinite: boolean;
}

export interface SlideAnimationTimelineIssue {
  code: string;
  severity: 'info' | 'warning';
  message: string;
}

export interface SlideAnimationTimelineReport {
  objectCount: number;
  animatedCount: number;
  autoEntryCount: number;
  clickStepCount: number;
  stepCount: number;
  totalDurationMs: number;
  duplicateOrderCount: number;
  infiniteRepeatCount: number;
  invalidTimingCount: number;
  longestDelayMs: number;
  entries: SlideAnimationTimelineEntry[];
  issues: SlideAnimationTimelineIssue[];
  readiness: 'empty' | 'ready' | 'review';
}

export interface AnimationChange {
  idx: number;
  key: AnimationChangeKey;
  value: number | string;
}

const LONG_TIMELINE_MS = 15000;
const LONG_DELAY_MS = 5000;

function finiteNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clampTiming(value: number, fallback: number, min: number): number {
  return Math.max(min, finiteNumber(value, fallback));
}

function isAnimated(item: SlideAnimationTimelineItem): boolean {
  return !!item.anim && item.anim !== 'none';
}

function animationDurationMs(item: SlideAnimationTimelineItem): number {
  return clampTiming(item.dur, 500, 100);
}

function animationDelayMs(item: SlideAnimationTimelineItem): number {
  return clampTiming(item.delay, 0, 0);
}

function animationRepeat(item: SlideAnimationTimelineItem): number {
  return item.repeat === 0 ? 0 : clampTiming(item.repeat, 1, 1);
}

export function formatAnimationTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0.0s';
  return `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)}s`;
}

export function buildSlideAnimationTimeline(items: readonly SlideAnimationTimelineItem[]): SlideAnimationTimelineReport {
  const animated = items
    .filter(isAnimated)
    .map((item, originalOrder) => ({ item, originalOrder }))
    .sort((a, b) => a.item.order - b.item.order || a.item.idx - b.item.idx);

  const orderCounts = new Map<number, number>();
  let invalidTimingCount = 0;
  let longestDelayMs = 0;
  let infiniteRepeatCount = 0;
  const entries: SlideAnimationTimelineEntry[] = [];

  for (const { item } of animated) {
    orderCounts.set(item.order, (orderCounts.get(item.order) ?? 0) + 1);
    if (
      !Number.isFinite(item.order) ||
      !Number.isFinite(item.dur) ||
      !Number.isFinite(item.delay) ||
      !Number.isFinite(item.repeat) ||
      item.dur <= 0 ||
      item.delay < 0 ||
      item.repeat < 0
    ) {
      invalidTimingCount += 1;
    }
  }

  let step = 0;
  let lastStartMs = 0;
  let lastDurationMs = 0;

  for (const { item } of animated) {
    const startMode = item.start || 'afterPrev';
    let startMs: number;
    if (startMode === 'onClick') {
      step += 1;
      startMs = 0;
      lastStartMs = 0;
      lastDurationMs = 0;
    } else if (startMode === 'withPrev') {
      startMs = lastStartMs;
    } else {
      startMs = lastStartMs + lastDurationMs;
    }

    const delayMs = animationDelayMs(item);
    const durationMs = animationDurationMs(item);
    const repeat = animationRepeat(item);
    const infinite = repeat === 0;
    const playbackDurationMs = durationMs * (infinite ? 1 : repeat);
    startMs += delayMs;

    longestDelayMs = Math.max(longestDelayMs, delayMs);
    if (infinite) infiniteRepeatCount += 1;

    entries.push({
      idx: item.idx,
      label: item.label,
      type: item.type,
      effect: item.anim,
      kind: item.kind,
      order: Number.isFinite(item.order) ? item.order : 0,
      step,
      startMode,
      startMs,
      delayMs,
      durationMs,
      repeat,
      endMs: startMs + playbackDurationMs,
      infinite,
    });

    lastStartMs = startMs;
    lastDurationMs = playbackDurationMs;
  }

  const duplicateOrderCount = [...orderCounts.values()].filter((count) => count > 1).length;
  const totalDurationMs = entries.reduce((max, entry) => Math.max(max, entry.endMs), 0);
  const clickStepCount = entries.reduce((max, entry) => Math.max(max, entry.step), 0);
  const autoEntryCount = entries.filter((entry) => entry.step === 0).length;
  const issues: SlideAnimationTimelineIssue[] = [];

  if (!entries.length) {
    issues.push({ code: 'no-animations', severity: 'info', message: 'No animated objects on this slide.' });
  }
  if (duplicateOrderCount) {
    issues.push({ code: 'duplicate-order', severity: 'warning', message: 'Multiple animations share the same order; playback may feel ambiguous.' });
  }
  if (invalidTimingCount) {
    issues.push({ code: 'invalid-timing', severity: 'warning', message: 'Some animations have invalid timing values and were normalized for preview.' });
  }
  if (infiniteRepeatCount) {
    issues.push({ code: 'infinite-repeat', severity: 'warning', message: 'Infinite repeat animations can distract in presenter mode and export poorly.' });
  }
  if (longestDelayMs > LONG_DELAY_MS) {
    issues.push({ code: 'long-delay', severity: 'warning', message: 'One or more animations wait more than 5 seconds before starting.' });
  }
  if (totalDurationMs > LONG_TIMELINE_MS) {
    issues.push({ code: 'long-timeline', severity: 'warning', message: 'This slide animation timeline runs longer than 15 seconds.' });
  }

  const hasWarning = issues.some((issue) => issue.severity === 'warning');
  return {
    objectCount: items.length,
    animatedCount: entries.length,
    autoEntryCount,
    clickStepCount,
    stepCount: entries.length ? clickStepCount + 1 : 0,
    totalDurationMs,
    duplicateOrderCount,
    infiniteRepeatCount,
    invalidTimingCount,
    longestDelayMs,
    entries,
    issues,
    readiness: entries.length ? (hasWarning ? 'review' : 'ready') : 'empty',
  };
}

export function buildAnimationPresetChanges(
  items: readonly SlideAnimationTimelineItem[],
  preset: AnimationPreset,
): AnimationChange[] {
  const ordered = [...items].sort((a, b) => a.idx - b.idx);
  return ordered.flatMap((item, position) => {
    const order = position + 1;
    const patch = preset === 'clickReveal'
      ? {
        anim: 'fade',
        animOrder: order,
        animDur: 500,
        animDelay: 0,
        animStart: 'onClick',
        animRepeat: 1,
      }
      : {
        anim: position === 0 ? 'fade' : 'fly',
        animOrder: order,
        animDur: 500,
        animDelay: position === 0 ? 0 : 100,
        animStart: 'afterPrev',
        animRepeat: 1,
      };

    return Object.entries(patch).map(([key, value]) => ({
      idx: item.idx,
      key: key as AnimationChangeKey,
      value,
    }));
  });
}

export function buildClearAnimationChanges(items: readonly SlideAnimationTimelineItem[]): AnimationChange[] {
  return items
    .filter(isAnimated)
    .flatMap((item) => [
      { idx: item.idx, key: 'anim' as const, value: 'none' },
      { idx: item.idx, key: 'animOrder' as const, value: 0 },
      { idx: item.idx, key: 'animDelay' as const, value: 0 },
      { idx: item.idx, key: 'animRepeat' as const, value: 1 },
    ]);
}
