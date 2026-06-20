/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Spec de entrada de fórmulas de la hoja de cálculo.
 *   npx tsx src/components/office/sheets/sheetformula.spec.ts
 *
 * Cubre dos cosas:
 *  A) La normalización pura estilo Excel (`normalizeCellInput`/`isFormulaInput`):
 *     «=…» y los atajos «+…»/«-…» se vuelven fórmula; los números con signo y el
 *     texto quedan igual.
 *  B) Integración REAL con el motor de Fortune-Sheet (`@fortune-sheet/formula-parser`,
 *     el mismo que usa la rejilla): suma directa, referencia de celda, multiplicación
 *     con referencia, rango con SUM/AVERAGE/COUNT/MIN/MAX, IF, el atajo Lotus «+1+1»
 *     y el **recálculo en cascada** al cambiar una celda de la que dependen otras.
 */
import { normalizeCellInput, isFormulaInput } from '@/components/office/sheets/sheetFormula';
import * as FP from '@fortune-sheet/formula-parser';

let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };
const approx = (a: number, b: number, m: string) => { if (typeof a === 'number' && Math.abs(a - b) < 1e-9) passed++; else fails.push(`${m} — esp ≈${b}, obt ${JSON.stringify(a)}`); };

// ───────────────────────── A) Normalización pura ─────────────────────────
// Fórmulas explícitas con «=» (sin cambios).
eq(normalizeCellInput('=1+1'), '=1+1', '«=1+1» queda igual');
eq(normalizeCellInput('=A1+A2'), '=A1+A2', '«=A1+A2» queda igual');
eq(normalizeCellInput('=SUM(A1:A10)'), '=SUM(A1:A10)', '«=SUM(...)» queda igual');

// Atajo Lotus: «+»/«-» seguido de número/celda/función → fórmula.
eq(normalizeCellInput('+1+1'), '=+1+1', '«+1+1» → fórmula');
eq(normalizeCellInput('-1+1'), '=-1+1', '«-1+1» → fórmula');
eq(normalizeCellInput('+A1'), '=+A1', '«+A1» → fórmula');
eq(normalizeCellInput('-A1*2'), '=-A1*2', '«-A1*2» → fórmula');
eq(normalizeCellInput('+SUM(A1:A3)'), '=+SUM(A1:A3)', '«+SUM(...)» → fórmula');
eq(normalizeCellInput('-$B$2'), '=-$B$2', 'referencia absoluta con signo → fórmula');

// Número con signo suelto → NO es fórmula (es ese número).
eq(normalizeCellInput('-5'), '-5', '«-5» es número, no fórmula');
eq(normalizeCellInput('+3.14'), '+3.14', '«+3.14» es número');
eq(normalizeCellInput('-.5'), '-.5', '«-.5» es número');

// Texto / números normales → sin cambios.
eq(normalizeCellInput('Hola'), 'Hola', 'texto normal queda igual');
eq(normalizeCellInput('123'), '123', 'número sin signo queda igual');
eq(normalizeCellInput('-abc'), '-abc', '«-abc» (sin número/celda) queda como texto');
eq(normalizeCellInput('Datos!A1:A10'), 'Datos!A1:A10', 'referencia con hoja → texto literal');
eq(normalizeCellInput(''), '', 'cadena vacía queda igual');

// Predicado isFormulaInput.
ok(isFormulaInput('=1+1'), '=1+1 es fórmula');
ok(isFormulaInput('+1+1'), '+1+1 es fórmula');
ok(isFormulaInput('-A1*2'), '-A1*2 es fórmula');
ok(!isFormulaInput('-5'), '-5 NO es fórmula');
ok(!isFormulaInput('Hola'), 'texto NO es fórmula');
ok(!isFormulaInput('='), '«=» suelto NO es fórmula');

// ───────────────── B) Integración con el motor de Fortune-Sheet ─────────────────
const Parser: any = (FP as any).Parser ?? (FP as any).default?.Parser ?? (FP as any).default;
ok(typeof Parser === 'function', 'Parser de @fortune-sheet/formula-parser disponible');

// Rejilla de respaldo: A1=10, A2=5, A3=7, B1=4 (índices fila_columna base 0).
const grid: Record<string, number> = { '0_0': 10, '1_0': 5, '2_0': 7, '0_1': 4 };
const parser = new Parser();
parser.on('callCellValue', (coord: any, _opts: any, done: any) => done(grid[`${coord.row.index}_${coord.column.index}`] ?? 0));
parser.on('callRangeValue', (s: any, e: any, _opts: any, done: any) => {
  const out: number[][] = [];
  for (let r = s.row.index; r <= e.row.index; r++) {
    const row: number[] = [];
    for (let c = s.column.index; c <= e.column.index; c++) row.push(grid[`${r}_${c}`] ?? 0);
    out.push(row);
  }
  done(out);
});

// Evalúa una entrada cruda igual que lo haría la celda: normaliza y, si es fórmula,
// la entrega al motor (sin el «=» inicial, como hace Fortune-Sheet internamente).
function evalInput(input: string): any {
  const norm = normalizeCellInput(input);
  if (norm[0] === '=') {
    const res = parser.parse(norm.slice(1));
    return res.error ? res.error : res.result;
  }
  return norm;
}

// Suma directa.
eq(evalInput('=1+1'), 2, 'motor: =1+1 = 2');
// Referencia de celda.
eq(evalInput('=A1+A2'), 15, 'motor: =A1+A2 = 15');
// Multiplicación con referencias.
eq(evalInput('=A1*B1'), 40, 'motor: =A1*B1 = 40');
// Rango con SUM y demás agregaciones imprescindibles.
eq(evalInput('=SUM(A1:A3)'), 22, 'motor: =SUM(A1:A3) = 22');
approx(evalInput('=AVERAGE(A1:A3)'), 22 / 3, 'motor: =AVERAGE(A1:A3) ≈ 7.333');
eq(evalInput('=COUNT(A1:A3)'), 3, 'motor: =COUNT(A1:A3) = 3');
eq(evalInput('=MIN(A1:A3)'), 5, 'motor: =MIN(A1:A3) = 5');
eq(evalInput('=MAX(A1:A3)'), 10, 'motor: =MAX(A1:A3) = 10');
// Lógica.
eq(evalInput('=IF(A1>A2,1,0)'), 1, 'motor: =IF(A1>A2,1,0) = 1');
// Atajo Lotus normalizado → el motor lo calcula.
eq(evalInput('+1+1'), 2, 'motor: +1+1 (normalizado) = 2');
eq(evalInput('-1+1'), 0, 'motor: -1+1 (normalizado) = 0');

// Recálculo en cascada: cambiar A1 cambia todo lo que depende de A1.
grid['0_0'] = 100; // A1 = 100
eq(evalInput('=A1+A2'), 105, 'cascada: tras A1=100, =A1+A2 = 105');
eq(evalInput('=SUM(A1:A3)'), 112, 'cascada: tras A1=100, =SUM(A1:A3) = 112');
eq(evalInput('=A1*B1'), 400, 'cascada: tras A1=100, =A1*B1 = 400');

console.log(`\nSHEET-FORMULA SPEC: ${passed} OK, ${fails.length} fallos`);
if (fails.length) { for (const f of fails) console.error('  ✗ ' + f); throw new Error(`${fails.length} fallos`); }
console.log('✓ Todas las aserciones de entrada/evaluación de fórmulas pasan.');
