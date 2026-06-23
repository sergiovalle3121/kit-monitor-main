/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría de WORKDAY.INTL / NETWORKDAYS.INTL, vía el motor REAL:
 *   cd apps/web && npx tsx src/components/office/sheets/dateIntl.spec.ts
 */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';

installFormulaEngine();
let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const Parser: any = (FP as any).Parser;
// H1:H2 festivos = 2024-01-03
const grid: Record<string, any> = { '0_7': '2024-01-03' };
const parser = new Parser();
parser.on('callCellValue', (c: any, _o: any, d: any) => d(grid[`${c.row.index}_${c.column.index}`] ?? null));
parser.on('callRangeValue', (s: any, e: any, _o: any, d: any) => { const out: any[][] = []; for (let r = s.row.index; r <= e.row.index; r++) { const row: any[] = []; for (let c = s.column.index; c <= e.column.index; c++) row.push(grid[`${r}_${c}`] ?? null); out.push(row); } d(out); });
const iso = (r: any) => (r && r.result instanceof Date ? r.result.toISOString().slice(0, 10) : (r.error ? `ERR:${r.error}` : r.result));
const ev = (f: string) => parser.parse(f.replace(/^=/, ''));
const evDate = (f: string) => iso(ev(f));
const evVal = (f: string) => { const r = ev(f); return r.error ? `ERR:${r.error}` : r.result; };

// ── WORKDAY.INTL ─────────────────────────────────────────────────────────────────
eq(evDate('=WORKDAY.INTL("2024-01-01",5)'), '2024-01-08', 'WORKDAY.INTL +5 (fin de semana por defecto)');
eq(evDate('=WORKDAY.INTL("2024-01-01",5,1)'), '2024-01-08', 'WORKDAY.INTL +5 código 1 (Sáb-Dom)');
eq(evDate('=WORKDAY.INTL("2024-01-01",5,"0000011")'), '2024-01-08', 'WORKDAY.INTL con máscara de texto');
eq(evDate('=WORKDAY.INTL("2024-01-01",-3,1)'), '2023-12-27', 'WORKDAY.INTL negativo');
eq(evDate('=WORKDAY.INTL("2024-01-01",5,1,H1:H2)'), '2024-01-09', 'WORKDAY.INTL salta el festivo Jan 3');
eq(evVal('=WORKDAY.INTL("2024-01-01",5,99)'), '#NUM!', 'WORKDAY.INTL con código inválido → #NUM!');

// ── NETWORKDAYS.INTL ─────────────────────────────────────────────────────────────
eq(evVal('=NETWORKDAYS.INTL("2024-01-01","2024-01-07")'), 5, 'NETWORKDAYS.INTL Lun-Dom = 5');
eq(evVal('=NETWORKDAYS.INTL("2024-01-01","2024-01-07",1)'), 5, 'NETWORKDAYS.INTL código 1 = 5');
eq(evVal('=NETWORKDAYS.INTL("2024-01-01","2024-01-07",11)'), 6, 'NETWORKDAYS.INTL sólo-domingo = 6');
eq(evVal('=NETWORKDAYS.INTL("2024-01-01","2024-01-07",1,H1:H2)'), 4, 'NETWORKDAYS.INTL con festivo = 4');
eq(evVal('=NETWORKDAYS.INTL("2024-01-07","2024-01-01",1)'), -5, 'NETWORKDAYS.INTL invertido = -5 (signo)');
eq(evVal('=NETWORKDAYS.INTL("2024-01-01","2024-01-01",1)'), 1, 'NETWORKDAYS.INTL mismo día laborable = 1');

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ dateIntl: ${passed}/${total} aserciones verdes.`);
