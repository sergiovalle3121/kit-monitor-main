/* eslint-disable @typescript-eslint/no-explicit-any */
import { AXOS_SHEET_CONNECTORS, buildAxosConnectorRefresh, buildAxosConnectorRefreshFromDataset, buildAxosConnectorTable, connectorFreshnessFor, connectorProtectionFor, connectorRefreshDue, createAxosConnectorInstance, markAxosConnectorRefreshFailed, originFromConnectorRange, suggestedChartsForConnector, summarizeConnectorFreshness, type AxosConnectorType } from './axosConnectors';

let passed = 0; const fails: string[] = [];
const ok = (cond: boolean, msg: string) => { if (cond) passed++; else fails.push(msg); };
const eq = (a: any, b: any, msg: string) => { if (a === b) passed++; else fails.push(`${msg} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const expected: AxosConnectorType[] = ['inventory_snapshot', 'bom_cost_rollup', 'work_orders', 'oee_by_line', 'supplier_scorecard', 'ncr_scrap', 'purchase_orders', 'mrp_shortages'];

{
  eq(AXOS_SHEET_CONNECTORS.length, expected.length, '8 conectores ERP/MES iniciales');
  for (const type of expected) ok(AXOS_SHEET_CONNECTORS.some((c) => c.type === type), `existe ${type}`);
  for (const connector of AXOS_SHEET_CONNECTORS) {
    ok(connector.headers.length >= 6, `${connector.type} tiene headers suficientes`);
    ok(connector.rows.length >= 4, `${connector.type} tiene filas starter`);
    ok(connector.rows.every((row) => row.length === connector.headers.length), `${connector.type} filas alineadas con headers`);
  }
}

{
  const table = buildAxosConnectorTable('mrp_shortages', { r: 2, c: 1 });
  eq(table.range, 'B3:H7', 'rango MRP desde B3');
  eq(table.nRows, 5, 'MRP incluye header + 4 filas');
  eq(table.nCols, 7, 'MRP tiene 7 columnas');
  eq(table.celldata.length, 35, 'MRP genera celldata rectangular');
  ok(table.celldata[0].v.bl === 1 && table.celldata[0].v.bg === '#ecfdf5', 'header con estilo AXOS');
}

{
  const now = new Date('2026-06-27T12:00:00.000Z');
  const instance = createAxosConnectorInstance('purchase_orders', 0, 'A1:G5', now);
  eq(instance.id, 'axc_mqwb5hc0', 'id determinístico con timestamp');
  eq(instance.label, 'Purchase orders', 'label desde registry');
  eq(instance.lastRefreshedAt, '2026-06-27T12:00:00.000Z', 'timestamp ISO');
  eq(instance.lastStatus, 'contract-pending', 'starter pending no simula API live');
  eq(instance.rowCount, 4, 'starter persiste conteo de filas');
  eq(instance.source, 'starter-table', 'starter persiste source honesto');
  ok(instance.readOnly, 'instancia read-only');
}

{
  const instance = createAxosConnectorInstance('inventory_snapshot', 1, 'C4:I8', new Date('2026-06-27T12:00:00.000Z'));
  const refreshed = buildAxosConnectorRefresh(instance, new Date('2026-06-27T12:05:00.000Z'));
  ok(!!refreshed, 'refresh válido desde rango persistido');
  eq(refreshed?.table.range, 'C4:I8', 'refresh mantiene rango si dimensiones coinciden');
  eq(refreshed?.instance.lastRefreshedAt, '2026-06-27T12:05:00.000Z', 'refresh actualiza timestamp');
  eq(refreshed?.instance.rowCount, 4, 'refresh local conserva row count');
  eq(refreshed?.instance.lastStatus, 'contract-pending', 'refresh local conserva contrato pendiente');
  eq(refreshed?.table.celldata.length, 35, 'refresh genera tabla completa');
  eq(originFromConnectorRange('C4:I8')?.r, 3, 'origin row desde rango');
  eq(originFromConnectorRange('C4:I8')?.c, 2, 'origin col desde rango');
  ok(originFromConnectorRange('nope') == null, 'rango inválido devuelve null');
  const protection = connectorProtectionFor(refreshed!.instance);
  eq(protection.range, 'C4:I8', 'protección cubre rango refrescado');
  eq(protection.connectorType, 'inventory_snapshot', 'protección conserva tipo de conector');
  ok(protection.locked, 'protección bloquea edición del rango conector');
  const charts = suggestedChartsForConnector(refreshed!.instance);
  eq(charts.length, 1, 'sugiere chart para conector');
  eq(charts[0].range, 'C4:I8', 'chart usa rango del conector');
  eq(charts[0].sheetIndex, 1, 'chart usa hoja del conector');
}

{
  const instance = createAxosConnectorInstance('supplier_scorecard', 0, 'B2:H5', new Date('2026-06-27T12:00:00.000Z'), { params: { supplier: 'Kyo' } });
  const refreshed = buildAxosConnectorRefreshFromDataset(instance, {
    columns: ['Proveedor', 'OTD', 'Calidad'],
    rows: [['Kyo Electronics', 0.91, 0.99]],
    asOf: '2026-06-27T12:02:00.000Z',
    source: 'office-sheet-connector-sample',
    warnings: ['sample rows'],
  }, new Date('2026-06-27T12:03:00.000Z'));
  ok(!!refreshed, 'refresh desde dataset API válido');
  eq(refreshed?.table.range, 'B2:D3', 'dataset API recalcula rango con columnas reales');
  eq(refreshed?.instance.lastStatus, 'ok', 'dataset API marca status ok');
  eq(refreshed?.instance.rowCount, 1, 'dataset API persiste row count real');
  eq(refreshed?.instance.source, 'office-sheet-connector-sample', 'dataset API persiste source');
  eq(refreshed?.instance.asOf, '2026-06-27T12:02:00.000Z', 'dataset API persiste asOf');
  eq(refreshed?.instance.warnings?.[0], 'sample rows', 'dataset API persiste warnings');
  const failed = markAxosConnectorRefreshFailed(instance, 'HTTP 500', new Date('2026-06-27T12:04:00.000Z'));
  eq(failed.lastStatus, 'failed', 'fallo marca status failed');
  eq(failed.lastError, 'HTTP 500', 'fallo persiste error');
  eq(failed.warnings?.[0], 'HTTP 500', 'fallo persiste warning');
}

{
  const now = new Date('2026-06-27T12:00:00.000Z');
  const fresh = createAxosConnectorInstance('work_orders', 0, 'A1:H5', new Date('2026-06-27T11:30:00.000Z'));
  const due = createAxosConnectorInstance('work_orders', 0, 'A1:H5', new Date('2026-06-27T09:30:00.000Z'));
  const stale = createAxosConnectorInstance('work_orders', 0, 'A1:H5', new Date('2026-06-26T10:00:00.000Z'));
  const manualDue = createAxosConnectorInstance('inventory_snapshot', 0, 'A1:G5', new Date('2026-06-25T11:59:00.000Z'));
  eq(connectorFreshnessFor(fresh, now).status, 'fresh', 'scheduled-ready fresco antes de 60 min');
  eq(connectorFreshnessFor(due, now).status, 'due', 'scheduled-ready vence después de 60 min');
  eq(connectorFreshnessFor(stale, now).status, 'stale', 'scheduled-ready stale después de 24h');
  eq(connectorFreshnessFor(manualDue, now).status, 'due', 'manual vence después de 24h');
  ok(connectorRefreshDue(due, now), 'due requiere refresh');
  const summary = summarizeConnectorFreshness([fresh, due, stale, manualDue], now);
  eq(summary.due, 2, 'summary cuenta due');
  eq(summary.stale, 1, 'summary cuenta stale');
  eq(summary.invalid, 0, 'summary cuenta invalid');
}

const total = passed + fails.length;
if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
console.log(`✅ ${passed}/${total}`);
