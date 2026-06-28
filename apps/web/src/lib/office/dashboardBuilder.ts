/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ChartConfig } from './charts';

export interface DashboardBuildInput {
  sheets: any[];
  charts?: ChartConfig[];
  pivots?: { id: string; sheetName: string; config?: any }[];
  connectors?: { id: string; label?: string; type?: string; range?: string; sheetIndex?: number; lastRefreshedAt?: string }[];
}

export interface DashboardBuildResult {
  sheet: any;
  charts: ChartConfig[];
  sheetIndex: number;
}

const NUM = '#,##0';

function cell(r: number, c: number, value: any, opts: any = {}) {
  const isFormula = typeof value === 'string' && value.startsWith('=');
  return {
    r, c,
    v: {
      v: isFormula ? opts.cached ?? null : value,
      m: opts.display ?? (isFormula ? String(opts.cached ?? '') : String(value ?? '')),
      ...(isFormula ? { f: value } : {}),
      ct: { fa: opts.fa ?? 'General', t: opts.t ?? (typeof value === 'number' || isFormula ? 'n' : 's') },
      ...(opts.bg ? { bg: opts.bg } : {}),
      ...(opts.fc ? { fc: opts.fc } : {}),
      ...(opts.bl ? { bl: 1 } : {}),
      ...(opts.fs ? { fs: opts.fs } : {}),
      ...(opts.ht != null ? { ht: opts.ht } : {}),
      ...(opts.vt != null ? { vt: opts.vt } : {}),
    },
  };
}

function uniqueDashboardName(sheets: any[]) {
  const existing = new Set(sheets.map((s) => String(s?.name ?? '').toLowerCase()));
  let name = 'Dashboard Ejecutivo';
  let i = 2;
  while (existing.has(name.toLowerCase())) name = `Dashboard Ejecutivo ${i++}`;
  return name;
}

function firstConnectorRange(connectors: DashboardBuildInput['connectors']) {
  const c = connectors?.find((x) => x.range && Number.isInteger(x.sheetIndex));
  return c ? { connector: c, sheetIndex: c.sheetIndex ?? 0, range: c.range as string } : null;
}

export function buildExecutiveDashboard(input: DashboardBuildInput): DashboardBuildResult {
  const sheetIndex = input.sheets.length;
  const name = uniqueDashboardName(input.sheets);
  const source = firstConnectorRange(input.connectors);
  const cells: any[] = [];
  const add = (r: number, c: number, v: any, opts?: any) => cells.push(cell(r, c, v, opts));

  add(0, 0, 'AXOS Sheets · Executive Dashboard', { bg: '#0f172a', fc: '#ffffff', bl: true, fs: 16 });
  add(1, 0, 'Dashboard generado desde conectores, pivots, charts y análisis what-if del workbook.', { fc: '#64748b' });
  add(3, 0, 'KPI', { bg: '#111827', fc: '#ffffff', bl: true });
  add(3, 1, 'Valor', { bg: '#111827', fc: '#ffffff', bl: true });
  add(3, 2, 'Fuente', { bg: '#111827', fc: '#ffffff', bl: true });

  const connectorLabel = source?.connector.label || source?.connector.type || 'Datos AXOS';
  if (source) {
    add(4, 0, 'Filas conectadas', { bg: '#ecfdf5', bl: true });
    add(4, 1, `=COUNTA('${input.sheets[source.sheetIndex]?.name ?? 'Hoja 1'}'!${source.range.split(':')[0]}:${source.range.split(':')[1]})-1`, { cached: 0, fa: NUM, bg: '#ecfdf5', bl: true });
    add(4, 2, connectorLabel, { bg: '#ecfdf5' });
    add(5, 0, 'Último refresh', { bg: '#f8fafc', bl: true });
    add(5, 1, source.connector.lastRefreshedAt || 'Pendiente', { bg: '#f8fafc' });
    add(5, 2, source.range, { bg: '#f8fafc' });
  } else {
    add(4, 0, 'Preparación', { bg: '#fef3c7', bl: true });
    add(4, 1, 'Inserta un conector AXOS o tabla', { bg: '#fef3c7' });
    add(4, 2, 'AXOS Data', { bg: '#fef3c7' });
  }
  add(6, 0, 'Pivots guardadas', { bl: true });
  add(6, 1, input.pivots?.length ?? 0, { fa: NUM });
  add(6, 2, 'Pivot Workbench');
  add(7, 0, 'Charts persistidos', { bl: true });
  add(7, 1, input.charts?.length ?? 0, { fa: NUM });
  add(7, 2, 'Chart layer');
  add(8, 0, 'What-if ready', { bl: true });
  add(8, 1, 'Goal Seek · Solver · Escenarios');
  add(8, 2, 'Datos > Análisis de hipótesis');

  add(10, 0, 'Executive narrative', { bg: '#111827', fc: '#ffffff', bl: true });
  add(11, 0, '1. Refresca conectores AXOS antes de publicar.');
  add(12, 0, '2. Actualiza tablas dinámicas y slicers para explorar línea, turno, proveedor o commodity.');
  add(13, 0, '3. Usa Goal Seek/Solver para simular objetivos de margen, OEE o capacidad.');

  add(3, 4, 'Visualizaciones', { bg: '#111827', fc: '#ffffff', bl: true });
  add(4, 4, 'Charts existentes se mantienen en el panel de gráficas y se anclan a esta hoja cuando aplique.');
  add(6, 4, 'Slicers / timelines', { bg: '#111827', fc: '#ffffff', bl: true });
  add(7, 4, 'Selecciona una columna de la tabla fuente y usa Datos > Segmentación de datos.');

  const sheet = {
    name,
    celldata: cells,
    order: sheetIndex,
    row: 40,
    column: 12,
    status: 1,
    config: {
      columnlen: { 0: 190, 1: 160, 2: 220, 4: 360 },
      rowlen: { 0: 34, 1: 28 },
      merge: { '0_0': { r: 0, c: 0, rs: 1, cs: 5 }, '1_0': { r: 1, c: 0, rs: 1, cs: 5 } },
    },
    axosDashboard: { generatedAt: new Date().toISOString(), sourceConnectorId: source?.connector.id ?? null },
  };

  const baseCharts: ChartConfig[] = source ? [
    { id: `dash_${Date.now().toString(36)}_bar`, title: `${connectorLabel} · resumen`, type: 'bar', range: source.range, sheetIndex: source.sheetIndex, legend: 'bottom', palette: 'brand' },
  ] : [];

  return { sheet, charts: [...(input.charts ?? []), ...baseCharts], sheetIndex };
}
