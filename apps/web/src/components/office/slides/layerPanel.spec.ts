import {
  LAYER_FILTERS,
  filterLayerPanelItems,
  layerFilterSummary,
  layerPanelStats,
  normalizeLayerQuery,
  type LayerPanelItem,
} from './layerPanel';

let passed = 0;
const fails: string[] = [];
const ok = (condition: boolean, message: string) => { if (condition) passed++; else fails.push(message); };
const eq = (actual: unknown, expected: unknown, message: string) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else fails.push(`${message} - expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

const items: LayerPanelItem[] = [
  { idx: 0, label: 'Titulo principal', type: 'Texto', visible: true, locked: false },
  { idx: 1, label: 'KPI OEE', type: 'Smart Object', visible: true, locked: true },
  { idx: 2, label: 'Pareto defectos', type: 'Grafico', visible: false, locked: false },
  { idx: 3, label: 'Fondo marca', type: 'Forma', visible: true, locked: true },
  { idx: 4, label: 'Accion abierta', type: 'Texto', visible: true, locked: false },
];

eq(LAYER_FILTERS.map((filter) => filter.id), ['all', 'visible', 'hidden', 'locked', 'editable'], 'filter registry is stable');
eq(normalizeLayerQuery('  Gráfico  '), 'grafico', 'query normalization removes accents');

const stats = layerPanelStats(items);
eq(stats.total, 5, 'stats total');
eq(stats.visible, 4, 'stats visible');
eq(stats.hidden, 1, 'stats hidden');
eq(stats.locked, 2, 'stats locked');
eq(stats.editable, 3, 'stats editable');
eq(stats.types, [
  { type: 'Texto', count: 2 },
  { type: 'Forma', count: 1 },
  { type: 'Grafico', count: 1 },
  { type: 'Smart Object', count: 1 },
], 'stats sorts type counts');

eq(filterLayerPanelItems(items, { mode: 'visible' }).map((item) => item.idx), [0, 1, 3, 4], 'visible filter');
eq(filterLayerPanelItems(items, { mode: 'hidden' }).map((item) => item.idx), [2], 'hidden filter');
eq(filterLayerPanelItems(items, { mode: 'locked' }).map((item) => item.idx), [1, 3], 'locked filter');
eq(filterLayerPanelItems(items, { mode: 'editable' }).map((item) => item.idx), [0, 2, 4], 'editable filter');
eq(filterLayerPanelItems(items, { type: 'Texto' }).map((item) => item.idx), [0, 4], 'type filter');
eq(filterLayerPanelItems(items, { query: 'oee' }).map((item) => item.idx), [1], 'query finds label');
eq(filterLayerPanelItems(items, { query: 'grafico' }).map((item) => item.idx), [2], 'query finds type accent-insensitively');
eq(filterLayerPanelItems(items, { mode: 'editable', query: 'accion', type: 'Texto' }).map((item) => item.idx), [4], 'filters compose');

eq(layerFilterSummary(stats), '5 objetos · 1 oculto · 2 bloqueados', 'summary includes hidden and locked counts');
eq(layerFilterSummary(layerPanelStats([])), '0 objetos', 'empty summary');
ok(filterLayerPanelItems(items, { mode: 'all', type: 'all', query: '' }).length === items.length, 'empty filter returns all');

if (fails.length) {
  console.error(`\nlayer panel: ${fails.length}/${passed + fails.length} failed`);
  for (const fail of fails) console.error(`  - ${fail}`);
  process.exit(1);
}

console.log(`layer panel: ${passed}/${passed} assertions passed`);
