import { strict as assert } from "node:assert";
import {
  CAD_PLANT_PRESETS,
  cadPlantPresetFootprint,
  cadValueForUnit,
  detectObjectsOutsidePlantBounds,
  formatCadPlantLength,
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
assert.equal(
  formatCadPlantSize(120, 80, "m", "mm"),
  "120,000 x 80,000 mm (120 x 80 m)",
  "plant size can display a meter-native layout in millimeters",
);
assert.equal(
  cadValueForUnit(2500, "mm", "m"),
  2.5,
  "display conversion keeps grid values readable in meters",
);
assert.equal(
  formatCadPlantLength(5000, "mm", "m"),
  "5 m",
  "grid and bounds labels can use the selected display unit",
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
