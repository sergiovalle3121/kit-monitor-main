/** MRP Control Room template should be connected, governed, and dashboard-ready. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { buildChartData } from '@/lib/office/charts';
import { TEMPLATES } from '@/lib/office/templates';

let passed = 0; const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };
const eq = (a: unknown, b: unknown, m: string) => { if (a === b) passed++; else fails.push(`${m} - esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

(async () => {
  const template = TEMPLATES.sheet.find((item) => item.id === 'mrp-shortages-control-room');
  ok(!!template, 'template visible en galeria de Sheets');
  const content = await template!.build();

  ok(!!content && !Array.isArray(content), 'devuelve workbook enriquecido');
  eq(content.sheets.length, 4, 'incluye dashboard, raw, actions y assumptions');
  ok(content.sheets.some((sheet: { name?: string }) => sheet.name === 'MRP Dashboard'), 'incluye dashboard MRP');
  ok(content.sheets.some((sheet: { name?: string }) => sheet.name === 'MRP Raw'), 'incluye hoja raw MRP');
  ok(content.sheets.some((sheet: { name?: string }) => sheet.name === 'Actions'), 'incluye action plan');

  eq(content.connectors.length, 1, 'incluye una instancia de conector');
  eq(content.connectors[0].type, 'mrp_shortages', 'usa conector MRP existente');
  eq(content.connectors[0].sheetIndex, 1, 'conector apunta a MRP Raw');
  eq(content.connectors[0].range, 'A1:G5', 'conector protege solo la tabla gobernada');

  const raw = content.sheets[1];
  const ranges = raw.axosProtection?.ranges ?? [];
  ok(ranges.some((range: { connectorType?: string; range?: string }) => range.connectorType === 'mrp_shortages' && range.range === 'A1:G5'), 'protege rango de conector');
  ok(raw.celldata.some((cell: any) => cell.r === 1 && cell.c === 7 && cell.v?.f === '=IFERROR((C2+D2)/B2,0)'), 'mantiene formulas de cobertura junto al conector');
  ok(raw.celldata.some((cell: any) => cell.r === 1 && cell.c === 9 && String(cell.v?.f).includes('"Critical"')), 'mantiene formula de prioridad');

  ok(content.tables.some((table: { name?: string; range?: string }) => table.name === 'MRP_SHORTAGES' && table.range === 'A1:J5'), 'registra tabla estructurada');
  ok(content.names.some((name: { name?: string; range?: string }) => name.name === 'MRP_SHORTAGE_QTY' && name.range === 'E2:E5'), 'registra nombre para shortage qty');
  ok(content.names.some((name: { name?: string; range?: string }) => name.name === 'MRP_COVERAGE' && name.range === 'H2:H5'), 'registra nombre para coverage');

  const actions = content.sheets[2];
  ok(!!actions.dataVerification?.['1_2'], 'valida prioridad de acciones');
  ok(!!actions.dataVerification?.['1_4'], 'valida estado de acciones');
  eq(content.printLayout.orientation, 'landscape', 'incluye layout de impresion horizontal');
  ok(Array.isArray(content.comments) && content.comments.length === 1, 'incluye comentario de contrato honesto');

  eq(content.charts.length, 2, 'incluye dos charts industriales');
  for (const chart of content.charts) {
    eq(chart.sheetIndex, 1, `${chart.id}: chart usa MRP Raw`);
    const data = buildChartData(content.sheets[chart.sheetIndex], chart);
    ok(!!data && Array.isArray(data.datasets) && data.datasets.length > 0, `${chart.id}: chart data valido`);
  }

  const total = passed + fails.length;
  if (fails.length) { console.error(`FAIL ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
  else console.log(`OK ${passed}/${total}`);
})().catch((e) => { console.error(e); process.exit(1); });
