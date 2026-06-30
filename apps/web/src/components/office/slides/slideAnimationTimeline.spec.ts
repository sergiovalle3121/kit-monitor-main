import {
  buildAnimationPresetChanges,
  buildClearAnimationChanges,
  buildSlideAnimationTimeline,
  formatAnimationTime,
  type SlideAnimationTimelineItem,
} from './slideAnimationTimeline';

let passed = 0;
const failures: string[] = [];
const ok = (condition: boolean, message: string) => { if (condition) passed += 1; else failures.push(message); };
const eq = (actual: unknown, expected: unknown, message: string) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed += 1;
  else failures.push(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

const items: SlideAnimationTimelineItem[] = [
  { idx: 2, label: 'KPI card', type: 'Grupo', anim: 'pulse', order: 3, dur: 600, delay: 100, start: 'onClick', repeat: 2, kind: 'emphasis' },
  { idx: 0, label: 'Title', type: 'Texto', anim: 'fade', order: 1, dur: 500, delay: 0, start: 'afterPrev', repeat: 1, kind: 'entrance' },
  { idx: 1, label: 'Chart', type: 'Grafico', anim: 'fly', order: 2, dur: 700, delay: 200, start: 'afterPrev', repeat: 1, kind: 'entrance' },
  { idx: 3, label: 'Logo', type: 'Imagen', anim: 'none', order: 0, dur: 500, delay: 0, start: 'afterPrev', repeat: 1, kind: 'none' },
];

const report = buildSlideAnimationTimeline(items);
eq(report.objectCount, 4, 'counts all objects');
eq(report.animatedCount, 3, 'counts animated objects');
eq(report.autoEntryCount, 2, 'counts automatic build entries');
eq(report.clickStepCount, 1, 'counts click reveal steps');
eq(report.stepCount, 2, 'counts automatic plus click steps');
eq(report.readiness, 'ready', 'clean timing is ready');
eq(report.entries.map((entry) => entry.idx), [0, 1, 2], 'sorts by animation order');
eq(report.entries.map((entry) => entry.startMs), [0, 700, 100], 'plans after-previous and click starts');
eq(report.totalDurationMs, 1400, 'uses longest finite step duration');
eq(formatAnimationTime(1400), '1.4s', 'formats seconds');

const review = buildSlideAnimationTimeline([
  { idx: 0, label: 'A', type: 'Text', anim: 'fade', order: 1, dur: -10, delay: 0, start: 'afterPrev', repeat: 1, kind: 'entrance' },
  { idx: 1, label: 'B', type: 'Text', anim: 'pulse', order: 1, dur: 500, delay: 6000, start: 'withPrev', repeat: 0, kind: 'emphasis' },
]);
eq(review.readiness, 'review', 'timing warnings require review');
ok(review.issues.some((issue) => issue.code === 'duplicate-order'), 'flags duplicate order');
ok(review.issues.some((issue) => issue.code === 'invalid-timing'), 'flags invalid timing');
ok(review.issues.some((issue) => issue.code === 'infinite-repeat'), 'flags infinite repeat');
ok(review.issues.some((issue) => issue.code === 'long-delay'), 'flags long delay');

const empty = buildSlideAnimationTimeline([{ idx: 0, label: 'Only', type: 'Rect', anim: 'none', order: 0, dur: 500, delay: 0, start: 'afterPrev', repeat: 1, kind: 'none' }]);
eq(empty.readiness, 'empty', 'empty animation timeline reports empty');
ok(empty.issues.some((issue) => issue.code === 'no-animations'), 'empty timeline has info issue');

const sequence = buildAnimationPresetChanges(items, 'sequence');
eq(sequence.filter((change) => change.key === 'anim').map((change) => change.value), ['fade', 'fly', 'fly', 'fly'], 'sequence animates every object');
eq(sequence.filter((change) => change.key === 'animStart').map((change) => change.value), ['afterPrev', 'afterPrev', 'afterPrev', 'afterPrev'], 'sequence uses automatic starts');

const clickReveal = buildAnimationPresetChanges(items, 'clickReveal');
eq(clickReveal.filter((change) => change.key === 'animStart').map((change) => change.value), ['onClick', 'onClick', 'onClick', 'onClick'], 'click preset uses click starts');
eq(clickReveal.filter((change) => change.key === 'animOrder').map((change) => change.value), [1, 2, 3, 4], 'presets assign stable order');

const clear = buildClearAnimationChanges(items);
eq(clear.filter((change) => change.key === 'anim').map((change) => change.idx), [2, 0, 1], 'clear only targets animated objects');
ok(clear.every((change) => change.key !== 'anim' || change.value === 'none'), 'clear removes animation effects');

if (failures.length) {
  console.error(`slide animation timeline: ${failures.length}/${passed + failures.length} failed`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(`slide animation timeline: ${passed}/${passed} assertions passed`);
