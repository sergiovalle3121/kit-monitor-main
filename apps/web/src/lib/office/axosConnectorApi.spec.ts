/* eslint-disable @typescript-eslint/no-explicit-any */
import { buildAxosConnectorRefreshRequest } from './axosConnectorApi';
import { createAxosConnectorInstance } from './axosConnectors';

let passed = 0; const fails: string[] = [];
const ok = (cond: boolean, msg: string) => { if (cond) passed++; else fails.push(msg); };
const eq = (a: any, b: any, msg: string) => { if (a === b) passed++; else fails.push(`${msg} - esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

{
  const instance = {
    ...createAxosConnectorInstance('inventory_snapshot', 0, 'B2:H6', new Date('2026-06-29T12:00:00.000Z')),
    params: { site: ' MAIN ', abcClass: 'A', unused: '' },
  };
  const request = buildAxosConnectorRefreshRequest(instance);
  ok(request.valid, 'inventory snapshot params validos');
  eq(request.method, 'GET', 'usa GET');
  eq(request.endpoint, '/office-documents/sheets/connectors/inventory_snapshot', 'usa endpoint Office contract');
  eq(request.params.site, 'MAIN', 'normaliza parametro requerido');
  eq(request.params.abcClass, 'A', 'mantiene filtro select valido');
  ok(!('unused' in request.params), 'omite params vacios/desconocidos');
}

{
  const instance = createAxosConnectorInstance('bom_cost_rollup', 0, 'A1:G5');
  const request = buildAxosConnectorRefreshRequest(instance);
  ok(!request.valid, 'BOM requiere parentSku');
  ok(request.errors.some((error) => error.includes('SKU padre')), 'expone error de parametro requerido');
}

{
  const instance = {
    ...createAxosConnectorInstance('oee_by_line', 0, 'A1:F5'),
    params: { dateFrom: '06/29/2026' },
  };
  const request = buildAxosConnectorRefreshRequest(instance);
  ok(!request.valid, 'rechaza fechas no ISO');
  ok(request.errors.some((error) => error.includes('YYYY-MM-DD')), 'expone contrato de fecha');
}

{
  const instance = {
    ...createAxosConnectorInstance('purchase_orders', 0, 'A1:G5'),
    params: { risk: 'Extreme' },
  };
  const request = buildAxosConnectorRefreshRequest(instance);
  ok(!request.valid, 'rechaza select fuera de catalogo');
  ok(request.errors.some((error) => error.includes('Bajo, Medio, Alto')), 'expone opciones validas');
}

{
  const instance = {
    ...createAxosConnectorInstance('supplier_scorecard', 0, 'A1:G5'),
    type: 'unknown' as any,
  };
  const request = buildAxosConnectorRefreshRequest(instance);
  ok(!request.valid, 'rechaza tipo desconocido');
  eq(request.endpoint, '/office-documents/sheets/connectors/unknown', 'usa endpoint unknown seguro');
}

const total = passed + fails.length;
if (fails.length) { console.error(`FAILED ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
console.log(`OK ${passed}/${total}`);
