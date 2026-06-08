/**
 * State machine for product / model master records (NPI · Engineering).
 *
 *   DRAFT ──▶ ACTIVE ──▶ OBSOLETE
 *     │                     │
 *     └──────▶ OBSOLETE     └──▶ ACTIVE  (reactivate a retired model)
 *
 * A model is captured as DRAFT, ACTIVATEd once its data (and BOM) are ready to
 * be consumed downstream (planning, process routing…), and OBSOLETEd when it is
 * retired. A retired model can be reactivated. Pure + side-effect free so the
 * rules are unit-testable in isolation (mirrors the improvement-initiative SM).
 */

export type ProductModelStatus = 'DRAFT' | 'ACTIVE' | 'OBSOLETE';

export const PRODUCT_MODEL_STATUSES: ProductModelStatus[] = [
  'DRAFT',
  'ACTIVE',
  'OBSOLETE',
];

const TRANSITIONS: Record<ProductModelStatus, ProductModelStatus[]> = {
  DRAFT: ['ACTIVE', 'OBSOLETE'],
  ACTIVE: ['OBSOLETE'],
  OBSOLETE: ['ACTIVE'], // retired models can be brought back
};

export function canTransition(
  from: ProductModelStatus,
  to: ProductModelStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStates(from: ProductModelStatus): ProductModelStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function assertTransition(
  from: ProductModelStatus,
  to: ProductModelStatus,
): void {
  if (from === to) {
    throw new Error(`The model is already ${from}.`);
  }
  if (!canTransition(from, to)) {
    throw new Error(
      `Cannot move a product model from ${from} to ${to}. ` +
        `Allowed: ${nextStates(from).join(', ') || '(none)'}.`,
    );
  }
}
