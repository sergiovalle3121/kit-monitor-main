/**
 * Material master domain vocabulary + lifecycle state machine (MM · Engineering).
 *
 * The material master is the SINGLE source of parts. Every part has:
 *  - an item type (SAP-style classification),
 *  - a make/buy procurement strategy,
 *  - a lifecycle status governed by the pure state machine below.
 *
 * Pure + side-effect free so the rules are unit-testable in isolation (mirrors
 * the product-model state machine). New prefixed tables (`mm_`), fully additive:
 * the legacy `material_master` (global, free-text) stays alive in parallel until
 * the supervised cut-over.
 */

// ── Item type (SAP-style material type) ──────────────────────────────────────
export type MaterialItemType =
  | 'PURCHASED' // comprado — se compra a proveedor
  | 'MANUFACTURED' // fabricado — se produce internamente (tiene BOM/ruteo)
  | 'PHANTOM' // fantasma — agrupador lógico, no se inventaría
  | 'NON_STOCK' // no-stock — se consume sin inventariar (consumibles)
  | 'DOCUMENT'; // documento — instructivo/plano, no físico

export const MATERIAL_ITEM_TYPES: MaterialItemType[] = [
  'PURCHASED',
  'MANUFACTURED',
  'PHANTOM',
  'NON_STOCK',
  'DOCUMENT',
];

export const ITEM_TYPE_LABELS: Record<MaterialItemType, string> = {
  PURCHASED: 'Comprado',
  MANUFACTURED: 'Fabricado',
  PHANTOM: 'Fantasma',
  NON_STOCK: 'No-stock',
  DOCUMENT: 'Documento',
};

export function isItemType(v?: string | null): v is MaterialItemType {
  return !!v && (MATERIAL_ITEM_TYPES as string[]).includes(v);
}

// ── Make / Buy ───────────────────────────────────────────────────────────────
export type MakeBuy = 'MAKE' | 'BUY';
export const MAKE_BUY_VALUES: MakeBuy[] = ['MAKE', 'BUY'];

/** Sensible make/buy default derived from the item type (overridable). */
export function defaultMakeBuy(itemType: MaterialItemType): MakeBuy {
  return itemType === 'MANUFACTURED' || itemType === 'PHANTOM' ? 'MAKE' : 'BUY';
}

/** A part that carries its own BOM / routing (an assembly we build). */
export function isAssemblyType(itemType: MaterialItemType): boolean {
  return itemType === 'MANUFACTURED' || itemType === 'PHANTOM';
}

// ── Lifecycle status ─────────────────────────────────────────────────────────
/**
 *   DRAFT ──▶ ACTIVE ──▶ OBSOLETE
 *     │         │ ▲          │
 *     │         ▼ │          │
 *     │        HOLD          │
 *     └────────▶ OBSOLETE    └──▶ ACTIVE  (reactivate a retired part)
 *
 * DRAFT: captured, not yet released. ACTIVE: usable in BOM/planning. HOLD:
 * temporarily blocked (quality/engineering freeze) — still visible, not for new
 * use. OBSOLETE: retired; can be reactivated if needed.
 */
export type MaterialLifecycle = 'DRAFT' | 'ACTIVE' | 'HOLD' | 'OBSOLETE';

export const MATERIAL_LIFECYCLE_STATUSES: MaterialLifecycle[] = [
  'DRAFT',
  'ACTIVE',
  'HOLD',
  'OBSOLETE',
];

const TRANSITIONS: Record<MaterialLifecycle, MaterialLifecycle[]> = {
  DRAFT: ['ACTIVE', 'OBSOLETE'],
  ACTIVE: ['HOLD', 'OBSOLETE'],
  HOLD: ['ACTIVE', 'OBSOLETE'],
  OBSOLETE: ['ACTIVE'], // retired parts can be brought back
};

export function canTransition(
  from: MaterialLifecycle,
  to: MaterialLifecycle,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStates(from: MaterialLifecycle): MaterialLifecycle[] {
  return TRANSITIONS[from] ?? [];
}

export function assertTransition(
  from: MaterialLifecycle,
  to: MaterialLifecycle,
): void {
  if (from === to) {
    throw new Error(`El material ya está en ${from}.`);
  }
  if (!canTransition(from, to)) {
    throw new Error(
      `No se puede mover un material de ${from} a ${to}. ` +
        `Permitido: ${nextStates(from).join(', ') || '(ninguno)'}.`,
    );
  }
}

// ── AVL (Approved Vendor List) status ────────────────────────────────────────
export type AvlStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'OBSOLETE';
export const AVL_STATUSES: AvlStatus[] = [
  'APPROVED',
  'PENDING',
  'REJECTED',
  'OBSOLETE',
];

// ── Material alternate relation type ─────────────────────────────────────────
export type AlternateType = 'ALTERNATE' | 'SUBSTITUTE';
export const ALTERNATE_TYPES: AlternateType[] = ['ALTERNATE', 'SUBSTITUTE'];
