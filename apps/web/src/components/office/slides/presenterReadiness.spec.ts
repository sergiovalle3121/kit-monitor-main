/* eslint-disable @typescript-eslint/no-explicit-any */
import { analyzeSlideDeckHealth } from './deckHealth';
import { buildPresenterReadiness } from './presenterReadiness';

let passed = 0;
const fails: string[] = [];
const ok = (cond: boolean, msg: string) => { if (cond) passed++; else fails.push(msg); };
const eq = (actual: any, expected: any, msg: string) => ok(JSON.stringify(actual) === JSON.stringify(expected), `${msg} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

const health = analyzeSlideDeckHealth({
  slides: [
    {
      objects: [
        { type: 'textbox', ph: 'title', text: 'Executive review', left: 56, top: 40, width: 600, height: 50 },
        { type: 'image', left: 1000, top: 30, width: 120, height: 80 },
        { type: 'group', smartObject: { title: 'OEE', source: 'AXOS.production.oee' }, left: 80, top: 140, width: 250, height: 120 },
      ],
      transition: 'fade',
      advanceAfter: 10,
    },
    { objects: [] },
    {
      objects: [
        { type: 'textbox', text: 'Quality actions', left: 56, top: 56, width: 500, height: 48, anim: 'fade' },
        { type: 'rect', left: 100, top: 160, width: 260, height: 120, visible: false, locked: true },
      ],
      transition: 'cube',
    },
  ],
  notes: ['Opening remarks', '', ''],
  comments: [{ resolved: false }, { resolved: true }],
  pptxIssues: [{ code: 'comments', message: 'Imported comments need review.' }],
  sections: ['Executive', null, 'Quality'],
  transitions: ['fade', 'push', 'cube'],
  advanceAfters: [10, 0, 0],
});

const readiness = buildPresenterReadiness({
  health,
  advanceAfters: [10, 0, 0],
  transitionDurationMs: [500, 500, 500],
  rehearsalSecondsPerSlide: 60,
});

eq(readiness.level, 'blocked', 'empty and off-canvas issues block presenter readiness');
eq(readiness.blockers, 2, 'counts presenter blockers');
ok(readiness.warnings >= 6, 'counts presenter warnings');
ok(readiness.issues[0].severity === 'blocker', 'orders blockers first');
ok(readiness.issues.some((issue) => issue.id === 'missing-notes'), 'surfaces missing notes');
ok(readiness.issues.some((issue) => issue.id === 'auto-advance'), 'surfaces auto-advance timing');
ok(readiness.issues.some((issue) => issue.id === 'animations'), 'surfaces animations');
eq(readiness.notesCoverage, 33, 'computes notes coverage');
eq(readiness.estimatedDurationSec, 132, 'estimates rehearsal duration from timed/manual slides plus transitions');
eq(readiness.estimatedDurationLabel, '2m 12s', 'formats rehearsal duration');
eq(readiness.checklist.length, 5, 'returns presenter checklist');
ok(readiness.checklist.some((item) => item.label === 'Speaker notes' && !item.ok), 'checklist marks notes gap');

const cleanHealth = analyzeSlideDeckHealth({
  slides: [
    { objects: [{ type: 'textbox', ph: 'title', text: 'Daily meeting', left: 40, top: 40, width: 500, height: 48 }] },
    { objects: [{ type: 'textbox', ph: 'title', text: 'Actions', left: 40, top: 40, width: 500, height: 48 }] },
  ],
  notes: ['Run agenda', 'Close actions'],
  comments: [],
  pptxIssues: [],
  sections: ['Daily', null],
});

const clean = buildPresenterReadiness({ health: cleanHealth, transitionDurationMs: [500, 500] });
eq(clean.level, 'ready', 'clean deck is presenter ready');
eq(clean.blockers, 0, 'clean deck has no blockers');
eq(clean.warnings, 0, 'clean deck has no warnings');
eq(clean.score, 100, 'clean deck keeps full score');
eq(clean.notesCoverage, 100, 'clean deck has full notes coverage');
ok(clean.estimatedDurationSec > 0, 'clean deck still gets rehearsal estimate');

if (fails.length) {
  console.error(`presenter readiness spec failed: ${fails.length}/${passed + fails.length}`);
  for (const fail of fails) console.error(` - ${fail}`);
  process.exit(1);
}

console.log(`presenter readiness spec passed: ${passed}/${passed}`);
