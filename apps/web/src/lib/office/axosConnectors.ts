/* eslint-disable @typescript-eslint/no-explicit-any */
import { parseRange, type ChartConfig } from './charts';
import { colName } from './sheetOps';

export type AxosConnectorType =
  | 'inventory_snapshot'
  | 'bom_cost_rollup'
  | 'work_orders'
  | 'oee_by_line'
  | 'supplier_scorecard'
  | 'ncr_scrap'
  | 'purchase_orders'
  | 'mrp_shortages';

export interface AxosConnectorDefinition {
  type: AxosConnectorType;
  label: string;
  description: string;
  domain: 'Inventory' | 'BOM' | 'Production' | 'OEE' | 'Quality' | 'Purchasing' | 'MRP' | 'Supplier';
  refreshPolicy: 'manual' | 'scheduled-ready';
  headers: string[];
  rows: (string | number)[][];
}

export interface AxosConnectorInstance {
  id: string;
  type: AxosConnectorType;
  label: string;
  sheetIndex: number;
  range: string;
  params?: Record<string, string>;
  lastRefreshedAt: string;
  readOnly: true;
}

export interface ConnectorTableBuild {
  celldata: any[];
  range: string;
  nRows: number;
  nCols: number;
}

function cellValueForConnector(value: string | number, bold = false) {
  const isNumber = typeof value === 'number';
  return {
    v: value,
    m: isNumber ? value.toLocaleString('en-US') : String(value),
    ct: { fa: isNumber ? 'General' : 'General', t: isNumber ? 'n' : 's' },
    ...(bold ? { bl: 1, bg: '#ecfdf5', fc: '#064e3b' } : {}),
  };
}

export const AXOS_SHEET_CONNECTORS: AxosConnectorDefinition[] = [
  {
    type: 'inventory_snapshot',
    label: 'Inventory snapshot',
    domain: 'Inventory',
    refreshPolicy: 'manual',
    description: 'Existencias por SKU/ubicación con reservado, tránsito, valor estándar y clase ABC.',
    headers: ['SKU', 'Ubicación', 'Disponible', 'Reservado', 'En tránsito', 'Valor estándar', 'Clase ABC'],
    rows: [
      ['AXOS-1000', 'MAIN', 184, 32, 48, 12.75, 'A'],
      ['PCB-DRV-01', 'SMT', 420, 80, 120, 6.46, 'A'],
      ['HARNESS-08', 'LINE-2', 96, 12, 30, 3.1, 'B'],
      ['BRKT-STL', 'FAB', 640, 44, 0, 1.18, 'C'],
    ],
  },
  {
    type: 'bom_cost_rollup',
    label: 'BOM cost rollup',
    domain: 'BOM',
    refreshPolicy: 'manual',
    description: 'Rollup de costo por componente/commodity con scrap y costo extendido.',
    headers: ['Padre', 'Componente', 'Commodity', 'Qty', 'Costo estándar', 'Scrap %', 'Costo extendido'],
    rows: [
      ['AXOS-1000', 'PCB-DRV-01', 'PCB', 1, 12.75, 0.02, 13.01],
      ['AXOS-1000', 'HARNESS-08', 'Cableado', 2, 3.1, 0.01, 6.26],
      ['AXOS-1000', 'LABOR-ASSY', 'Labor', 0.35, 28, 0, 9.8],
      ['AXOS-1000', 'OH-SMT', 'Overhead', 0.18, 45, 0, 8.1],
    ],
  },
  {
    type: 'work_orders',
    label: 'Work orders',
    domain: 'Production',
    refreshPolicy: 'scheduled-ready',
    description: 'Órdenes de trabajo por línea/estado para planeación y seguimiento.',
    headers: ['WO', 'SKU', 'Línea', 'Estado', 'Qty plan', 'Qty buena', 'Inicio plan', 'Prioridad'],
    rows: [
      ['WO-10420', 'AXOS-1000', 'Línea 1', 'Liberada', 240, 96, '2026-06-29', 'Alta'],
      ['WO-10421', 'PCB-DRV-01', 'SMT', 'En proceso', 600, 420, '2026-06-29', 'Media'],
      ['WO-10422', 'HARNESS-08', 'Línea 2', 'Planeada', 350, 0, '2026-06-30', 'Media'],
      ['WO-10423', 'AXOS-2000', 'Línea 3', 'Bloqueada', 120, 0, '2026-07-01', 'Crítica'],
    ],
  },
  {
    type: 'oee_by_line',
    label: 'OEE by line',
    domain: 'OEE',
    refreshPolicy: 'manual',
    description: 'Disponibilidad, performance, calidad y OEE por línea/turno.',
    headers: ['Línea', 'Turno', 'Disponibilidad', 'Performance', 'Calidad', 'OEE'],
    rows: [
      ['Línea 1', 'A', 0.92, 0.88, 0.98, 0.793],
      ['Línea 1', 'B', 0.86, 0.9, 0.97, 0.751],
      ['Línea 2', 'A', 0.94, 0.84, 0.99, 0.782],
      ['Línea 3', 'C', 0.81, 0.79, 0.95, 0.608],
    ],
  },
  {
    type: 'supplier_scorecard',
    label: 'Supplier scorecard',
    domain: 'Supplier',
    refreshPolicy: 'scheduled-ready',
    description: 'Score proveedor con OTD, calidad, costo, respuesta y estado.',
    headers: ['Proveedor', 'OTD', 'Calidad', 'Costo', 'Respuesta', 'Score', 'Estado'],
    rows: [
      ['North Metals', 0.96, 0.98, 0.91, 0.9, 0.946, 'Aprobado'],
      ['Delta Plastics', 0.88, 0.93, 0.86, 0.84, 0.886, 'Monitorear'],
      ['Kyo Electronics', 0.91, 0.99, 0.89, 0.92, 0.936, 'Aprobado'],
      ['Rapid Freight', 0.79, 0.9, 0.82, 0.78, 0.824, 'Acción'],
    ],
  },
  {
    type: 'ncr_scrap',
    label: 'NCR / Scrap',
    domain: 'Quality',
    refreshPolicy: 'manual',
    description: 'No conformidades y scrap por defecto, línea, costo y responsable.',
    headers: ['NCR', 'Fecha', 'Línea', 'Defecto', 'Qty scrap', 'Costo scrap', 'Responsable'],
    rows: [
      ['NCR-8801', '2026-06-24', 'Línea 1', 'Soldadura', 12, 184.2, 'Calidad'],
      ['NCR-8802', '2026-06-24', 'SMT', 'Componente', 8, 96.4, 'Proceso'],
      ['NCR-8803', '2026-06-25', 'Línea 2', 'Torque', 18, 142.7, 'Mantenimiento'],
      ['NCR-8804', '2026-06-25', 'Línea 3', 'Etiqueta', 31, 38.9, 'Producción'],
    ],
  },
  {
    type: 'purchase_orders',
    label: 'Purchase orders',
    domain: 'Purchasing',
    refreshPolicy: 'scheduled-ready',
    description: 'Órdenes de compra abiertas con proveedor, ETA, qty, precio y riesgo.',
    headers: ['PO', 'Proveedor', 'SKU', 'ETA', 'Qty abierta', 'Precio', 'Riesgo'],
    rows: [
      ['PO-7201', 'North Metals', 'BRKT-STL', '2026-06-30', 1200, 1.18, 'Bajo'],
      ['PO-7202', 'Kyo Electronics', 'PCB-DRV-01', '2026-07-02', 900, 6.46, 'Medio'],
      ['PO-7203', 'Delta Plastics', 'COVER-ABS', '2026-07-05', 650, 2.32, 'Alto'],
      ['PO-7204', 'Rapid Freight', 'SHIP-EXP', '2026-06-28', 1, 480, 'Medio'],
    ],
  },
  {
    type: 'mrp_shortages',
    label: 'MRP shortages',
    domain: 'MRP',
    refreshPolicy: 'manual',
    description: 'Faltantes MRP por SKU con demanda, disponible, incoming y fecha de necesidad.',
    headers: ['SKU', 'Demanda', 'Disponible', 'Incoming', 'Shortage', 'Fecha necesidad', 'Comprador'],
    rows: [
      ['PCB-DRV-01', 720, 420, 120, 180, '2026-07-01', 'Ana'],
      ['HARNESS-08', 280, 96, 30, 154, '2026-07-02', 'Luis'],
      ['COVER-ABS', 650, 220, 300, 130, '2026-07-05', 'Mia'],
      ['SENSOR-T', 160, 75, 40, 45, '2026-07-06', 'Noah'],
    ],
  },
];

export const AXOS_CONNECTOR_BY_TYPE: Record<AxosConnectorType, AxosConnectorDefinition> = AXOS_SHEET_CONNECTORS.reduce((acc, def) => {
  acc[def.type] = def;
  return acc;
}, {} as Record<AxosConnectorType, AxosConnectorDefinition>);

export function buildAxosConnectorTable(type: AxosConnectorType, origin: { r: number; c: number }): ConnectorTableBuild {
  const def = AXOS_CONNECTOR_BY_TYPE[type];
  if (!def) throw new Error(`Conector AXOS no soportado: ${type}`);
  const celldata: any[] = [];
  def.headers.forEach((header, i) => celldata.push({ r: origin.r, c: origin.c + i, v: cellValueForConnector(header, true) }));
  def.rows.forEach((row, ri) => row.forEach((value, ci) => celldata.push({ r: origin.r + ri + 1, c: origin.c + ci, v: cellValueForConnector(value) })));
  return {
    celldata,
    nRows: def.rows.length + 1,
    nCols: def.headers.length,
    range: `${colName(origin.c)}${origin.r + 1}:${colName(origin.c + def.headers.length - 1)}${origin.r + def.rows.length + 1}`,
  };
}

export function createAxosConnectorInstance(type: AxosConnectorType, sheetIndex: number, range: string, now = new Date()): AxosConnectorInstance {
  const def = AXOS_CONNECTOR_BY_TYPE[type];
  if (!def) throw new Error(`Conector AXOS no soportado: ${type}`);
  return {
    id: `axc_${now.getTime().toString(36)}`,
    type,
    label: def.label,
    sheetIndex,
    range,
    params: {},
    lastRefreshedAt: now.toISOString(),
    readOnly: true,
  };
}


export type AxosConnectorFreshness = 'fresh' | 'due' | 'stale' | 'invalid';

export interface AxosConnectorFreshnessReport {
  id: string;
  type: AxosConnectorType;
  label: string;
  status: AxosConnectorFreshness;
  ageMinutes: number | null;
  refreshPolicy: AxosConnectorDefinition['refreshPolicy'];
}

export function connectorFreshnessFor(instance: AxosConnectorInstance, now = new Date()): AxosConnectorFreshnessReport {
  const def = AXOS_CONNECTOR_BY_TYPE[instance.type];
  const refreshedAt = Date.parse(String(instance.lastRefreshedAt ?? ''));
  if (!def || !Number.isFinite(refreshedAt)) {
    return { id: instance.id, type: instance.type, label: instance.label, status: 'invalid', ageMinutes: null, refreshPolicy: def?.refreshPolicy ?? 'manual' };
  }
  const ageMinutes = Math.max(0, Math.floor((now.getTime() - refreshedAt) / 60000));
  const dueAfter = def.refreshPolicy === 'scheduled-ready' ? 60 : 24 * 60;
  const staleAfter = def.refreshPolicy === 'scheduled-ready' ? 24 * 60 : 7 * 24 * 60;
  const status: AxosConnectorFreshness = ageMinutes > staleAfter ? 'stale' : ageMinutes > dueAfter ? 'due' : 'fresh';
  return { id: instance.id, type: instance.type, label: instance.label, status, ageMinutes, refreshPolicy: def.refreshPolicy };
}

export function connectorRefreshDue(instance: AxosConnectorInstance, now = new Date()): boolean {
  const status = connectorFreshnessFor(instance, now).status;
  return status === 'due' || status === 'stale' || status === 'invalid';
}

export function summarizeConnectorFreshness(instances: AxosConnectorInstance[], now = new Date()): { reports: AxosConnectorFreshnessReport[]; due: number; stale: number; invalid: number } {
  const reports = instances.map((instance) => connectorFreshnessFor(instance, now));
  return {
    reports,
    due: reports.filter((report) => report.status === 'due').length,
    stale: reports.filter((report) => report.status === 'stale').length,
    invalid: reports.filter((report) => report.status === 'invalid').length,
  };
}

export function originFromConnectorRange(range: string): { r: number; c: number } | null {
  const parsed = parseRange(range);
  return parsed ? { r: parsed.r1, c: parsed.c1 } : null;
}

export function refreshedAxosConnectorInstance(instance: AxosConnectorInstance, now = new Date()): AxosConnectorInstance {
  return { ...instance, lastRefreshedAt: now.toISOString() };
}

export function buildAxosConnectorRefresh(instance: AxosConnectorInstance, now = new Date()): { instance: AxosConnectorInstance; table: ConnectorTableBuild } | null {
  const origin = originFromConnectorRange(instance.range);
  if (!origin) return null;
  const table = buildAxosConnectorTable(instance.type, origin);
  return { table, instance: { ...refreshedAxosConnectorInstance(instance, now), range: table.range } };
}


export function connectorProtectionFor(instance: AxosConnectorInstance): { range: string; locked: true; reason: string; connectorId: string; connectorType: AxosConnectorType } {
  return {
    range: instance.range,
    locked: true,
    reason: `AXOS connector · ${instance.label}`,
    connectorId: instance.id,
    connectorType: instance.type,
  };
}


export function suggestedChartsForConnector(instance: AxosConnectorInstance): ChartConfig[] {
  const base = {
    id: `axc_chart_${instance.id}`,
    sheetIndex: instance.sheetIndex,
    range: instance.range,
    legend: 'bottom' as const,
    palette: 'brand',
  };
  switch (instance.type) {
    case 'inventory_snapshot':
      return [{ ...base, type: 'bar', title: `${instance.label} · Disponible/Reservado`, yTitle: 'Cantidad' }];
    case 'bom_cost_rollup':
      return [{ ...base, type: 'doughnut', title: `${instance.label} · Costo por componente`, yTitle: 'Costo' }];
    case 'work_orders':
      return [{ ...base, type: 'bar', title: `${instance.label} · Plan vs buenas`, yTitle: 'Cantidad' }];
    case 'oee_by_line':
      return [{ ...base, type: 'combo', title: `${instance.label} · OEE`, yTitle: 'Componentes', y1Title: 'OEE', series: [{ type: 'bar' }, { type: 'bar' }, { type: 'bar' }, { type: 'line', axis: 'y1', color: '#ef4444' }] }];
    case 'supplier_scorecard':
      return [{ ...base, type: 'radar', title: `${instance.label} · Score proveedor`, yTitle: 'Score' }];
    case 'ncr_scrap':
      return [{ ...base, type: 'bar', title: `${instance.label} · Scrap por defecto`, yTitle: 'Qty / costo' }];
    case 'purchase_orders':
      return [{ ...base, type: 'bar', title: `${instance.label} · Qty abierta`, yTitle: 'Cantidad' }];
    case 'mrp_shortages':
      return [{ ...base, type: 'bar', title: `${instance.label} · Shortage`, yTitle: 'Cantidad' }];
    default:
      return [];
  }
}
