/* eslint-disable @typescript-eslint/no-explicit-any */
/** XLSX hyperlinks and cell comments round-trip through SheetJS/ExcelJS helpers. */
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { cellToXlsx, xlsxToFortuneV } from './xlsx';
import { styledXlsxBuffer, readStylesIntoSheets } from './xlsxStyled';

let passed = 0; const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };

const fortuneCell = { v: 'AXOS', m: 'AXOS', ct: { fa: 'General', t: 's' }, hl: 'https://axos.local/office', hlTooltip: 'Abrir AXOS', comment: 'Revisar rango' };
const mapped = cellToXlsx(fortuneCell)!;
ok(mapped.l?.Target === 'https://axos.local/office', 'cellToXlsx conserva hyperlink');
ok(mapped.l?.Tooltip === 'Abrir AXOS', 'cellToXlsx conserva tooltip');
ok(mapped.c?.[0]?.t === 'Revisar rango', 'cellToXlsx conserva comentario');
const back = xlsxToFortuneV({ t: 's', v: 'AXOS', l: { Target: 'https://axos.local/office', Tooltip: 'Abrir AXOS' }, c: [{ t: 'Revisar rango' }] });
ok(back.hl === 'https://axos.local/office' && back.hlTooltip === 'Abrir AXOS', 'xlsxToFortuneV recupera hyperlink');
ok(back.comment === 'Revisar rango', 'xlsxToFortuneV recupera comentario');

const sheets = [{
  name: 'Links',
  celldata: [
    { r: 0, c: 0, v: fortuneCell },
    { r: 1, c: 0, v: { v: 'Docs', m: 'Docs', ct: { fa: 'General', t: 's' }, hyperlink: 'https://docs.axos.local' } },
  ],
}];

(async () => {
  const buf = await styledXlsxBuffer(ExcelJS, sheets as any);
  ok(buf.byteLength > 0, 'genera xlsx con links/comments');

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  const ws = wb.getWorksheet('Links')!;
  const a1 = ws.getCell('A1') as any;
  ok(a1.value?.hyperlink === 'https://axos.local/office', 'ExcelJS export conserva hyperlink A1');
  ok(String(a1.note ?? '').includes('Revisar rango'), 'ExcelJS export conserva comment A1');
  ok((ws.getCell('A2') as any).value?.hyperlink === 'https://docs.axos.local', 'ExcelJS export conserva alias hyperlink');

  const sheetJsWb = XLSX.read(buf, { type: 'array', cellFormula: true, cellNF: true, cellStyles: true, cellHTML: false, cellText: true });
  const a1SheetJs = sheetJsWb.Sheets.Links.A1 as any;
  ok(a1SheetJs?.l?.Target === 'https://axos.local/office', 'SheetJS import ve hyperlink');
  ok(Array.isArray(a1SheetJs?.c) && a1SheetJs.c[0]?.t.includes('Revisar rango'), 'SheetJS import ve comment');

  const reimported: any[] = [{ name: 'Links', celldata: [{ r: 0, c: 0, v: { v: 'AXOS', m: 'AXOS', ct: { fa: 'General', t: 's' } } }] }];
  await readStylesIntoSheets(ExcelJS, buf, reimported);
  ok(reimported[0].celldata[0].v.hl === 'https://axos.local/office', 'readStylesIntoSheets fusiona hyperlink');
  ok(reimported[0].celldata[0].v.comment === 'Revisar rango', 'readStylesIntoSheets fusiona comment');

  const total = passed + fails.length;
  if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
  else console.log(`✅ ${passed}/${total}`);
})().catch((e) => { console.error(e); process.exit(1); });
