/* eslint-disable @typescript-eslint/no-explicit-any */
/** Spec de la exportación a texto plano. npx tsx src/components/office/docs/plainText.spec.ts */
import { tiptapJsonToPlainText } from '@/lib/office/markdown';

let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (a === b) passed++; else fails.push(`${m}\n     esp ${JSON.stringify(b)}\n     obt ${JSON.stringify(a)}`); };
const doc = (...content: any[]) => ({ type: 'doc', content });
const p = (...content: any[]) => ({ type: 'paragraph', content });
const t = (text: string, marks?: any[]) => ({ type: 'text', text, ...(marks ? { marks } : {}) });
const li = (...content: any[]) => ({ type: 'listItem', content });
const h1 = (s: string) => ({ type: 'heading', attrs: { level: 1 }, content: [t(s)] });

// Encabezado + párrafo: una línea en blanco entre bloques.
eq(tiptapJsonToPlainText(doc(h1('Título'), p(t('cuerpo')))), 'Título\n\ncuerpo\n', 'encabezado + párrafo');
// Las marcas se descartan, el texto se conserva.
eq(tiptapJsonToPlainText(doc(p(t('a'), t('b', [{ type: 'bold' }])))), 'ab\n', 'marcas descartadas');
// Listas con viñetas y anidación.
eq(tiptapJsonToPlainText(doc({ type: 'bulletList', content: [li(p(t('one'))), li(p(t('two')))] })), '• one\n• two\n', 'viñetas');
eq(
  tiptapJsonToPlainText(doc({ type: 'bulletList', content: [li(p(t('one')), { type: 'bulletList', content: [li(p(t('sub')))] })] })),
  '• one\n  • sub\n', 'viñetas anidadas',
);
// Lista ordenada.
eq(tiptapJsonToPlainText(doc({ type: 'orderedList', content: [li(p(t('a'))), li(p(t('b')))] })), '1. a\n2. b\n', 'ordenada');
// Bloque de código (literal).
eq(tiptapJsonToPlainText(doc({ type: 'codeBlock', content: [t('x = 1')] })), 'x = 1\n', 'bloque de código');
// Tabla → celdas separadas por tabulador.
{
  const cell = (s: string) => ({ type: 'tableCell', content: [p(t(s))] });
  const table = { type: 'table', content: [
    { type: 'tableRow', content: [cell('A'), cell('B')] },
    { type: 'tableRow', content: [cell('1'), cell('2')] },
  ] };
  eq(tiptapJsonToPlainText(doc(table)), 'A\tB\n1\t2\n', 'tabla con tabuladores');
}
// footnoteList no produce salida.
eq(tiptapJsonToPlainText(doc(p(t('a')), { type: 'footnoteList' })), 'a\n', 'footnoteList vacío');
// Documento vacío.
eq(tiptapJsonToPlainText(doc()), '\n', 'documento vacío');

console.log(`\nPLAIN TEXT SPEC: ${passed} OK, ${fails.length} fallos`);
if (fails.length) { for (const f of fails) console.error('  ✗ ' + f); throw new Error(`${fails.length} fallos`); }
console.log('✓ Todas las aserciones de texto plano pasan.');
