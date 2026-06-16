/**
 * Pure genealogy derivation helpers — no DB, fully unit-testable. The service
 * collects normalized `GenealogyLink`s from the live consumption ledger and the
 * additive index, then these functions shape them into the as-built tree and the
 * where-used recall aggregation.
 */

/** A single normalized consumption link (in-memory; not a DB row). */
export interface GenealogyLink {
  builtSerial: string;
  part: string;
  lot: string | null;
  reel: string | null;
  qty: number;
  woId: string | null;
  woFolio: string | null;
  model: string | null;
  station: string | null;
  operator: string | null;
  consumedAt: string | null; // ISO timestamp
  source: string;
  sourceEventId: string | null;
}

export interface AsBuiltComponent {
  part: string;
  totalQty: number;
  lots: string[];
  reels: string[];
  /** Each individual consumption with operator / station / timestamp. */
  consumptions: Array<{
    lot: string | null;
    reel: string | null;
    qty: number;
    station: string | null;
    operator: string | null;
    consumedAt: string | null;
    woId: string | null;
    woFolio: string | null;
    source: string;
  }>;
}

export interface AsBuiltTree {
  serial: string;
  model: string | null;
  woId: string | null;
  woFolio: string | null;
  componentCount: number;
  parts: AsBuiltComponent[];
  /** True when at least one component link is missing lot capture (honest gap signal). */
  lotCaptureGap: boolean;
  firstBuiltAt: string | null;
  lastBuiltAt: string | null;
}

function uniqSorted(values: Array<string | null>): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v))).sort();
}

function round(n: number, dp = 6): number {
  const f = Math.pow(10, dp);
  return Math.round((Number(n) || 0) * f) / f;
}

/** Build the as-built tree for one serial from its consumption links. */
export function buildAsBuiltTree(
  serial: string,
  links: GenealogyLink[],
): AsBuiltTree {
  const byPart = new Map<string, AsBuiltComponent>();
  let model: string | null = null;
  let woId: string | null = null;
  let woFolio: string | null = null;
  let lotCaptureGap = false;
  const times: number[] = [];

  for (const l of links) {
    model = model ?? l.model;
    woId = woId ?? l.woId;
    woFolio = woFolio ?? l.woFolio;
    if (!l.lot) lotCaptureGap = true;
    if (l.consumedAt) {
      const t = new Date(l.consumedAt).getTime();
      if (!Number.isNaN(t)) times.push(t);
    }

    let comp = byPart.get(l.part);
    if (!comp) {
      comp = { part: l.part, totalQty: 0, lots: [], reels: [], consumptions: [] };
      byPart.set(l.part, comp);
    }
    comp.totalQty = round(comp.totalQty + (Number(l.qty) || 0));
    comp.consumptions.push({
      lot: l.lot,
      reel: l.reel,
      qty: Number(l.qty) || 0,
      station: l.station,
      operator: l.operator,
      consumedAt: l.consumedAt,
      woId: l.woId,
      woFolio: l.woFolio,
      source: l.source,
    });
  }

  const parts = Array.from(byPart.values())
    .map((c) => ({
      ...c,
      lots: uniqSorted(c.consumptions.map((x) => x.lot)),
      reels: uniqSorted(c.consumptions.map((x) => x.reel)),
    }))
    .sort((a, b) => a.part.localeCompare(b.part));

  return {
    serial,
    model,
    woId,
    woFolio,
    componentCount: parts.length,
    parts,
    lotCaptureGap,
    firstBuiltAt: times.length ? new Date(Math.min(...times)).toISOString() : null,
    lastBuiltAt: times.length ? new Date(Math.max(...times)).toISOString() : null,
  };
}

export interface WhereUsedResult {
  query: { lot: string | null; reel: string | null; part: string | null };
  serialCount: number;
  affectedSerials: Array<{
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
  }>;
  shipmentCount: number;
  shipments: Array<{
    serial: string;
    shipmentId: string | null;
    shipmentFolio: string | null;
    asn: string | null;
    customerName: string | null;
    destination: string | null;
    shippedAt: string | null;
  }>;
  /** The de-duplicated containment scope a recall needs to act on. */
  recallScope: { serials: string[]; shipments: string[]; customers: string[] };
}

export interface ShipmentLinkRow {
  builtSerial: string;
  shipmentId: string | null;
  shipmentFolio: string | null;
  asn: string | null;
  customerName: string | null;
  destination: string | null;
  shippedAt: string | null;
}

/**
 * Aggregate the recall containment: from the matching consumption links → the
 * distinct serials → the shipments (and customers) that contain them.
 */
export function aggregateWhereUsed(
  query: { lot: string | null; reel: string | null; part: string | null },
  links: GenealogyLink[],
  shipmentLinks: ShipmentLinkRow[],
): WhereUsedResult {
  const affectedSerials = links
    .map((l) => ({
      serial: l.builtSerial,
      part: l.part,
      lot: l.lot,
      reel: l.reel,
      qty: Number(l.qty) || 0,
      woId: l.woId,
      woFolio: l.woFolio,
      station: l.station,
      operator: l.operator,
      consumedAt: l.consumedAt,
      source: l.source,
    }))
    .sort((a, b) => a.serial.localeCompare(b.serial));

  const serials = Array.from(new Set(affectedSerials.map((s) => s.serial)));
  const serialSet = new Set(serials);

  const shipments = shipmentLinks
    .filter((s) => serialSet.has(s.builtSerial))
    .map((s) => ({
      serial: s.builtSerial,
      shipmentId: s.shipmentId,
      shipmentFolio: s.shipmentFolio,
      asn: s.asn,
      customerName: s.customerName,
      destination: s.destination,
      shippedAt: s.shippedAt,
    }))
    .sort((a, b) => a.serial.localeCompare(b.serial));

  const shipmentIds = uniqSorted(
    shipments.map((s) => s.shipmentFolio ?? s.shipmentId),
  );
  const customers = uniqSorted(shipments.map((s) => s.customerName));

  return {
    query,
    serialCount: serials.length,
    affectedSerials,
    shipmentCount: shipments.length,
    shipments,
    recallScope: { serials: serials.sort(), shipments: shipmentIds, customers },
  };
}
