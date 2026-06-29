/** Pure CAD layer smoke tests. */
import { strict as assert } from "node:assert";
import {
  assignObjectsToLayer,
  DEFAULT_CAD_LAYERS,
  editableObjectIds,
  hideEmptyCadLayers,
  isolateCadLayerVisibility,
  isLayerLocked,
  isObjectLayerLocked,
  isLayerVisible,
  layerForObject,
  showAllCadLayers,
  summarizeCadLayers,
  toggleCadLayerLocked,
  toggleCadLayerVisible,
  unlockAllCadLayers,
} from "./layers";

let layers = DEFAULT_CAD_LAYERS;
assert.equal(
  isLayerVisible(layers, "layout"),
  true,
  "layout visible by default",
);
layers = toggleCadLayerVisible(layers, "layout");
assert.equal(isLayerVisible(layers, "layout"), false, "visibility toggles");
layers = toggleCadLayerLocked(layers, "equipment");
assert.equal(isLayerLocked(layers, "equipment"), true, "lock toggles");
const assignments = assignObjectsToLayer({}, ["a", "b"], "safety");
assert.equal(
  layerForObject(assignments, "a", "layout"),
  "safety",
  "assignment works",
);
assert.equal(
  layerForObject(assignments, "x", "layout"),
  "layout",
  "fallback works",
);

assert.equal(
  isObjectLayerLocked(layers, assignments, "a", "layout"),
  false,
  "object on unlocked safety layer can be edited",
);
layers = toggleCadLayerLocked(layers, "safety");
assert.equal(
  isObjectLayerLocked(layers, assignments, "a", "layout"),
  true,
  "object on locked assigned layer is locked",
);
assert.deepEqual(
  editableObjectIds(layers, assignments, [
    { id: "a", fallbackLayer: "layout" },
    { id: "x", fallbackLayer: "layout" },
  ]),
  ["x"],
  "editableObjectIds filters locked objects",
);

const summaries = summarizeCadLayers(DEFAULT_CAD_LAYERS, assignments, [
  { id: "a", fallbackLayer: "layout", area: 100 },
  { id: "x", fallbackLayer: "layout", area: 50 },
]);
assert.equal(
  summaries.find((layer) => layer.id === "safety")?.count,
  1,
  "summaries count assigned objects",
);
assert.equal(
  summaries.find((layer) => layer.id === "layout")?.area,
  50,
  "summaries include fallback-layer area",
);
assert.equal(
  summaries.find((layer) => layer.id === "safety")?.assignedCount,
  1,
  "summaries track explicit assignments",
);

let presentation = isolateCadLayerVisibility(DEFAULT_CAD_LAYERS, "safety");
assert.equal(
  isLayerVisible(presentation, "safety"),
  true,
  "isolate keeps target visible",
);
assert.equal(
  isLayerVisible(presentation, "layout"),
  false,
  "isolate hides other layers",
);
presentation = showAllCadLayers(presentation);
assert.equal(
  isLayerVisible(presentation, "layout"),
  true,
  "show all restores visibility",
);
presentation = hideEmptyCadLayers(presentation, summaries);
assert.equal(
  isLayerVisible(presentation, "flow"),
  false,
  "hide empty hides empty layers",
);
assert.equal(
  isLayerVisible(presentation, "layout"),
  true,
  "hide empty keeps populated fallback layer",
);
presentation = unlockAllCadLayers(layers);
assert.equal(
  isLayerLocked(presentation, "safety"),
  false,
  "unlock all clears locked layers",
);
console.log("cad layer specs passed");
