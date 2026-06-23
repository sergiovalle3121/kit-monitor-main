/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría de las funciones MODERNAS (matrices dinámicas + texto) contra el motor REAL
 * (`@fortune-sheet/formula-parser` con el parche instalado), igual que `formulaEngine.spec.ts`:
 *   cd apps/web && npx tsx src/components/office/sheets/modernFunctions.spec.ts
 *
 * Verifica (1) la semántica pura de cada función y (2) que el parser las resuelve y que
 * COMPONEN dentro de SUM/COUNT/INDEX/TEXTJOIN — el patrón realista mientras no haya spilling.
 */
import * as FP from '@fortune-sheet/formula-parser';
import {
  installFormulaEngine,
} from './formulaEngine';
import {
  UNIQUE, SORT, SORTBY, FILTER, SEQUENCE, TAKE, DROP, TRANSPOSE,
  TEXTBEFORE, TEXTAFTER, TEXTSPLIT, ARRAYTOTEXT, VALUETOTEXT,
  VSTACK, HSTACK, TOCOL, TOROW, CHOOSEROWS, CHOOSECOLS, EXPAND, WRAPROWS, WRAPCOLS,
  REGEXTEST, REGEXREPLACE, REGEXEXTRACT,
} from './modernFunctions';

installFormulaEngine();

let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };

const Parser: any = (FP as any).Parser;

// Hoja de datos (fila_columna, base 0):
//   A: 30,10,20,10,30   B: "b","a","c","a","b"   C(máscara): 1,0,1,0,1
const grid: Record<string, any> = {
  '0_0': 30, '1_0': 10, '2_0': 20, '3_0': 10, '4_0': 30,
  '0_1': 'b', '1_1': 'a', '2_1': 'c', '3_1': 'a', '4_1': 'b',
  '0_2': 1, '1_2': 0, '2_2': 1, '3_2': 0, '4_2': 1,
};
const parser = new Parser();
parser.on('callCellValue', (coord: any, _o: any, done: any) => done(grid[`${coord.row.index}_${coord.column.index}`] ?? 0));
parser.on('callRangeValue', (s: any, e: any, _o: any, done: any) => {
  const out: any[][] = [];
  for (let r = s.row.index; r <= e.row.index; r++) { const row: any[] = []; for (let c = s.column.index; c <= e.column.index; c++) row.push(grid[`${r}_${c}`] ?? null); out.push(row); }
  done(out);
});
function ev(f: string): any { const r = parser.parse(f.replace(/^=/, '')); return r.error ? r.error : r.result; }

// ───────────────────────── UNIQUE ─────────────────────────
eq(UNIQUE([[[30], [10], [20], [10], [30]]]), [[30], [10], [20]], 'UNIQUE columna dedup');
eq(UNIQUE([[['B'], ['a'], ['b'], ['A']]]), [['B'], ['a']], 'UNIQUE case-insensitive (primera aparición)');
eq(UNIQUE([[[30], [10], [20], [10], [30]], false, true]), [[20]], 'UNIQUE solo_una_vez');
eq(UNIQUE([[[1, 2], [1, 2], [3, 4]]]), [[1, 2], [3, 4]], 'UNIQUE por filas (multi-col)');
eq(UNIQUE([[[1, 1, 2]], true]), [[1, 2]], 'UNIQUE por columnas');

// ───────────────────────── SORT / SORTBY ─────────────────────────
eq(SORT([[[30], [10], [20]]]), [[10], [20], [30]], 'SORT asc');
eq(SORT([[[30], [10], [20]], 1, -1]), [[30], [20], [10]], 'SORT desc');
eq(SORT([[['b'], ['a'], ['c']]]), [['a'], ['b'], ['c']], 'SORT texto');
eq(SORT([[[2, 'b'], [1, 'a'], [3, 'c']], 1, -1]), [[3, 'c'], [2, 'b'], [1, 'a']], 'SORT por col 1 desc');
eq(SORTBY([[['x'], ['y'], ['z']], [3, 1, 2]]), [['y'], ['z'], ['x']], 'SORTBY vector externo');
eq(SORTBY([[['x'], ['y'], ['z']], [3, 1, 2], -1]), [['x'], ['z'], ['y']], 'SORTBY desc');

// ───────────────────────── FILTER ─────────────────────────
eq(FILTER([[[10], [20], [30]], [1, 0, 1]]), [[10], [30]], 'FILTER por máscara');
eq(FILTER([[[10], [20]], [0, 0], 'nada']), 'nada', 'FILTER vacío → si_vacío');
eq(FILTER([[[10], [20]], [0, 0]]), '#CALC!', 'FILTER vacío → #CALC!');
eq(FILTER([[[1, 2, 3]], [true, false, true]]), [[1, 3]], 'FILTER por columnas (fila única)');

// ───────────────────────── SEQUENCE ─────────────────────────
eq(SEQUENCE([3]), [[1], [2], [3]], 'SEQUENCE columna');
eq(SEQUENCE([2, 3]), [[1, 2, 3], [4, 5, 6]], 'SEQUENCE 2x3');
eq(SEQUENCE([2, 2, 10, 5]), [[10, 15], [20, 25]], 'SEQUENCE inicio/paso');

// ───────────────────────── TAKE / DROP / TRANSPOSE ─────────────────────────
eq(TAKE([[[1], [2], [3], [4]], 2]), [[1], [2]], 'TAKE primeras 2');
eq(TAKE([[[1], [2], [3], [4]], -1]), [[4]], 'TAKE última');
eq(TAKE([[[1, 2, 3]], '', 2]), [[1, 2]], 'TAKE 2 columnas');
eq(DROP([[[1], [2], [3], [4]], 1]), [[2], [3], [4]], 'DROP primera');
eq(DROP([[[1], [2], [3], [4]], -2]), [[1], [2]], 'DROP 2 del final');
eq(TRANSPOSE([[[1, 2, 3]]]), [[1], [2], [3]], 'TRANSPOSE fila→columna');
eq(TRANSPOSE([[[1, 2], [3, 4]]]), [[1, 3], [2, 4]], 'TRANSPOSE 2x2');

// ───────────────────────── TEXTBEFORE / TEXTAFTER ─────────────────────────
eq(TEXTBEFORE(['rojo-verde-azul', '-']), 'rojo', 'TEXTBEFORE primera');
eq(TEXTBEFORE(['rojo-verde-azul', '-', 2]), 'rojo-verde', 'TEXTBEFORE instancia 2');
eq(TEXTBEFORE(['rojo-verde-azul', '-', -1]), 'rojo-verde', 'TEXTBEFORE desde el final');
eq(TEXTAFTER(['rojo-verde-azul', '-']), 'verde-azul', 'TEXTAFTER primera');
eq(TEXTAFTER(['rojo-verde-azul', '-', -1]), 'azul', 'TEXTAFTER última');
eq(TEXTAFTER(['user@dominio.com', '@']), 'dominio.com', 'TEXTAFTER email');
eq(TEXTBEFORE(['sin', '-', 1, 0, 0, 's/d']), 's/d', 'TEXTBEFORE no encontrado → si_no_existe');
eq(TEXTBEFORE(['aXbYc', ['X', 'Y'], 2]), 'aXb', 'TEXTBEFORE múltiples delimitadores');

// ───────────────────────── TEXTSPLIT ─────────────────────────
eq(TEXTSPLIT(['a,b,c', ',']), [['a', 'b', 'c']], 'TEXTSPLIT por comas');
eq(TEXTSPLIT(['a,b;c,d', ',', ';']), [['a', 'b'], ['c', 'd']], 'TEXTSPLIT filas y columnas');
eq(TEXTSPLIT(['a,,c', ',', '', true]), [['a', 'c']], 'TEXTSPLIT ignorar vacíos');

// ───────────────────────── ARRAYTOTEXT / VALUETOTEXT ─────────────────────────
eq(ARRAYTOTEXT([[[1, 2], [3, 4]]]), '1, 2, 3, 4', 'ARRAYTOTEXT conciso');
eq(ARRAYTOTEXT([[['a'], ['b']], 1]), '{"a";"b"}', 'ARRAYTOTEXT estricto');
eq(VALUETOTEXT(['hola', 1]), '"hola"', 'VALUETOTEXT estricto');
eq(VALUETOTEXT([42]), '42', 'VALUETOTEXT número');

// ───────────────────────── VSTACK / HSTACK ─────────────────────────
eq(VSTACK([[[1], [2]], [[3]]]), [[1], [2], [3]], 'VSTACK columnas');
eq(VSTACK([[[1, 2]], [[3, 4], [5, 6]]]), [[1, 2], [3, 4], [5, 6]], 'VSTACK matrices');
eq(VSTACK([[[1, 2]], [[3]]]), [[1, 2], [3, '#N/A']], 'VSTACK rellena columnas faltantes');
eq(HSTACK([[[1], [2]], [[3], [4]]]), [[1, 3], [2, 4]], 'HSTACK columnas');
eq(HSTACK([[[1], [2]], [[3]]]), [[1, 3], [2, '#N/A']], 'HSTACK rellena filas faltantes');

// ───────────────────────── TOCOL / TOROW ─────────────────────────
eq(TOCOL([[[1, 2], [3, 4]]]), [[1], [2], [3], [4]], 'TOCOL por filas');
eq(TOROW([[[1, 2], [3, 4]]]), [[1, 2, 3, 4]], 'TOROW por filas');
eq(TOROW([[[1, 2], [3, 4]], 0, true]), [[1, 3, 2, 4]], 'TOROW por columnas');
eq(TOCOL([[[1, null], ['', 4]], 1]), [[1], [4]], 'TOCOL ignora vacíos');

// ───────────────────────── CHOOSEROWS / CHOOSECOLS / EXPAND / WRAP ─────────────────────────
eq(CHOOSEROWS([[[1, 2], [3, 4], [5, 6]], 1, 3]), [[1, 2], [5, 6]], 'CHOOSEROWS 1 y 3');
eq(CHOOSEROWS([[[1], [2], [3]], -1]), [[3]], 'CHOOSEROWS última');
eq(CHOOSECOLS([[[1, 2, 3], [4, 5, 6]], 1, 3]), [[1, 3], [4, 6]], 'CHOOSECOLS 1 y 3');
eq(EXPAND([[[1, 2]], 2, 3, 0]), [[1, 2, 0], [0, 0, 0]], 'EXPAND con relleno 0');
eq(WRAPROWS([[1, 2, 3, 4, 5], 2, 'x']), [[1, 2], [3, 4], [5, 'x']], 'WRAPROWS ancho 2');
eq(WRAPCOLS([[1, 2, 3, 4, 5], 2, 'x']), [[1, 3, 5], [2, 4, 'x']], 'WRAPCOLS alto 2');

// ───────────────────────── REGEX ─────────────────────────
eq(REGEXTEST(['abc123', '\\d+']), true, 'REGEXTEST dígitos');
eq(REGEXTEST(['abcdef', '\\d+']), false, 'REGEXTEST sin dígitos');
eq(REGEXTEST(['ABC', 'abc', 1]), true, 'REGEXTEST case-insensitive');
eq(REGEXEXTRACT(['pedido 42 de 7', '\\d+']), '42', 'REGEXEXTRACT primera');
eq(REGEXEXTRACT(['a1 b2 c3', '\\d', 1]), [['1'], ['2'], ['3']], 'REGEXEXTRACT todas (columna)');
eq(REGEXEXTRACT(['2026-06-22', '(\\d+)-(\\d+)-(\\d+)', 2]), [['2026', '06', '22']], 'REGEXEXTRACT grupos (fila)');
eq(REGEXREPLACE(['a1b2c3', '\\d', '#']), 'a#b#c#', 'REGEXREPLACE todas');
eq(REGEXREPLACE(['a1b2c3', '\\d', '#', 2]), 'a1b#c3', 'REGEXREPLACE 2ª ocurrencia');
eq(REGEXREPLACE(['John Smith', '(\\w+)\\s(\\w+)', '$2 $1']), 'Smith John', 'REGEXREPLACE con grupos');

// ───────────────────────── Integración: el MOTOR REAL las resuelve y COMPONEN ─────────────────────────
eq(ev('=SUM(FILTER(A1:A5,C1:C5))'), 80, 'motor: SUM(FILTER(A,máscara)) = 30+20+30');
eq(ev('=COUNT(UNIQUE(A1:A5))'), 3, 'motor: COUNT(UNIQUE) = 3 distintos');
eq(ev('=INDEX(SORT(A1:A5),1)'), 10, 'motor: INDEX(SORT,1) = mínimo');
eq(ev('=INDEX(SORT(A1:A5,1,-1),1)'), 30, 'motor: INDEX(SORT desc,1) = máximo');
eq(ev('=TEXTJOIN("-",TRUE,UNIQUE(B1:B5))'), 'b-a-c', 'motor: TEXTJOIN(UNIQUE(texto))');
eq(ev('=SUM(SEQUENCE(5))'), 15, 'motor: SUM(SEQUENCE(5)) = 1..5');
eq(ev('=SUM(TAKE(A1:A5,2))'), 40, 'motor: SUM(TAKE 2) = 30+10');
eq(ev('=TEXTBEFORE("a-b-c","-",2)'), 'a-b', 'motor: TEXTBEFORE');
eq(ev('=SUM(FILTER(A1:A5,C1:C5))+1'), 81, 'motor: arithmetic sobre array-fn');
ok(typeof ev('=SORT(A1:A5)') !== 'string' || !String(ev('=SORT(A1:A5)')).startsWith('#'), 'motor: SORT no es error');
eq(ev('=SUM(VSTACK(A1:A2,A4:A5))'), 80, 'motor: SUM(VSTACK) = 30+10+10+30');
eq(ev('=COUNTA(TOCOL(A1:B2))'), 4, 'motor: COUNTA(TOCOL(A1:B2))');
eq(ev('=INDEX(CHOOSEROWS(A1:A5,2),1)'), 10, 'motor: INDEX(CHOOSEROWS,2)');
eq(ev('=REGEXEXTRACT("orden #9001","\\d+")'), '9001', 'motor: REGEXEXTRACT');
eq(ev('=REGEXREPLACE("a-b-c","-","_")'), 'a_b_c', 'motor: REGEXREPLACE');
eq(ev('=SUM(TOCOL(SEQUENCE(2,2)))'), 10, 'motor: SUM(TOCOL(SEQUENCE 2x2)) = 1+2+3+4');

// ───────────────────────── Resumen ─────────────────────────
const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ modernFunctions: ${passed}/${total} aserciones verdes.`);
