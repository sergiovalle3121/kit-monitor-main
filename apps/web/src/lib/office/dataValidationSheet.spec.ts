/* eslint-disable @typescript-eslint/no-explicit-any */
import { applyDataVerification } from './sheetOps';
import { auditDataValidations } from './dataValidationAudit';
import { buildDataValidationSheet, upsertDataValidationSheet } from './dataValidationSheet';

let passed = 0; const fails: string[] = [];
const ok = (cond: boolean, msg: string) => { if (cond) passed++; else fails.push(msg); };
const eq = (a: unknown, b: unknown, msg: string) => { if (a === b) passed++; else fails.push(`${msg} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const sheet = { name: 'Quality', order: 0, celldata: [{ r: 0, c: 0, v: { v: 'BAD' } }] };
applyDataVerification(sheet, 'A1:A1', { type: 'dropdown', value1: 'OK,HOLD' });
const content = { sheets: [sheet] };
const audit = auditDataValidations(content);
const built = buildDataValidationSheet(audit, 2);
eq(built.name, 'AXOS Validation Audit', 'crea hoja validation');
eq(built.order, 2, 'respeta orden');
ok(built.celldata.some((cell: any) => cell.v.v === 'BAD'), 'incluye valor inválido');
ok(built.celldata.some((cell: any) => cell.v.v === 'dropdown'), 'incluye tipo');
const inserted = upsertDataValidationSheet(content.sheets, content);
eq(inserted.sheets.length, 2, 'inserta hoja validation');
eq(inserted.audit.invalid, 1, 'retorna audit invalid');
const updated = upsertDataValidationSheet(inserted.sheets, { sheets: inserted.sheets });
eq(updated.sheets.length, 2, 'actualiza hoja existente');
const clean = buildDataValidationSheet(auditDataValidations({ sheets: [] }));
ok(clean.celldata.some((cell: any) => cell.v.v === 'Sin reglas de validación'), 'incluye estado sin reglas');

const total = passed + fails.length;
if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
console.log(`✅ ${passed}/${total}`);
