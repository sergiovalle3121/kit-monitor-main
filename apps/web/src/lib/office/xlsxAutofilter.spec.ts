/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Export del AUTOFILTRO al .xlsx (ExcelJS):
 *   cd apps/web && npx tsx src/lib/office/xlsxAutofilter.spec.ts
 * Una hoja con `filter_select` debe exportar `worksheet.autoFilter` (encabezados con flecha de filtro).
 */
import ExcelJS from 'exceljs';
import { styledXlsxBuffer } from './xlsxStyled';

let passed = 0; const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };

const cell = (v: any) => ({ v, m: String(v ?? ''), ct: { fa: 'General', t: typeof v === 'number' ? 'n' : 's' } });
const withFilter = {
  name: 'Tabla',
  celldata: [
    { r: 0, c: 0, v: cell('Mes') }, { r: 0, c: 1, v: cell('Importe') },
    { r: 1, c: 0, v: cell('Ene') }, { r: 1, c: 1, v: cell(10) },
    { r: 2, c: 0, v: cell('Feb') }, { r: 2, c: 1, v: cell(20) },
  ],
  filter_select: { row: [0, 2], column: [0, 1] },
};
const noFilter = { name: 'Plana', celldata: [{ r: 0, c: 0, v: cell('x') }] };

(async () => {
  const buf = await styledXlsxBuffer(ExcelJS, [withFilter, noFilter] as any);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  const ws = wb.getWorksheet('Tabla') as any;
  const plain = wb.getWorksheet('Plana') as any;

  ok(!!ws.autoFilter, 'la hoja con filtro exporta autoFilter');
  ok(String(ws.autoFilter).replace(/\$/g, '') === 'A1:B3', `el rango del filtro es A1:B3 (obt ${JSON.stringify(ws.autoFilter)})`);
  ok(!plain.autoFilter, 'la hoja sin filtro NO lleva autoFilter');

  const total = passed + fails.length;
  if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
  else console.log(`✅ ${passed}/${total}`);
})().catch((e) => { console.error(e); process.exit(1); });
