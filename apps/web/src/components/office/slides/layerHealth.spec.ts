import {
  analyzeSlideLayers,
  filterSlideLayerInsights,
  normalizeLayerQuery,
  type SlideLayerItem,
} from './layerHealth';

let passed = 0;
const fails: string[] = [];
const ok = (cond: boolean, msg: string) => { if (cond) passed++; else fails.push(msg); };
const eq = (actual: unknown, expected: unknown, msg: string) => ok(JSON.stringify(actual) === JSON.stringify(expected), `${msg} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

const layers: SlideLayerItem[] = [
  { idx: 0, label: 'Title', type: 'Texto', visible: true, locked: false, left: 56, top: 70, width: 500, height: 48 },
  { idx: 1, label: 'Supplier scorecard', type: 'Smart Object', visible: true, locked: true, left: 120, top: 160, width: 260, height: 140, smartObjectSource: 'AXOS.suppliers.scorecard' },
  { idx: 2, label: 'Assembly photo', type: 'Imagen', visible: true, locked: false, left: 900, top: 20, width: 180, height: 120, objectId: 'img-1', commentCount: 2 },
  { idx: 3, label: 'Hidden note', type: 'Texto', visible: false, locked: false, left: 60, top: 440, width: 320, height: 44, animation: 'fade' },
  { idx: 4, label: 'Jump to appendix', type: 'Forma', visible: true, locked: false, left: 80, top: 300, width: 140, height: 70, hasLink: true },
  { idx: 5, label: 'Manual KPI', type: 'Smart Object', visible: true, locked: false, left: 260, top: 300, width: 140, height: 70, smartObjectSource: 'manual' },
];

eq(normalizeLayerQuery('  Ensamble AREA  '), 'ensamble area', 'normalizes layer search text');

const analyzed = analyzeSlideLayers(layers, { width: 960, height: 540 });
eq(analyzed.summary.total, 6, 'counts all layers');
eq(analyzed.summary.visible, 5, 'counts visible layers');
eq(analyzed.summary.hidden, 1, 'counts hidden layers');
eq(analyzed.summary.locked, 1, 'counts locked layers');
eq(analyzed.summary.animated, 1, 'counts animated layers');
eq(analyzed.summary.commented, 1, 'counts commented layers');
eq(analyzed.summary.linked, 1, 'counts linked layers');
eq(analyzed.summary.offCanvas, 1, 'counts off-canvas layers');
eq(analyzed.summary.smartObjectPending, 1, 'counts pending smart objects');
eq(analyzed.summary.needsReview, 4, 'counts layers with review flags');
ok(analyzed.summary.types.includes('Imagen') && analyzed.summary.types.includes('Smart Object'), 'returns type filter options');
ok(analyzed.summary.warnings.some((warning) => warning.includes('outside the slide bounds')), 'surfaces off-canvas warning');
ok(analyzed.summary.warnings.some((warning) => warning.includes('Smart Object')), 'surfaces smart object warning');

const offCanvas = analyzed.items.find((item) => item.label === 'Assembly photo');
ok(!!offCanvas?.offCanvas, 'marks the overflowing image');
ok(!!offCanvas?.commented, 'marks object with open comments');

const manual = analyzed.items.find((item) => item.label === 'Manual KPI');
ok(!manual?.smartObjectPending, 'manual smart objects are not contract pending');

eq(filterSlideLayerInsights(analyzed.items, { issue: 'offCanvas' }).map((item) => item.label), ['Assembly photo'], 'filters off-canvas layers');
eq(filterSlideLayerInsights(analyzed.items, { issue: 'smartObject' }).map((item) => item.label), ['Supplier scorecard'], 'filters pending smart objects');
eq(filterSlideLayerInsights(analyzed.items, { issue: 'review' }).map((item) => item.label), ['Supplier scorecard', 'Assembly photo', 'Hidden note', 'Jump to appendix'], 'filters review-needed layers');
eq(filterSlideLayerInsights(analyzed.items, { type: 'Texto' }).map((item) => item.label), ['Title', 'Hidden note'], 'filters by type');
eq(filterSlideLayerInsights(analyzed.items, { query: 'appendix link' }).map((item) => item.label), ['Jump to appendix'], 'searches labels and issue aliases');
eq(filterSlideLayerInsights(analyzed.items, { query: 'scorecard', issue: 'smartObject' }).map((item) => item.label), ['Supplier scorecard'], 'combines search and issue filters');

if (fails.length) {
  console.error(`layer health spec failed: ${fails.length}/${passed + fails.length}`);
  for (const fail of fails) console.error(` - ${fail}`);
  process.exit(1);
}

console.log(`layer health spec passed: ${passed}/${passed}`);
