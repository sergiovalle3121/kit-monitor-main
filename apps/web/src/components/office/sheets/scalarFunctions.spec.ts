/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría de escalares ausentes/rotas en formulajs, vía el motor REAL:
 *   cd apps/web && npx tsx src/components/office/sheets/scalarFunctions.spec.ts
 */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';

installFormulaEngine();
let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const Parser: any = (FP as any).Parser;
const grid: Record<string, any> = { '0_0': 'hola', '1_0': 42, '0_1': true };
const parser = new Parser();
parser.on('callCellValue', (c: any, _o: any, d: any) => d(grid[`${c.row.index}_${c.column.index}`] ?? 0));
parser.on('callRangeValue', (s: any, e: any, _o: any, d: any) => { const out: any[][] = []; for (let r = s.row.index; r <= e.row.index; r++) { const row: any[] = []; for (let c = s.column.index; c <= e.column.index; c++) row.push(grid[`${r}_${c}`] ?? null); out.push(row); } d(out); });
const ev = (f: string) => { const r = parser.parse(f.replace(/^=/, '')); return r.error ? `ERR:${r.error}` : r.result; };

// ── ADDRESS ───────────────────────────────────────────────────────────────────
eq(ev('=ADDRESS(2,3)'), '$C$2', 'ADDRESS abs por defecto');
eq(ev('=ADDRESS(2,3,2)'), 'C$2', 'ADDRESS fila abs, col rel');
eq(ev('=ADDRESS(2,3,3)'), '$C2', 'ADDRESS fila rel, col abs');
eq(ev('=ADDRESS(2,3,4)'), 'C2', 'ADDRESS relativo');
eq(ev('=ADDRESS(1,1,4,FALSE)'), 'R[1]C[1]', 'ADDRESS estilo R1C1 relativo');
eq(ev('=ADDRESS(2,3,1,TRUE,"Hoja1")'), 'Hoja1!$C$2', 'ADDRESS con hoja');
eq(ev('=ADDRESS(5,27)'), '$AA$5', 'ADDRESS columna de dos letras');

// ── DOLLAR / FIXED ─────────────────────────────────────────────────────────────
eq(ev('=DOLLAR(1234.5,2)'), '$1,234.50', 'DOLLAR positivo');
eq(ev('=DOLLAR(-1234.567,2)'), '($1,234.57)', 'DOLLAR negativo entre paréntesis');
eq(ev('=DOLLAR(1234.5,-2)'), '$1,200', 'DOLLAR con decimales negativos');
eq(ev('=FIXED(1234.567,2)'), '1,234.57', 'FIXED por defecto con miles');
eq(ev('=FIXED(1234.567,2,TRUE)'), '1234.57', 'FIXED sin separador de miles');
eq(ev('=FIXED(-1234.5,0)'), '-1,235', 'FIXED negativo, 0 decimales');

// ── T / N ──────────────────────────────────────────────────────────────────────
eq(ev('=T("hola")'), 'hola', 'T de texto');
eq(ev('=T(42)'), '', 'T de número → ""');
eq(ev('=T(A1)'), 'hola', 'T de celda de texto');
eq(ev('=N(42)'), 42, 'N de número');
eq(ev('=N(TRUE)'), 1, 'N de lógico verdadero');
eq(ev('=N("texto")'), 0, 'N de texto → 0');

// ── BASE / DECIMAL ─────────────────────────────────────────────────────────────
eq(ev('=BASE(255,16)'), 'FF', 'BASE 255 → FF (mayúsculas)');
eq(ev('=BASE(7,2,8)'), '00000111', 'BASE con relleno a 8');
eq(ev('=BASE(100,16)'), '64', 'BASE 100 hex');
eq(ev('=DECIMAL("FF",16)'), 255, 'DECIMAL hex → 255');
eq(ev('=DECIMAL("111",2)'), 7, 'DECIMAL binario → 7');
eq(ev('=DECIMAL("ZZ",36)'), 1295, 'DECIMAL base 36');
eq(ev('=DECIMAL("XYZ",16)'), '#NUM!', 'DECIMAL con dígito inválido → #NUM!');

// ── TIMEVALUE ──────────────────────────────────────────────────────────────────
eq(ev('=TIMEVALUE("12:00")'), 0.5, 'TIMEVALUE mediodía = 0.5');
eq(ev('=TIMEVALUE("6:00 AM")'), 0.25, 'TIMEVALUE 6 AM = 0.25');
eq(ev('=TIMEVALUE("18:00")'), 0.75, 'TIMEVALUE 18:00 = 0.75');
eq(ev('=TIMEVALUE("12:00 AM")'), 0, 'TIMEVALUE medianoche = 0');
{ const r = ev('=TIMEVALUE("23:59:59")') as number; eq(Math.abs(r - 86399 / 86400) < 1e-9, true, 'TIMEVALUE con segundos'); }

// ── Composición con otras funciones ────────────────────────────────────────────
eq(ev('="Total: "&DOLLAR(2500)'), 'Total: $2,500.00', 'DOLLAR concatenado con texto');
eq(ev('=LEN(FIXED(1234.5,2))'), 8, 'FIXED compone con LEN ("1,234.50")');

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ scalarFunctions: ${passed}/${total} aserciones verdes.`);
