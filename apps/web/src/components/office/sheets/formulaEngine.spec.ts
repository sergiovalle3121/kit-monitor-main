/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría del motor de fórmulas REAL de la hoja (el mismo `@fortune-sheet/formula-parser`
 * que usa la rejilla), con nuestro parche instalado:
 *   cd apps/web && npx tsx src/components/office/sheets/formulaEngine.spec.ts
 *
 * Cubre las funciones que los usuarios EMS necesitan (búsqueda, condicionales, texto, fecha,
 * financieras, matriciales), las referencias entre hojas, la semántica de errores y —lo más
 * importante— las regresiones que el parche arregla: literales booleanos (`VLOOKUP(...,FALSE)`,
 * `IF(TRUE,…)`) y las funciones registradas (`XLOOKUP`, `TEXTJOIN`, `MAXIFS`/`MINIFS`, `TEXT`).
 */
import * as FP from '@fortune-sheet/formula-parser';
import {
  installFormulaEngine, normalizeFormula, matchesCriterion, flatten,
  XLOOKUP, TEXTJOIN, MAXIFS, MINIFS, TEXT,
} from '@/components/office/sheets/formulaEngine';

installFormulaEngine(); // parchea el Parser compartido ANTES de evaluar nada

let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };
const approx = (a: any, b: number, m: string) => { if (typeof a === 'number' && Math.abs(a - b) < 1e-6) passed++; else fails.push(`${m} — esp ≈${b}, obt ${JSON.stringify(a)}`); };

const Parser: any = (FP as any).Parser;

// Hoja «Datos» (índices fila_columna base 0):
//   A: números 10,5,7   | B: texto      | D:E tabla de búsqueda (material → precio)
//   Hoja 2 «Otra»: A1 = 100 (para referencia entre hojas)
const datos: Record<string, any> = {
  '0_0': 10, '1_0': 5, '2_0': 7,
  '0_1': 'Tornillo', '1_1': 'Tuerca', '2_1': 'Arandela',
  '0_3': 'Tuerca', '0_4': 2.5, '1_3': 'Tornillo', '1_4': 1.1, '2_3': 'Arandela', '2_4': 0.3,
};
const otra: Record<string, any> = { '0_0': 100 };
function sheetOf(name: string | undefined) { return name === 'Otra' ? otra : datos; }

const parser = new Parser();
parser.on('callCellValue', (coord: any, _opts: any, done: any) => {
  done(sheetOf(coord.sheetName)[`${coord.row.index}_${coord.column.index}`] ?? 0);
});
parser.on('callRangeValue', (s: any, e: any, _opts: any, done: any) => {
  const grid = sheetOf(s.sheetName);
  const out: any[][] = [];
  for (let r = s.row.index; r <= e.row.index; r++) {
    const row: any[] = [];
    for (let c = s.column.index; c <= e.column.index; c++) row.push(grid[`${r}_${c}`] ?? null);
    out.push(row);
  }
  done(out);
});
// `=` se quita igual que en la rejilla (core hace `txt.substring(1)`).
function ev(formula: string): any { const r = parser.parse(formula.replace(/^=/, '')); return r.error ? r.error : r.result; }

// ───────────────────────── A) Normalización de booleanos (pura) ─────────────────────────
eq(normalizeFormula('IF(TRUE,1,2)'), 'IF(TRUE(),1,2)', 'TRUE → TRUE()');
eq(normalizeFormula('VLOOKUP(A1,B:C,2,FALSE)'), 'VLOOKUP(A1,B:C,2,FALSE())', 'FALSE → FALSE()');
eq(normalizeFormula('CONCATENATE("TRUE","-","FALSE")'), 'CONCATENATE("TRUE","-","FALSE")', 'no toca texto entrecomillado');
eq(normalizeFormula('"es TRUE o FALSE"'), '"es TRUE o FALSE"', 'literal de texto intacto');
eq(normalizeFormula('TRUEVALUE+1'), 'TRUEVALUE+1', 'no parte identificadores que contienen TRUE');
eq(normalizeFormula('TRUE()'), 'TRUE()', 'idempotente con TRUE(');

// ───────────────────────── B) Booleanos en el MOTOR (regresión clave) ─────────────────────────
eq(ev('=TRUE'), true, 'motor: =TRUE');
eq(ev('=FALSE'), false, 'motor: =FALSE');
eq(ev('=IF(TRUE,1,2)'), 1, 'motor: IF(TRUE,…)');
eq(ev('=IF(FALSE,1,2)'), 2, 'motor: IF(FALSE,…)');
eq(ev('=AND(TRUE,FALSE)'), false, 'motor: AND(TRUE,FALSE)');
eq(ev('=OR(TRUE,FALSE)'), true, 'motor: OR(TRUE,FALSE)');
eq(ev('=NOT(FALSE)'), true, 'motor: NOT(FALSE)');

// ───────────────────────── C) Búsqueda y referencia ─────────────────────────
eq(ev('=VLOOKUP("Tuerca",D1:E3,2,FALSE)'), 2.5, 'BUSCARV exacta con FALSE');
eq(ev('=VLOOKUP("Arandela",D1:E3,2,0)'), 0.3, 'BUSCARV exacta con 0');
eq(ev('=INDEX(E1:E3,MATCH("Tornillo",D1:D3,0))'), 1.1, 'INDEX+MATCH');
eq(ev('=XLOOKUP("Arandela",D1:D3,E1:E3)'), 0.3, 'XLOOKUP encontrado');
eq(ev('=XLOOKUP("ZZZ",D1:D3,E1:E3,"s/d")'), 's/d', 'XLOOKUP si_no_encontrado');
eq(ev('=XMATCH("Tuerca",D1:D3)'), 1, 'XMATCH posición');

// ───────────────────────── D) Agregación condicional ─────────────────────────
eq(ev('=SUMIF(A1:A3,">5")'), 17, 'SUMAR.SI');
eq(ev('=SUMIFS(E1:E3,D1:D3,"Tuerca")'), 2.5, 'SUMAR.SI.CONJUNTO');
eq(ev('=COUNTIF(A1:A3,">5")'), 2, 'CONTAR.SI');
eq(ev('=COUNTIFS(A1:A3,">1")'), 3, 'CONTAR.SI.CONJUNTO');
approx(ev('=AVERAGEIF(A1:A3,">1")'), 22 / 3, 'PROMEDIO.SI');
eq(ev('=MAXIFS(A1:A3,A1:A3,">4")'), 10, 'MAX.SI.CONJUNTO');
eq(ev('=MINIFS(A1:A3,A1:A3,">4")'), 5, 'MIN.SI.CONJUNTO');

// ───────────────────────── E) Texto ─────────────────────────
eq(ev('=LEFT("Tornillo",4)'), 'Torn', 'IZQUIERDA');
eq(ev('=MID("Tornillo",5,4)'), 'illo', 'EXTRAE');
eq(ev('=LEN("Tuerca")'), 6, 'LARGO');
eq(ev('=CONCATENATE("A","-","B")'), 'A-B', 'CONCATENAR');
eq(ev('=SUBSTITUTE("a-b-c","-","_")'), 'a_b_c', 'SUSTITUIR');
eq(ev('=UPPER("abc")'), 'ABC', 'MAYUSC');
eq(ev('=TEXTJOIN("-",TRUE,"a","","b","c")'), 'a-b-c', 'UNIRCADENAS ignora vacíos');
eq(ev('=TEXT(0.5,"0.00%")'), '50.00%', 'TEXTO porcentaje');
eq(ev('=TEXT(1234.5,"$#,##0.00")'), '$1,234.50', 'TEXTO moneda');

// ───────────────────────── F) Fecha ─────────────────────────
eq(ev('=YEAR(DATE(2024,1,15))'), 2024, 'AÑO');
eq(ev('=MONTH(DATE(2024,7,15))'), 7, 'MES');
eq(ev('=DAY(EOMONTH(DATE(2024,2,1),0))'), 29, 'FIN.MES (bisiesto)');
eq(ev('=DATEDIF(DATE(2024,1,1),DATE(2024,2,1),"d")'), 31, 'SIFECHA días');
eq(ev('=TEXT(DATE(2024,1,15),"yyyy-mm-dd")'), '2024-01-15', 'TEXTO de fecha');

// ───────────────────────── G) Financieras y matriciales ─────────────────────────
approx(ev('=PMT(0.1/12,12,-1000)'), 87.9158872, 'PAGO');
approx(ev('=NPV(0.1,100,200,300)'), 481.5927874, 'VNA');
eq(ev('=SUMPRODUCT(A1:A3,A1:A3)'), 174, 'SUMAPRODUCTO (10²+5²+7²)');

// ───────────────────────── H) Referencias ENTRE HOJAS ─────────────────────────
eq(ev('=Otra!A1'), 100, 'referencia a otra hoja');
eq(ev('=Otra!A1+A1'), 110, 'suma entre hojas (Otra!A1 + Datos!A1)');
eq(ev('=SUM(A1:A3)+Otra!A1'), 122, 'agregación + referencia entre hojas');

// ───────────────────────── I) Semántica de errores (consistente con Excel) ─────────────────────────
// El motor mezcla errores como OBJETOS (formulajs: SQRT(-1) → #NUM!) y como CADENAS sueltas
// (operadores: 1/0 → 'DIV/0'). Nuestros SI.ERROR/SI.ND/ES… unifican ambos:
ok(/DIV/.test(String(ev('=1/0'))), 'división por cero produce indicador DIV/0');
ok(!!parser.parse('NOEXISTE(1)').error, 'función inexistente → error');
eq(ev('=IFERROR(1/0,"err")'), 'err', 'SI.ERROR atrapa #DIV/0! aritmético (patrón EMS a/b)');
eq(ev('=IFERROR(A1/0,0)'), 0, 'SI.ERROR atrapa división de celda entre 0');
eq(ev('=IFERROR(SQRT(-1),"err")'), 'err', 'SI.ERROR atrapa #NUM! de función');
eq(ev('=IFERROR(VLOOKUP("ZZZ",D1:E3,2,FALSE),"s/d")'), 's/d', 'SI.ERROR atrapa #N/A de BUSCARV');
eq(ev('=IFNA(NA(),"nd")'), 'nd', 'SI.ND atrapa #N/A');
eq(ev('=IFNA(SQRT(-1),"nd")'), '#NUM!', 'SI.ND NO atrapa #NUM! (pasa el error)');
eq(ev('=ISERROR(1/0)'), true, 'ESERROR de #DIV/0!');
eq(ev('=ISERROR(5)'), false, 'ESERROR de un número normal');
eq(ev('=ISNA(NA())'), true, 'ESND de #N/A');
eq(ev('=IFERROR("texto normal","x")'), 'texto normal', 'SI.ERROR no toca texto legítimo');

// ───────────────────────── J) Helpers puros ─────────────────────────
ok(matchesCriterion(10, '>5') && !matchesCriterion(3, '>5'), 'criterio numérico >5');
ok(matchesCriterion('Tuerca', 'Tuerca') && !matchesCriterion('Tornillo', 'Tuerca'), 'criterio de igualdad de texto');
ok(matchesCriterion('Tornillo', 'Torn*') && matchesCriterion('Tuerca', '?uerca'), 'criterio con comodines');
eq(flatten([[1, 2], [3, 4]]), [1, 2, 3, 4], 'flatten de matriz 2D');
eq(XLOOKUP(['x', [['a'], ['b']], [[1], [2]]]), '#N/A', 'XLOOKUP directo no encontrado');
eq(TEXTJOIN([',', true, 'a', null, 'b']), 'a,b', 'TEXTJOIN directo');
eq(MAXIFS([[[3], [9], [4]], [['x'], ['y'], ['x']], 'x']), 4, 'MAXIFS directo');
eq(MINIFS([[[3], [9], [4]], [['x'], ['y'], ['x']], 'x']), 3, 'MINIFS directo');
eq(TEXT([0.125, '0.0%']), '12.5%', 'TEXT directo');

console.log(`\nFORMULA-ENGINE SPEC: ${passed} OK, ${fails.length} fallos`);
if (fails.length) { for (const f of fails) console.error('  ✗ ' + f); throw new Error(`${fails.length} fallos`); }
console.log('✓ Auditoría del motor de fórmulas: todas las aserciones pasan.');
