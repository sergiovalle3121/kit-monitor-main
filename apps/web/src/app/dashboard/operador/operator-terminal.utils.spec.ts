import { strict as assert } from "node:assert";
// @ts-expect-error Node strip-types executes the colocated .ts module directly.
import { classifyScan, deriveProductionMetrics } from "./operator-terminal.utils.ts";

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

console.log(
  `operator-terminal.utils: ${cases.length} scanner cases and production metrics passed`,
);
