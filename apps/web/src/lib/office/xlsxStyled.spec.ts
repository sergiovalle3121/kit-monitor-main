/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Golden round-trip del writer .xlsx con estilos (ExcelJS):
 *   cd apps/web && npx tsx src/lib/office/xlsxStyled.spec.ts
 * Construye un libro con estilos, lo escribe a bytes reales y lo REABRE con ExcelJS para confirmar
 * que fuente/relleno/alineación/formato-de-número/combinación/ancho/fórmula/nombres SÍ viajan al .xlsx
 * (lo que SheetJS comunitario NO hacía).
 */
import ExcelJS from 'exceljs';
import { toArgb, cellStyle, styledXlsxBuffer } from './xlsxStyled';

let passed = 0; const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };

// ── Helpers puros ──
ok(toArgb('#1e3a8a') === 'FF1E3A8A', 'toArgb #rrggbb → FFRRGGBB');
ok(toArgb('00FF00') === 'FF00FF00', 'toArgb sin # ');
ok(toArgb('FF112233') === 'FF112233', 'toArgb argb tal cual');
ok(toArgb('rojo') === null, 'toArgb inválido → null');
{ const s = cellStyle({ bl: 1, it: 1, un: 1, cl: 1, fs: 14, ff: 'Arial', fc: '#ff0000', bg: '#00ff00', ht: 2, vt: 1, tb: 2 });
  ok(s.font.bold && s.font.italic && s.font.underline && s.font.strike, 'font flags');
  ok(s.font.size === 14 && s.font.name === 'Arial' && s.font.color.argb === 'FFFF0000', 'font size/name/color');
  ok(s.fill.pattern === 'solid' && s.fill.fgColor.argb === 'FF00FF00', 'fill sólido');
  ok(s.alignment.horizontal === 'right' && s.alignment.vertical === 'top' && s.alignment.wrapText === true, 'alineación'); }
ok(Object.keys(cellStyle(undefined)).length === 0, 'celda sin estilo → {}');

// ── Documento de prueba con estilos + layout + fórmula ──
const cell = (v: any, extra: any = {}) => ({ v, m: String(v ?? ''), ct: { fa: 'General', t: typeof v === 'number' ? 'n' : 's' }, ...extra });
const sheets = [{
  name: 'Reporte',
  celldata: [
    { r: 0, c: 0, v: cell('Mes', { bl: 1, fc: '#ffffff', bg: '#1f6feb', ht: 0 }) },
    { r: 0, c: 1, v: cell('Importe', { bl: 1, fc: '#ffffff', bg: '#1f6feb', ht: 2 }) },
    { r: 1, c: 0, v: cell('Enero') },
    { r: 1, c: 1, v: { v: 1234.5, m: '1234.5', ct: { fa: '$#,##0.00', t: 'n' } } },
    { r: 2, c: 0, v: cell('Total', { bl: 1, bg: '#f1f5f9' }) },
    { r: 2, c: 1, v: { f: '=SUM(B2:B2)', v: 1234.5, m: '1234.5', ct: { fa: '$#,##0.00', t: 'n' }, bl: 1 } },
  ],
  config: { columnlen: { 0: 120, 1: 96 }, rowlen: { 0: 28 }, merge: { '3_0': { r: 3, c: 0, rs: 1, cs: 2 } } },
}];

(async () => {
  const buf = await styledXlsxBuffer(ExcelJS, sheets as any);
  ok(buf.byteLength > 0, 'genera bytes');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  const ws = wb.getWorksheet('Reporte');
  ok(!!ws, 'la hoja "Reporte" existe');

  const a1 = ws!.getCell('A1');
  ok(a1.value === 'Mes', 'A1 valor');
  ok((a1.font as any)?.bold === true, 'A1 negrita');
  ok((a1.fill as any)?.fgColor?.argb === 'FF1F6FEB', 'A1 relleno azul');
  ok((a1.font as any)?.color?.argb === 'FFFFFFFF', 'A1 fuente blanca');
  ok((a1.alignment as any)?.horizontal === 'center', 'A1 centrado');

  const b2 = ws!.getCell('B2');
  ok(b2.value === 1234.5, 'B2 número');
  ok(b2.numFmt === '$#,##0.00', 'B2 formato de moneda');

  const b3 = ws!.getCell('B3');
  ok(!!(b3.value as any)?.formula, 'B3 conserva la fórmula');
  ok((b3.font as any)?.bold === true, 'B3 negrita');

  ok(Math.abs((ws!.getColumn(1).width ?? 0) - (120 - 5) / 7) < 0.1, 'ancho de columna A');
  ok(!!ws!.getCell('A4').isMerged, 'A4:B4 combinada');

  const total = passed + fails.length;
  if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
  else console.log(`✅ ${passed}/${total}`);
})().catch((e) => { console.error(e); process.exit(1); });
