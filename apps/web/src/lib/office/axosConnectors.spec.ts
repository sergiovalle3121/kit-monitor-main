/* eslint-disable @typescript-eslint/no-explicit-any */
import { AXOS_SHEET_CONNECTORS, buildAxosConnectorRefresh, buildAxosConnectorTable, createAxosConnectorInstance, originFromConnectorRange, type AxosConnectorType } from './axosConnectors';

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
  ok(instance.readOnly, 'instancia read-only');
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
}

const total = passed + fails.length;
if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
console.log(`✅ ${passed}/${total}`);
