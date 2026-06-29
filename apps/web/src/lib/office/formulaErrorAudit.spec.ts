import { auditFormulaErrors, formatFormulaErrorAudit } from './formulaErrorAudit';

let passed = 0; const fails: string[] = [];
const ok = (cond: boolean, msg: string) => { if (cond) passed++; else fails.push(msg); };
const eq = (a: unknown, b: unknown, msg: string) => { if (a === b) passed++; else fails.push(`${msg} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const audit = auditFormulaErrors({ sheets: [
  { name: 'Ops', celldata: [
    { r: 0, c: 0, v: { f: '=A2/0', v: '#DIV/0!' } },
    { r: 1, c: 1, v: { f: '=VLOOKUP(A1,B:C,2,FALSE)', v: '#N/A' } },
    { r: 2, c: 2, v: { v: 42 } },
  ] },
  { name: 'BOM', celldata: [
    { r: 4, c: 3, v: '#REF!' },
  ] },
] });

eq(audit.total, 3, 'cuenta errores visibles');
eq(audit.byError['#DIV/0!'], 1, 'cuenta div cero');
eq(audit.byError['#N/A'], 1, 'cuenta n/a');
eq(audit.byError['#REF!'], 1, 'cuenta ref');
eq(audit.findings[0].cell, 'A1', 'calcula celda A1');
eq(audit.findings[1].cell, 'B2', 'calcula celda B2');
eq(audit.findings[2].cell, 'D5', 'calcula celda D5');
ok(formatFormulaErrorAudit(audit).includes('3 error(es)'), 'formatea resumen con total');
ok(formatFormulaErrorAudit(audit).includes('Ops!A1 #DIV/0!'), 'formatea samples');
eq(formatFormulaErrorAudit(auditFormulaErrors({ sheets: [] })), 'Sin errores de fórmula visibles.', 'formatea sin errores');

const total = passed + fails.length;
if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
console.log(`✅ ${passed}/${total}`);
