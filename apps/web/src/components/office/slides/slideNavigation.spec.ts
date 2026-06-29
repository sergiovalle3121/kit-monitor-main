import {
  buildSlideNavigationItems,
  filterSlideNavigationItems,
  getSlideBody,
  getSlideSectionOptions,
  getSlideTitle,
  summarizeSlideNavigation,
} from './slideNavigation';

let passed = 0; const fails: string[] = [];
const ok = (condition: boolean, message: string) => { if (condition) passed++; else fails.push(message); };

const slides = [
  {
    objects: [
      { type: 'textbox', text: 'Launch readiness' },
      { type: 'textbox', text: 'PPAP open items\nCapacity risk' },
    ],
  },
  {
    objects: [
      {
        type: 'group',
        objects: [
          { type: 'fabrictext', text: 'Supplier scorecard' },
          { type: 'text', text: 'OTD and quality trend' },
        ],
      },
    ],
  },
  { objects: [{ type: 'rect' }, { type: 'textbox', text: '   ' }] },
];

const items = buildSlideNavigationItems(slides, ['Executive', null, 'Quality']);
const summary = summarizeSlideNavigation(items);

ok(getSlideTitle(slides[0]) === 'Launch readiness', 'extracts the first text object as title');
ok(getSlideBody(slides[0]).includes('Capacity risk'), 'extracts body text after the title');
ok(items[1].section === 'Executive', 'carries the active section forward');
ok(items[1].title === 'Supplier scorecard', 'extracts nested group text');
ok(items[2].sectionStart && items[2].section === 'Quality', 'marks section starts');
ok(!items[2].hasTitle, 'detects missing slide titles');
ok(getSlideSectionOptions(items).join('|') === 'Executive|Quality', 'builds unique section options');
ok(filterSlideNavigationItems(items, 'supplier', 'all')[0]?.index === 1, 'filters by nested title text');
ok(filterSlideNavigationItems(items, 'risk', 'Executive').length === 1, 'filters by query and section');
ok(filterSlideNavigationItems(items, '', 'Quality')[0]?.index === 2, 'filters by section only');
ok(summary.slideCount === 3, 'summarizes slide count');
ok(summary.sectionCount === 2, 'summarizes section count');
ok(summary.missingTitleCount === 1, 'summarizes missing titles');
ok(summary.objectCount === 5, 'summarizes top-level object count');

const total = passed + fails.length;
if (fails.length) {
  console.error(`slide navigation: ${fails.length}/${total} failed`);
  for (const fail of fails) console.error(`  - ${fail}`);
  process.exit(1);
}
console.log(`slide navigation: ${passed}/${total} assertions passed`);
