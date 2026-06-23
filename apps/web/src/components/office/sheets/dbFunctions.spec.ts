/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría de las funciones de base de datos (D…), vía el motor REAL:
 *   cd apps/web && npx tsx src/components/office/sheets/dbFunctions.spec.ts
 */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';

installFormulaEngine();
let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };
const approx = (a: any, b: number, m: string, tol = 1e-6) => { if (typeof a === 'number' && Math.abs(a - b) < tol) passed++; else fails.push(`${m} — esp ≈${b}, obt ${JSON.stringify(a)}`); };

const Parser: any = (FP as any).Parser;
// Base A1:C5 (encabezado + 4 registros). Criterios en E1:E2, G1:H2, J1:J2.
const grid: Record<string, any> = {
  '0_0': 'Producto', '0_1': 'Region', '0_2': 'Ventas',
  '1_0': 'A', '1_1': 'Norte', '1_2': 100,
  '2_0': 'B', '2_1': 'Sur', '2_2': 200,
  '3_0': 'A', '3_1': 'Sur', '3_2': 150,
  '4_0': 'C', '4_1': 'Norte', '4_2': 300,
  // E1:E2 → Region = Norte (filas 1 y 4: 100, 300)
  '0_4': 'Region', '1_4': 'Norte',
  // G1:H2 → Producto = A Y Region = Sur (sólo fila 3: 150)
  '0_6': 'Producto', '0_7': 'Region', '1_6': 'A', '1_7': 'Sur',
  // J1:J2 → Ventas > 150 (filas 2 y 4: 200, 300)
  '0_9': 'Ventas', '1_9': '>150',
  // L1:L2 → Producto = C (un único registro)
  '0_11': 'Producto', '1_11': 'C',
  // N1:N2 → Region = Sur (Ventas {200,150})
  '0_13': 'Region', '1_13': 'Sur',
};
const parser = new Parser();
parser.on('callCellValue', (c: any, _o: any, d: any) => d(grid[`${c.row.index}_${c.column.index}`] ?? null));
parser.on('callRangeValue', (s: any, e: any, _o: any, d: any) => { const out: any[][] = []; for (let r = s.row.index; r <= e.row.index; r++) { const row: any[] = []; for (let c = s.column.index; c <= e.column.index; c++) row.push(grid[`${r}_${c}`] ?? null); out.push(row); } d(out); });
const ev = (f: string) => { const r = parser.parse(f.replace(/^=/, '')); return r.error ? `ERR:${r.error}` : r.result; };

// ── Criterio simple: Region = Norte ─────────────────────────────────────────────
eq(ev('=DSUM(A1:C5,"Ventas",E1:E2)'), 400, 'DSUM Region=Norte = 100+300');
eq(ev('=DCOUNT(A1:C5,"Ventas",E1:E2)'), 2, 'DCOUNT cuenta numéricos = 2');
eq(ev('=DCOUNTA(A1:C5,"Producto",E1:E2)'), 2, 'DCOUNTA cuenta no vacíos = 2');
eq(ev('=DAVERAGE(A1:C5,"Ventas",E1:E2)'), 200, 'DAVERAGE = (100+300)/2');
eq(ev('=DMAX(A1:C5,"Ventas",E1:E2)'), 300, 'DMAX = 300');
eq(ev('=DMIN(A1:C5,"Ventas",E1:E2)'), 100, 'DMIN = 100');
eq(ev('=DPRODUCT(A1:C5,"Ventas",E1:E2)'), 30000, 'DPRODUCT = 100*300');
// Campo por índice numérico (3 = Ventas).
eq(ev('=DSUM(A1:C5,3,E1:E2)'), 400, 'DSUM con campo por índice numérico');

// ── Criterio combinado (Y dentro de la fila): Producto=A Y Region=Sur ────────────
eq(ev('=DSUM(A1:C5,"Ventas",G1:H2)'), 150, 'DSUM A∧Sur = 150');
eq(ev('=DGET(A1:C5,"Ventas",G1:H2)'), 150, 'DGET registro único = 150');

// ── Criterio con operador: Ventas > 150 ─────────────────────────────────────────
eq(ev('=DSUM(A1:C5,"Ventas",J1:J2)'), 500, 'DSUM Ventas>150 = 200+300');
eq(ev('=DCOUNT(A1:C5,"Ventas",J1:J2)'), 2, 'DCOUNT Ventas>150 = 2');

// ── DGET: errores por 0 o múltiples coincidencias ───────────────────────────────
eq(ev('=DGET(A1:C5,"Ventas",E1:E2)'), '#NUM!', 'DGET con 2 coincidencias → #NUM!');
eq(ev('=DGET(A1:C5,"Ventas",L1:L2)'), 300, 'DGET Producto=C (único) = 300');

// ── Desviación / varianza sobre el campo (criterio Region=Sur → Ventas {200,150}) ─
// var muestral = 1250, σ muestral = 35.3553…, var poblacional = 625.
approx(ev('=DVAR(A1:C5,"Ventas",N1:N2)'), 1250, 'DVAR Sur {200,150} muestral = 1250');
approx(ev('=DSTDEV(A1:C5,"Ventas",N1:N2)'), Math.sqrt(1250), 'DSTDEV Sur muestral');
approx(ev('=DVARP(A1:C5,"Ventas",N1:N2)'), 625, 'DVARP Sur poblacional = 625');

// ── Campo inexistente → #VALUE! ─────────────────────────────────────────────────
eq(ev('=DSUM(A1:C5,"NoExiste",E1:E2)'), '#VALUE!', 'campo inexistente → #VALUE! (lo capta IFERROR)');
eq(ev('=IFERROR(DSUM(A1:C5,"NoExiste",E1:E2),-1)'), -1, 'IFERROR captura el #VALUE! del campo inexistente');

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ dbFunctions: ${passed}/${total} aserciones verdes.`);
