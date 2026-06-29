import {
  INDUSTRIAL_CHART_PRESETS,
  analyzeChartSpec,
  chartPresetSpec,
  cloneChartSpec,
  getIndustrialChartPreset,
  type ChartSpec,
} from './chart';

let passed = 0;
const fails: string[] = [];
const ok = (condition: boolean, message: string) => { if (condition) passed++; else fails.push(message); };
const eq = (actual: unknown, expected: unknown, message: string) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else fails.push(`${message} - expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

const ids = INDUSTRIAL_CHART_PRESETS.map((preset) => preset.id);
ok(INDUSTRIAL_CHART_PRESETS.length >= 8, 'industrial preset catalog covers PowerPoint-grade manufacturing charts');
ok(new Set(ids).size === ids.length, 'preset ids are unique');
ok(ids.includes('oee-trend'), 'catalog includes OEE trend');
ok(ids.includes('pareto-defects'), 'catalog includes quality Pareto');
ok(ids.includes('supplier-score-radar'), 'catalog includes supplier score radar');
ok(ids.includes('npi-readiness-gauge'), 'catalog includes NPI readiness gauge');

for (const preset of INDUSTRIAL_CHART_PRESETS) {
  ok(Boolean(preset.label), `${preset.id}: has label`);
  ok(Boolean(preset.description), `${preset.id}: has description`);
  ok(preset.spec.presetId === preset.id, `${preset.id}: spec carries preset id`);
  ok(preset.spec.presetLabel === preset.label, `${preset.id}: spec carries preset label`);
  ok(preset.spec.labels.length > 0, `${preset.id}: has labels`);
  ok(preset.spec.series.length > 0, `${preset.id}: has series`);
  ok(preset.spec.series.every((series) => series.data.length > 0), `${preset.id}: every series has data`);
}

eq(getIndustrialChartPreset('oee-trend')?.spec.type, 'line', 'preset lookup returns OEE line chart');
eq(chartPresetSpec('plan-vs-actual')?.series.length, 2, 'preset spec clone preserves series');
eq(chartPresetSpec('missing'), undefined, 'missing preset returns undefined');

const cloned = chartPresetSpec('oee-trend')!;
cloned.labels[0] = 'Changed';
cloned.series[0].data[0] = 1;
eq(getIndustrialChartPreset('oee-trend')?.spec.labels[0], 'Lun', 'preset clone does not mutate catalog labels');
eq(getIndustrialChartPreset('oee-trend')?.spec.series[0].data[0], 78, 'preset clone does not mutate catalog data');

const manualClone = cloneChartSpec(getIndustrialChartPreset('inventory-abc')!.spec);
manualClone.palette![0] = '#000000';
eq(getIndustrialChartPreset('inventory-abc')?.spec.palette?.[0], '#2563eb', 'cloneChartSpec clones palette arrays');

const oeeHealth = analyzeChartSpec(chartPresetSpec('oee-trend')!);
eq(oeeHealth.status, 'ready', 'native line preset is ready');
eq(oeeHealth.nativePptx, true, 'line preset exports as native PPTX chart');
ok(oeeHealth.issues.some((issue) => issue.message.includes('contrato pendiente')), 'contract-pending preset surfaces honest source note');

const radarHealth = analyzeChartSpec(chartPresetSpec('supplier-score-radar')!);
eq(radarHealth.status, 'review', 'radar preset requires export review');
eq(radarHealth.nativePptx, false, 'radar preset is not exact native PPTX');
ok(radarHealth.issues.some((issue) => issue.severity === 'warning'), 'radar preset emits warning');

const paretoHealth = analyzeChartSpec(chartPresetSpec('pareto-defects')!);
eq(paretoHealth.usesFirstSeriesOnly, true, 'Pareto uses first series only');
ok(paretoHealth.issues.some((issue) => issue.message.includes('aproximacion editable')), 'Pareto surfaces PPTX approximation warning');

const empty: ChartSpec = { type: 'bar', title: 'Empty', labels: [], series: [] };
const emptyHealth = analyzeChartSpec(empty);
eq(emptyHealth.status, 'blocked', 'empty chart is blocked');
ok(emptyHealth.issues.some((issue) => issue.severity === 'critical'), 'empty chart emits critical issue');

const mismatched: ChartSpec = {
  type: 'bar',
  title: 'Mismatch',
  labels: ['A', 'B', 'C'],
  series: [{ name: 'Actual', data: [1, 2] }],
};
const mismatchHealth = analyzeChartSpec(mismatched);
eq(mismatchHealth.status, 'review', 'mismatched series requires review');
ok(mismatchHealth.issues.some((issue) => issue.message.includes('numero de categorias')), 'mismatched series warning is explicit');

const pieWithTwoSeries: ChartSpec = {
  type: 'pie',
  title: 'Two series',
  labels: ['A', 'B'],
  series: [
    { name: 'One', data: [1, 2] },
    { name: 'Two', data: [3, 4] },
  ],
};
const pieHealth = analyzeChartSpec(pieWithTwoSeries);
eq(pieHealth.status, 'review', 'multi-series pie requires review');
eq(pieHealth.usesFirstSeriesOnly, true, 'pie is first-series-only');
ok(pieHealth.issues.some((issue) => issue.message.includes('primera serie')), 'multi-series pie warning is explicit');

if (fails.length) {
  console.error(`chart spec failed: ${fails.length}/${passed + fails.length}`);
  for (const fail of fails) console.error(` - ${fail}`);
  process.exit(1);
}

console.log(`chart spec passed: ${passed}/${passed}`);
