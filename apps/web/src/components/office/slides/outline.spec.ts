/* eslint-disable @typescript-eslint/no-explicit-any */
/** Slide outline analyzer. npx tsx src/components/office/slides/outline.spec.ts */
import { buildSlideOutlineEntries, filterSlideOutlineEntries, summarizeSlideOutline } from './outline';

let passed = 0;
const fails: string[] = [];
const eq = (actual: any, expected: any, message: string) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed += 1;
  else fails.push(`${message} - expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

const deck = [
  {
    objects: [
      { type: 'textbox', text: 'Daily Production Meeting' },
      { type: 'textbox', text: 'Line A\nOEE 86%' },
      { type: 'rect' },
    ],
  },
  { objects: [{ type: 'rect' }] },
  { objects: [] },
  {
    objects: [
      { type: 'i-text', text: 'Quality Review' },
      { type: 'text', text: 'A'.repeat(600) },
    ],
  },
];

const entries = buildSlideOutlineEntries(deck);

eq(entries.map((entry) => entry.title), ['Daily Production Meeting', '', '', 'Quality Review'], 'extracts first text object as title');
eq(entries[0].body, 'Line A OEE 86%', 'normalizes body text');
eq(entries[1].warnings, ['Sin titulo'], 'warns when a slide has objects but no title');
eq(entries[2].warnings, ['Sin titulo', 'Vacia'], 'warns on empty slides');
eq(entries[3].warnings, ['Texto denso'], 'warns on dense text slides');
eq(filterSlideOutlineEntries(entries, 'quality').map((entry) => entry.index), [3], 'filters by title/body');
eq(filterSlideOutlineEntries(entries, '2').map((entry) => entry.index), [1], 'filters by slide number');
eq(summarizeSlideOutline(entries), { totalSlides: 4, missingTitles: 2, emptySlides: 1, denseSlides: 1, totalObjects: 6 }, 'summarizes deck structure');

console.log(`\nSLIDE OUTLINE SPEC: ${passed} OK, ${fails.length} failures`);
if (fails.length) {
  for (const fail of fails) console.error(`  x ${fail}`);
  throw new Error(`${fails.length} failures`);
}
