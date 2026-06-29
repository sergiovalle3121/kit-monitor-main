import { analyzeSheetQualityPreflight, formatSheetQualityPreflight } from './sheetQualityPreflight';
import { applyDataVerification } from './sheetOps';

let passed = 0; const fails: string[] = [];
const ok = (cond: boolean, msg: string) => { if (cond) passed++; else fails.push(msg); };
const eq = (a: unknown, b: unknown, msg: string) => { if (a === b) passed++; else fails.push(`${msg} - esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const clean = analyzeSheetQualityPreflight({ sheets: [] }, new Date('2026-06-29T00:00:00.000Z'));
eq(clean.status, 'pass', 'workbook limpio pasa');
eq(clean.canExport, true, 'workbook limpio exportable');
ok(formatSheetQualityPreflight(clean).includes('passed'), 'formatea preflight limpio');

const reviewSheet = {
  name: 'Quality',
  celldata: [
    { r: 0, c: 0, v: { v: 'OK' } },
    { r: 1, c: 0, v: { v: 'BAD' } },
  ],
};
applyDataVerification(reviewSheet, 'A1:A2', { type: 'dropdown', value1: 'OK,HOLD' });
const review = analyzeSheetQualityPreflight({ sheets: [reviewSheet] }, new Date('2026-06-29T00:00:00.000Z'));
eq(review.status, 'review', 'validacion invalida requiere revision');
eq(review.dataValidations.invalid, 1, 'cuenta validacion invalida');
ok(formatSheetQualityPreflight(review).includes('Invalid data validations: 1/2'), 'formatea validaciones invalidas');

const blocked = analyzeSheetQualityPreflight({
  sheets: [{ name: 'Ops', celldata: [{ r: 0, c: 0, v: { f: '=Missing!A1', v: '#REF!' } }] }],
}, new Date('2026-06-29T00:00:00.000Z'));
eq(blocked.status, 'blocked', 'errores criticos bloquean preflight');
eq(blocked.canExport, false, 'errores criticos no son export-ready');
ok(blocked.findings.some((finding) => finding.includes('#REF!')), 'incluye finding de formula');

const total = passed + fails.length;
if (fails.length) { console.error(`FAILED ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
console.log(`PASSED ${passed}/${total}`);
