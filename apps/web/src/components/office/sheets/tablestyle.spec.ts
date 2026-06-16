/* eslint-disable @typescript-eslint/no-explicit-any */
/** Spec de «dar formato como tabla» (encabezado, bandas, autofiltro, bordes). npx tsx … */
import { applyTableStyle, TABLE_STYLES } from '@/lib/office/sheetOps';

let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (a === b) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };
const cell = (r: number, c: number, v: any) => ({ r, c, v: { v, m: String(v), ct: { fa: 'General', t: typeof v === 'number' ? 'n' : 's' } } });
const at = (sheet: any, r: number, c: number) => sheet.celldata.find((x: any) => x.r === r && x.c === c)?.v;

// ── Encabezado + bandas + autofiltro + bordes ────────────────────────────────
{
  const sheet: any = { celldata: [
    cell(0, 0, 'Nombre'), cell(0, 1, 'Valor'),
    cell(1, 0, 'A'), cell(1, 1, 1),
    cell(2, 0, 'B'), cell(2, 1, 2),
    cell(3, 0, 'C'), cell(3, 1, 3),
  ], config: {} };
  const n = applyTableStyle(sheet, { range: 'A1:B4', headerBg: '#2563eb', headerFc: '#ffffff', band1: '#ffffff', band2: '#eff6ff' });
  eq(n, 8, '8 celdas con estilo');
  // Encabezado
  eq(at(sheet, 0, 0).bg, '#2563eb', 'encabezado con relleno');
  eq(at(sheet, 0, 0).fc, '#ffffff', 'encabezado texto blanco');
  eq(at(sheet, 0, 0).bl, 1, 'encabezado en negrita');
  // Bandas: primera fila de datos (idx 0) = band1, segunda (idx 1) = band2
  eq(at(sheet, 1, 0).bg, '#ffffff', 'fila datos 1 → banda 1');
  eq(at(sheet, 2, 0).bg, '#eff6ff', 'fila datos 2 → banda 2');
  eq(at(sheet, 3, 0).bg, '#ffffff', 'fila datos 3 → banda 1');
  ok(at(sheet, 1, 0).bl === 0, 'filas de datos sin negrita');
  // Autofiltro + bordes
  eq(sheet.filter_select.row[0], 0, 'autofiltro empieza en fila 0');
  eq(sheet.filter_select.column[1], 1, 'autofiltro hasta col 1');
  ok(sheet.filter != null, 'filtro inicializado');
  eq(sheet.config.borderInfo.length, 1, 'un bloque de bordes');
  eq(sheet.config.borderInfo[0].borderType, 'border-all', 'borde en toda la tabla');
}

// ── Sin encabezado, sin bandas, sin filtro, sin bordes ───────────────────────
{
  const sheet: any = { celldata: [cell(0, 0, 1), cell(1, 0, 2)], config: {} };
  applyTableStyle(sheet, { range: 'A1:A2', hasHeader: false, banded: false, withFilter: false, withBorders: false, band1: '#fafafa' });
  eq(at(sheet, 0, 0).bg, '#fafafa', 'sin bandas → relleno uniforme');
  eq(at(sheet, 1, 0).bg, '#fafafa', 'sin bandas → relleno uniforme (2)');
  ok(sheet.filter_select == null, 'sin autofiltro');
  ok(sheet.config.borderInfo == null, 'sin bordes');
}

// ── Fila de totales ──────────────────────────────────────────────────────────
{
  const sheet: any = { celldata: [
    cell(0, 0, 'H'), cell(1, 0, 10), cell(2, 0, 20), cell(3, 0, 30),
  ], config: {} };
  applyTableStyle(sheet, { range: 'A1:A4', totalRow: true });
  eq(at(sheet, 3, 0).bl, 1, 'última fila (totales) en negrita');
}

// ── Crea celdas vacías para bandas continuas ─────────────────────────────────
{
  const sheet: any = { celldata: [cell(0, 0, 'X')], config: {} }; // solo una celda
  applyTableStyle(sheet, { range: 'A1:B3', hasHeader: true });
  ok(at(sheet, 2, 1) != null, 'se crean celdas vacías para el estilo');
}

// ── Galería de estilos ───────────────────────────────────────────────────────
ok(TABLE_STYLES.length >= 4 && TABLE_STYLES.every((s) => !!s.headerBg && !!s.band2), 'galería de estilos válida');

console.log(`\nTABLESTYLE SPEC: ${passed} OK, ${fails.length} fallos`);
if (fails.length) { for (const f of fails) console.error('  ✗ ' + f); throw new Error(`${fails.length} fallos`); }
console.log('✓ Todas las aserciones de formato como tabla pasan.');
