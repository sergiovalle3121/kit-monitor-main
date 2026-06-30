import { strict as assert } from "node:assert";
import {
  CAD_PLANT_PRESETS,
  cadPlantPresetFootprint,
  detectObjectsOutsidePlantBounds,
  formatCadPlantSize,
  recommendCadGridSize,
} from "./plant-scale";

assert.equal(CAD_PLANT_PRESETS.length, 4, "expected four factory scale presets");

const fullFactory = cadPlantPresetFootprint("full-factory", "mm");
assert.deepEqual(
  fullFactory,
  { width: 120000, height: 80000, gridSize: 5000 },
  "full factory preset uses 120 m x 80 m in mm",
);

const warehouseMeters = cadPlantPresetFootprint("warehouse", "m");
assert.deepEqual(
  warehouseMeters,
  { width: 60, height: 40, gridSize: 2.5 },
  "warehouse preset converts to meters",
);

assert.equal(
  recommendCadGridSize(120000, 80000, "mm"),
  5000,
  "large factories get a coarse drafting grid",
);
assert.equal(
  recommendCadGridSize(10000, 8000, "mm"),
  500,
  "small cells keep a detailed drafting grid",
);

assert.equal(
  formatCadPlantSize(30000, 12000, "mm"),
  "30,000 x 12,000 mm (30 x 12 m)",
  "plant size displays both mm and m",
);

const issues = detectObjectsOutsidePlantBounds({
  width: 10000,
  height: 8000,
  objects: [
    { id: "ok", label: "Inside", x: 100, y: 100, width: 900, height: 900 },
    { id: "bad", label: "Outside", x: 9500, y: 100, width: 900, height: 900 },
  ],
});
assert.equal(issues.length, 1, "only out-of-bounds objects are returned");
assert.equal(issues[0].id, "bad", "issue points at the overflowing object");
assert.equal(issues[0].right, 400, "right overflow is measured");

console.log("cad plant scale specs passed");
