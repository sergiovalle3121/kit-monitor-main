import {
  IMAGE_FX_PRESETS,
  IMG_FX_DEFAULTS,
  analyzeImageEffects,
  countActiveImageEffects,
  imageEffectsSummary,
  imageFxPresetById,
} from './imageEffects';

let passed = 0;
const fails: string[] = [];
const ok = (condition: boolean, message: string) => { if (condition) passed++; else fails.push(message); };
const eq = (actual: unknown, expected: unknown, message: string) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else fails.push(`${message} - expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

const ids = IMAGE_FX_PRESETS.map((preset) => preset.id);
ok(IMAGE_FX_PRESETS.length >= 6, 'preset gallery covers image workflows');
ok(new Set(ids).size === ids.length, 'preset ids are unique');
for (const preset of IMAGE_FX_PRESETS) {
  ok(preset.label.length > 2, `${preset.id}: has label`);
  ok(preset.description.length > 5, `${preset.id}: has description`);
  ok(typeof preset.fx.brightness === 'number', `${preset.id}: has full fx object`);
}

eq(imageFxPresetById('document-scan')?.fx.grayscale, true, 'lookup returns document scan preset');
eq(imageFxPresetById('missing'), undefined, 'missing preset returns undefined');

eq(countActiveImageEffects(IMG_FX_DEFAULTS), 0, 'defaults have no active effects');
eq(countActiveImageEffects({ ...IMG_FX_DEFAULTS, brightness: 0.1, grayscale: true, blur: 0.2 }), 3, 'counts numeric and boolean effects');

const clean = analyzeImageEffects(IMG_FX_DEFAULTS);
eq(clean.exportFidelity, 'native', 'default image export is native');
eq(clean.issues, [], 'default image has no issues');
eq(imageEffectsSummary(IMG_FX_DEFAULTS), 'Sin filtros activos', 'default summary');

const adjusted = analyzeImageEffects({ ...IMG_FX_DEFAULTS, contrast: 0.2 });
eq(adjusted.exportFidelity, 'approximate', 'active filters mark export as approximate');
ok(adjusted.issues.some((issue) => issue.code === 'pptx-image-effects'), 'active filters add PPTX fidelity note');
eq(imageEffectsSummary({ ...IMG_FX_DEFAULTS, contrast: 0.2 }), '1 filtro activo', 'single filter summary');

const riskyFx = { ...IMG_FX_DEFAULTS, brightness: 0.6, contrast: -0.55, saturation: 0.9, blur: 0.4, grayscale: true, invert: true };
const risky = analyzeImageEffects(riskyFx);
ok(risky.issues.some((issue) => issue.code === 'blur-readability' && issue.severity === 'warning'), 'high blur warning');
ok(risky.issues.some((issue) => issue.code === 'brightness-extreme'), 'brightness warning');
ok(risky.issues.some((issue) => issue.code === 'contrast-extreme'), 'contrast warning');
ok(risky.issues.some((issue) => issue.code === 'saturation-extreme'), 'saturation warning');
ok(risky.issues.some((issue) => issue.code === 'stacked-color-filters'), 'stacked color filters warning');
ok(risky.issues.some((issue) => issue.code === 'stacked-effects'), 'stacked effects note');
ok(imageEffectsSummary(riskyFx).includes('alertas'), 'risky summary includes warning count');

if (fails.length) {
  console.error(`\nimage effects: ${fails.length}/${passed + fails.length} failed`);
  for (const fail of fails) console.error(`  - ${fail}`);
  process.exit(1);
}

console.log(`image effects: ${passed}/${passed} assertions passed`);
