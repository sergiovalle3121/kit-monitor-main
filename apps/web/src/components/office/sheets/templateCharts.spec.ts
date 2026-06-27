/** Industrial sheet templates should open with persisted charts that render from their ranges. */
import { buildChartData } from '@/lib/office/charts';
import { TEMPLATES } from '@/lib/office/templates';

let passed = 0; const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };

const expected = ['bom-costing', 'oee-calculator', 'inventory-abc', 'supplier-scorecard'];
(async () => {
  for (const id of expected) {
    const t = TEMPLATES.sheet.find((x) => x.id === id)!;
    const content = await t.build();
    ok(!!content && !Array.isArray(content), `${id}: devuelve workbook enriquecido`);
    ok(Array.isArray(content.sheets) && content.sheets.length > 0, `${id}: conserva sheets`);
    ok(Array.isArray(content.charts) && content.charts.length > 0, `${id}: incluye charts`);
    for (const c of content.charts ?? []) {
      const data = buildChartData(content.sheets[c.sheetIndex] ?? content.sheets[0], c);
      ok(!!data && Array.isArray(data.datasets) && data.datasets.length > 0, `${id}/${c.id}: chart data válido`);
    }
  }
  const total = passed + fails.length;
  if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
  else console.log(`✅ ${passed}/${total}`);
})().catch((e) => { console.error(e); process.exit(1); });
