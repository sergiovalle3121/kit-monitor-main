import { strict as assert } from "node:assert";
import {
  generateWarehouseRackRows,
  normalizeRackRowGeneratorInput,
} from "./warehouse-generator";

const defaults = normalizeRackRowGeneratorInput({});
assert.equal(defaults.rows, 2, "default generator creates two rack rows");
assert.equal(defaults.baysPerRow, 4, "default generator creates four bays");

const generated = generateWarehouseRackRows(
  {
    rows: 2,
    baysPerRow: 3,
    bayWidth: 4200,
    rackDepth: 1100,
    aisleWidth: 3000,
    labelPrefix: "A",
    startIndex: 1,
  },
  { width: 18000, height: 9000, gridSize: 100 },
);

assert.equal(generated.summary.rackCount, 6, "creates one rack per bay");
assert.equal(generated.summary.aisleCount, 1, "creates aisles between rows");
assert.equal(
  generated.assets.filter((asset) => asset.kind === "rack").length,
  6,
  "rack assets are editable rack objects",
);
assert.equal(
  generated.assets.filter((asset) => asset.kind === "agvpath").length,
  1,
  "forklift path is an editable aisle asset",
);
assert.equal(generated.assets[0].label, "A01", "uses label prefix and index");
assert.ok(
  generated.annotations.some((annotation) => annotation.text.includes("Row 1")),
  "adds row labels",
);
assert.ok(
  generated.assets.every((asset) => asset.tags.includes("generated")),
  "generated objects carry source tags",
);

const vertical = generateWarehouseRackRows(
  {
    rows: 2,
    baysPerRow: 2,
    bayWidth: 2500,
    rackDepth: 900,
    aisleWidth: 2800,
    orientation: "vertical",
  },
  { width: 9000, height: 9000, gridSize: 100 },
);
const firstVerticalRack = vertical.assets.find((asset) => asset.kind === "rack");
assert.equal(firstVerticalRack?.w, 900, "vertical rows use rack depth as width");
assert.equal(firstVerticalRack?.h, 2500, "vertical rows use bay width as depth");
assert.ok(
  vertical.assets.some((asset) => asset.layer === "aisles"),
  "aisle assets use the existing Aisles layer",
);

const tooLarge = generateWarehouseRackRows(
  { rows: 4, baysPerRow: 8, bayWidth: 4200, rackDepth: 1100 },
  { width: 8000, height: 5000, gridSize: 100 },
);
assert.ok(tooLarge.warnings.length >= 1, "warns when generated rows overflow");

console.log("cad warehouse generator specs passed");
