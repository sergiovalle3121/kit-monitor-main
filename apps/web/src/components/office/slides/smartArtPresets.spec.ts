import { SMART_KINDS } from './smartart';
import {
  INDUSTRIAL_SMART_ART_PRESETS,
  SMART_ART_PRESET_CATEGORIES,
  SMART_ART_PRESET_CATEGORY_LABEL,
  cloneSmartArtPresetSpec,
  filterSmartArtPresets,
  getSmartArtPresetById,
  normalizeSmartArtPresetQuery,
  smartArtPresetStats,
} from './smartArtPresets';

let passed = 0;
const fails: string[] = [];
const ok = (condition: boolean, message: string) => { if (condition) passed++; else fails.push(message); };
const eq = (actual: unknown, expected: unknown, message: string) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else fails.push(`${message} - expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

const ids = INDUSTRIAL_SMART_ART_PRESETS.map((preset) => preset.id);
const kinds = new Set(SMART_KINDS.map((kind) => kind.value));

ok(INDUSTRIAL_SMART_ART_PRESETS.length >= 10, 'industrial SmartArt catalog has broad manufacturing coverage');
ok(new Set(ids).size === ids.length, 'preset ids are unique');
ok(SMART_ART_PRESET_CATEGORIES.length >= 5, 'preset categories cover operations, quality, launch, supplier and visual aids');

for (const preset of INDUSTRIAL_SMART_ART_PRESETS) {
  ok(Boolean(SMART_ART_PRESET_CATEGORY_LABEL[preset.category]), `${preset.id}: category has a label`);
  ok(kinds.has(preset.kind), `${preset.id}: kind is supported by the existing SmartArt renderer`);
  ok(preset.items.length >= 3, `${preset.id}: has enough editable diagram nodes`);
  ok(preset.tags.length >= 4, `${preset.id}: has searchable tags`);
  ok(preset.description.length > 8, `${preset.id}: has a useful card description`);
  if (preset.kind === 'matrix') eq(preset.items.length, 4, `${preset.id}: matrix presets fit the existing 2x2 renderer`);
}

const stats = smartArtPresetStats();
eq(stats.total, INDUSTRIAL_SMART_ART_PRESETS.length, 'stats total matches preset catalog');
for (const category of SMART_ART_PRESET_CATEGORIES) {
  ok(stats.categories[category.id] > 0, `${category.id}: category has at least one preset`);
}

eq(normalizeSmartArtPresetQuery('  Calidad '), 'calidad', 'query normalization trims and lowercases');
eq(normalizeSmartArtPresetQuery('Operacion'), 'operacion', 'query normalization is accent-insensitive');

ok(filterSmartArtPresets(INDUSTRIAL_SMART_ART_PRESETS, { query: '8d' }).some((preset) => preset.id === 'eight-d-capa-flow'), 'search finds 8D/CAPA preset');
ok(filterSmartArtPresets(INDUSTRIAL_SMART_ART_PRESETS, { query: 'sop' }).some((preset) => preset.id === 'npi-gate-roadmap'), 'search finds launch readiness by SOP tag');
ok(filterSmartArtPresets(INDUSTRIAL_SMART_ART_PRESETS, { category: 'supplier' }).every((preset) => preset.category === 'supplier'), 'category filter scopes supplier presets');
eq(getSmartArtPresetById('quality-containment-loop')?.kind, 'cycle', 'lookup returns containment cycle preset');

const original = getSmartArtPresetById('material-flow-review');
if (!original) {
  fails.push('material flow preset exists');
} else {
  const clone = cloneSmartArtPresetSpec(original);
  clone.items[0] = 'Changed';
  eq(original.items[0], 'Supplier', 'clone does not mutate source preset');
  eq(clone.kind, original.kind, 'clone preserves SmartArt kind');
}

if (fails.length) {
  console.error(`smartArt presets: ${fails.length}/${passed + fails.length} failed`);
  for (const fail of fails) console.error(`  - ${fail}`);
  process.exit(1);
}

console.log(`smartArt presets: ${passed}/${passed} assertions passed`);
