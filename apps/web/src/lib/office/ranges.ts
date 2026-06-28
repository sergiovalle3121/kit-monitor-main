export interface CellAddress { row: number; col: number; rowAbsolute?: boolean; colAbsolute?: boolean }
export interface RangeAddress { start: CellAddress; end: CellAddress }
export interface SheetReference { sheetName?: string; address: string; range?: RangeAddress }

export function columnNameToIndex(name: string): number {
  if (!/^[A-Z]+$/i.test(name.trim())) throw new Error(`Invalid column name: ${name}`);
  let n = 0;
  for (const ch of name.trim().toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function columnIndexToName(index: number): string {
  if (!Number.isInteger(index) || index < 0) throw new Error(`Invalid column index: ${index}`);
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export function parseCellAddress(address: string): CellAddress | null {
  const match = /^\s*(\$?)([A-Z]{1,3})(\$?)([1-9]\d*)\s*$/i.exec(address);
  if (!match) return null;
  return { row: Number(match[4]) - 1, col: columnNameToIndex(match[2]), colAbsolute: match[1] === '$', rowAbsolute: match[3] === '$' };
}

export function formatCellAddress(cell: CellAddress, absolute = false): string {
  const colAbs = absolute || cell.colAbsolute ? '$' : '';
  const rowAbs = absolute || cell.rowAbsolute ? '$' : '';
  return `${colAbs}${columnIndexToName(cell.col)}${rowAbs}${cell.row + 1}`;
}

export function parseAbsoluteReference(ref: string): CellAddress | null { return parseCellAddress(ref); }

export function parseRangeAddress(range: string): RangeAddress | null {
  const parts = range.split(':');
  if (parts.length > 2) return null;
  const start = parseCellAddress(parts[0]);
  const end = parseCellAddress(parts[1] ?? parts[0]);
  return start && end ? { start, end } : null;
}

export function formatRangeAddress(range: RangeAddress, absolute = false): string {
  const a = formatCellAddress(range.start, absolute);
  const b = formatCellAddress(range.end, absolute);
  return a === b ? a : `${a}:${b}`;
}

export function normalizeSheetName(name: string): string {
  return name.trim().replace(/^'|'$/g, '').replace(/''/g, "'");
}

function splitSheetRef(ref: string): { sheetName?: string; address: string } {
  let inQuote = false;
  for (let i = 0; i < ref.length; i++) {
    const ch = ref[i];
    if (ch === "'") inQuote = !inQuote;
    if (ch === '!' && !inQuote) return { sheetName: normalizeSheetName(ref.slice(0, i)), address: ref.slice(i + 1) };
  }
  return { address: ref };
}

export function parseSheetReference(ref: string): SheetReference | null {
  const { sheetName, address } = splitSheetRef(ref.trim());
  const range = parseRangeAddress(address.replace(/\$/g, ''));
  if (!range) return null;
  return { sheetName, address: formatRangeAddress(range), range };
}
