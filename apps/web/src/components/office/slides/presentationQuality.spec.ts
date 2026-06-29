/* eslint-disable @typescript-eslint/no-explicit-any */
import { analyzeSlidePresentationQuality, contrastRatio } from './presentationQuality';

let passed = 0;
const fails: string[] = [];
const ok = (cond: boolean, msg: string) => { if (cond) passed++; else fails.push(msg); };
const eq = (actual: any, expected: any, msg: string) => ok(JSON.stringify(actual) === JSON.stringify(expected), `${msg} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

ok(contrastRatio('#000000', '#ffffff') > 20, 'black on white has maximum contrast');
ok(contrastRatio('#777777', '#ffffff') < 4.5, 'mid gray on white is below body-text threshold');

const denseText = Array.from({ length: 92 }, (_, i) => `word${i + 1}`).join(' ');
const deck = [
  {
    background: '#ffffff',
    objects: [
      { type: 'textbox', ph: 'title', text: 'Launch readiness', left: 40, top: 40, width: 600, height: 42, fontSize: 34, fill: '#111827' },
      { type: 'textbox', text: 'Small caption', left: 64, top: 450, width: 200, height: 16, fontSize: 10, fill: '#111827' },
      { type: 'image', left: 720, top: 100, width: 160, height: 120 },
    ],
  },
  {
    background: '#ffffff',
    objects: [
      { type: 'textbox', text: 'Missing title body', left: 40, top: 50, width: 400, height: 40, fontSize: 18, fill: '#777777' },
      { type: 'rect', left: 970, top: 30, width: 100, height: 100, fill: '#2563eb' },
    ],
  },
  {
    background: '#0f172a',
    objects: [
      { type: 'textbox', ph: 'title', text: 'Dense review slide', left: 40, top: 40, width: 700, height: 42, fontSize: 34, fill: '#ffffff' },
      { type: 'textbox', text: denseText, left: 60, top: 120, width: 820, height: 320, fontSize: 18, fill: '#e5e7eb' },
    ],
  },
];

const report = analyzeSlidePresentationQuality({
  slides: deck,
  notes: ['Presenter notes', '', 'Dense slide notes'],
  current: 1,
  width: 960,
  height: 540,
});

eq(report.slidesWithoutTitle, 1, 'counts slides without titles');
eq(report.slidesWithoutNotes, 1, 'counts slides without notes');
eq(report.smallTextObjects, 1, 'counts too-small text');
eq(report.lowContrastTextObjects, 1, 'counts low contrast text');
eq(report.imagesMissingAltText, 1, 'counts images without alt text');
eq(report.offCanvasObjects, 1, 'counts off-canvas objects');
eq(report.denseTextSlides, 1, 'counts dense slides');
ok(report.score < 75, 'score penalizes presentation quality issues');
ok(report.currentSlideIssues.some((issue) => issue.code === 'missing-title'), 'current slide issues include selected slide warnings');
ok(report.currentSlideIssues.some((issue) => issue.code === 'low-contrast'), 'current slide issues include selected slide contrast issue');

const clean = analyzeSlidePresentationQuality({
  slides: [{
    background: '#ffffff',
    objects: [
      { type: 'textbox', ph: 'title', text: 'Daily production meeting', left: 40, top: 40, width: 700, height: 42, fontSize: 34, fill: '#111827' },
      { type: 'textbox', text: 'One clear decision per slide.', left: 64, top: 150, width: 700, height: 36, fontSize: 24, fill: '#111827' },
      { type: 'image', left: 640, top: 220, width: 180, height: 120, altText: 'Line A output chart' },
    ],
  }],
  notes: ['Run the standup from this slide.'],
});

eq(clean.score, 100, 'clean deck scores 100');
eq(clean.issueCount, 0, 'clean deck has no issues');

if (fails.length) {
  console.error(`presentation quality spec failed: ${fails.length}/${passed + fails.length}`);
  for (const fail of fails) console.error(` - ${fail}`);
  process.exit(1);
}

console.log(`presentation quality spec passed: ${passed}/${passed}`);
