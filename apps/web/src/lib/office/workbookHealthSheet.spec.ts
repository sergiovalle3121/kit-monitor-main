/* eslint-disable @typescript-eslint/no-explicit-any */
import { buildWorkbookHealthSheet, upsertWorkbookHealthSheet } from './workbookHealthSheet';
import type { WorkbookHealthReport } from './workbookHealth';

let passed = 0; const fails: string[] = [];
const ok = (cond: boolean, msg: string) => { if (cond) passed++; else fails.push(msg); };
const eq = (a: unknown, b: unknown, msg: string) => { if (a === b) passed++; else fails.push(`${msg} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const report: WorkbookHealthReport = {
  label: 'medium',
  score: 80,
  findings: [
    { severity: 'warning', code: 'stale-connectors', message: '1 conector vencido.' },
    { severity: 'critical', code: 'formula-cycles', message: '1 ciclo detectado.' },
  ],
};
const sheet = buildWorkbookHealthSheet(report, new Date('2026-06-27T12:00:00.000Z'), 2);
eq(sheet.name, 'AXOS Workbook Health', 'crea hoja health');
eq(sheet.order, 2, 'respeta orden');
ok(sheet.celldata.some((cell: any) => cell.v.v === 'Score'), 'incluye score');
ok(sheet.celldata.some((cell: any) => cell.v.v === 'stale-connectors'), 'incluye finding warning');
ok(sheet.celldata.some((cell: any) => cell.v.v === 'formula-cycles'), 'incluye finding critical');

const healthy = buildWorkbookHealthSheet({ label: 'small', score: 100, findings: [] }, new Date('2026-06-27T12:00:00.000Z'));
ok(healthy.celldata.some((cell: any) => cell.v.v === 'Sin hallazgos relevantes.'), 'incluye fila healthy sin hallazgos');

const content = {
  sheets: [{ name: 'Ops', order: 0, celldata: [{ r: 0, c: 0, v: { f: '=AXOS_UNKNOWN(A1)', v: '#NAME?' } }] }],
};
const inserted = upsertWorkbookHealthSheet(content.sheets, content, new Date('2026-06-27T12:00:00.000Z'));
eq(inserted.sheets.length, 2, 'inserta hoja health');
ok(inserted.report.findings.some((finding) => finding.code === 'unknown-axos-functions'), 'genera reporte desde content');
const updated = upsertWorkbookHealthSheet(inserted.sheets, { ...content, sheets: inserted.sheets }, new Date('2026-06-27T12:01:00.000Z'));
eq(updated.sheets.length, 2, 'actualiza hoja health existente');
ok(updated.sheets[1].celldata.some((cell: any) => cell.v.v === '2026-06-27T12:01:00.000Z'), 'actualiza timestamp');

const total = passed + fails.length;
if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
console.log(`✅ ${passed}/${total}`);
