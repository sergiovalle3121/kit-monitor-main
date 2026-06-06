/**
 * Pure BOM-explosion logic for the materials pull system (Phase 1A).
 *
 * Given the BOM lines for a model and the quantity of finished units a plan
 * schedules, produce the consolidated PickList the warehouse must pull. Kept as
 * a side-effect-free function so the math is trivially unit-testable and reused
 * by the persistence layer.
 */

export interface BomExplosionInput {
  partNumber: string;
  description?: string | null;
  usageFactor: number; // units consumed per assembled unit
  unit?: string | null;
}

export interface PickListLine {
  partNumber: string;
  description: string | null;
  quantityRequired: number;
  unit: string;
}

/**
 * Explode a BOM into PickList lines for `quantity` finished units.
 *
 * A part number may legitimately appear on several BOM lines (e.g. used in
 * multiple sub-assemblies); those are consolidated into a single PickList line
 * with the summed requirement so the warehouse pulls it once.
 */
export function explodeBom(
  bomItems: BomExplosionInput[],
  quantity: number,
): PickListLine[] {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(
      'Plan quantity must be a positive number to explode the BOM.',
    );
  }

  const consolidated = new Map<string, PickListLine>();

  for (const item of bomItems) {
    const partNumber = item.partNumber?.trim();
    if (!partNumber) continue; // skip malformed BOM rows defensively

    const usageFactor = Number(item.usageFactor);
    const lineQty = (Number.isFinite(usageFactor) ? usageFactor : 0) * quantity;

    const existing = consolidated.get(partNumber);
    if (existing) {
      existing.quantityRequired += lineQty;
      // Prefer the first non-empty description / unit we encounter.
      if (!existing.description && item.description)
        existing.description = item.description;
    } else {
      consolidated.set(partNumber, {
        partNumber,
        description: item.description ?? null,
        quantityRequired: lineQty,
        unit: item.unit?.trim() || 'EA',
      });
    }
  }

  return [...consolidated.values()];
}
