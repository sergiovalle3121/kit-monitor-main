/**
 * Pure backflush computation: given the materials consumed at an operation and
 * the number of units produced, compute how much of each to consume. Side-effect
 * free (unit-testable). The service resolves the operation's materials and posts
 * the consumption to inventory.
 */

export interface BackflushMaterialInput {
  materialId: string;
  partNumber: string;
  description: string;
  qtyPerUnit: number;
  uom: string;
}

export interface BackflushLine extends BackflushMaterialInput {
  consumeQty: number;
}

const round = (n: number) => Math.round((n + Number.EPSILON) * 1e6) / 1e6;

export function computeBackflush(
  materials: BackflushMaterialInput[],
  units: number,
): BackflushLine[] {
  const u = units > 0 ? units : 0;
  return materials.map((m) => ({
    ...m,
    consumeQty: round(Math.max(0, m.qtyPerUnit || 0) * u),
  }));
}

export function totalBackflushQty(lines: BackflushLine[]): number {
  return round(lines.reduce((s, l) => s + l.consumeQty, 0));
}
