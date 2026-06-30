import {
  buildSlideReuseItems,
  filterSlideReuseItems,
  getReuseSlideText,
  summarizeSlideReuseItems,
  type SlideReuseSource,
} from './slideReuse';

let passed = 0; const fails: string[] = [];
const ok = (condition: boolean, message: string) => { if (condition) passed++; else fails.push(message); };

const sources: SlideReuseSource[] = [
  {
    slide: {
      objects: [
        { type: 'textbox', text: 'Supplier review' },
        { type: 'textbox', text: 'OTD trend\nQuality score' },
      ],
    },
    note: 'Ask purchasing to confirm recovery plan',
    transition: 'fade',
    transDur: 500,
  },
  {
    slide: {
      objects: [
        {
          type: 'group',
          objects: [
            { type: 'fabrictext', text: 'Launch gate' },
            { type: 'text', text: 'PPAP open items' },
          ],
        },
      ],
    },
    note: '',
    transition: 'none',
  },
  { slide: { objects: [{ type: 'rect' }, { type: 'textbox', text: '  ' }] }, note: '', transition: 'push' },
];

const items = buildSlideReuseItems(sources);
const summary = summarizeSlideReuseItems(items);

ok(getReuseSlideText(sources[0].slide).length === 2, 'extracts top-level text runs');
ok(items[1].title === 'Launch gate', 'extracts nested group title');
ok(items[0].body.includes('Quality score'), 'extracts body text');
ok(items[0].hasNotes, 'detects speaker notes');
ok(!items[2].hasTitle, 'detects missing title');
ok(items[2].hasTransition, 'detects non-none transition');
ok(filterSlideReuseItems(items, 'purchasing', 'all')[0]?.index === 0, 'searches notes');
ok(filterSlideReuseItems(items, 'ppap', 'all')[0]?.index === 1, 'searches nested body text');
ok(filterSlideReuseItems(items, '', 'withNotes').length === 1, 'filters slides with notes');
ok(filterSlideReuseItems(items, '', 'missingTitle')[0]?.index === 2, 'filters missing titles');
ok(filterSlideReuseItems(items, '', 'withTransition').length === 2, 'filters slides with transitions');
ok(summary.slideCount === 3, 'summarizes slide count');
ok(summary.withNotes === 1, 'summarizes notes');
ok(summary.missingTitles === 1, 'summarizes missing titles');
ok(summary.withTransitions === 2, 'summarizes transitions');

const total = passed + fails.length;
if (fails.length) {
  console.error(`slide reuse: ${fails.length}/${total} failed`);
  for (const fail of fails) console.error(`  - ${fail}`);
  process.exit(1);
}
console.log(`slide reuse: ${passed}/${total} assertions passed`);
