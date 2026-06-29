/* eslint-disable @typescript-eslint/no-explicit-any */
/** Spec del generador de impresión. npx tsx src/components/office/sheets/print.spec.ts */
import { buildPrintHtml } from '@/lib/office/sheetOps';

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

console.log(`\nPRINT SPEC: ${passed} OK, ${fails.length} fallos`);
if (fails.length) { for (const f of fails) console.error('  ✗ ' + f); throw new Error(`${fails.length} fallos`); }
console.log('✓ Todas las aserciones de impresión pasan.');
