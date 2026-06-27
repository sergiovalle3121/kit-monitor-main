/* eslint-disable @typescript-eslint/no-explicit-any */
import { auditWorkbookFormulas, formatFormulaAuditSummary, functionsInFormula } from './formulaAudit';

let passed = 0; const fails: string[] = [];
const ok = (cond: boolean, msg: string) => { if (cond) passed++; else fails.push(msg); };
const eq = (a: any, b: any, msg: string) => { if (a === b) passed++; else fails.push(`${msg} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

eq(functionsInFormula('=SUM(A1:A3)+AXOS_OEE(B1,C1,D1)').join(','), 'AXOS_OEE,SUM', 'extrae funciones ordenadas');

const result = auditWorkbookFormulas({ sheets: [{ name: 'Ops', celldata: [
  { r: 0, c: 0, v: { f: '=AXOS_OEE(B1,C1,D1)', v: 0.8 } },
  { r: 1, c: 0, v: { f: '=NOW()', v: 123 } },
  { r: 2, c: 0, v: { f: '=AXOS_FAKE(A1)', v: '#NAME?' } },
  { r: 3, c: 0, v: { f: '=VLOOKUP(A1,[Book2.xlsx]Sheet1!A:B,2,FALSE)', v: 1 } },
  { r: 4, c: 0, v: 'plain' },
] }] });

eq(result.total, 4, 'cuenta fórmulas');
eq(result.volatile, 1, 'detecta volátiles');
eq(result.externalReferences, 1, 'detecta referencias externas');
eq(result.axosFunctions, 2, 'cuenta fórmulas AXOS');
eq(result.unknownAxosFunctions.join(','), 'AXOS_FAKE', 'detecta AXOS desconocidas');
eq(result.formulas[0].address, 'A1', 'dirección A1');
ok(formatFormulaAuditSummary(result).includes('AXOS desconocidas: AXOS_FAKE'), 'summary incluye desconocidas');

const total = passed + fails.length;
if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
console.log(`✅ ${passed}/${total}`);
