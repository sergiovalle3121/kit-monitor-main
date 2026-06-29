/* eslint-disable @typescript-eslint/no-explicit-any */
import { appendConnectorRefreshAudit, buildConnectorAuditSheet, createConnectorRefreshAuditEntry, formatConnectorRefreshAuditSummary, summarizeConnectorRefreshAudit, upsertConnectorAuditSheet } from './axosConnectorAudit';

let passed = 0; const fails: string[] = [];
const ok = (cond: boolean, msg: string) => { if (cond) passed++; else fails.push(msg); };
const eq = (a: unknown, b: unknown, msg: string) => { if (a === b) passed++; else fails.push(`${msg} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const base = createConnectorRefreshAuditEntry({
  connectorId: 'c1',
  connectorType: 'inventory_snapshot',
  label: 'Inventory snapshot',
  range: 'A1:G5',
  sheetIndex: 0,
  status: 'api',
  source: 'api',
  refreshedAt: '2026-06-27T12:00:00.000Z',
  warnings: [],
});
const duplicate = createConnectorRefreshAuditEntry({
  connectorId: 'c1',
  connectorType: 'inventory_snapshot',
  label: 'Inventory snapshot',
  range: 'A1:G5',
  sheetIndex: 0,
  status: 'api',
  source: 'api',
  refreshedAt: '2026-06-27T12:00:00.000Z',
  warnings: [],
});
const fallback = createConnectorRefreshAuditEntry({
  connectorId: 'c2',
  connectorType: 'oee_by_line',
  label: 'OEE by line',
  range: 'A10:F14',
  sheetIndex: 0,
  status: 'fallback',
  source: 'local',
  refreshedAt: '2026-06-27T12:01:00.000Z',
  warnings: ['API no disponible'],
  message: 'fallback local',
});

ok(base.id.startsWith('axca_'), 'genera id estable de auditoría');
eq(duplicate.id, base.id, 'id estable para la misma entrada lógica');
const history = appendConnectorRefreshAudit([base], [duplicate, fallback]);
eq(history.length, 2, 'deduplica auditoría por id');
eq(history[0].connectorId, 'c2', 'ordena historial por fecha descendente');
const limited = appendConnectorRefreshAudit(history, [base], 1);
eq(limited.length, 1, 'respeta límite de historial');
const summary = summarizeConnectorRefreshAudit(history);
eq(summary.total, 2, 'resume total');
eq(summary.api, 1, 'resume API');
eq(summary.fallback, 1, 'resume fallback');
eq(summary.warnings, 1, 'resume warnings');
ok(formatConnectorRefreshAuditSummary(summary).includes('2 evento(s) auditados'), 'formatea resumen de auditoría');
eq(formatConnectorRefreshAuditSummary(summarizeConnectorRefreshAudit([])), 'Sin historial de refresh AXOS.', 'formatea historial vacío');
const auditSheet = buildConnectorAuditSheet(history, 3);
eq(auditSheet.name, 'AXOS Connector Audit', 'construye hoja de auditoría');
eq(auditSheet.order, 3, 'respeta orden de hoja auditada');
ok(auditSheet.celldata.some((cell: any) => cell.r === 0 && cell.c === 0 && cell.v.v === 'Refreshed at'), 'incluye headers de auditoría');
ok(auditSheet.celldata.some((cell: any) => cell.v.v === 'API no disponible'), 'incluye warnings de auditoría');
const inserted = upsertConnectorAuditSheet([{ name: 'Ops', order: 0, celldata: [] }], history);
eq(inserted.length, 2, 'inserta hoja de auditoría si no existe');
const updated = upsertConnectorAuditSheet(inserted, [base]);
eq(updated.length, 2, 'actualiza hoja de auditoría existente');
ok(updated[1].celldata.some((cell: any) => cell.v.v === 'Inventory snapshot'), 'actualiza contenido de auditoría');

const total = passed + fails.length;
if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
console.log(`✅ ${passed}/${total}`);
