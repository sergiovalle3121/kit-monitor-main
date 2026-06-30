import { TEMPLATES } from './templates';
import { analyzeSheetTemplateReadiness, summarizeSheetTemplateBuild } from './templateReadiness';

let passed = 0;
const fails: string[] = [];
const ok = (condition: boolean, message: string) => { if (condition) passed++; else fails.push(message); };
const eq = (actual: unknown, expected: unknown, message: string) => {
  if (actual === expected) passed++;
  else fails.push(`${message} - expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

function sheetTemplate(id: string) {
  const template = TEMPLATES.sheet.find((item) => item.id === id);
  if (!template) throw new Error(`Missing template ${id}`);
  return template;
}

(async () => {
  const blank = summarizeSheetTemplateBuild(sheetTemplate('blank'));
  eq(blank.level, 'blank', 'blank template is explicit');
  eq(blank.score, 0, 'blank template has no readiness score');
  ok(blank.warnings.some((warning) => warning.includes('no industrial workbook payload')), 'blank warning is honest');

  const mrp = summarizeSheetTemplateBuild(sheetTemplate('mrp-shortages-control-room'));
  ok(mrp.score >= 90, 'MRP control room reaches governed score');
  eq(mrp.level, 'governed', 'MRP control room is governed');
  eq(mrp.metrics.connectors, 1, 'MRP control room uses one AXOS connector');
  ok(mrp.metrics.protectedRanges >= 1, 'MRP connector range is protected');
  ok(mrp.badges.includes('Connector'), 'MRP readiness advertises connector');
  ok(mrp.badges.includes('Dashboard'), 'MRP readiness advertises dashboard');
  ok(mrp.badges.includes('Print'), 'MRP readiness advertises print layout');
  ok(!mrp.warnings.some((warning) => warning.includes('without protected')), 'MRP has no unprotected connector warning');

  const pivots = summarizeSheetTemplateBuild(sheetTemplate('industrial-pivot-pack'));
  eq(pivots.metrics.pivots, 5, 'pivot pack has five persisted pivot definitions');
  ok(pivots.badges.includes('Pivots'), 'pivot pack advertises pivots');
  eq(pivots.level, 'analysis', 'pivot pack is analysis-ready without overstating governance');
  ok(pivots.warnings.some((warning) => warning.includes('No print layout')), 'pivot pack warns about report layout gap');

  const oee = summarizeSheetTemplateBuild(sheetTemplate('oee-calculator'));
  ok(oee.metrics.formulas > 0, 'OEE calculator has formulas');
  ok(oee.metrics.charts > 0, 'OEE calculator has chart metadata');
  ok(oee.badges.includes('Formulas'), 'OEE readiness advertises formulas');
  ok(oee.badges.includes('Charts'), 'OEE readiness advertises charts');

  const manual = analyzeSheetTemplateReadiness({
    sheets: [{ name: 'Connector Raw', celldata: [{ r: 0, c: 0, v: { v: 'SKU', m: 'SKU' } }] }],
    connectors: [{ id: 'c1', type: 'inventory_snapshot', range: 'A1:G5' }],
  });
  ok(manual.warnings.some((warning) => warning.includes('without protected connector ranges')), 'manual connector workbook warns when unprotected');

  const total = passed + fails.length;
  if (fails.length) {
    console.error(`FAIL ${passed}/${total}`);
    for (const fail of fails) console.error(`  - ${fail}`);
    process.exit(1);
  }
  console.log(`OK ${passed}/${total}`);
})().catch((error) => { console.error(error); process.exit(1); });
