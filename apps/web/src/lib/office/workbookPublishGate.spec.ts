import { evaluateWorkbookPublishGate, formatWorkbookPublishGate } from './workbookPublishGate';

let passed = 0; const fails: string[] = [];
const ok = (cond: boolean, msg: string) => { if (cond) passed++; else fails.push(msg); };
const eq = (a: unknown, b: unknown, msg: string) => { if (a === b) passed++; else fails.push(`${msg} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const clean = evaluateWorkbookPublishGate({ sheets: [] }, new Date('2026-06-28T00:00:00.000Z'));
eq(clean.status, 'pass', 'workbook limpio pasa');
eq(clean.canPublish, true, 'workbook limpio publicable');
ok(formatWorkbookPublishGate(clean).includes('Preflight aprobado'), 'formatea aprobado');

const review = evaluateWorkbookPublishGate({
  sheets: [{ name: 'Ops', celldata: [{ r: 0, c: 0, v: { f: '=B1/0', v: '#DIV/0!' } }] }],
}, new Date('2026-06-28T00:00:00.000Z'));
eq(review.status, 'review', 'warnings requieren revisión');
eq(review.canPublish, true, 'warnings no bloquean publish');
ok(formatWorkbookPublishGate(review).includes('formula-div-zero-errors'), 'formatea review con finding');

const blocked = evaluateWorkbookPublishGate({
  sheets: [{ name: 'Ops', celldata: [{ r: 0, c: 0, v: { f: '=Missing!A1', v: '#REF!' } }] }],
}, new Date('2026-06-28T00:00:00.000Z'));
eq(blocked.status, 'blocked', 'críticos bloquean publish');
eq(blocked.canPublish, false, 'críticos no publicables');
ok(blocked.blockers.some((finding) => finding.code === 'formula-ref-errors'), 'expone blockers');
ok(formatWorkbookPublishGate(blocked).includes('Preflight bloqueado'), 'formatea bloqueado');

const total = passed + fails.length;
if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
console.log(`✅ ${passed}/${total}`);
