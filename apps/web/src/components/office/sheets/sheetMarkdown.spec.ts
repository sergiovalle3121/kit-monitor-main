/* eslint-disable @typescript-eslint/no-explicit-any */
/** Spec de exportación de rango a Markdown. npx tsx src/components/office/sheets/sheetMarkdown.spec.ts */
import { gridToMarkdownTable, rangeValues, rangeToMarkdown } from '@/lib/office/sheetMarkdown';

let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (a === b) passed++; else fails.push(`${m}\n     esp ${JSON.stringify(b)}\n     obt ${JSON.stringify(a)}`); };
const eqj = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

// gridToMarkdownTable: encabezado por defecto.
eq(gridToMarkdownTable([['A', 'B'], ['1', '2']]), '| A | B |\n| --- | --- |\n| 1 | 2 |', 'tabla básica');
// Varias filas de cuerpo.
eq(gridToMarkdownTable([['H'], ['a'], ['b']]), '| H |\n| --- |\n| a |\n| b |', 'una columna, dos filas');
// Sin encabezado → cabecera vacía (GFM la exige).
eq(gridToMarkdownTable([['1', '2']], { header: false }), '|  |  |\n| --- | --- |\n| 1 | 2 |', 'sin encabezado');
// Rellena filas cortas.
eq(gridToMarkdownTable([['A', 'B', 'C'], ['1', '2']]), '| A | B | C |\n| --- | --- | --- |\n| 1 | 2 |  |', 'rellena fila corta');
// Escapa la barra vertical y los saltos de línea.
eq(gridToMarkdownTable([['a|b', 'c\nd']]), '| a\\|b | c d |\n| --- | --- |', 'escapa | y colapsa salto');
// Vacío.
eq(gridToMarkdownTable([]), '', 'sin filas → cadena vacía');

// rangeValues sobre un celldata simulado.
const cell = (r: number, c: number, m: string) => ({ r, c, v: { v: m, m, ct: { fa: 'General', t: 's' } } });
const sheet: any = { celldata: [
  cell(0, 0, 'Región'), cell(0, 1, 'Ventas'),
  cell(1, 0, 'Norte'), cell(1, 1, '100'),
  cell(2, 0, 'Sur'), /* B3 vacío */
] };
eqj(rangeValues(sheet, 'A1:B3'), [['Región', 'Ventas'], ['Norte', '100'], ['Sur', '']], 'rangeValues con hueco vacío');
eqj(rangeValues(sheet, 'Z9'), [['']], 'celda fuera de datos → vacía');

// rangeToMarkdown extremo a extremo.
eq(rangeToMarkdown(sheet, 'A1:B2'), '| Región | Ventas |\n| --- | --- |\n| Norte | 100 |', 'rango → Markdown');

console.log(`\nSHEET MARKDOWN SPEC: ${passed} OK, ${fails.length} fallos`);
if (fails.length) { for (const f of fails) console.error('  ✗ ' + f); throw new Error(`${fails.length} fallos`); }
console.log('✓ Todas las aserciones de exportación a Markdown pasan.');
