/* eslint-disable @typescript-eslint/no-explicit-any */
/** Spec del generador de impresión. npx tsx src/components/office/sheets/print.spec.ts */
import { analyzeSheetPrintReadiness, buildPrintHtml } from '@/lib/office/sheetOps';

let passed = 0; const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };

const cell = (r: number, c: number, v: any, extra: any = {}) => ({ r, c, v: { v, m: String(v), ct: { fa: 'General', t: typeof v === 'number' ? 'n' : 's' }, ...extra } });
const sheet: any = { celldata: [
  cell(0, 0, '<b>Hi</b>'), cell(0, 1, 5, { bg: '#ff0000' }),
  cell(1, 0, 'x'), cell(9, 3, 'fuera'),
] };

const html = buildPrintHtml(sheet, { range: 'A1:B2', title: 'Informe', orientation: 'landscape', paperSize: 'Letter', header: 'Cab', fitToPage: true });
ok(html.includes('&lt;b&gt;Hi&lt;/b&gt;'), 'escapa HTML de las celdas');
ok(html.includes('<h1>Informe</h1>'), 'incluye título');
ok(html.includes('Cab'), 'incluye encabezado');
ok(html.includes('Letter landscape'), 'papel carta con orientación horizontal');
ok(html.includes('background:#ff0000'), 'aplica color de fondo');
ok(html.includes('>5<'), 'incluye valor numérico');
ok(html.includes('text-align:right'), 'números alineados a la derecha');
ok(html.includes('width:100%'), 'ajuste a página activa ancho completo');
ok(!html.includes('fuera'), 'excluye celdas fuera del rango');

// Sin rango → usa el área usada (incluye D10 "fuera").
ok(buildPrintHtml(sheet, {}).includes('fuera'), 'sin rango usa el área usada');

const ready = analyzeSheetPrintReadiness(sheet, {
  orientation: 'landscape', paperSize: 'Letter', printArea: 'A1:D10', fitToWidth: true, fitToPage: false, showGridlines: false,
}, { title: 'Informe', footer: 'Rev A' });
ok(ready.status === 'ready', 'layout controlado queda listo para imprimir');
ok(ready.score === 100, 'layout listo conserva score perfecto');

const omitted = analyzeSheetPrintReadiness(sheet, {
  orientation: 'portrait', paperSize: 'A4', printArea: 'A1:B2', fitToWidth: false, fitToPage: false, showGridlines: true,
}, { title: 'Informe' });
ok(omitted.status === 'review', 'celdas omitidas dejan el reporte en revision');
ok(omitted.issues.some((issue) => issue.key === 'omitted-cells' && issue.count === 1), 'detecta celdas pobladas fuera del area');
ok(omitted.issues.some((issue) => issue.key === 'missing-footer'), 'advierte pie faltante para reporte controlado');

const invalid = analyzeSheetPrintReadiness(null, {
  orientation: 'portrait', paperSize: 'A4', printArea: 'Nope', fitToWidth: false, fitToPage: false, showGridlines: true,
}, { usedRange: 'A1:B2' });
ok(invalid.status === 'blocked', 'area invalida bloquea readiness');

const errorSheet: any = { celldata: [cell(0, 0, '#REF!'), cell(0, 1, 'ok')] };
const blocked = analyzeSheetPrintReadiness(errorSheet, {
  orientation: 'landscape', paperSize: 'A4', printArea: 'A1:B1', fitToWidth: true, fitToPage: false, showGridlines: false,
}, { title: 'Informe', footer: 'Rev A' });
ok(blocked.status === 'blocked', 'errores de formula bloquean el reporte');
ok(blocked.issues.some((issue) => issue.key === 'formula-errors' && issue.count === 1), 'cuenta errores en area de impresion');

console.log(`\nPRINT SPEC: ${passed} OK, ${fails.length} fallos`);
if (fails.length) { for (const f of fails) console.error('  ✗ ' + f); throw new Error(`${fails.length} fallos`); }
console.log('✓ Todas las aserciones de impresión pasan.');
