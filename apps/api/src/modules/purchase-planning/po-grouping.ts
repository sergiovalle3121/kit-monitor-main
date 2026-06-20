/**
 * Pure grouping of MRP shortage lines into purchase-order drafts (one per
 * supplier). Side-effect free (unit-testable). The service resolves the supplier
 * per material (preferred AVL manufacturer) and then groups here.
 */

export const UNASSIGNED_SUPPLIER = 'Por asignar';

export interface ShortageLine {
  materialId: string;
  partNumber: string;
  description: string;
  uom: string;
  qty: number; // net / suggested order
  unitCost: number;
  value: number; // shortage value
  supplierName: string; // resolved (or UNASSIGNED_SUPPLIER)
}

export interface PoDraftPart {
  partNumber: string;
  description: string;
  qty: number;
  uom: string;
  value: number;
}

export interface PoDraft {
  supplierName: string;
  parts: PoDraftPart[];
  lineCount: number;
  totalValue: number;
  currency: string;
  title: string;
  notes: string;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function groupBySupplier(
  lines: ShortageLine[],
  rootPartNumber: string,
  currency = 'USD',
): PoDraft[] {
  const groups = new Map<string, ShortageLine[]>();
  for (const l of lines) {
    const key = l.supplierName || UNASSIGNED_SUPPLIER;
    const arr = groups.get(key) ?? [];
    arr.push(l);
    groups.set(key, arr);
  }

  const drafts: PoDraft[] = [];
  for (const [supplierName, arr] of groups) {
    const parts: PoDraftPart[] = arr.map((l) => ({
      partNumber: l.partNumber,
      description: l.description,
      qty: l.qty,
      uom: l.uom,
      value: round2(l.value),
    }));
    const totalValue = round2(parts.reduce((s, p) => s + p.value, 0));
    const notes =
      `Sugerido por MRP para ${rootPartNumber}.\n` +
      parts.map((p) => `• ${p.partNumber} ×${p.qty} ${p.uom} — ${p.description}`).join('\n');
    drafts.push({
      supplierName,
      parts,
      lineCount: parts.length,
      totalValue,
      currency,
      title: `OC ${supplierName} — ${parts.length} parte(s) (MRP ${rootPartNumber})`,
      notes,
    });
  }

  // Highest value first; unassigned last.
  return drafts.sort((a, b) => {
    if (a.supplierName === UNASSIGNED_SUPPLIER) return 1;
    if (b.supplierName === UNASSIGNED_SUPPLIER) return -1;
    return b.totalValue - a.totalValue;
  });
}
