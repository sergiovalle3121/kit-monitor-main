import assert from 'node:assert/strict';
import {
  buildSlideLayerPanelModel,
  matchesSlideLayer,
  summarizeSlideLayers,
  type SlideLayerItem,
} from './layers';

const layers: SlideLayerItem[] = [
  { idx: 0, label: 'Title block', type: 'Texto', visible: true, locked: false },
  { idx: 1, label: 'OEE chart', type: 'Grafico', visible: true, locked: true },
  { idx: 2, label: 'Hidden SOP photo', type: 'Imagen', visible: false, locked: false },
  { idx: 3, label: 'Supplier scorecard', type: 'Tabla', visible: true, locked: false },
  { idx: 4, label: 'Locked badge', type: 'Grafico', visible: false, locked: true },
];

const summary = summarizeSlideLayers(layers);
assert.equal(summary.total, 5);
assert.equal(summary.visible, 3);
assert.equal(summary.hidden, 2);
assert.equal(summary.locked, 2);
assert.deepEqual(summary.types, [
  { type: 'Grafico', count: 2 },
  { type: 'Imagen', count: 1 },
  { type: 'Tabla', count: 1 },
  { type: 'Texto', count: 1 },
]);

assert.equal(matchesSlideLayer(layers[2], { status: 'hidden' }), true);
assert.equal(matchesSlideLayer(layers[2], { status: 'visible' }), false);
assert.equal(matchesSlideLayer(layers[1], { status: 'locked' }), true);
assert.equal(matchesSlideLayer(layers[0], { status: 'unlocked' }), true);
assert.equal(matchesSlideLayer(layers[1], { type: 'grafico' }), true);
assert.equal(matchesSlideLayer(layers[1], { query: 'oee' }), true);
assert.equal(matchesSlideLayer(layers[3], { query: '#4' }), true);
assert.equal(matchesSlideLayer(layers[4], { query: 'hidden locked' }), false);

const all = buildSlideLayerPanelModel(layers);
assert.equal(all.hasFilters, false);
assert.deepEqual(all.ordered.map((layer) => layer.idx), [4, 3, 2, 1, 0]);
assert.deepEqual(all.filtered.map((layer) => layer.idx), [4, 3, 2, 1, 0]);

const filtered = buildSlideLayerPanelModel(layers, { status: 'hidden', type: 'grafico', query: 'badge' });
assert.equal(filtered.hasFilters, true);
assert.equal(filtered.status, 'hidden');
assert.equal(filtered.type, 'grafico');
assert.deepEqual(filtered.filtered.map((layer) => layer.idx), [4]);

const empty = buildSlideLayerPanelModel(layers, { query: 'missing object' });
assert.equal(empty.filtered.length, 0);
assert.equal(empty.summary.total, 5);

console.log('slides/layers.spec.ts passed');
