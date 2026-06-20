// ─────────────────────────────────────────────────────────────────────────────
// ASN (Advance Ship Notice / EDI 856) + packing list — pure assembly logic.
//
// The verified load (handling units with SSCCs, Fase 2b) is turned into the two
// documents that ride with / precede a shipment:
//   • Packing list — flat, human-readable: every content line per handling unit.
//   • ASN — the hierarchical advance ship notice (Shipment → Tare → Pack → Item)
//     a customer receives, plus a simplified EDI 856 flat-file rendering.
//
// Pure + side-effect free (mirrors shipment-state / packing.loading) so the tree,
// totals and EDI text are unit-tested without a DB. The service does the IO.
// ─────────────────────────────────────────────────────────────────────────────

/** Minimal handling-unit shape the assembly needs (subset of packing entity). */
export interface AsnUnitLike {
  id: string;
  sscc: string | null;
  type: string; // PALLET | CARTON | BOX
  parentId: string | null;
  status: string; // OPEN | PACKED | LOADED
  weightKg: number | null;
  contents:
    | { partNumber: string; quantity: number; serials?: string[] }[]
    | null;
}

/** Minimal shipment shape the assembly needs (subset of outbound entity). */
export interface AsnShipmentLike {
  id: string;
  folio: string | null;
  asn: string | null;
  customerName: string | null;
  destination: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  incoterm: string;
  status: string;
  shippedDate: Date | string | null;
}

export interface AsnLine {
  partNumber: string;
  quantity: number;
  serials: string[];
}
export interface AsnPack {
  id: string;
  sscc: string | null;
  type: string;
  loaded: boolean;
  weightKg: number | null;
  lines: AsnLine[];
}
/** A top-level handling unit: its own loose contents + nested packs (cartons). */
export interface AsnTare extends AsnPack {
  packs: AsnPack[];
}
export interface AsnTotals {
  tares: number;
  packs: number;
  units: number;
  pieces: number;
  parts: number;
  weightKg: number;
  loaded: number;
}
export interface Asn {
  asn: string | null;
  folio: string | null;
  shipDate: string | null;
  shipTo: { name: string | null; destination: string | null };
  carrier: string | null;
  tracking: string | null;
  incoterm: string;
  status: string;
  hierarchy: AsnTare[];
  totals: AsnTotals;
}

function toLines(contents: AsnUnitLike['contents']): AsnLine[] {
  return (contents ?? [])
    .filter((c) => c && c.partNumber && Number(c.quantity) > 0)
    .map((c) => ({
      partNumber: String(c.partNumber),
      quantity: Number(c.quantity) || 0,
      serials: Array.isArray(c.serials) ? c.serials.map(String) : [],
    }));
}

const isLoaded = (u: AsnUnitLike) => u.status === 'LOADED';

function pack(u: AsnUnitLike): AsnPack {
  return {
    id: u.id,
    sscc: u.sscc,
    type: u.type,
    loaded: isLoaded(u),
    weightKg: u.weightKg,
    lines: toLines(u.contents),
  };
}

/**
 * Build the hierarchical ASN from a shipment and its handling units. Top-level
 * units (no parent, or a parent that isn't in the set) are tares; their children
 * are packs. A standalone box is a tare with its own lines and no packs. Totals
 * roll pieces/weight/distinct parts across the whole tree.
 */
export function buildAsn(shipment: AsnShipmentLike, units: AsnUnitLike[]): Asn {
  const ids = new Set(units.map((u) => u.id));
  const childrenByParent = new Map<string, AsnUnitLike[]>();
  const roots: AsnUnitLike[] = [];
  for (const u of units) {
    if (u.parentId && ids.has(u.parentId)) {
      const arr = childrenByParent.get(u.parentId) ?? [];
      arr.push(u);
      childrenByParent.set(u.parentId, arr);
    } else {
      roots.push(u);
    }
  }

  const hierarchy: AsnTare[] = roots.map((r) => ({
    ...pack(r),
    packs: (childrenByParent.get(r.id) ?? []).map(pack),
  }));

  const parts = new Set<string>();
  let pieces = 0;
  let weightKg = 0;
  let packs = 0;
  for (const u of units) {
    if (u.parentId && ids.has(u.parentId)) packs += 1;
    weightKg += Number(u.weightKg) || 0;
    for (const l of toLines(u.contents)) {
      pieces += l.quantity;
      parts.add(l.partNumber);
    }
  }

  return {
    asn: shipment.asn,
    folio: shipment.folio,
    shipDate: shipment.shippedDate ? toIsoDate(shipment.shippedDate) : null,
    shipTo: { name: shipment.customerName, destination: shipment.destination },
    carrier: shipment.carrier,
    tracking: shipment.trackingNumber,
    incoterm: shipment.incoterm,
    status: shipment.status,
    hierarchy,
    totals: {
      tares: roots.length,
      packs,
      units: units.length,
      pieces,
      parts: parts.size,
      weightKg: Math.round(weightKg * 1000) / 1000,
      loaded: units.filter(isLoaded).length,
    },
  };
}

// ── Packing list (flat) ──────────────────────────────────────────────────────

export interface PackingRow {
  sscc: string | null;
  type: string;
  partNumber: string;
  quantity: number;
  serials: string[];
  weightKg: number | null;
  loaded: boolean;
}
export interface PackingList {
  folio: string | null;
  asn: string | null;
  customer: string | null;
  destination: string | null;
  date: string;
  rows: PackingRow[];
  totals: { units: number; pieces: number; parts: number; weightKg: number };
}

/** Flatten the handling units into one row per content line (the packing slip). */
export function buildPackingList(
  shipment: AsnShipmentLike,
  units: AsnUnitLike[],
  now: Date = new Date(),
): PackingList {
  const rows: PackingRow[] = [];
  const parts = new Set<string>();
  let pieces = 0;
  let weightKg = 0;
  for (const u of units) {
    weightKg += Number(u.weightKg) || 0;
    const lines = toLines(u.contents);
    if (lines.length === 0) {
      rows.push({
        sscc: u.sscc,
        type: u.type,
        partNumber: '—',
        quantity: 0,
        serials: [],
        weightKg: u.weightKg,
        loaded: isLoaded(u),
      });
      continue;
    }
    for (const l of lines) {
      pieces += l.quantity;
      parts.add(l.partNumber);
      rows.push({
        sscc: u.sscc,
        type: u.type,
        partNumber: l.partNumber,
        quantity: l.quantity,
        serials: l.serials,
        weightKg: u.weightKg,
        loaded: isLoaded(u),
      });
    }
  }
  return {
    folio: shipment.folio,
    asn: shipment.asn,
    customer: shipment.customerName,
    destination: shipment.destination,
    date: toIsoDate(now),
    rows,
    totals: {
      units: units.length,
      pieces,
      parts: parts.size,
      weightKg: Math.round(weightKg * 1000) / 1000,
    },
  };
}

/** CSV rendering of the packing list (download from the UI). */
export function packingListCsv(pl: PackingList): string {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = [
    'SSCC',
    'Tipo',
    'Parte',
    'Cantidad',
    'Series',
    'Peso(kg)',
    'Cargada',
  ];
  const lines = [header.join(',')];
  for (const r of pl.rows) {
    lines.push(
      [
        r.sscc ?? '',
        r.type,
        r.partNumber,
        r.quantity,
        r.serials.join(' '),
        r.weightKg ?? '',
        r.loaded ? 'SI' : 'NO',
      ]
        .map(esc)
        .join(','),
    );
  }
  lines.push(
    [
      '',
      '',
      `TOTAL ${pl.totals.parts} partes`,
      pl.totals.pieces,
      '',
      pl.totals.weightKg,
      '',
    ]
      .map(esc)
      .join(','),
  );
  return lines.join('\n');
}

// ── EDI 856 (simplified ASN flat file) ───────────────────────────────────────

function toIsoDate(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
}
const ediDate = (iso: string | null) => (iso ? iso.replace(/-/g, '') : '');

/**
 * Render a simplified, well-formed EDI 856 (Ship Notice/Manifest) from the ASN:
 * BSN header + the HL hierarchy S(hipment)→T(are)→P(ack)→item with MAN*GM SSCCs
 * and LIN/SN1 item lines, closed by CTT/SE. Honest subset (no envelope) — enough
 * to recognize and parse as an 856; the UI offers it as a download.
 */
export function toEdi856(asn: Asn): string {
  const seg: string[] = [];
  let hl = 0;
  seg.push('ST*856*0001');
  seg.push(
    `BSN*00*${asn.asn ?? asn.folio ?? ''}*${ediDate(asn.shipDate) || ediDate(toIsoDate(new Date()))}*0000`,
  );

  const shipmentHl = ++hl;
  seg.push(`HL*${shipmentHl}**S`);
  if (asn.carrier) seg.push(`TD5**2*${asn.carrier}`);
  if (asn.tracking) seg.push(`REF*CN*${asn.tracking}`);
  if (asn.shipTo.name) seg.push(`N1*ST*${asn.shipTo.name}`);
  if (asn.shipTo.destination) seg.push(`N3*${asn.shipTo.destination}`);

  const emitItems = (lines: AsnLine[]) => {
    for (const l of lines) {
      seg.push(`LIN**BP*${l.partNumber}`);
      seg.push(`SN1**${l.quantity}*EA`);
      for (const s of l.serials) seg.push(`REF*SE*${s}`);
    }
  };

  for (const tare of asn.hierarchy) {
    const tareHl = ++hl;
    seg.push(`HL*${tareHl}*${shipmentHl}*T`);
    if (tare.sscc) seg.push(`MAN*GM*${tare.sscc}`);
    emitItems(tare.lines);
    for (const p of tare.packs) {
      const packHl = ++hl;
      seg.push(`HL*${packHl}*${tareHl}*P`);
      if (p.sscc) seg.push(`MAN*GM*${p.sscc}`);
      emitItems(p.lines);
    }
  }

  seg.push(`CTT*${hl}`);
  // SE count includes ST + all segments through SE itself.
  seg.push(`SE*${seg.length + 1}*0001`);
  return seg.map((s) => `${s}~`).join('\n');
}
