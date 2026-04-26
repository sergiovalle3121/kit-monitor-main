import type { QualityInspection } from "./quality.types";

export const calculateFirstPassYield = (inspections: QualityInspection[]) => {
  const totals = inspections.reduce(
    (accumulator, inspection) => ({
      inspected: accumulator.inspected + inspection.inspectedQuantity,
      passed: accumulator.passed + inspection.passedQuantity,
    }),
    { inspected: 0, passed: 0 },
  );

  if (totals.inspected === 0) return 0;

  return Number(((totals.passed / totals.inspected) * 100).toFixed(1));
};
