/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría de correcciones de fecha/hora (HOUR/MINUTE/SECOND con texto; EDATE fin de mes):
 *   cd apps/web && npx tsx src/components/office/sheets/dateTimeFix.spec.ts
 */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';

installFormulaEngine();
let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const Parser: any = (FP as any).Parser;
const parser = new Parser();
parser.on('callCellValue', (_c: any, _o: any, d: any) => d(0));
parser.on('callRangeValue', (_s: any, _e: any, _o: any, d: any) => d([[0]]));
const ev = (f: string) => { const r = parser.parse(f.replace(/^=/, '')); return r.error ? `ERR:${r.error}` : r.result; };
const evDate = (f: string) => { const r = parser.parse(f.replace(/^=/, '')); return r.result instanceof Date ? r.result.toISOString().slice(0, 10) : (r.error ? `ERR:${r.error}` : r.result); };

// ── HOUR/MINUTE/SECOND parsean texto, número de serie y Date ─────────────────────
eq(ev('=HOUR("13:45:30")'), 13, 'HOUR de texto');
eq(ev('=MINUTE("13:45:30")'), 45, 'MINUTE de texto');
eq(ev('=SECOND("13:45:30")'), 30, 'SECOND de texto');
eq(ev('=HOUR("6:00 AM")'), 6, 'HOUR con AM');
eq(ev('=HOUR("6:00 PM")'), 18, 'HOUR con PM');
eq(ev('=HOUR("12:00 AM")'), 0, 'HOUR medianoche');
eq(ev('=HOUR(0.5)'), 12, 'HOUR de número de serie (0.5 = mediodía)');
eq(ev('=MINUTE(0.75)'), 0, 'MINUTE de 0.75 (18:00)');
eq(ev('=HOUR(TIMEVALUE("23:59:59"))'), 23, 'HOUR compone con TIMEVALUE');
eq(ev('=HOUR("8:30")'), 8, 'HOUR sin segundos');
eq(ev('=HOUR("no es hora")'), '#VALUE!', 'HOUR de texto inválido → #VALUE!');
eq(ev('=IFERROR(HOUR("x"),-1)'), -1, 'el #VALUE! lo capta IFERROR');

// ── EDATE recorta al último día del mes destino ──────────────────────────────────
eq(evDate('=EDATE(DATE(2024,1,31),1)'), '2024-02-29', 'EDATE 31-ene +1 = 29-feb (bisiesto)');
eq(evDate('=EDATE(DATE(2023,1,31),1)'), '2023-02-28', 'EDATE 31-ene +1 = 28-feb (no bisiesto)');
eq(evDate('=EDATE(DATE(2024,3,31),-1)'), '2024-02-29', 'EDATE 31-mar −1 = 29-feb');
eq(evDate('=EDATE(DATE(2024,1,15),3)'), '2024-04-15', 'EDATE caso normal (sin recorte)');
eq(evDate('=EDATE(DATE(2024,12,31),1)'), '2025-01-31', 'EDATE cruza el año');
eq(evDate('=EDATE(DATE(2024,5,31),1)'), '2024-06-30', 'EDATE 31-may +1 = 30-jun');

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ dateTimeFix: ${passed}/${total} aserciones verdes.`);
