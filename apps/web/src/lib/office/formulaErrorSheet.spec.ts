/* eslint-disable @typescript-eslint/no-explicit-any */
import { auditFormulaErrors } from './formulaErrorAudit';
import { buildFormulaErrorSheet, upsertFormulaErrorSheet } from './formulaErrorSheet';

let passed = 0; const fails: string[] = [];
const ok = (cond: boolean, msg: string) => { if (cond) passed++; else fails.push(msg); };
const eq = (a: unknown, b: unknown, msg: string) => { if (a === b) passed++; else fails.push(`${msg} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const content = { sheets: [{ name: 'Ops', order: 0, celldata: [
  { r: 0, c: 0, v: { f: '=Missing!A1', v: '#REF!' } },
  { r: 1, c: 1, v: { f: '=B1/0', v: '#DIV/0!' } },
] }] };
const audit = auditFormulaErrors(content);
const sheet = buildFormulaErrorSheet(audit, 4);
eq(sheet.name, 'AXOS Formula Errors', 'crea hoja de errores');
eq(sheet.order, 4, 'respeta orden');
ok(sheet.celldata.some((cell: any) => cell.v.v === '#REF!'), 'incluye #REF');
ok(sheet.celldata.some((cell: any) => cell.v.v === '=B1/0'), 'incluye fórmula');
const inserted = upsertFormulaErrorSheet(content.sheets, content);
eq(inserted.sheets.length, 2, 'inserta hoja de errores');
eq(inserted.audit.total, 2, 'retorna auditoría');
const updated = upsertFormulaErrorSheet(inserted.sheets, { sheets: inserted.sheets });
eq(updated.sheets.length, 2, 'actualiza hoja existente');
const clean = buildFormulaErrorSheet(auditFormulaErrors({ sheets: [] }));
ok(clean.celldata.some((cell: any) => cell.v.v === 'Sin errores visibles'), 'incluye estado limpio');

const total = passed + fails.length;
if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
console.log(`✅ ${passed}/${total}`);
