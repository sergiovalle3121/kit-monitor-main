import {
  ANIMATION_TIMELINE_PRESETS,
  buildAnimationClearChanges,
  buildAnimationPresetChanges,
  buildAnimationReindexChanges,
  buildAnimationTimelineSummary,
  formatAnimationRuntime,
  type AnimationTimelineItem,
} from './animationTimeline';

let passed = 0;
const fails: string[] = [];
const ok = (condition: boolean, message: string) => { if (condition) passed++; else fails.push(message); };
const eq = (actual: unknown, expected: unknown, message: string) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else fails.push(`${message} - expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

const items: AnimationTimelineItem[] = [
  { idx: 0, label: 'Title', type: 'textbox', anim: 'fade', order: 2, dur: 500, delay: 0, start: 'withPrev', repeat: 1, kind: 'entrance' },
  { idx: 1, label: 'OEE chart', type: 'group chart', anim: 'zoom', order: 2, dur: 1500, delay: 2400, start: 'afterPrev', repeat: 1, kind: 'entrance' },
  { idx: 2, label: 'Risk callout', type: 'rect', anim: 'pulse', order: 6, dur: 700, delay: 100, start: 'onClick', repeat: 0, kind: 'emphasis' },
  { idx: 3, label: 'Photo evidence', type: 'image', anim: 'none', order: 0, dur: 500, delay: 0, start: 'afterPrev', repeat: 1, kind: 'none' },
];

const summary = buildAnimationTimelineSummary(items);
eq(summary.objectCount, 4, 'counts all timeline objects');
eq(summary.animatedCount, 3, 'counts animated objects');
eq(summary.entranceCount, 2, 'counts entrance animations');
eq(summary.emphasisCount, 1, 'counts emphasis animations');
eq(summary.duplicateOrderCount, 1, 'detects duplicate play order');
eq(summary.longDelayCount, 1, 'detects long delays');
eq(summary.slowAnimationCount, 1, 'detects slow timeline items');
eq(summary.infiniteRepeatCount, 1, 'detects infinite repeat');
eq(summary.onClickCount, 1, 'counts manual click steps');
eq(summary.withPreviousCount, 1, 'counts with previous start mode');
eq(summary.afterPreviousCount, 1, 'counts after previous start mode');
ok(summary.needsReindex, 'flags non-contiguous animation order');
eq(summary.readiness, 'review', 'warnings move timeline to review');
ok(summary.totalRuntimeMs > 0, 'estimates runtime');
ok(summary.issues.some((issue) => issue.code === 'duplicate-orders'), 'surfaces duplicate order issue');
ok(summary.issues.some((issue) => issue.code === 'manual-clicks'), 'surfaces manual click issue');

const empty = buildAnimationTimelineSummary([{ idx: 0, label: 'Box', type: 'rect', anim: 'none' }]);
eq(empty.readiness, 'empty', 'empty timeline has empty readiness');
ok(empty.issues.some((issue) => issue.code === 'empty-timeline'), 'empty timeline gives setup guidance');

const reindex = buildAnimationReindexChanges(items);
eq(reindex.map((change) => `${change.idx}:${change.value}`), ['0:0', '1:1', '2:2'], 'reindex follows current sorted order');

const clear = buildAnimationClearChanges(items);
eq(clear.map((change) => change.idx), [0, 1, 2], 'clear only targets animated objects');
ok(clear.every((change) => change.key === 'anim' && change.value === 'none'), 'clear changes disable effects');

const presetItems: AnimationTimelineItem[] = [
  { idx: 0, label: 'Title', type: 'textbox', anim: 'none', order: 0, dur: 500, delay: 0, start: 'afterPrev', repeat: 1, kind: 'none' },
  { idx: 1, label: 'OEE chart', type: 'group chart', anim: 'none', order: 0, dur: 500, delay: 0, start: 'afterPrev', repeat: 1, kind: 'none' },
  { idx: 2, label: 'Risk callout', type: 'rect warning', anim: 'none', order: 0, dur: 500, delay: 0, start: 'afterPrev', repeat: 1, kind: 'none' },
  { idx: 3, label: 'Photo evidence', type: 'image', anim: 'none', order: 0, dur: 500, delay: 0, start: 'afterPrev', repeat: 1, kind: 'none' },
];

const preset = buildAnimationPresetChanges(presetItems, 'executive-review');
ok(preset.some((change) => change.idx === 0 && change.key === 'anim' && change.value === 'fade'), 'executive preset fades title');
ok(preset.some((change) => change.idx === 1 && change.key === 'anim' && change.value === 'zoom'), 'executive preset zooms charts');
ok(preset.some((change) => change.idx === 3 && change.key === 'anim' && change.value === 'fade'), 'preset animates previously static image');
ok(preset.some((change) => change.key === 'animOrder' && change.value === 3), 'preset assigns contiguous order');

const shopfloor = buildAnimationPresetChanges(presetItems, 'shopfloor-visual-aid');
ok(shopfloor.some((change) => change.idx === 2 && change.key === 'anim' && change.value === 'pulse'), 'shopfloor preset highlights callouts');
ok(shopfloor.some((change) => change.idx === 3 && change.key === 'anim' && change.value === 'zoom'), 'shopfloor preset brings visuals first');

ok(ANIMATION_TIMELINE_PRESETS.length >= 3, 'ships multiple industrial animation presets');
eq(formatAnimationRuntime(850), '850ms', 'formats sub-second runtime');
eq(formatAnimationRuntime(12500), '13s', 'formats long runtime');

if (fails.length) {
  console.error(`animation timeline: ${fails.length}/${passed + fails.length} failed`);
  for (const fail of fails) console.error(`  - ${fail}`);
  process.exit(1);
}

console.log(`animation timeline: ${passed}/${passed} assertions passed`);
