import { buildPptxExportPreflight } from './pptxExportPreflight';

let passed = 0;
function ok(value: unknown, message: string) {
  if (!value) throw new Error(message);
  passed += 1;
}
function eq<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  passed += 1;
}

const report = buildPptxExportPreflight({
  slides: [
    { objects: [{ type: 'textbox', text: 'Title', anim: 'fade' }, { type: 'group', chartSpec: { type: 'bar' } }, { type: 'group', smartObject: { title: 'OEE' } }] },
    { hidden: true, objects: [{ type: 'textbox', text: 'Hidden' }] },
    { objects: [{ type: 'path' }, { type: 'image', src: 'clip.mp4' }, { type: 'group', tableSpec: { rows: 2 } }, { type: 'group', smart: { kind: 'process' } }] },
  ],
  notes: ['Talk track', 'Hidden note', ''],
  comments: [{ id: 'c1', text: 'Fix this', resolved: false }, { id: 'c2', text: 'Done', resolved: true }],
  transitions: ['fade', 'wipe', 'none'],
  pptxCompatibility: { issues: [{ code: 'macros', severity: 'danger', message: 'Macros blocked', count: 1 }] },
  options: { includeNotes: true, includeHiddenSlides: false },
});

eq(report.slides.length, 2, 'excludes hidden slides');
eq(report.notes.length, 2, 'notes stay aligned with exported slides');
eq(report.notes[0], 'Talk track', 'first exported note preserved');
eq(report.report.hiddenSlideCount, 1, 'counts hidden slides');
eq(report.report.animationCount, 1, 'counts object animations');
eq(report.report.transitionCount, 1, 'counts real exported transitions');
eq(report.report.nativeChartCount, 1, 'counts native chart exports');
eq(report.report.nativeTableCount, 1, 'counts native table exports');
eq(report.report.smartObjectCount, 1, 'counts smart objects');
eq(report.report.smartArtCount, 1, 'counts smartart');
eq(report.report.openCommentCount, 1, 'counts open comments');
eq(report.report.dangerCount, 2, 'counts media and imported danger issues');
ok(!report.report.exportReady, 'danger issues block export-ready status');
ok(report.report.issues.some((issue) => issue.code === 'hidden-slides-excluded'), 'warns about hidden slide exclusion');
ok(report.report.issues.some((issue) => issue.code === 'comments-not-exported'), 'warns about comments');
ok(report.report.issues.some((issue) => issue.code === 'animations-not-exported'), 'warns about animations');
ok(report.report.issues.some((issue) => issue.code === 'transitions-not-exported'), 'warns about transitions');
ok(report.report.issues.some((issue) => issue.code === 'speaker-notes-included'), 'reports notes inclusion');
ok(report.report.issues.some((issue) => issue.code === 'import-macros'), 'keeps imported PPTX warnings');

const clean = buildPptxExportPreflight({
  slides: [{ objects: [{ type: 'textbox', text: 'Ready' }] }],
  notes: ['Skip me'],
  comments: [],
  transitions: [],
  options: { includeNotes: false, includeHiddenSlides: true },
});

eq(clean.slides.length, 1, 'exports clean slide');
eq(clean.notes.length, 0, 'notes are empty when disabled');
eq(clean.report.warningCount, 1, 'skipped notes create one warning');
eq(clean.report.dangerCount, 0, 'clean deck has no danger issues');
ok(clean.report.exportReady, 'clean deck remains export ready');

console.log(`pptx export preflight: ${passed}/24 assertions passed.`);
