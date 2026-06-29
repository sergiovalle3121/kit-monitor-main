/* eslint-disable @typescript-eslint/no-explicit-any */
import { analyzeSlideDeckHealth, getSlideTitle } from './deckHealth';

let passed = 0;
const fails: string[] = [];
const ok = (cond: boolean, msg: string) => { if (cond) passed++; else fails.push(msg); };
const eq = (actual: any, expected: any, msg: string) => ok(JSON.stringify(actual) === JSON.stringify(expected), `${msg} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

const deck = [
  {
    objects: [
      { type: 'rect', bgFill: true, left: 0, top: 0, width: 960, height: 540 },
      { type: 'textbox', ph: 'title', text: 'Launch review', left: 56, top: 60, width: 500, height: 40 },
      { type: 'group', smartObject: { title: 'OEE', source: 'AXOS.production.oee' }, left: 120, top: 140, width: 260, height: 150 },
      { type: 'image', left: 990, top: 20, width: 160, height: 120 },
    ],
    transition: 'fade',
    advanceAfter: 5,
  },
  {
    objects: [
      { type: 'rect', bgFill: true, left: 0, top: 0, width: 960, height: 540 },
    ],
    transition: 'push',
  },
  {
    objects: [
      { type: 'textbox', text: 'Risk matrix', left: 60, top: 40, width: 420, height: 48, anim: 'fade' },
      { type: 'rect', left: 40, top: 120, width: 200, height: 140, visible: false, locked: true },
      { type: 'group', smartObject: { title: 'Supplier risk', source: 'AXOS.suppliers.scorecard', binding: { lastUpdatedAt: '2026-06-29T18:00:00.000Z' } }, left: 300, top: 120, width: 260, height: 150 },
    ],
    transition: 'cube',
  },
];

eq(getSlideTitle(deck[0]), 'Launch review', 'prefers title placeholder text');
eq(getSlideTitle(deck[2]), 'Risk matrix', 'falls back to first text object');

const health = analyzeSlideDeckHealth({
  slides: deck,
  notes: ['Discuss OEE gap', '', ''],
  sections: ['Executive', null, 'Risks'],
  comments: [{ resolved: false }, { resolved: true }, { resolved: false, parentId: 'reply' }],
  pptxIssues: [{ code: 'animations', message: 'PowerPoint animations will be approximated.' }],
  current: 1,
  theme: 'AXOS Executive',
  ratio: '16:9',
  layout: 'kpiDashboard',
  masterObjects: [{ type: 'textbox', text: 'AXOS' }],
});

eq(health.slideCount, 3, 'counts slides');
eq(health.objectCount, 6, 'ignores background fill objects');
eq(health.emptySlides, 1, 'counts background-only slide as empty');
eq(health.missingTitles, 1, 'counts missing titles');
eq(health.missingNotes, 2, 'counts missing notes');
eq(health.sections, 2, 'counts sections');
eq(health.commentsOpen, 1, 'counts unresolved root comments');
eq(health.commentsResolved, 1, 'counts resolved root comments');
eq(health.pptxIssues, 1, 'counts PPTX issues');
eq(health.smartObjects, 2, 'counts smart objects');
eq(health.smartObjectsContractPending, 1, 'flags live smart objects without refresh timestamp');
eq(health.animatedObjects, 1, 'counts animated objects');
eq(health.slidesWithAnimations, 1, 'counts slides with animations');
eq(health.autoAdvanceSlides, 1, 'counts auto-advance slides');
eq(health.transitionVariants, 3, 'counts transition variety');
eq(health.hiddenObjects, 1, 'counts hidden objects');
eq(health.lockedObjects, 1, 'counts locked objects');
eq(health.offCanvasObjects, 1, 'counts off-canvas objects');
eq(health.imagesMissingAltText, 1, 'counts image alt text gaps');
eq(health.currentEmpty, true, 'current slide empty state uses selected slide');
eq(health.currentHasTitle, false, 'current title state uses selected slide');
eq(health.currentHasNotes, false, 'current notes state uses selected slide');
ok(health.master, 'detects master objects');
ok(health.readinessScore < 75, 'penalizes release readiness issues');
ok(health.readinessIssues.some((issue) => issue.includes('speaker notes')), 'surfaces missing notes issue');
ok(health.readinessIssues.some((issue) => issue.includes('outside the slide bounds')), 'surfaces off-canvas issue');
ok(health.readinessIssues.some((issue) => issue.includes('Smart Object')), 'surfaces smart object contract issue');

const blockedByPptx = analyzeSlideDeckHealth({
  slides: [{ objects: [{ type: 'textbox', ph: 'title', text: 'Imported deck', left: 40, top: 40, width: 500, height: 48 }] }],
  notes: ['Imported from PowerPoint.'],
  pptxIssues: [{ code: 'macros', severity: 'danger', message: 'Macros are blocked.' }],
});
eq(blockedByPptx.exportReadiness, 'blocked', 'dangerous PPTX content blocks export readiness');
ok(blockedByPptx.readinessIssues.some((issue) => issue.includes('blocked content')), 'surfaces dangerous PPTX issue');

const clean = analyzeSlideDeckHealth({
  slides: [{ objects: [{ type: 'textbox', ph: 'title', text: 'Daily production meeting', left: 40, top: 40, width: 600, height: 48 }] }],
  notes: ['Run the daily production meeting.'],
  sections: ['Daily'],
  comments: [],
  pptxIssues: [],
});
eq(clean.readinessScore, 100, 'clean deck scores 100');
eq(clean.readinessIssues, [], 'clean deck has no readiness issues');

if (fails.length) {
  console.error(`deck health spec failed: ${fails.length}/${passed + fails.length}`);
  for (const fail of fails) console.error(` - ${fail}`);
  process.exit(1);
}

console.log(`deck health spec passed: ${passed}/${passed}`);
