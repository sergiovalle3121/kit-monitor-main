import {
  CHART_PRESET_CATEGORIES,
  INDUSTRIAL_CHART_PRESETS,
  chartPresetCategoryLabel,
  chartPresetToSpec,
  chartTypePptxNote,
  filterSlideChartPresets,
  getSlideChartPreset,
} from './chartPresets';
import type { ChartSpec } from './chart';

function ok(value: unknown, message: string) {
  if (!value) throw new Error(message);
}

function eq<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

function includes(value: string, expected: string, message: string) {
  if (!value.includes(expected)) throw new Error(`${message}: expected "${value}" to include "${expected}"`);
}

function assertChartSpec(spec: ChartSpec, id: string) {
  ok(!!spec.title.trim(), `${id}: has title`);
  ok(spec.labels.length > 0, `${id}: has labels`);
  ok(spec.series.length > 0, `${id}: has series`);
  for (const series of spec.series) {
    ok(!!series.name.trim(), `${id}: series has name`);
    ok(series.data.length >= spec.labels.length, `${id}: series covers labels`);
    ok(series.data.every((point) => Number.isFinite(point)), `${id}: data is finite`);
  }
}

const ids = new Set(INDUSTRIAL_CHART_PRESETS.map((preset) => preset.id));
eq(ids.size, INDUSTRIAL_CHART_PRESETS.length, 'preset ids are unique');
ok(INDUSTRIAL_CHART_PRESETS.length >= 10, 'ships a meaningful industrial chart starter set');

for (const preset of INDUSTRIAL_CHART_PRESETS) {
  assertChartSpec(preset.spec, preset.id);
  ok(preset.keywords.length > 0, `${preset.id}: has search keywords`);
  ok(CHART_PRESET_CATEGORIES.some((category) => category.id === preset.category), `${preset.id}: category is registered`);
}

ok(!!getSlideChartPreset('oee-trend'), 'finds OEE preset by id');
eq(getSlideChartPreset('missing-preset'), undefined, 'missing preset returns undefined');
eq(chartPresetCategoryLabel('quality'), 'Calidad', 'category label resolves');

const oeeSpec = chartPresetToSpec('oee-trend');
ok(!!oeeSpec, 'clones preset spec');
eq(oeeSpec?.type, 'line', 'OEE preset is line chart');
eq(oeeSpec?.series.length, 2, 'OEE preset has actual and target series');

const cloned = chartPresetToSpec('defect-pareto');
const original = getSlideChartPreset('defect-pareto')?.spec;
ok(!!cloned && !!original, 'has clone and original');
if (cloned && original) {
  cloned.labels[0] = 'Changed';
  cloned.series[0].data[0] = 999;
  eq(original.labels[0], 'Solder bridge', 'clone does not mutate original labels');
  eq(original.series[0].data[0], 38, 'clone does not mutate original data');
}

eq(filterSlideChartPresets({ query: 'supplier' })[0]?.id, 'supplier-score-radar', 'query matches supplier preset');
eq(filterSlideChartPresets({ category: 'quality' }).length, 2, 'category filter scopes quality presets');
ok(filterSlideChartPresets({ type: 'gauge' }).every((preset) => preset.spec.type === 'gauge'), 'type filter scopes gauges');
eq(filterSlideChartPresets({ query: 'not-a-real-chart' }).length, 0, 'empty query result is supported');
ok(filterSlideChartPresets({ query: 'FPY' }).some((preset) => preset.id === 'test-yield'), 'query is case insensitive');
ok(filterSlideChartPresets({ category: 'inventory', query: 'shortage' }).some((preset) => preset.id === 'mrp-shortages'), 'query and category combine');

includes(chartTypePptxNote('gauge'), 'doughnut', 'gauge note is honest about PPTX mapping');
includes(chartTypePptxNote('waterfall'), 'approximated', 'waterfall note is honest about PPTX fidelity');
includes(chartTypePptxNote('scatter'), 'limited native PowerPoint fidelity', 'scatter note is honest about PPTX fidelity');
includes(chartTypePptxNote('bar'), 'native chartSpec', 'standard charts use native path note');

console.log(`chartPresets.spec.ts passed (${INDUSTRIAL_CHART_PRESETS.length} presets)`);
