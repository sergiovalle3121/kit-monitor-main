/**
 * Espejo EXACTO de las respuestas del módulo backend `genealogy`
 * (`apps/api/src/modules/genealogy/genealogy.derivation.ts`). No se importa nada
 * del API — sólo se replican las formas para tipar el visor. Si el contrato del
 * backend cambia, estos tipos se actualizan a mano (frontera de carril).
 */

// ── AS-BUILT (GET /genealogy/as-built/by-serial/:serial) ─────────────────────

/** Un consumo individual: qué lote/reel se puso, por quién, dónde y cuándo. */
export interface AsBuiltConsumption {
  lot: string | null;
  reel: string | null;
  qty: number;
  station: string | null;
  operator: string | null;
  consumedAt: string | null; // ISO
  woId: string | null;
  woFolio: string | null;
  source: string;
}

/** Un componente (NP) del producto, con todos sus consumos agregados. */
export interface AsBuiltComponent {
  part: string;
  totalQty: number;
  lots: string[];
  reels: string[];
  consumptions: AsBuiltConsumption[];
}

/** Árbol as-built de una serie (cuna-a-tumba). */
export interface AsBuiltTree {
  serial: string;
  model: string | null;
  woId: string | null;
  woFolio: string | null;
  componentCount: number;
  parts: AsBuiltComponent[];
  /** true si algún eslabón no trae lote capturado (señal honesta de hueco). */
  lotCaptureGap: boolean;
  firstBuiltAt: string | null;
  lastBuiltAt: string | null;
}

// ── WHERE-USED (GET /genealogy/where-used/by-lot) ────────────────────────────

/** Una serie que consumió el lote/reel buscado. */
export interface AffectedSerial {
  serial: string;
  part: string;
  lot: string | null;
  reel: string | null;
  qty: number;
  woId: string | null;
  woFolio: string | null;
  station: string | null;
  operator: string | null;
  consumedAt: string | null;
  source: string;
}

/** Un embarque que contiene una serie afectada (camino al cliente). */
export interface WhereUsedShipment {
  serial: string;
  shipmentId: string | null;
  shipmentFolio: string | null;
  asn: string | null;
  customerName: string | null;
  destination: string | null;
  shippedAt: string | null;
}

/** Resultado de contención inversa (la consulta del recall). */
export interface WhereUsedResult {
  query: { lot: string | null; reel: string | null; part: string | null };
  serialCount: number;
  affectedSerials: AffectedSerial[];
  shipmentCount: number;
  shipments: WhereUsedShipment[];
  /** Conjunto deduplicado sobre el que actúa el recall. */
  recallScope: { serials: string[]; shipments: string[]; customers: string[] };
}
