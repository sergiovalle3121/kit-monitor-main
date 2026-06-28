/* eslint-disable @typescript-eslint/no-explicit-any */
import { parseRange, type ChartConfig } from "./charts";
import { colName } from "./sheetOps";

export { AXOS_SHEET_CONNECTORS } from "@axos/contracts";
export { AXOS_SHEET_CONNECTOR_BY_TYPE as AXOS_CONNECTOR_BY_TYPE } from "@axos/contracts";
export { validateAxosSheetConnectorParams as validateConnectorParams } from "@axos/contracts";
export type {
  AxosSheetConnectorDefinition as AxosConnectorDefinition,
  AxosSheetConnectorParamDefinition as AxosConnectorParamDefinition,
  AxosSheetConnectorParamType as AxosConnectorParamType,
  AxosSheetConnectorParamValidation as AxosConnectorParamValidation,
  AxosSheetConnectorType as AxosConnectorType,
} from "@axos/contracts";

import {
  AXOS_SHEET_CONNECTOR_BY_TYPE,
  validateAxosSheetConnectorParams,
  type AxosSheetConnectorDefinition,
  type AxosSheetConnectorType,
} from "@axos/contracts";

type AxosConnectorType = AxosSheetConnectorType;
type AxosConnectorDefinition = AxosSheetConnectorDefinition;

export interface AxosConnectorInstance {
  id: string;
  type: AxosSheetConnectorType;
  label: string;
  sheetIndex: number;
  range: string;
  params?: Record<string, string>;
  lastRefreshedAt: string;
  lastRefreshSource?: 'api' | 'local';
  lastRefreshWarnings?: string[];
  tenantId?: string | null;
  readOnly: true;
}

export interface ConnectorTableBuild {
  celldata: any[];
  range: string;
  nRows: number;
  nCols: number;
}

function cellValueForConnector(value: string | number, bold = false) {
  const isNumber = typeof value === "number";
  return {
    v: value,
    m: isNumber ? value.toLocaleString("en-US") : String(value),
    ct: { fa: isNumber ? "General" : "General", t: isNumber ? "n" : "s" },
    ...(bold ? { bl: 1, bg: "#ecfdf5", fc: "#064e3b" } : {}),
  };
}

export interface AxosConnectorRefreshRequest {
  connectorId: string;
  type: AxosConnectorType;
  endpoint: string;
  method: "GET";
  params: Record<string, string>;
  range: string;
  sheetIndex: number;
  cacheKey: string;
  valid: boolean;
  errors: string[];
}

export function connectorRequestCacheKey(
  type: AxosConnectorType,
  params: Record<string, string> = {},
): string {
  const normalized = validateAxosSheetConnectorParams(type, params).params;
  const parts = Object.keys(normalized)
    .sort()
    .map((key) => `${key}=${encodeURIComponent(normalized[key])}`);
  return `${type}${parts.length ? "?" + parts.join("&") : ""}`;
}

export function buildAxosConnectorRefreshRequest(
  instance: AxosConnectorInstance,
): AxosConnectorRefreshRequest {
  const def = AXOS_SHEET_CONNECTOR_BY_TYPE[instance.type];
  const validation = validateAxosSheetConnectorParams(
    instance.type,
    instance.params ?? {},
  );
  return {
    connectorId: instance.id,
    type: instance.type,
    endpoint: def?.endpoint ?? "/office-documents/sheets/connectors/unknown",
    method: "GET",
    params: validation.params,
    range: instance.range,
    sheetIndex: instance.sheetIndex,
    cacheKey: connectorRequestCacheKey(instance.type, validation.params),
    valid: !!def && validation.ok,
    errors: validation.errors,
  };
}

export function summarizeConnectorRequests(
  instances: AxosConnectorInstance[],
): { requests: AxosConnectorRefreshRequest[]; valid: number; invalid: number } {
  const requests = instances.map((instance) =>
    buildAxosConnectorRefreshRequest(instance),
  );
  return {
    requests,
    valid: requests.filter((r) => r.valid).length,
    invalid: requests.filter((r) => !r.valid).length,
  };
}

export function connectorParamSummary(type: AxosConnectorType): string {
  const def = AXOS_SHEET_CONNECTOR_BY_TYPE[type];
  if (!def?.params.length) return "Sin parámetros requeridos.";
  return def.params
    .map((param) => `${param.label}${param.required ? " *" : ""}`)
    .join(" · ");
}

export interface AxosConnectorDatasetPayload {
  columns: string[];
  rows: (string | number)[][];
}

export function buildAxosConnectorTableFromDataset(
  dataset: AxosConnectorDatasetPayload,
  origin: { r: number; c: number },
): ConnectorTableBuild {
  const headers = dataset.columns.length ? dataset.columns : ["Sin datos"];
  const rows = dataset.rows.filter((row) => row.length === headers.length);
  const celldata: any[] = [];
  headers.forEach((header, i) =>
    celldata.push({
      r: origin.r,
      c: origin.c + i,
      v: cellValueForConnector(header, true),
    }),
  );
  rows.forEach((row, ri) =>
    row.forEach((value, ci) =>
      celldata.push({
        r: origin.r + ri + 1,
        c: origin.c + ci,
        v: cellValueForConnector(value),
      }),
    ),
  );
  return {
    celldata,
    nRows: rows.length + 1,
    nCols: headers.length,
    range: `${colName(origin.c)}${origin.r + 1}:${colName(origin.c + headers.length - 1)}${origin.r + rows.length + 1}`,
  };
}

export function buildAxosConnectorTable(
  type: AxosConnectorType,
  origin: { r: number; c: number },
): ConnectorTableBuild {
  const def = AXOS_SHEET_CONNECTOR_BY_TYPE[type];
  if (!def) throw new Error(`Conector AXOS no soportado: ${type}`);
  return buildAxosConnectorTableFromDataset(
    { columns: def.headers, rows: def.rows },
    origin,
  );
}

export function createAxosConnectorInstance(
  type: AxosConnectorType,
  sheetIndex: number,
  range: string,
  now = new Date(),
  params: Record<string, string> = {},
): AxosConnectorInstance {
  const def = AXOS_SHEET_CONNECTOR_BY_TYPE[type];
  if (!def) throw new Error(`Conector AXOS no soportado: ${type}`);
  return {
    id: `axc_${now.getTime().toString(36)}`,
    type,
    label: def.label,
    sheetIndex,
    range,
    params: validateAxosSheetConnectorParams(type, params).params,
    lastRefreshedAt: now.toISOString(),
    readOnly: true,
  };
}

export type AxosConnectorFreshness = "fresh" | "due" | "stale" | "invalid";

export interface AxosConnectorFreshnessReport {
  id: string;
  type: AxosConnectorType;
  label: string;
  status: AxosConnectorFreshness;
  ageMinutes: number | null;
  refreshPolicy: AxosConnectorDefinition["refreshPolicy"];
}

export function connectorFreshnessFor(
  instance: AxosConnectorInstance,
  now = new Date(),
): AxosConnectorFreshnessReport {
  const def = AXOS_SHEET_CONNECTOR_BY_TYPE[instance.type];
  const refreshedAt = Date.parse(String(instance.lastRefreshedAt ?? ""));
  if (!def || !Number.isFinite(refreshedAt)) {
    return {
      id: instance.id,
      type: instance.type,
      label: instance.label,
      status: "invalid",
      ageMinutes: null,
      refreshPolicy: def?.refreshPolicy ?? "manual",
    };
  }
  const ageMinutes = Math.max(
    0,
    Math.floor((now.getTime() - refreshedAt) / 60000),
  );
  const dueAfter = def.refreshPolicy === "scheduled-ready" ? 60 : 24 * 60;
  const staleAfter =
    def.refreshPolicy === "scheduled-ready" ? 24 * 60 : 7 * 24 * 60;
  const status: AxosConnectorFreshness =
    ageMinutes > staleAfter ? "stale" : ageMinutes > dueAfter ? "due" : "fresh";
  return {
    id: instance.id,
    type: instance.type,
    label: instance.label,
    status,
    ageMinutes,
    refreshPolicy: def.refreshPolicy,
  };
}

export function connectorRefreshDue(
  instance: AxosConnectorInstance,
  now = new Date(),
): boolean {
  const status = connectorFreshnessFor(instance, now).status;
  return status === "due" || status === "stale" || status === "invalid";
}

export function summarizeConnectorFreshness(
  instances: AxosConnectorInstance[],
  now = new Date(),
): {
  reports: AxosConnectorFreshnessReport[];
  due: number;
  stale: number;
  invalid: number;
} {
  const reports = instances.map((instance) =>
    connectorFreshnessFor(instance, now),
  );
  return {
    reports,
    due: reports.filter((report) => report.status === "due").length,
    stale: reports.filter((report) => report.status === "stale").length,
    invalid: reports.filter((report) => report.status === "invalid").length,
  };
}

export function originFromConnectorRange(
  range: string,
): { r: number; c: number } | null {
  const parsed = parseRange(range);
  return parsed ? { r: parsed.r1, c: parsed.c1 } : null;
}

export function refreshedAxosConnectorInstance(
  instance: AxosConnectorInstance,
  now = new Date(),
): AxosConnectorInstance {
  return { ...instance, lastRefreshedAt: now.toISOString(), lastRefreshSource: 'local' };
}


export function connectorInstanceFromDataset(
  instance: AxosConnectorInstance,
  dataset: { asOf?: string; params?: Record<string, string>; source?: string; tenantId?: string | null; warnings?: string[] },
): AxosConnectorInstance {
  const asOf = typeof dataset.asOf === 'string' && dataset.asOf ? dataset.asOf : instance.lastRefreshedAt;
  return {
    ...instance,
    lastRefreshedAt: asOf,
    params: dataset.params ?? instance.params,
    lastRefreshSource: 'api',
    tenantId: dataset.tenantId ?? instance.tenantId ?? null,
    lastRefreshWarnings: Array.isArray(dataset.warnings) ? dataset.warnings : [],
  };
}

export function buildAxosConnectorRefresh(
  instance: AxosConnectorInstance,
  now = new Date(),
): { instance: AxosConnectorInstance; table: ConnectorTableBuild } | null {
  const origin = originFromConnectorRange(instance.range);
  if (!origin) return null;
  const table = buildAxosConnectorTable(instance.type, origin);
  return {
    table,
    instance: {
      ...refreshedAxosConnectorInstance(instance, now),
      range: table.range,
    },
  };
}

export function formatConnectorRefreshReport(summary: { total: number; api: number; fallback: number; warnings: number }): string {
  if (!summary.total) return 'No hay conectores AXOS insertados.';
  const parts = [`${summary.total} conector(es) actualizados`];
  if (summary.api) parts.push(`${summary.api} vía API`);
  if (summary.fallback) parts.push(`${summary.fallback} con fallback local`);
  if (summary.warnings) parts.push(`${summary.warnings} con warnings`);
  return parts.join(' · ');
}

export function connectorProtectionFor(instance: AxosConnectorInstance): {
  range: string;
  locked: true;
  reason: string;
  connectorId: string;
  connectorType: AxosConnectorType;
} {
  return {
    range: instance.range,
    locked: true,
    reason: `AXOS connector · ${instance.label}`,
    connectorId: instance.id,
    connectorType: instance.type,
  };
}

export function suggestedChartsForConnector(
  instance: AxosConnectorInstance,
): ChartConfig[] {
  const base = {
    id: `axc_chart_${instance.id}`,
    sheetIndex: instance.sheetIndex,
    range: instance.range,
    legend: "bottom" as const,
    palette: "brand",
  };
  switch (instance.type) {
    case "inventory_snapshot":
      return [
        {
          ...base,
          type: "bar",
          title: `${instance.label} · Disponible/Reservado`,
          yTitle: "Cantidad",
        },
      ];
    case "bom_cost_rollup":
      return [
        {
          ...base,
          type: "doughnut",
          title: `${instance.label} · Costo por componente`,
          yTitle: "Costo",
        },
      ];
    case "work_orders":
      return [
        {
          ...base,
          type: "bar",
          title: `${instance.label} · Plan vs buenas`,
          yTitle: "Cantidad",
        },
      ];
    case "oee_by_line":
      return [
        {
          ...base,
          type: "combo",
          title: `${instance.label} · OEE`,
          yTitle: "Componentes",
          y1Title: "OEE",
          series: [
            { type: "bar" },
            { type: "bar" },
            { type: "bar" },
            { type: "line", axis: "y1", color: "#ef4444" },
          ],
        },
      ];
    case "supplier_scorecard":
      return [
        {
          ...base,
          type: "radar",
          title: `${instance.label} · Score proveedor`,
          yTitle: "Score",
        },
      ];
    case "ncr_scrap":
      return [
        {
          ...base,
          type: "bar",
          title: `${instance.label} · Scrap por defecto`,
          yTitle: "Qty / costo",
        },
      ];
    case "purchase_orders":
      return [
        {
          ...base,
          type: "bar",
          title: `${instance.label} · Qty abierta`,
          yTitle: "Cantidad",
        },
      ];
    case "mrp_shortages":
      return [
        {
          ...base,
          type: "bar",
          title: `${instance.label} · Shortage`,
          yTitle: "Cantidad",
        },
      ];
    default:
      return [];
  }
}
