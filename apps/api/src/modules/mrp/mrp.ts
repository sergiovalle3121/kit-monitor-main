/**
 * Pure MRP netting: gross requirement − available − in-transit = net requirement,
 * with a suggested order qty. Side-effect free (unit-testable). The service feeds
 * it BOM-exploded demand + aggregated inventory supply.
 */

export interface MrpDemandLine {
  partNumber: string;
  description: string;
  uom: string;
  grossQty: number;
  unitCost: number;
  makeBuy: string; // MAKE | BUY
}

export interface MrpSupply {
  available: number;
  inTransit: number;
}

export interface MrpRow {
  partNumber: string;
  description: string;
  uom: string;
  makeBuy: string;
  gross: number;
  available: number;
  inTransit: number;
  net: number;
  suggestedOrder: number;
  unitCost: number;
  shortageValue: number;
}

export interface MrpSummary {
  parts: number;
  shortageParts: number;
  totalShortageValue: number;
}

const round = (n: number) => Math.round((n + Number.EPSILON) * 1e6) / 1e6;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function computeNetting(
  demand: MrpDemandLine[],
  supplyByPart: Map<string, MrpSupply>,
): { rows: MrpRow[]; summary: MrpSummary } {
  const rows = demand.map((d) => {
    const supply = supplyByPart.get(d.partNumber) ?? { available: 0, inTransit: 0 };
    const available = Math.max(0, supply.available || 0);
    const inTransit = Math.max(0, supply.inTransit || 0);
    const net = round(Math.max(0, (d.grossQty || 0) - available - inTransit));
    return {
      partNumber: d.partNumber,
      description: d.description,
      uom: d.uom,
      makeBuy: d.makeBuy,
      gross: round(d.grossQty || 0),
      available: round(available),
      inTransit: round(inTransit),
      net,
      suggestedOrder: net,
      unitCost: round2(d.unitCost || 0),
      shortageValue: round2(net * (d.unitCost || 0)),
    };
  });

  // Shortages first, then by descending shortage value.
  rows.sort((a, b) => (b.net > 0 ? 1 : 0) - (a.net > 0 ? 1 : 0) || b.shortageValue - a.shortageValue || a.partNumber.localeCompare(b.partNumber));

  const shortageParts = rows.filter((r) => r.net > 0).length;
  return {
    rows,
    summary: {
      parts: rows.length,
      shortageParts,
      totalShortageValue: round2(rows.reduce((s, r) => s + r.shortageValue, 0)),
    },
  };
}
