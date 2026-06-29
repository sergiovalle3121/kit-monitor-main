import {
  INDUSTRIAL_SMARTART_PRESETS,
  SMARTART_PRESET_CATEGORIES,
  addSmartArtItem,
  filterSmartArtPresets,
  getSmartArtPresetById,
  moveSmartArtItem,
  normalizeSmartArtItems,
  normalizeSmartArtQuery,
  removeSmartArtItem,
  smartArtPresetStats,
  smartArtSpecFromPreset,
  updateSmartArtItem,
} from './smartartPresets';

let passed = 0;
const fails: string[] = [];
const ok = (condition: boolean, message: string) => { if (condition) passed++; else fails.push(message); };
const eq = (actual: unknown, expected: unknown, message: string) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else fails.push(`${message} - expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

const ids = INDUSTRIAL_SMARTART_PRESETS.map((preset) => preset.id);
ok(INDUSTRIAL_SMARTART_PRESETS.length >= 12, 'preset gallery has broad industrial coverage');
ok(new Set(ids).size === ids.length, 'preset ids are unique');

const categoryIds = SMARTART_PRESET_CATEGORIES.map((category) => category.id);
for (const preset of INDUSTRIAL_SMARTART_PRESETS) {
  ok(categoryIds.includes(preset.category), `${preset.id}: category is registered`);
  ok(preset.items.length >= 4, `${preset.id}: has enough editable nodes`);
  ok(preset.tags.length >= 4, `${preset.id}: has searchable tags`);
  ok(preset.description.length > 10, `${preset.id}: has a useful description`);
}

const stats = smartArtPresetStats();
eq(stats.total, INDUSTRIAL_SMARTART_PRESETS.length, 'stats total matches presets');
for (const category of SMARTART_PRESET_CATEGORIES) {
  if (category.id === 'all') continue;
  ok(stats.byCategory[category.id] > 0, `${category.id}: category has at least one preset`);
}
ok((stats.byKind.timeline ?? 0) >= 2, 'timeline kind has industrial presets');
ok((stats.byKind.swimlane ?? 0) >= 1, 'swimlane kind has industrial presets');
ok((stats.byKind.sipoc ?? 0) >= 1, 'sipoc kind has industrial presets');
ok((stats.byKind.funnel ?? 0) >= 1, 'funnel kind has industrial presets');

eq(normalizeSmartArtQuery('  Contencion '), 'contencion', 'query normalization trims and lowercases');
eq(normalizeSmartArtQuery('Produccion'), 'produccion', 'query normalization is stable for ASCII text');
ok(filterSmartArtPresets(INDUSTRIAL_SMARTART_PRESETS, { query: 'capa' }).some((preset) => preset.id === 'quality-containment'), 'search finds CAPA containment');
ok(filterSmartArtPresets(INDUSTRIAL_SMARTART_PRESETS, { query: 'ppap' }).some((preset) => preset.id === 'npi-gates'), 'search finds PPAP launch gates');
ok(filterSmartArtPresets(INDUSTRIAL_SMARTART_PRESETS, { category: 'supplier' }).every((preset) => preset.category === 'supplier'), 'category filter scopes supplier presets');
ok(filterSmartArtPresets(INDUSTRIAL_SMARTART_PRESETS, { kind: 'swimlane' }).every((preset) => preset.kind === 'swimlane'), 'kind filter scopes swimlane presets');

const sipoc = getSmartArtPresetById('sipoc-review');
ok(Boolean(sipoc), 'lookup returns SIPOC preset');
if (sipoc) {
  eq(smartArtSpecFromPreset(sipoc), { kind: 'sipoc', items: ['Supplier', 'Inputs', 'Process', 'Outputs', 'Customer'] }, 'preset clones to SmartSpec');
  const spec = smartArtSpecFromPreset(sipoc);
  spec.items[0] = 'Changed';
  eq(sipoc.items[0], 'Supplier', 'spec clone does not mutate preset');
}

eq(normalizeSmartArtItems(['', '  Detect ', ' ', 'Verify']), ['Detect', 'Verify'], 'normalizes editable node labels');
eq(normalizeSmartArtItems(['', '  ']), ['Elemento'], 'normalization keeps a fallback node');
eq(addSmartArtItem(['A', 'B']), ['A', 'B', 'Nodo 3'], 'adds a default node');
eq(addSmartArtItem(['A'], 'Custom'), ['A', 'Custom'], 'adds a custom node');
eq(updateSmartArtItem(['A', 'B'], 1, 'C'), ['A', 'C'], 'updates a node');
eq(removeSmartArtItem(['A', 'B'], 0), ['B'], 'removes a node');
eq(removeSmartArtItem(['A'], 0), ['Elemento'], 'remove keeps one fallback node');
eq(moveSmartArtItem(['A', 'B', 'C'], 0, 2), ['B', 'C', 'A'], 'moves a node down');
eq(moveSmartArtItem(['A', 'B', 'C'], 2, 0), ['C', 'A', 'B'], 'moves a node up');
eq(moveSmartArtItem(['A', 'B'], -1, 1), ['A', 'B'], 'invalid move is a no-op clone');

if (fails.length) {
  console.error(`\nsmartart presets: ${fails.length}/${passed + fails.length} failed`);
  for (const fail of fails) console.error(`  - ${fail}`);
  process.exit(1);
}

console.log(`smartart presets: ${passed}/${passed} assertions passed`);
