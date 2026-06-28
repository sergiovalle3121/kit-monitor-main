import { strict as assert } from "node:assert";
// @ts-expect-error Node strip-types executes the colocated .ts module directly.
import { classifyScan, deriveOperatorReadiness, deriveProductionMetrics, validateOperatorTransaction } from "./operator-terminal.utils.ts";

const cases = [
  ["WO-000123", "wo", "000123", true],
  ["000123", "wo", "000123", true],
  ["SN-ABC1234", "serial", "SN-ABC1234", true],
  ["SERIAL ABC1234", "serial", "SN-ABC1234", true],
  ["LOT-77A", "lot", "LOT-77A", true],
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

const ready = deriveOperatorReadiness({
  hasWorkOrder: true,
  hasCurrentStep: true,
  stepStatus: "in_process",
  maxConfirmable: 5,
  materialShortCount: 0,
  openIncidentCount: 0,
  blockingIncidentCount: 0,
  openAndonCount: 0,
  openDowntimeCount: 0,
  hasInstructions: true,
  assignedOperatorNames: ["Ana"],
  operatorName: "Ana",
  certification: {
    certified: true,
    status: "valid",
    daysToExpiry: 120,
    skill: "SMT",
  },
  socketStatus: "connected",
  offlineQueueCount: 0,
});
assert.equal(ready.status, "READY");
assert.equal(ready.canConfirm, true);
assert.equal(ready.score, 100);

const blocked = deriveOperatorReadiness({
  hasWorkOrder: true,
  hasCurrentStep: true,
  stepStatus: "blocked",
  maxConfirmable: 5,
  materialShortCount: 1,
  openIncidentCount: 1,
  blockingIncidentCount: 1,
  openDowntimeCount: 1,
  certification: {
    certified: false,
    status: "expired",
    daysToExpiry: -4,
    skill: "AOI",
  },
  socketStatus: "connected",
});
assert.equal(blocked.status, "BLOCKED");
assert.equal(blocked.canConfirm, false);
assert.equal(
  blocked.checks.find((check) => check.id === "operator")?.status,
  "fail",
);

const validConfirm = validateOperatorTransaction({
  type: "confirm",
  maxConfirmable: 3,
  payload: { quantity: 2, scrap: 0, serial: "SN-1000", clientRequestId: "req-1" },
});
assert.equal(validConfirm.ok, true);

const invalidConfirm = validateOperatorTransaction({
  type: "confirm",
  maxConfirmable: 3,
  payload: { quantity: 5, scrap: 0, clientRequestId: "req-2" },
});
assert.equal(invalidConfirm.ok, false);
assert.match(invalidConfirm.errors.join(" "), /excede máximo/);

const engineeringAndon = validateOperatorTransaction({
  type: "andon",
  payload: { type: "engineering", clientRequestId: "req-3" },
});
assert.equal(engineeringAndon.ok, true);

const invalidAndon = validateOperatorTransaction({
  type: "andon",
  payload: { type: "unknown", clientRequestId: "req-4" },
});
assert.equal(invalidAndon.ok, false);

console.log(
  `operator-terminal.utils: ${cases.length} scanner cases, production metrics, readiness and transactions passed`,
);
