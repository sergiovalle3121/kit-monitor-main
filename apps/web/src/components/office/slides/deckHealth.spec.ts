/** Deck health smoke spec. Run with:
 * npx tsx apps/web/src/components/office/slides/deckHealth.spec.ts
 */
import { buildSlideDeckHealth, describeDeckHealthIssue } from './deckHealth';

let passed = 0;
const fails: string[] = [];
const ok = (condition: boolean, message: string) => { if (condition) passed += 1; else fails.push(message); };
const eq = <T>(actual: T, expected: T, message: string) => ok(Object.is(actual, expected), `${message}: expected ${String(expected)}, got ${String(actual)}`);

const deck = {
  slides: [
    {
      objects: [
        { type: 'textbox', text: 'Daily production review', left: 48, top: 48, width: 400, height: 60 },
        { type: 'image', src: 'data:image/png;base64,abc', left: 80, top: 140, width: 220, height: 120 },
        { type: 'rect', left: 980, top: 40, width: 80, height: 40 },
        { type: 'group', smartObject: { title: 'OEE', source: 'AXOS.production.oee' }, left: 100, top: 300, width: 200, height: 120 },
      ],
    },
    {
      objects: [
        { type: 'rect', left: 20, top: 20, width: 50, height: 50, locked: true },
        { type: 'textbox', text: '', left: 40, top: 90, width: 200, height: 40 },
      ],
    },
    { objects: [] },
  ],
  notes: ['Talk track', '', ''],
  sections: ['Daily standup', null, 'Risks'],
  transitions: ['fade', 'none', 'wipe'],
  comments: [
    { id: 'c1', slide: 1, text: 'Resolve before launch', resolved: false },
    { id: 'c2', slide: 0, text: 'Closed', resolved: true },
  ],
  pptxCompatibility: {
    issues: [
      { code: 'macros', severity: 'danger', message: 'Macro risk' },
      { code: 'embedded-fonts', severity: 'warning', message: 'Font substitution' },
    ],
  },
};

const report = buildSlideDeckHealth({ ...deck, currentIndex: 1, slideWidth: 960, slideHeight: 540 });
const issueIds = new Set(report.issues.map((issue) => issue.id));

eq(report.slideCount, 3, 'counts slides');
eq(report.sectionCount, 2, 'counts sections');
eq(report.commentsOpen, 1, 'counts open root comments');
eq(report.commentsResolved, 1, 'counts resolved root comments');
eq(report.pptxIssues, 2, 'counts pptx compatibility issues');
eq(report.pptxDangerIssues, 1, 'counts dangerous pptx issues');
eq(report.emptySlides, 1, 'counts empty slides');
eq(report.missingTitles, 2, 'counts missing titles');
eq(report.missingNotes, 2, 'counts missing notes');
eq(report.currentMissingNotes, true, 'detects missing note on current slide');
eq(report.currentHasTitle, false, 'detects missing title on current slide');
eq(report.smartObjects, 1, 'counts smart objects');
eq(report.contractPendingSmartObjects, 1, 'counts pending AXOS smart object contracts');
eq(report.transitions, 2, 'counts non-none transitions');
eq(report.offCanvasObjects, 1, 'detects off-canvas objects');
eq(report.missingAltText, 1, 'detects image alt text gaps');
eq(report.lockedObjects, 1, 'detects locked objects');
ok(report.exportWarnings >= 5, 'aggregates export warnings');
ok(report.readinessScore < 80, 'penalizes release readiness score');
eq(report.exportReady, false, 'blocks export ready state when blockers exist');
ok(issueIds.has('open-comments'), 'adds open comment issue');
ok(issueIds.has('pptx-danger'), 'adds pptx danger issue');
ok(issueIds.has('off-canvas-objects'), 'adds off-canvas issue');
ok(describeDeckHealthIssue(report.issues[0]).includes('Slide'), 'describes issue targets');

const clean = buildSlideDeckHealth({
  slides: [{ objects: [{ type: 'textbox', text: 'Ready', left: 20, top: 20, width: 200, height: 40, label: 'Title' }] }],
  notes: ['Presenter notes'],
  comments: [],
  transitions: ['none'],
});
eq(clean.issueCount, 0, 'clean deck has no issues');
eq(clean.exportReady, true, 'clean deck is export ready');
eq(clean.readinessScore, 100, 'clean deck score is perfect');

const total = passed + fails.length;
if (fails.length) {
  console.error(`\n${fails.length}/${total} failures:\n${fails.map((f) => ` - ${f}`).join('\n')}`);
  process.exit(1);
}
console.log(`\ndeck health: ${passed}/${total} assertions passed.`);
