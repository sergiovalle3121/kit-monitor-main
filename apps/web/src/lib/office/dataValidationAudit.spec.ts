import { auditDataValidations, formatDataValidationAudit } from './dataValidationAudit';
import { applyDataVerification } from './sheetOps';

let passed = 0; const fails: string[] = [];
const ok = (cond: boolean, msg: string) => { if (cond) passed++; else fails.push(msg); };
const eq = (a: unknown, b: unknown, msg: string) => { if (a === b) passed++; else fails.push(`${msg} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const sheet = { name: 'Quality', celldata: [
  { r: 0, c: 0, v: { v: 'OK' } },
  { r: 1, c: 0, v: { v: 'BAD' } },
  { r: 2, c: 0, v: { v: '' } },
] };
applyDataVerification(sheet, 'A1:A2', { type: 'dropdown', value1: 'OK,HOLD' });
applyDataVerification(sheet, 'A3:A3', { type: 'required' });
const audit = auditDataValidations({ sheets: [sheet] });
eq(audit.rules, 3, 'cuenta reglas por celda');
eq(audit.invalid, 2, 'detecta inválidos visibles');
eq(audit.byType.dropdown, 2, 'agrupa dropdown');
eq(audit.byType.required, 1, 'agrupa required');
ok(audit.findings.some((finding) => finding.cell === 'A2' && finding.type === 'dropdown'), 'reporta dropdown inválido');
ok(audit.findings.some((finding) => finding.cell === 'A3' && finding.type === 'required'), 'reporta required inválido');
ok(formatDataValidationAudit(audit).includes('2/3'), 'formatea inválidos');
eq(formatDataValidationAudit(auditDataValidations({ sheets: [] })), 'Sin reglas de validación de datos.', 'formatea sin reglas');
const clean = { name: 'Clean', celldata: [{ r: 0, c: 0, v: { v: 5 } }] };
applyDataVerification(clean, 'A1:A1', { type: 'number', operator: 'greaterOrEqualTo', value1: '1' });
ok(formatDataValidationAudit(auditDataValidations({ sheets: [clean] })).includes('sin valores inválidos'), 'formatea reglas limpias');

const total = passed + fails.length;
if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
console.log(`✅ ${passed}/${total}`);
