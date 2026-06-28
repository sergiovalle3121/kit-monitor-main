/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  AXOS_CONNECTOR_BY_TYPE,
  AXOS_SHEET_CONNECTORS,
  buildAxosConnectorTable,
  createAxosConnectorInstance,
  connectorProtectionFor,
  suggestedChartsForConnector,
  type AxosConnectorInstance,
  type AxosConnectorType,
} from "./axosConnectors";
import { buildPivot, pivotToCelldata, type PivotConfig } from "./sheetOps";
import type { ChartConfig } from "./charts";

export type WorkbenchMetric =
  | "inventory_value_by_abc"
  | "oee_by_line"
  | "scrap_cost_by_defect"
  | "supplier_score"
  | "shortages_by_buyer";
export type QueryStepKind =
  | "source"
  | "keep-columns"
  | "type-cast"
  | "filter"
  | "add-calculated-column"
  | "load-table"
  | "build-pivot"
  | "suggest-chart";

export interface WorkbenchPlan {
  id: string;
  title: string;
  description: string;
  connectors: AxosConnectorType[];
  metric: WorkbenchMetric;
}

export interface WorkbenchQueryStep {
  kind: QueryStepKind;
  label: string;
  detail: string;
}
export interface WorkbenchBuildResult {
  sheets: any[];
  connectors: AxosConnectorInstance[];
  pivots: { id: string; config: PivotConfig; sheetName: string }[];
  charts: ChartConfig[];
  steps: WorkbenchQueryStep[];
  summary: string;
}

export const AXOS_DATA_WORKBENCH_PLANS: WorkbenchPlan[] = [
  {
    id: "inventory-control-tower",
    title: "Inventory control tower",
    description:
      "Inventario, faltantes MRP y valor por clase ABC para compras/planeación.",
    connectors: ["inventory_snapshot", "mrp_shortages", "purchase_orders"],
    metric: "inventory_value_by_abc",
  },
  {
    id: "production-oee-quality",
    title: "Production + OEE + Quality",
    description:
      "OEE por línea junto con scrap/NCR para juntas diarias de producción.",
    connectors: ["work_orders", "oee_by_line", "ncr_scrap"],
    metric: "oee_by_line",
  },
  {
    id: "supplier-cost-risk",
    title: "Supplier, BOM cost & risk",
    description: "Scorecard de proveedores, OC abiertas y rollup de costo BOM.",
    connectors: ["supplier_scorecard", "purchase_orders", "bom_cost_rollup"],
    metric: "supplier_score",
  },
];

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

function sheetWithConnector(type: AxosConnectorType, order: number, now: Date) {
  const def = AXOS_CONNECTOR_BY_TYPE[type];
  const table = buildAxosConnectorTable(type, { r: 2, c: 0 });
  const instance = createAxosConnectorInstance(type, order, table.range, now);
  const sheet = {
    name: def.label,
    order,
    row: Math.max(80, table.nRows + 8),
    column: Math.max(16, table.nCols + 4),
    status: order === 0 ? 1 : 0,
    config: { columnlen: {} as Record<number, number> },
    celldata: table.celldata,
    axosProtection: { ranges: [connectorProtectionFor(instance)] },
  };
  def.headers.forEach((header, i) => {
    sheet.config.columnlen[i] = Math.max(110, String(header).length * 12);
  });
  return { sheet, instance };
}

function metricPivotFor(
  metric: WorkbenchMetric,
  sourceIndex: number,
): PivotConfig {
  switch (metric) {
    case "inventory_value_by_abc":
      return {
        sheetIndex: sourceIndex,
        range: "A3:G7",
        rows: ["Clase ABC"],
        cols: [],
        values: [
          { field: "Valor estándar", agg: "sum" },
          { field: "Disponible", agg: "sum" },
        ],
      };
    case "oee_by_line":
      return {
        sheetIndex: sourceIndex,
        range: "A3:F7",
        rows: ["Línea"],
        cols: ["Turno"],
        values: [{ field: "OEE", agg: "avg" }],
      };
    case "scrap_cost_by_defect":
      return {
        sheetIndex: sourceIndex,
        range: "A3:G7",
        rows: ["Defecto"],
        cols: [],
        values: [
          { field: "Costo scrap", agg: "sum" },
          { field: "Qty scrap", agg: "sum" },
        ],
      };
    case "supplier_score":
      return {
        sheetIndex: sourceIndex,
        range: "A3:G7",
        rows: ["Estado"],
        cols: [],
        values: [
          { field: "Score", agg: "avg" },
          { field: "OTD", agg: "avg" },
          { field: "Calidad", agg: "avg" },
        ],
      };
    case "shortages_by_buyer":
      return {
        sheetIndex: sourceIndex,
        range: "A3:G7",
        rows: ["Comprador"],
        cols: [],
        values: [
          { field: "Shortage", agg: "sum" },
          { field: "Demanda", agg: "sum" },
        ],
      };
  }
}

function sourceForMetric(plan: WorkbenchPlan): AxosConnectorType {
  if (plan.metric === "inventory_value_by_abc") return "inventory_snapshot";
  if (plan.metric === "oee_by_line") return "oee_by_line";
  if (plan.metric === "scrap_cost_by_defect") return "ncr_scrap";
  if (plan.metric === "shortages_by_buyer") return "mrp_shortages";
  return "supplier_scorecard";
}

export function buildAxosDataWorkbench(
  planId: string,
  now = new Date(),
): WorkbenchBuildResult {
  const plan =
    AXOS_DATA_WORKBENCH_PLANS.find((x) => x.id === planId) ??
    AXOS_DATA_WORKBENCH_PLANS[0];
  const sheets: any[] = [];
  const connectors: AxosConnectorInstance[] = [];
  const steps: WorkbenchQueryStep[] = [];
  for (const type of plan.connectors) {
    const { sheet, instance } = sheetWithConnector(type, sheets.length, now);
    sheets.push(sheet);
    connectors.push(instance);
    const def = AXOS_CONNECTOR_BY_TYPE[type];
    steps.push({
      kind: "source",
      label: `Conectar ${def.label}`,
      detail: `${def.domain} · ${def.refreshPolicy}`,
    });
    steps.push({
      kind: "type-cast",
      label: "Tipar columnas",
      detail: `${def.headers.length} columnas listas para fórmula, pivot y chart.`,
    });
    steps.push({
      kind: "load-table",
      label: "Cargar tabla gobernada",
      detail: `${instance.range} protegido contra edición accidental.`,
    });
  }
  const sourceType = sourceForMetric(plan);
  const sourceIndex = Math.max(
    0,
    connectors.findIndex((x) => x.type === sourceType),
  );
  const pivotConfig = metricPivotFor(plan.metric, sourceIndex);
  const source = sheets[sourceIndex];
  const pivotResult = buildPivot(source, pivotConfig);
  const pivotSheetName = `Model · ${plan.title}`.slice(0, 31);
  sheets.push({
    name: pivotSheetName,
    order: sheets.length,
    row: Math.max(80, pivotResult.nRows + 8),
    column: Math.max(16, pivotResult.nCols + 4),
    status: 0,
    config: {},
    celldata: pivotToCelldata(pivotResult, 1, 0),
  });
  steps.push({
    kind: "build-pivot",
    label: "Crear modelo pivot",
    detail: `${pivotConfig.rows?.join(", ") || "medida"} → ${pivotConfig.values.map((v) => `${v.agg}(${v.field})`).join(", ")}`,
  });
  const dashboard = {
    name: "AXOS BI Dashboard",
    order: sheets.length,
    row: 80,
    column: 18,
    status: 0,
    config: {},
    celldata: [
      {
        r: 0,
        c: 0,
        v: {
          v: plan.title,
          m: plan.title,
          bl: 1,
          fs: 16,
          fc: "#064e3b",
          bg: "#ecfdf5",
          ct: { fa: "General", t: "s" },
        },
      },
      {
        r: 1,
        c: 0,
        v: {
          v: plan.description,
          m: plan.description,
          ct: { fa: "General", t: "s" },
        },
      },
      {
        r: 3,
        c: 0,
        v: {
          v: "Data pipeline",
          m: "Data pipeline",
          bl: 1,
          ct: { fa: "General", t: "s" },
        },
      },
      ...steps.slice(0, 9).map((s, i) => ({
        r: 4 + i,
        c: 0,
        v: {
          v: `${i + 1}. ${s.label}`,
          m: `${i + 1}. ${s.label}`,
          ct: { fa: "General", t: "s" },
        },
      })),
    ],
  };
  sheets.push(dashboard);
  const charts = connectors.flatMap((instance) =>
    suggestedChartsForConnector(instance),
  );
  charts.push({
    id: `workbench_${plan.id}_pivot_chart`,
    sheetIndex: sheets.length - 2,
    range: `A2:${pivotResult.nCols > 1 ? "D" : "B"}${Math.max(4, pivotResult.nRows + 1)}`,
    type: "bar",
    title: plan.title,
    legend: "bottom",
    palette: "brand",
  } as ChartConfig);
  steps.push({
    kind: "suggest-chart",
    label: "Sugerir dashboard",
    detail: `${charts.length} visualizaciones listas para ajustar.`,
  });
  return {
    sheets: clone(sheets),
    connectors,
    pivots: [
      {
        id: `pv_workbench_${plan.id}`,
        config: pivotConfig,
        sheetName: pivotSheetName,
      },
    ],
    charts,
    steps,
    summary: `${plan.title}: ${connectors.length} conectores, ${steps.length} pasos, 1 modelo pivot.`,
  };
}

export function connectorCatalogSummary(): string[] {
  return AXOS_SHEET_CONNECTORS.map(
    (x) => `${x.label} · ${x.domain} · ${x.headers.length} campos`,
  );
}
