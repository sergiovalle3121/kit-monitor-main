/* eslint-disable @typescript-eslint/no-explicit-any */
import { AXOS_SHEET_CONNECTORS, buildAxosConnectorRefresh, buildAxosConnectorRefreshRequest, buildAxosConnectorTable, buildAxosConnectorTableFromDataset, connectorFreshnessFor, connectorInstanceFromDataset, connectorParamSummary, connectorProtectionFor, connectorRefreshDue, createAxosConnectorInstance, formatConnectorRefreshReport, originFromConnectorRange, suggestedChartsForConnector, summarizeConnectorFreshness, validateConnectorParams, type AxosConnectorType } from './axosConnectors';

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
    ok(Array.isArray(connector.params), `${connector.type} declara parámetros`);
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
  const instance = createAxosConnectorInstance('purchase_orders', 0, 'A1:G5', now, { supplier: 'North Metals', risk: 'Medio', ignored: 'x' });
  eq(instance.id, 'axc_mqwb5hc0', 'id determinístico con timestamp');
  eq(instance.label, 'Purchase orders', 'label desde registry');
  eq(instance.lastRefreshedAt, '2026-06-27T12:00:00.000Z', 'timestamp ISO');
  ok(instance.readOnly, 'instancia read-only');
  eq(instance.params?.supplier, 'North Metals', 'normaliza parámetro supplier');
  eq(instance.params?.risk, 'Medio', 'normaliza parámetro select');
  ok(!('ignored' in (instance.params ?? {})), 'descarta parámetros no declarados');
}

{
  const invalid = validateConnectorParams('inventory_snapshot', { abcClass: 'Z' });
  ok(!invalid.ok, 'valida requerido y select inválido');
  ok(invalid.errors.some((e) => e.includes('Sitio')), 'reporta requerido faltante');
  ok(invalid.errors.some((e) => e.includes('Clase ABC')), 'reporta opción inválida');
  const valid = validateConnectorParams('ncr_scrap', { line: 'Línea 1', dateFrom: '2026-06-01', dateTo: '2026-06-27' });
  ok(valid.ok, 'acepta parámetros válidos');
  eq(valid.params.dateFrom, '2026-06-01', 'preserva fecha válida');
  ok(connectorParamSummary('bom_cost_rollup').includes('SKU padre *'), 'summary marca requerido');
}

{
  const instance = createAxosConnectorInstance('inventory_snapshot', 1, 'C4:I8', new Date('2026-06-27T12:00:00.000Z'));
  const refreshed = buildAxosConnectorRefresh(instance, new Date('2026-06-27T12:05:00.000Z'));
  ok(!!refreshed, 'refresh válido desde rango persistido');
  eq(refreshed?.table.range, 'C4:I8', 'refresh mantiene rango si dimensiones coinciden');
  eq(refreshed?.instance.lastRefreshedAt, '2026-06-27T12:05:00.000Z', 'refresh actualiza timestamp');
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


{
  const instance = createAxosConnectorInstance('bom_cost_rollup', 0, 'A1:G5', new Date('2026-06-27T12:00:00.000Z'), { parentSku: 'AXOS-1000', revision: 'B', ignored: 'x' });
  const request = buildAxosConnectorRefreshRequest(instance);
  ok(request.valid, 'request válido para refresh vivo con parámetros requeridos');
  eq(request.endpoint, '/office-documents/sheets/connectors/bom_cost_rollup', 'request usa endpoint gobernado');
  eq(request.method, 'GET', 'request es read-only GET');
  eq(request.params.parentSku, 'AXOS-1000', 'request normaliza params');
  eq(request.cacheKey, 'bom_cost_rollup?parentSku=AXOS-1000&revision=B', 'cache key determinística ordenada');
  const invalidRequest = buildAxosConnectorRefreshRequest(createAxosConnectorInstance('bom_cost_rollup', 0, 'A1:G5', new Date('2026-06-27T12:00:00.000Z')));
  ok(!invalidRequest.valid, 'request inválido si faltan requeridos');
  ok(invalidRequest.errors.some((e) => e.includes('SKU padre')), 'request reporta requerido faltante');
}


{
  const table = buildAxosConnectorTableFromDataset({ columns: ['A', 'B'], rows: [[1, 2], [3], ['x', 'y']] }, { r: 4, c: 3 });
  eq(table.range, 'D5:E7', 'dataset API construye rango desde payload rectangular');
  eq(table.nRows, 3, 'dataset ignora filas no rectangulares');
  eq(table.nCols, 2, 'dataset conserva columnas API');
  eq(table.celldata.length, 6, 'dataset genera headers + filas válidas');
}


{
  const base = createAxosConnectorInstance('oee_by_line', 2, 'B2:G6', new Date('2026-06-27T10:00:00.000Z'), { line: 'Línea 1' });
  const updated = connectorInstanceFromDataset(base, { asOf: '2026-06-27T12:34:00.000Z', params: { line: 'Línea 2' }, source: 'office-sheet-connector-sample', tenantId: 'tenant-a', warnings: ['sample'] });
  eq(updated.lastRefreshedAt, '2026-06-27T12:34:00.000Z', 'dataset actualiza timestamp de instancia');
  eq(updated.params?.line, 'Línea 2', 'dataset actualiza params normalizados');
  eq(updated.lastRefreshSource, 'api', 'dataset marca fuente api');
  eq(updated.tenantId, 'tenant-a', 'dataset conserva tenantId');
  eq(updated.lastRefreshWarnings?.[0], 'sample', 'dataset conserva warnings');
}


{
  eq(formatConnectorRefreshReport({ total: 3, api: 2, fallback: 1, warnings: 1 }), '3 conector(es) actualizados · 2 vía API · 1 con fallback local · 1 con warnings', 'formatea reporte mixto de refresh');
  eq(formatConnectorRefreshReport({ total: 0, api: 0, fallback: 0, warnings: 0 }), 'No hay conectores AXOS insertados.', 'formatea reporte vacío de refresh');
}

const total = passed + fails.length;
if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
console.log(`✅ ${passed}/${total}`);
