import { animKind, type AnimKind } from '../slideAssets';

export type AnimationTimelineChangeKey = 'anim' | 'animOrder' | 'animDur' | 'animDelay' | 'animStart' | 'animRepeat';

export interface AnimationTimelineItem {
  idx: number;
  label: string;
  type: string;
  anim?: string;
  order?: number;
  dur?: number;
  delay?: number;
  start?: string;
  repeat?: number;
  kind?: AnimKind;
}

export interface AnimationTimelineChange {
  idx: number;
  key: AnimationTimelineChangeKey;
  value: number | string;
}

export interface AnimationTimelineIssue {
  code: string;
  severity: 'info' | 'warning';
  title: string;
  detail: string;
  count?: number;
}

export interface AnimationTimelineSummary {
  objectCount: number;
  animatedCount: number;
  entranceCount: number;
  emphasisCount: number;
  exitCount: number;
  motionCount: number;
  onClickCount: number;
  withPreviousCount: number;
  afterPreviousCount: number;
  duplicateOrderCount: number;
  infiniteRepeatCount: number;
  longDelayCount: number;
  slowAnimationCount: number;
  totalRuntimeMs: number;
  needsReindex: boolean;
  readiness: 'empty' | 'ready' | 'review';
  issues: AnimationTimelineIssue[];
}

export interface AnimationTimelinePreset {
  id: string;
  label: string;
  description: string;
}

type NormalizedAnimationItem = Required<Pick<AnimationTimelineItem, 'idx' | 'label' | 'type' | 'anim' | 'order' | 'dur' | 'delay' | 'start' | 'repeat'>> & { kind: AnimKind };

export const ANIMATION_TIMELINE_PRESETS: AnimationTimelinePreset[] = [
  {
    id: 'executive-review',
    label: 'Executive review',
    description: 'Clean title, metrics, charts, and takeaways in a controlled sequence.',
  },
  {
    id: 'shopfloor-visual-aid',
    label: 'Shopfloor visual aid',
    description: 'Large visuals first, then callouts and warnings for operator walkthroughs.',
  },
  {
    id: 'quality-walkthrough',
    label: 'Quality walkthrough',
    description: 'Issue, evidence, root-cause, containment, and action flow for reviews.',
  },
];

const START_AFTER_PREV = 'afterPrev';
const START_WITH_PREV = 'withPrev';
const START_ON_CLICK = 'onClick';

function isAnimatedEffect(effect?: string) {
  return !!effect && effect !== 'none';
}

function clampNonNegative(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function normalizeItem(item: AnimationTimelineItem): NormalizedAnimationItem {
  const anim = item.anim && item.anim !== 'none' ? item.anim : 'none';
  return {
    idx: item.idx,
    label: item.label || `Object ${item.idx + 1}`,
    type: item.type || 'object',
    anim,
    order: clampNonNegative(item.order, 0),
    dur: Math.max(100, clampNonNegative(item.dur, 500)),
    delay: clampNonNegative(item.delay, 0),
    start: item.start || START_AFTER_PREV,
    repeat: clampNonNegative(item.repeat, 1),
    kind: item.kind ?? animKind(anim),
  };
}

function animatedItems(items: AnimationTimelineItem[]) {
  return items.map(normalizeItem).filter((item) => isAnimatedEffect(item.anim));
}

function duplicateOrderCount(items: NormalizedAnimationItem[]) {
  const seen = new Set<number>();
  const dup = new Set<number>();
  for (const item of items) {
    if (seen.has(item.order)) dup.add(item.order);
    seen.add(item.order);
  }
  return dup.size;
}

function estimateRuntime(items: NormalizedAnimationItem[]) {
  const sorted = [...items].sort((a, b) => a.order - b.order || a.idx - b.idx);
  let cursor = 0;
  let groupStart = 0;
  let previousOrder: number | null = null;
  for (const item of sorted) {
    const repeated = item.repeat === 0 ? 3 : Math.max(1, item.repeat);
    const span = item.delay + item.dur * repeated;
    if (item.start === START_WITH_PREV && previousOrder !== null) {
      cursor = Math.max(cursor, groupStart + span);
    } else {
      groupStart = cursor;
      cursor += span;
    }
    previousOrder = item.order;
  }
  return cursor;
}

export function formatAnimationRuntime(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return '0s';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  return seconds >= 10 ? `${Math.round(seconds)}s` : `${Math.round(seconds * 10) / 10}s`;
}

export function buildAnimationTimelineSummary(items: AnimationTimelineItem[]): AnimationTimelineSummary {
  const animated = animatedItems(items);
  const counts = animated.reduce<Record<AnimKind, number>>((acc, item) => {
    acc[item.kind] += 1;
    return acc;
  }, { entrance: 0, emphasis: 0, exit: 0, motion: 0, none: 0 });
  const duplicateOrders = duplicateOrderCount(animated);
  const sorted = [...animated].sort((a, b) => a.order - b.order || a.idx - b.idx);
  const needsReindex = sorted.some((item, index) => item.order !== index);
  const infiniteRepeatCount = animated.filter((item) => item.repeat === 0).length;
  const longDelayCount = animated.filter((item) => item.delay >= 2000).length;
  const slowAnimationCount = animated.filter((item) => item.dur >= 1200 || item.delay + item.dur * Math.max(1, item.repeat || 1) >= 4000).length;
  const onClickCount = animated.filter((item) => item.start === START_ON_CLICK).length;
  const withPreviousCount = animated.filter((item) => item.start === START_WITH_PREV).length;
  const afterPreviousCount = animated.filter((item) => item.start !== START_ON_CLICK && item.start !== START_WITH_PREV).length;
  const totalRuntimeMs = estimateRuntime(animated);
  const issues: AnimationTimelineIssue[] = [];

  if (!animated.length) {
    issues.push({
      code: 'empty-timeline',
      severity: 'info',
      title: 'No object animations',
      detail: 'Apply a preset or animate selected objects before using presenter preview.',
    });
  }
  if (duplicateOrders) {
    issues.push({
      code: 'duplicate-orders',
      severity: 'warning',
      title: 'Duplicate animation order',
      detail: 'Several objects share the same play order. Reindex for a predictable presenter sequence.',
      count: duplicateOrders,
    });
  }
  if (longDelayCount) {
    issues.push({
      code: 'long-delays',
      severity: 'warning',
      title: 'Long delays',
      detail: 'Delays over 2s can make shopfloor and executive decks feel unresponsive.',
      count: longDelayCount,
    });
  }
  if (slowAnimationCount) {
    issues.push({
      code: 'slow-animations',
      severity: 'warning',
      title: 'Slow timeline items',
      detail: 'Long durations or repeated effects should be reviewed before presenting.',
      count: slowAnimationCount,
    });
  }
  if (infiniteRepeatCount) {
    issues.push({
      code: 'infinite-repeat',
      severity: 'warning',
      title: 'Infinite repeat',
      detail: 'Looping object animations are useful for visual aids but can distract in review decks.',
      count: infiniteRepeatCount,
    });
  }
  if (onClickCount) {
    issues.push({
      code: 'manual-clicks',
      severity: 'info',
      title: 'Manual click steps',
      detail: 'Presenter mode will pause for these click-triggered beats.',
      count: onClickCount,
    });
  }

  return {
    objectCount: items.length,
    animatedCount: animated.length,
    entranceCount: counts.entrance,
    emphasisCount: counts.emphasis,
    exitCount: counts.exit,
    motionCount: counts.motion,
    onClickCount,
    withPreviousCount,
    afterPreviousCount,
    duplicateOrderCount: duplicateOrders,
    infiniteRepeatCount,
    longDelayCount,
    slowAnimationCount,
    totalRuntimeMs,
    needsReindex,
    readiness: animated.length === 0 ? 'empty' : issues.some((issue) => issue.severity === 'warning') ? 'review' : 'ready',
    issues,
  };
}

function roleFor(item: NormalizedAnimationItem, position: number) {
  const value = `${item.label} ${item.type}`.toLowerCase();
  if (value.includes('chart') || value.includes('graf')) return 'chart';
  if (value.includes('table') || value.includes('tabla') || value.includes('matrix') || value.includes('register')) return 'table';
  if (value.includes('image') || value.includes('imagen') || value.includes('photo') || value.includes('foto')) return 'image';
  if (value.includes('kpi') || value.includes('metric') || value.includes('smart')) return 'metric';
  if (value.includes('callout') || value.includes('warning') || value.includes('alert') || value.includes('defect')) return 'callout';
  if (value.includes('text') || value.includes('textbox') || value.includes('titulo') || value.includes('title')) return position === 0 ? 'title' : 'text';
  if (position === 0) return 'title';
  return 'shape';
}

function presetValues(presetId: string, item: NormalizedAnimationItem, position: number) {
  const role = roleFor(item, position);
  if (presetId === 'shopfloor-visual-aid') {
    if (role === 'image') return { anim: 'zoom', start: START_WITH_PREV, dur: 700, delay: 0, repeat: 1 };
    if (role === 'callout') return { anim: 'pulse', start: START_AFTER_PREV, dur: 900, delay: position * 140, repeat: 2 };
    if (role === 'title') return { anim: 'fade', start: START_WITH_PREV, dur: 400, delay: 0, repeat: 1 };
    return { anim: 'flyRight', start: START_AFTER_PREV, dur: 500, delay: position * 120, repeat: 1 };
  }

  if (presetId === 'quality-walkthrough') {
    if (role === 'title') return { anim: 'fade', start: START_WITH_PREV, dur: 400, delay: 0, repeat: 1 };
    if (role === 'chart' || role === 'table') return { anim: 'wipe', start: START_AFTER_PREV, dur: 650, delay: position * 100, repeat: 1 };
    if (role === 'callout') return { anim: 'flash', start: START_AFTER_PREV, dur: 700, delay: position * 120, repeat: 1 };
    return { anim: 'flyLeft', start: START_AFTER_PREV, dur: 500, delay: position * 110, repeat: 1 };
  }

  if (role === 'title') return { anim: 'fade', start: START_WITH_PREV, dur: 450, delay: 0, repeat: 1 };
  if (role === 'chart' || role === 'metric') return { anim: 'zoom', start: START_AFTER_PREV, dur: 550, delay: position * 90, repeat: 1 };
  if (role === 'table') return { anim: 'wipe', start: START_AFTER_PREV, dur: 600, delay: position * 90, repeat: 1 };
  if (role === 'image') return { anim: 'fade', start: START_AFTER_PREV, dur: 500, delay: position * 90, repeat: 1 };
  return { anim: 'fly', start: START_AFTER_PREV, dur: 500, delay: position * 90, repeat: 1 };
}

function pushChange(changes: AnimationTimelineChange[], item: NormalizedAnimationItem, key: AnimationTimelineChangeKey, value: number | string) {
  const current = key === 'anim' ? item.anim
    : key === 'animOrder' ? item.order
      : key === 'animDur' ? item.dur
        : key === 'animDelay' ? item.delay
          : key === 'animStart' ? item.start
            : item.repeat;
  if (current !== value) changes.push({ idx: item.idx, key, value });
}

export function buildAnimationPresetChanges(items: AnimationTimelineItem[], presetId: string): AnimationTimelineChange[] {
  const normalized = items.map(normalizeItem);
  const changes: AnimationTimelineChange[] = [];
  normalized.forEach((item, position) => {
    const next = presetValues(presetId, item, position);
    pushChange(changes, item, 'anim', next.anim);
    pushChange(changes, item, 'animOrder', position);
    pushChange(changes, item, 'animStart', next.start);
    pushChange(changes, item, 'animDur', next.dur);
    pushChange(changes, item, 'animDelay', next.delay);
    pushChange(changes, item, 'animRepeat', next.repeat);
  });
  return changes;
}

export function buildAnimationReindexChanges(items: AnimationTimelineItem[]): AnimationTimelineChange[] {
  return animatedItems(items)
    .sort((a, b) => a.order - b.order || a.idx - b.idx)
    .flatMap((item, index) => (item.order === index ? [] : [{ idx: item.idx, key: 'animOrder' as const, value: index }]));
}

export function buildAnimationClearChanges(items: AnimationTimelineItem[]): AnimationTimelineChange[] {
  return animatedItems(items).map((item) => ({ idx: item.idx, key: 'anim', value: 'none' }));
}
