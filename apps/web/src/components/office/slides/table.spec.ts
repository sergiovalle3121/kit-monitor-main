import {
  INDUSTRIAL_TABLE_PRESETS,
  TABLE_ACCENT,
  TABLE_PRESET_CATEGORY_LABEL,
  createTablePresetSpec,
  createTablePresetSpecById,
  getTablePreset,
  normalizeCells,
  type TablePreset,
} from './table';

let passed = 0;
const fails: string[] = [];
const ok = (condition: boolean, message: string) => { if (condition) passed++; else fails.push(message); };
const eq = (actual: unknown, expected: unknown, message: string) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else fails.push(`${message} - expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

const ids = INDUSTRIAL_TABLE_PRESETS.map((preset) => preset.id);
ok(INDUSTRIAL_TABLE_PRESETS.length >= 8, 'covers common industrial review tables');
ok(new Set(ids).size === ids.length, 'preset ids are unique');

for (const preset of INDUSTRIAL_TABLE_PRESETS) {
  ok(Boolean(TABLE_PRESET_CATEGORY_LABEL[preset.category]), `${preset.id}: category label exists`);
  ok(preset.label.length > 3, `${preset.id}: label is useful`);
  ok(preset.description.length > 12, `${preset.id}: description is useful`);
  ok(preset.cells.length >= 4, `${preset.id}: has header plus editable rows`);
  ok(preset.cells[0].length >= 4, `${preset.id}: has enough industrial columns`);
}

const actionRegister = getTablePreset('action-register');
ok(Boolean(actionRegister), 'lookup finds action register preset');
const actionSpec = createTablePresetSpec(actionRegister!, '#f59e0b');
eq(actionSpec.rows, 4, 'action register rows are derived from cells');
eq(actionSpec.cols, 5, 'action register columns are derived from cells');
eq(actionSpec.accent, '#f59e0b', 'preset accepts theme accent');
eq(actionSpec.presetId, 'action-register', 'preset id persists on table spec');
eq(actionSpec.presetLabel, 'Action register', 'preset label persists on table spec');
eq(actionSpec.cells[0], ['Accion', 'Owner', 'Due', 'Status', 'Decision needed'], 'action register header is preserved');

actionSpec.cells[1][0] = 'Changed';
eq(actionRegister!.cells[1][0], 'Accion 1', 'preset spec deep clones source cells');

const supplierSpec = createTablePresetSpecById('supplier-scorecard');
eq(supplierSpec?.accent, TABLE_ACCENT, 'preset by id uses default accent');
eq(supplierSpec?.rows, 5, 'supplier scorecard rows are derived');
eq(supplierSpec?.cols, 5, 'supplier scorecard columns are derived');
eq(createTablePresetSpecById('missing-preset'), null, 'missing preset returns null');

const jaggedPreset: TablePreset = {
  id: 'jagged',
  label: 'Jagged',
  category: 'operations',
  description: 'For dimension normalization checks.',
  cells: [['A', 'B', 'C'], ['1']],
};
const jaggedSpec = createTablePresetSpec(jaggedPreset);
eq(jaggedSpec.rows, 2, 'jagged rows are kept');
eq(jaggedSpec.cols, 3, 'jagged cols use widest row');
eq(normalizeCells(jaggedSpec), [['A', 'B', 'C'], ['1', '', '']], 'jagged preset normalizes missing cells');

if (fails.length) {
  console.error(`\ntable presets: ${fails.length}/${passed + fails.length} failed`);
  for (const fail of fails) console.error(`  - ${fail}`);
  process.exit(1);
}

console.log(`table presets: ${passed}/${passed} assertions passed`);
