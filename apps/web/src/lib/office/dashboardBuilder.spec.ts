import { strict as assert } from 'node:assert';
import { buildExecutiveDashboard } from './dashboardBuilder';

const sheets = [{ name: 'AXOS Data', celldata: [], order: 0, row: 20, column: 8, config: {} }];
const result = buildExecutiveDashboard({
  sheets,
  charts: [{ id: 'c1', title: 'OEE', type: 'bar', range: 'A1:C4', sheetIndex: 0 }],
  pivots: [{ id: 'p1', sheetName: 'Pivot OEE' }],
  connectors: [{ id: 'cn1', label: 'OEE por línea', type: 'oee_by_line', range: 'A1:F6', sheetIndex: 0, lastRefreshedAt: '2026-06-28T00:00:00.000Z' }],
});

assert.equal(result.sheet.name, 'Dashboard Ejecutivo');
assert.equal(result.sheetIndex, 1);
assert.ok(result.sheet.celldata.some((c: { v?: { v?: unknown } }) => c.v?.v === 'AXOS Sheets · Executive Dashboard'));
assert.ok(result.sheet.celldata.some((c: { v?: { v?: unknown } }) => c.v?.v === 1));
assert.equal(result.charts.length, 2);
assert.equal(result.charts[1].range, 'A1:F6');
assert.equal(result.charts[1].sheetIndex, 0);

const second = buildExecutiveDashboard({ sheets: [...sheets, result.sheet] });
assert.equal(second.sheet.name, 'Dashboard Ejecutivo 2');
console.log('✅ dashboardBuilder: executive dashboard generation ok');
