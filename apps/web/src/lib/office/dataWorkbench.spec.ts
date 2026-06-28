import { strict as assert } from "node:assert";
import {
  AXOS_DATA_WORKBENCH_PLANS,
  buildAxosDataWorkbench,
  connectorCatalogSummary,
} from "./dataWorkbench";

const result = buildAxosDataWorkbench(
  "inventory-control-tower",
  new Date("2026-06-28T00:00:00.000Z"),
);

assert.equal(
  AXOS_DATA_WORKBENCH_PLANS.length >= 3,
  true,
  "ships multiple business workbench presets",
);
assert.equal(
  result.connectors.length,
  3,
  "builds the selected live connector set",
);
assert.equal(result.pivots.length, 1, "persists a refreshable pivot model");
assert.equal(
  result.sheets.some((sheet) => sheet.name === "AXOS BI Dashboard"),
  true,
  "adds a visible dashboard sheet",
);
assert.equal(
  result.sheets[0].axosProtection.ranges[0].locked,
  true,
  "protects governed connector ranges",
);
assert.equal(
  result.charts.length >= result.connectors.length,
  true,
  "suggests connector/dashboard charts",
);
assert.equal(
  result.steps.some((step) => step.kind === "type-cast"),
  true,
  "exposes Power Query-like transformation steps",
);
assert.equal(
  connectorCatalogSummary().some((line) => line.includes("Inventory snapshot")),
  true,
  "summarizes the connector catalog",
);

console.log("✓ AXOS data workbench assertions passed.");
