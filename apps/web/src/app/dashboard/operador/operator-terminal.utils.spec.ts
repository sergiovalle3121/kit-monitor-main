import { strict as assert } from "node:assert";
// @ts-expect-error Node strip-types executes the colocated .ts module directly.
import { buildOperatorActionSignature, buildOperatorConfirmationSummary, classifyScan, deriveMaterialRequestReadiness, deriveProductionMetrics } from "./operator-terminal.utils.ts";

const cases = [
  ["WO-000123", "wo", "000123", true],
  ["000123", "wo", "000123", true],
  ["SN-ABC1234", "serial", "SN-ABC1234", true],
  ["SERIAL ABC1234", "serial", "SN-ABC1234", true],
  ["LOT-77A", "lot", "LOT-77A", true],
  ["REEL-88A", "reel", "REEL-88A", true],
  ["R 88A", "reel", "REEL-88A", true],
  ["PN-AX-99", "material", "AX-99", true],
  ["]C101095011015300", "code128", "01095011015300", true],
  ["]D201ABC", "datamatrix", "01ABC", true],
  [
    "https://example.test/trace/123",
    "qr",
    "https://example.test/trace/123",
    true,
  ],
  ["x", "code128", "x", false],
] as const;

for (const [raw, kind, normalized, valid] of cases) {
  const result = classifyScan(raw);
  assert.equal(result.kind, kind, `${raw} kind`);
  assert.equal(result.normalized, normalized, `${raw} normalized`);
  assert.equal(result.valid, valid, `${raw} valid`);
}

const metrics = deriveProductionMetrics({
  quantity: 100,
  overall: 0.42,
  downtimeSummarySec: 60,
  openDowntimeDurationsSec: [30, 10],
  steps: [
    { unitsCompleted: 40, scrapQty: 2, segregatedQty: 1 },
    { unitsCompleted: 25, scrapQty: 1, segregatedQty: 2 },
    { unitsCompleted: 10, scrapQty: 0, segregatedQty: 0 },
  ],
});

assert.deepEqual(metrics, {
  target: 100,
  real: 40,
  remaining: 60,
  oeePercent: 42,
  yieldPercent: 93,
  scrap: 3,
  rework: 3,
  downtimeSec: 100,
  wip: 0,
});

const startSummary = buildOperatorConfirmationSummary({
  action: "start-work-order",
  workOrder: "WO-99",
  operator: "Luis",
});
assert.equal(startSummary.tone, "emerald");
assert.equal(startSummary.primaryLabel, "Montar WO");
assert.ok(startSummary.consequence.includes("ejecucion MES"));
assert.deepEqual(startSummary.details, ["WO WO-99", "Operador Luis"]);

const advanceSummary = buildOperatorConfirmationSummary({
  action: "confirm-advance",
  workOrder: "WO-77",
  stepName: "ICT",
  quantity: 3,
  scrap: 1,
});
assert.equal(advanceSummary.tone, "emerald");
assert.equal(advanceSummary.primaryLabel, "Confirmar y descontar material");
assert.ok(advanceSummary.consequence.includes("consumirá material"));
assert.deepEqual(advanceSummary.details, [
  "WO WO-77",
  "Estación ICT",
  "3 buenas",
  "1 scrap",
]);

const stopSummary = buildOperatorConfirmationSummary({
  action: "line-stop",
  workOrder: "WO-88",
  stepName: null,
  operator: "Ana",
});
assert.equal(stopSummary.tone, "rose");
assert.equal(stopSummary.primaryLabel, "Detener línea y levantar Andon");
assert.ok(stopSummary.consequence.includes("downtime"));
assert.deepEqual(stopSummary.details, [
  "WO WO-88",
  "Estación actual",
  "Operador Ana",
]);

assert.equal(
  buildOperatorActionSignature({
    action: "confirm-advance",
    workOrder: " wo-77 ",
    stepId: "ICT-01",
    quantity: 3.8,
    scrap: 1,
    serial: " sn-abc ",
  }),
  "confirm-advance:WO-77:ICT-01:3:1:SN-ABC::",
);

const stopSignature = buildOperatorActionSignature({
  action: "line-stop",
  workOrder: "WO-88",
  stepId: 7,
  downtimeReason: "quality_hold",
  note: "esperando calidad",
});
assert.notEqual(
  stopSignature,
  buildOperatorActionSignature({
    action: "line-stop",
    workOrder: "WO-88",
    stepId: 7,
    downtimeReason: "material_shortage",
    note: "esperando calidad",
  }),
);
assert.notEqual(
  stopSignature,
  buildOperatorActionSignature({
    action: "line-stop",
    workOrder: "WO-88",
    stepId: 7,
    downtimeReason: "quality_hold",
    note: "esperando supervisor",
  }),
);

assert.deepEqual(
  deriveMaterialRequestReadiness({ kitId: null, requests: [] }),
  {
    canRequest: false,
    status: "no-kit",
    primaryLabel: "Kit no disponible",
    message:
      "Esta WO todavia no tiene un kit publicado; solicita a planeacion generar el PickList antes de pedir surtido.",
  },
);

assert.deepEqual(
  deriveMaterialRequestReadiness({
    kitId: 7,
    requests: [{ id: 42, status: "pending" }],
  }),
  {
    canRequest: false,
    status: "pending",
    primaryLabel: "Solicitud #42 pendiente",
    message:
      "Ya existe una solicitud pendiente para este kit; espera la respuesta de materiales antes de levantar otra.",
    pendingId: 42,
  },
);

assert.equal(
  deriveMaterialRequestReadiness({ kitId: 7, requests: [] }).canRequest,
  true,
);

console.log(
  `operator-terminal.utils: ${cases.length} scanner cases, production metrics and material request readiness passed`,
);
