/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Round-trip COMPLETO de estilos .xlsx (cierra §109 en la lectura):
 *   cd apps/web && npx tsx src/lib/office/xlsxStyleImport.spec.ts
 * Fortune → writer ExcelJS (§109) → bytes → lectura de estilos (ExcelJS) → Fortune, y se confirma que
 * negrita/cursiva/color/fondo/alineación/formato sobreviven el viaje de ida y vuelta.
 */
import ExcelJS from 'exceljs';
import { argbToHex, fortuneStyleFromCell, styledXlsxBuffer, readStylesIntoSheets } from './xlsxStyled';

let passed = 0; const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };

// ── Helpers inversos ──
ok(argbToHex('FF1E3A8A') === '#1e3a8a', 'argbToHex FFRRGGBB → #rrggbb');
ok(argbToHex('00FF00') === '#00ff00', 'argbToHex RRGGBB');
ok(argbToHex(undefined) === null, 'argbToHex sin valor → null');
{ const st = fortuneStyleFromCell({ font: { bold: true, italic: true, size: 14, name: 'Arial', color: { argb: 'FFFF0000' } }, fill: { pattern: 'solid', fgColor: { argb: 'FF00FF00' } }, alignment: { horizontal: 'right', vertical: 'top', wrapText: true } });
  ok(st.bl === 1 && st.it === 1 && st.fs === 14 && st.ff === 'Arial' && st.fc === '#ff0000', 'font inverso');
  ok(st.bg === '#00ff00', 'fill inverso');
  ok(st.ht === 2 && st.vt === 1 && st.tb === 2, 'alineación inversa'); }
ok(Object.keys(fortuneStyleFromCell({})).length === 0, 'celda sin estilo → {}');

// ── Round-trip completo ──
const cell = (v: any, extra: any = {}) => ({ v, m: String(v ?? ''), ct: { fa: 'General', t: typeof v === 'number' ? 'n' : 's' }, ...extra });
const original = [{
  name: 'Datos',
  celldata: [
    { r: 0, c: 0, v: cell('Cabecera', { bl: 1, fc: '#ffffff', bg: '#1f6feb', ht: 0 }) },
    { r: 1, c: 0, v: cell('cursiva', { it: 1, fc: '#9c0006' }) },
    { r: 1, c: 1, v: { v: 99.5, m: '99.5', ct: { fa: '$#,##0.00', t: 'n' }, ht: 2 } },
  ],
}];

(async () => {
  const buf = await styledXlsxBuffer(ExcelJS, original as any);
  // Simula la importación: hojas con SÓLO valores (como las dejaría SheetJS), luego fusiona estilos.
  const imported = [{ name: 'Datos', celldata: [
    { r: 0, c: 0, v: { v: 'Cabecera', m: 'Cabecera', ct: { fa: 'General', t: 's' } } },
    { r: 1, c: 0, v: { v: 'cursiva', m: 'cursiva', ct: { fa: 'General', t: 's' } } },
    { r: 1, c: 1, v: { v: 99.5, m: '99.5', ct: { fa: 'General', t: 'n' } } },
  ] }];
  await readStylesIntoSheets(ExcelJS, buf, imported as any);

  const at = (r: number, c: number) => imported[0].celldata.find((x: any) => x.r === r && x.c === c)?.v as any;
  ok(at(0, 0).bl === 1, 'cabecera recupera negrita');
  ok(at(0, 0).bg === '#1f6feb', 'cabecera recupera fondo azul');
  ok(at(0, 0).fc === '#ffffff', 'cabecera recupera fuente blanca');
  ok(at(0, 0).ht === 0, 'cabecera recupera centrado');
  ok(at(1, 0).it === 1, 'fila recupera cursiva');
  ok(at(1, 0).fc === '#9c0006', 'fila recupera color de fuente');
  ok(at(1, 1).ct.fa === '$#,##0.00', 'recupera el formato de moneda');
  ok(at(1, 1).ht === 2, 'recupera alineación derecha');
  ok(at(1, 1).v === 99.5, 'el valor numérico se conserva (no se pisa)');

  const total = passed + fails.length;
  if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
  else console.log(`✅ ${passed}/${total}`);
})().catch((e) => { console.error(e); process.exit(1); });
