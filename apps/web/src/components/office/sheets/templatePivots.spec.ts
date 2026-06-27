/** Industrial Pivot Analysis Pack should ship with refreshable pivot definitions and result sheets. */
import { buildPivot } from '@/lib/office/sheetOps';
import { TEMPLATES } from '@/lib/office/templates';

let passed = 0; const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };

(async () => {
  const t = TEMPLATES.sheet.find((x) => x.id === 'industrial-pivot-pack')!;
  const content = await t.build();
  ok(!!content && !Array.isArray(content), 'template devuelve workbook enriquecido');
  ok(Array.isArray(content.sheets) && content.sheets.length >= 10, 'incluye raw sheets + pivot sheets');
  ok(Array.isArray(content.pivots) && content.pivots.length === 5, 'incluye 5 definiciones persistidas');
  const expected = ['Pivot Scrap', 'Pivot Compras', 'Pivot Inventario', 'Pivot OEE', 'Pivot BOM'];
  for (const name of expected) ok(!!content.sheets.find((s: { name?: string }) => s.name === name), `incluye hoja ${name}`);
  for (const p of content.pivots) {
    const src = content.sheets[p.config.sheetIndex];
    const res = buildPivot(src, p.config);
    ok(res.matrix.length > 0 && res.nRows > 0 && res.nCols > 0, `${p.id}: recalcula con datos`);
    ok(!!content.sheets.find((s: { name?: string }) => s.name === p.sheetName), `${p.id}: apunta a hoja destino existente`);
  }
  const total = passed + fails.length;
  if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
  else console.log(`✅ ${passed}/${total}`);
})().catch((e) => { console.error(e); process.exit(1); });
