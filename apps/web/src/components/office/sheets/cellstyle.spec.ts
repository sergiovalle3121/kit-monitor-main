/* eslint-disable @typescript-eslint/no-explicit-any */
/** Spec de applyCellStyle. cd apps/web && npx tsx src/components/office/sheets/cellstyle.spec.ts */
import { applyCellStyle, CELL_STYLES } from '@/lib/office/sheetOps';

let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };

const cellAt = (sheet: any, r: number, c: number) => sheet.celldata.find((x: any) => x.r === r && x.c === c);

// Aplica un preset «Malo» a A1 (celda existente) y A2 (vacía → se crea).
{
  const sheet: any = { celldata: [{ r: 0, c: 0, v: { v: 5, m: '5', ct: { fa: 'General', t: 'n' } } }] };
  const bad = CELL_STYLES.find((s) => s.id === 'bad')!.style;
  const n = applyCellStyle(sheet, 'A1:A2', bad);
  eq(n, 2, 'aplica a 2 celdas (1 existente + 1 creada)');
  eq(cellAt(sheet, 0, 0).v.bg, '#ffc7ce', 'A1 bg malo');
  eq(cellAt(sheet, 0, 0).v.fc, '#9c0006', 'A1 fc malo');
  ok(!!cellAt(sheet, 1, 0), 'A2 creada para el estilo');
}

// Alineación derecha → ht=2; ajustar texto → tb=2.
{
  const sheet: any = { celldata: [{ r: 0, c: 0, v: { v: 'x', m: 'x', ct: { fa: 'General', t: 's' } } }] };
  applyCellStyle(sheet, 'A1', { align: 'right' });
  eq(cellAt(sheet, 0, 0).v.ht, 2, 'align right → ht 2');
  applyCellStyle(sheet, 'A1', { wrap: true });
  eq(cellAt(sheet, 0, 0).v.tb, 2, 'wrap → tb 2');
}

// Normal (clear) elimina estilos.
{
  const sheet: any = { celldata: [{ r: 0, c: 0, v: { v: 'x', m: 'x', bg: '#fff', fc: '#000', bl: 1, ct: { fa: 'General', t: 's' } } }] };
  applyCellStyle(sheet, 'A1', { clear: true });
  const v = cellAt(sheet, 0, 0).v;
  ok(v.bg === undefined && v.fc === undefined && v.bl === undefined, 'clear elimina bg/fc/bl');
}

// Rango enorme no crea celdas vacías (solo estila las existentes).
{
  const sheet: any = { celldata: [{ r: 0, c: 0, v: { v: 1, m: '1', ct: { fa: 'General', t: 'n' } } }] };
  const n = applyCellStyle(sheet, 'A1:CZ1000', { bg: '#eee' }); // 104*1000 > 4000
  eq(n, 1, 'rango enorme solo estila la celda existente');
  eq(sheet.celldata.length, 1, 'no infla el modelo');
}

console.log(`\nCELLSTYLE SPEC: ${passed} OK, ${fails.length} fallos`);
if (fails.length) { for (const f of fails) console.error('  ✗ ' + f); throw new Error(`${fails.length} fallos`); }
console.log('✓ Todas las aserciones de estilos de celda pasan.');
