import {
  CATEGORY_LABEL,
  INDUSTRIAL_ASSETS,
  SLIDE_ASSET_CATEGORIES,
  assetCatalogStats,
  filterSlideAssets,
  getSlideAssetById,
  normalizeAssetQuery,
} from './assetCatalog';

let passed = 0;
const fails: string[] = [];
const ok = (condition: boolean, message: string) => { if (condition) passed++; else fails.push(message); };
const eq = (actual: unknown, expected: unknown, message: string) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else fails.push(`${message} - expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

const ids = INDUSTRIAL_ASSETS.map((asset) => asset.id);
ok(INDUSTRIAL_ASSETS.length >= 36, 'industrial catalog has broad PowerPoint-grade coverage');
ok(new Set(ids).size === ids.length, 'asset ids are unique');
ok(SLIDE_ASSET_CATEGORIES.length >= 12, 'asset categories cover industrial review use cases');

for (const asset of INDUSTRIAL_ASSETS) {
  ok(Boolean(CATEGORY_LABEL[asset.category]), `${asset.id}: category has a label`);
  ok(asset.svg.startsWith('<svg '), `${asset.id}: svg wrapper is present`);
  ok(!/<script\b/i.test(asset.svg), `${asset.id}: svg has no script tag`);
  ok(asset.keywords.length >= 3, `${asset.id}: has searchable keywords`);
  ok(asset.description.length > 3, `${asset.id}: has card description`);
}

const stats = assetCatalogStats();
eq(stats.total, INDUSTRIAL_ASSETS.length, 'stats total matches catalog');
for (const category of SLIDE_ASSET_CATEGORIES) {
  ok(stats.categories[category.id] > 0, `${category.id}: category has at least one asset`);
}

eq(normalizeAssetQuery('  Produccion '), 'produccion', 'query normalization trims and lowercases');
eq(normalizeAssetQuery('Calidad'), 'calidad', 'query normalization removes accents');

ok(filterSlideAssets(INDUSTRIAL_ASSETS, { query: 'capa' }).some((asset) => asset.id === 'capa'), 'search finds CAPA');
ok(filterSlideAssets(INDUSTRIAL_ASSETS, { query: 'conteo' }).some((asset) => asset.id === 'cycle-count'), 'search is accent-insensitive through keywords');
ok(filterSlideAssets(INDUSTRIAL_ASSETS, { category: 'supplier' }).every((asset) => asset.category === 'supplier'), 'category filter scopes supplier assets');
ok(filterSlideAssets(INDUSTRIAL_ASSETS, { mode: 'favorites', favoriteIds: ['scar', 'capa'] }).every((asset) => ['scar', 'capa'].includes(asset.id)), 'favorites mode scopes to favorite ids');
eq(filterSlideAssets(INDUSTRIAL_ASSETS, { mode: 'recent', recentIds: ['truck', 'andon', 'capa'] }).map((asset) => asset.id).slice(0, 3), ['truck', 'andon', 'capa'], 'recent mode preserves recent order');
eq(getSlideAssetById('ppap')?.category, 'npi', 'lookup returns PPAP asset');

if (fails.length) {
  console.error(`\nasset catalog: ${fails.length}/${passed + fails.length} failed`);
  for (const fail of fails) console.error(`  - ${fail}`);
  process.exit(1);
}

console.log(`asset catalog: ${passed}/${passed} assertions passed`);
