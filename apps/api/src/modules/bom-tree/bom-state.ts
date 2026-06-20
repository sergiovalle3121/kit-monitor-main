/**
 * BOM (multilevel) domain vocabulary + node lifecycle state machine.
 * Pure + side-effect free (unit-testable). New prefixed tables (`bom_node`,
 * `bom_line`) — additive, coexisting with the legacy flat BOM (`bom_headers`…).
 */

export type BomNodeStatus = 'DRAFT' | 'ACTIVE' | 'OBSOLETE';

export const BOM_NODE_STATUSES: BomNodeStatus[] = ['DRAFT', 'ACTIVE', 'OBSOLETE'];

const TRANSITIONS: Record<BomNodeStatus, BomNodeStatus[]> = {
  DRAFT: ['ACTIVE', 'OBSOLETE'],
  ACTIVE: ['OBSOLETE'],
  OBSOLETE: ['ACTIVE'],
};

export function canTransition(from: BomNodeStatus, to: BomNodeStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStates(from: BomNodeStatus): BomNodeStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function assertTransition(from: BomNodeStatus, to: BomNodeStatus): void {
  if (from === to) throw new Error(`El BOM ya está en ${from}.`);
  if (!canTransition(from, to)) {
    throw new Error(
      `No se puede mover un BOM de ${from} a ${to}. ` +
        `Permitido: ${nextStates(from).join(', ') || '(ninguno)'}.`,
    );
  }
}

/** Line item category (how a component participates in this BOM). */
export type BomItemCategory =
  | 'STANDARD' // parte normal con consumo/inventario
  | 'PHANTOM' // sub-ensamble fantasma (se explota, no se inventaría)
  | 'NON_STOCK' // consumible no inventariado
  | 'REFERENCE'; // sólo referencia (no se consume)

export const BOM_ITEM_CATEGORIES: BomItemCategory[] = [
  'STANDARD',
  'PHANTOM',
  'NON_STOCK',
  'REFERENCE',
];
