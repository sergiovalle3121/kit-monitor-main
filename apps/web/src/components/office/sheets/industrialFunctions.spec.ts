/* eslint-disable @typescript-eslint/no-explicit-any */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';
import {
  AXOS_OEE,
  AXOS_YIELD,
  AXOS_SCRAP_RATE,
  AXOS_INVENTORY_TURNS,
  AXOS_MARGIN,
  AXOS_MARKUP,
  AXOS_COST_ROLLUP,
  AXOS_ABCD_CLASS,
  AXOS_CPK,
  AXOS_SUPPLIER_SCORE,
  AXOS_CAPACITY_UTILIZATION,
  AXOS_SHORTAGE,
  AXOS_SUM_VISIBLE,
} from './industrialFunctions';

installFormulaEngine();
let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };
const approx = (a: any, b: number, m: string, tol = 1e-9) => { if (typeof a === 'number' && Math.abs(a - b) <= tol) passed++; else fails.push(`${m} — esp ≈${b}, obt ${JSON.stringify(a)}`); };

approx(AXOS_OEE([0.9, 0.8, 0.95]), 0.684, 'AXOS_OEE puro');
approx(AXOS_YIELD([95, 100]), 0.95, 'AXOS_YIELD puro');
approx(AXOS_SCRAP_RATE([5, 100]), 0.05, 'AXOS_SCRAP_RATE puro');
approx(AXOS_INVENTORY_TURNS([120000, 30000]), 4, 'AXOS_INVENTORY_TURNS puro');
approx(AXOS_MARGIN([150, 90]), 0.4, 'AXOS_MARGIN puro');
approx(AXOS_MARKUP([150, 90]), 2 / 3, 'AXOS_MARKUP puro');
approx(AXOS_COST_ROLLUP([[[1], [2]], [[10], [5]], [[0.1], [0]]]), 21, 'AXOS_COST_ROLLUP puro');
eq(AXOS_ABCD_CLASS([0.8]), 'A', 'AXOS_ABCD_CLASS A');
eq(AXOS_ABCD_CLASS([0.93]), 'B', 'AXOS_ABCD_CLASS B');
eq(AXOS_ABCD_CLASS([0.99]), 'C', 'AXOS_ABCD_CLASS C');
eq(AXOS_ABCD_CLASS([1.2]), 'D', 'AXOS_ABCD_CLASS D');
approx(AXOS_SUPPLIER_SCORE([0.96, 0.985, 0.91, 0.94]), 0.95825, 'AXOS_SUPPLIER_SCORE puro');
approx(AXOS_CAPACITY_UTILIZATION([190, 200]), 0.95, 'AXOS_CAPACITY_UTILIZATION puro');
eq(AXOS_SHORTAGE([100, 70, 20]), 10, 'AXOS_SHORTAGE con incoming');
eq(AXOS_SHORTAGE([100, 120]), 0, 'AXOS_SHORTAGE no negativo');
eq(AXOS_SUM_VISIBLE([[[1, 2], [3, 4]]]), 10, 'AXOS_SUM_VISIBLE puro');
approx(AXOS_CPK([[[9.9], [10.0], [10.1], [10.05], [9.95]], 9.7, 10.3]), 1.264911064, 'AXOS_CPK puro', 1e-6);
eq(AXOS_YIELD([1, 0]), '#DIV/0!', 'AXOS_YIELD div0');
eq(AXOS_MARGIN(['abc', 1]), '#VALUE!', 'AXOS_MARGIN value error');

const Parser: any = (FP as any).Parser;
const parser = new Parser();
function ev(formula: string): any { const r = parser.parse(formula.replace(/^=/, '')); return r.error ? r.error : r.result; }

approx(ev('=AXOS_OEE(0.9,0.8,0.95)'), 0.684, 'motor AXOS_OEE');
approx(ev('=AXOS_YIELD(452,470)'), 452 / 470, 'motor AXOS_YIELD');
approx(ev('=AXOS_SCRAP_RATE(18,470)'), 18 / 470, 'motor AXOS_SCRAP_RATE');
approx(ev('=AXOS_INVENTORY_TURNS(120000,30000)'), 4, 'motor AXOS_INVENTORY_TURNS');
approx(ev('=AXOS_MARGIN(54.579,37.114)'), (54.579 - 37.114) / 54.579, 'motor AXOS_MARGIN');
approx(ev('=AXOS_MARKUP(54.579,37.114)'), (54.579 - 37.114) / 37.114, 'motor AXOS_MARKUP');
eq(ev('=AXOS_ABCD_CLASS(0.93)'), 'B', 'motor AXOS_ABCD_CLASS');
approx(ev('=AXOS_SUPPLIER_SCORE(0.96,0.985,0.91,0.94)'), 0.95825, 'motor AXOS_SUPPLIER_SCORE');
eq(ev('=AXOS_SHORTAGE(100,70,20)'), 10, 'motor AXOS_SHORTAGE');

console.log(`\nAXOS INDUSTRIAL FUNCTIONS SPEC: ${passed} OK, ${fails.length} fallos`);
if (fails.length) { for (const f of fails) console.error('  ✗ ' + f); throw new Error(`${fails.length} fallos`); }
console.log('✓ Funciones industriales AXOS: todas las aserciones pasan.');
