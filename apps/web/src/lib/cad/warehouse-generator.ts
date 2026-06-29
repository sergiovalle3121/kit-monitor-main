import type { CadLayerId } from "./layers";

export type CadRackRowOrientation = "horizontal" | "vertical";

export interface CadRackRowGeneratorInput {
  rows: number;
  baysPerRow: number;
  bayWidth: number;
  rackDepth: number;
  aisleWidth: number;
  orientation: CadRackRowOrientation;
  labelPrefix: string;
  startIndex: number;
  margin?: number;
}

export interface CadGeneratedWarehouseAsset {
  ref: string;
  kind: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  layer: CadLayerId;
  tags: string[];
}

export interface CadGeneratedWarehouseAnnotation {
  ref: string;
  type: "text";
  text: string;
  x: number;
  y: number;
  layer: CadLayerId;
}

export interface CadWarehouseRackRowsResult {
  assets: CadGeneratedWarehouseAsset[];
  annotations: CadGeneratedWarehouseAnnotation[];
  summary: {
    rackCount: number;
    aisleCount: number;
    labelCount: number;
    width: number;
    height: number;
  };
  warnings: string[];
}

const DEFAULTS: CadRackRowGeneratorInput = {
  rows: 2,
  baysPerRow: 4,
  bayWidth: 4200,
  rackDepth: 1100,
  aisleWidth: 3000,
  orientation: "horizontal",
  labelPrefix: "R",
  startIndex: 1,
};

function integer(value: number, fallback: number, min: number, max: number) {
  const parsed = Number.isFinite(value) ? Math.trunc(value) : fallback;
  return Math.max(min, Math.min(max, parsed));
}

function positive(value: number, fallback: number, min = 1) {
  return Number.isFinite(value) && value > 0 ? Math.max(min, value) : fallback;
}

function snap(value: number, gridSize: number): number {
  const grid = Math.max(1, Math.abs(gridSize || 1));
  return Math.round(value / grid) * grid;
}

function labelFor(prefix: string, index: number, lastIndex: number): string {
  return `${prefix}${String(index).padStart(Math.max(2, String(lastIndex).length), "0")}`;
}

export function normalizeRackRowGeneratorInput(
  input: Partial<CadRackRowGeneratorInput>,
): CadRackRowGeneratorInput {
  return {
    rows: integer(input.rows ?? DEFAULTS.rows, DEFAULTS.rows, 1, 20),
    baysPerRow: integer(
      input.baysPerRow ?? DEFAULTS.baysPerRow,
      DEFAULTS.baysPerRow,
      1,
      60,
    ),
    bayWidth: positive(input.bayWidth ?? DEFAULTS.bayWidth, DEFAULTS.bayWidth),
    rackDepth: positive(
      input.rackDepth ?? DEFAULTS.rackDepth,
      DEFAULTS.rackDepth,
    ),
    aisleWidth: positive(
      input.aisleWidth ?? DEFAULTS.aisleWidth,
      DEFAULTS.aisleWidth,
    ),
    orientation:
      input.orientation === "vertical" ? "vertical" : DEFAULTS.orientation,
    labelPrefix: (input.labelPrefix ?? DEFAULTS.labelPrefix).trim() || "R",
    startIndex: integer(
      input.startIndex ?? DEFAULTS.startIndex,
      DEFAULTS.startIndex,
      0,
      9999,
    ),
    margin: input.margin,
  };
}

export function generateWarehouseRackRows(
  input: Partial<CadRackRowGeneratorInput>,
  footprint: { width: number; height: number; gridSize?: number },
): CadWarehouseRackRowsResult {
  const cfg = normalizeRackRowGeneratorInput(input);
  const gridSize = Math.max(1, footprint.gridSize ?? 100);
  const margin = snap(
    positive(cfg.margin ?? gridSize * 5, gridSize * 5, gridSize),
    gridSize,
  );
  const horizontal = cfg.orientation === "horizontal";
  const rowWidth = cfg.baysPerRow * cfg.bayWidth;
  const rowDepthSpan = cfg.rows * cfg.rackDepth + (cfg.rows - 1) * cfg.aisleWidth;
  const width = horizontal ? rowWidth : rowDepthSpan;
  const height = horizontal ? rowDepthSpan : rowWidth;
  const warnings: string[] = [];

  if (margin * 2 + width > footprint.width) {
    warnings.push(
      `Rack generator width ${Math.round(margin * 2 + width)} exceeds footprint ${Math.round(footprint.width)}.`,
    );
  }
  if (margin * 2 + height > footprint.height) {
    warnings.push(
      `Rack generator height ${Math.round(margin * 2 + height)} exceeds footprint ${Math.round(footprint.height)}.`,
    );
  }

  const assets: CadGeneratedWarehouseAsset[] = [];
  const annotations: CadGeneratedWarehouseAnnotation[] = [];
  const lastIndex = cfg.startIndex + cfg.rows * cfg.baysPerRow - 1;

  for (let row = 0; row < cfg.rows; row += 1) {
    const rowOffset = row * (cfg.rackDepth + cfg.aisleWidth);
    const rowStartIndex = cfg.startIndex + row * cfg.baysPerRow;
    const rowEndIndex = rowStartIndex + cfg.baysPerRow - 1;

    annotations.push({
      ref: `row-label-${row + 1}`,
      type: "text",
      text: `Row ${row + 1}: ${labelFor(cfg.labelPrefix, rowStartIndex, lastIndex)}-${labelFor(cfg.labelPrefix, rowEndIndex, lastIndex)}`,
      x: horizontal ? margin : Math.max(0, margin + rowOffset - gridSize),
      y: horizontal ? Math.max(0, margin + rowOffset - gridSize) : margin,
      layer: "measurements",
    });

    for (let bay = 0; bay < cfg.baysPerRow; bay += 1) {
      const bayOffset = bay * cfg.bayWidth;
      const rackIndex = cfg.startIndex + row * cfg.baysPerRow + bay;
      const label = labelFor(cfg.labelPrefix, rackIndex, lastIndex);
      assets.push({
        ref: `rack-${row + 1}-${bay + 1}`,
        kind: "rack",
        label,
        x: margin + (horizontal ? bayOffset : rowOffset),
        y: margin + (horizontal ? rowOffset : bayOffset),
        w: horizontal ? cfg.bayWidth : cfg.rackDepth,
        h: horizontal ? cfg.rackDepth : cfg.bayWidth,
        rotation: 0,
        layer: "equipment",
        tags: [
          "generated",
          "warehouse",
          "rack-row",
          `row:${row + 1}`,
          `bay:${bay + 1}`,
        ],
      });
    }

    if (row < cfg.rows - 1) {
      const aisleOffset = rowOffset + cfg.rackDepth;
      assets.push({
        ref: `forklift-aisle-${row + 1}`,
        kind: "agvpath",
        label: `Forklift aisle ${row + 1}`,
        x: margin + (horizontal ? 0 : aisleOffset),
        y: margin + (horizontal ? aisleOffset : 0),
        w: horizontal ? rowWidth : cfg.aisleWidth,
        h: horizontal ? cfg.aisleWidth : rowWidth,
        rotation: 0,
        layer: "aisles",
        tags: ["generated", "warehouse", "rack-row", "forklift", "aisle"],
      });
      annotations.push({
        ref: `aisle-label-${row + 1}`,
        type: "text",
        text: `Forklift aisle ${row + 1} - ${Math.round(cfg.aisleWidth)} mm`,
        x: margin + (horizontal ? rowWidth / 2 : aisleOffset + cfg.aisleWidth / 2),
        y: margin + (horizontal ? aisleOffset + cfg.aisleWidth / 2 : rowWidth / 2),
        layer: "aisles",
      });
    }
  }

  annotations.unshift({
    ref: "rack-generator-title",
    type: "text",
    text: `${cfg.rows}x${cfg.baysPerRow} rack rows - ${Math.round(cfg.bayWidth)} x ${Math.round(cfg.rackDepth)} mm`,
    x: margin,
    y: Math.max(0, margin - gridSize * 2),
    layer: "measurements",
  });

  return {
    assets,
    annotations,
    summary: {
      rackCount: cfg.rows * cfg.baysPerRow,
      aisleCount: Math.max(0, cfg.rows - 1),
      labelCount: annotations.length,
      width,
      height,
    },
    warnings: [...new Set(warnings)],
  };
}
