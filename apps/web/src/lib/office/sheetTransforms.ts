/* eslint-disable @typescript-eslint/no-explicit-any */
import { parseRange } from './charts';
import { colName, rawOf } from './sheetOps';

export type SheetTransformFilterOp =
  | '='
  | '!='
  | '>'
  | '>='
  | '<'
  | '<='
  | 'contains'
  | 'notcontains'
  | 'beginsWith'
  | 'endsWith'
  | 'empty'
  | 'notempty';

export type SheetTransformAggregate = 'sum' | 'avg' | 'count' | 'min' | 'max';
export type SheetTransformCalculatedFormula = 'sum' | 'difference' | 'product' | 'ratio';

export type SheetTransformStep =
  | { type: 'select_columns'; columns: string[] }
  | { type: 'rename_columns'; renames: Record<string, string> }
  | { type: 'filter_rows'; column: string; op: SheetTransformFilterOp; value?: string }
  | { type: 'sort_rows'; column: string; order: 'asc' | 'desc' }
  | { type: 'split_column'; column: string; delimiter: string; into?: string[]; removeSource?: boolean; trim?: boolean }
  | { type: 'remove_blanks'; columns?: string[]; mode?: 'any' | 'all' }
  | { type: 'remove_duplicates'; columns?: string[] }
  | { type: 'trim_clean_text'; columns?: string[] }
  | { type: 'normalize_number'; columns: string[] }
  | { type: 'normalize_date'; columns: string[] }
  | { type: 'add_calculated_column'; name: string; formula: SheetTransformCalculatedFormula; left: string; right: string }
  | { type: 'group_by'; groupBy: string[]; aggregations: { column: string; op: SheetTransformAggregate; as?: string }[] }
  | { type: 'unpivot_columns'; keyColumns: string[]; valueColumns?: string[]; nameColumn?: string; valueColumn?: string; skipBlanks?: boolean };

export interface SheetTransformConfig {
  range: string;
  sheetIndex: number;
  hasHeader?: boolean;
  steps: SheetTransformStep[];
}

export interface SheetTransformResult {
  ok: boolean;
  range: string;
  headers: string[];
  rows: any[][];
  warnings: string[];
  inputRows: number;
  outputRows: number;
  stepsApplied: number;
}

export interface SheetTransformCelldata {
  celldata: any[];
  nRows: number;
  nCols: number;
}

function isBlank(value: any): boolean {
  return value == null || String(value).trim() === '';
}

function cleanText(value: any): any {
  if (typeof value !== 'string') return value;
  return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeHeader(value: any, fallback: string): string {
  const cleaned = cleanText(value);
  return String(cleaned ?? '').trim() || fallback;
}

function dedupeHeaders(headers: string[]): { headers: string[]; warnings: string[] } {
  const seen = new Map<string, number>();
  const warnings: string[] = [];
  const next = headers.map((header) => {
    const key = header.toLowerCase();
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count === 1) return header;
    const renamed = `${header}_${count}`;
    warnings.push(`Duplicate header "${header}" renamed to "${renamed}".`);
    return renamed;
  });
  return { headers: next, warnings };
}

function cellValue(value: any, bold = false) {
  const numeric = typeof value === 'number' && Number.isFinite(value);
  const text = value == null ? '' : String(value);
  return {
    v: numeric ? value : text,
    m: numeric ? String(value) : text,
    ct: { fa: 'General', t: numeric ? 'n' : 's' },
    ...(bold ? { bl: 1, bg: '#f8fafc', fc: '#0f172a' } : {}),
  };
}

function readSource(sheet: any, config: SheetTransformConfig): SheetTransformResult {
  const parsed = parseRange(config.range);
  if (!parsed || !sheet) {
    return { ok: false, range: config.range, headers: [], rows: [], warnings: ['Invalid source range.'], inputRows: 0, outputRows: 0, stepsApplied: 0 };
  }

  const map = new Map<string, any>();
  for (const cd of sheet.celldata ?? []) map.set(`${cd.r}_${cd.c}`, rawOf(cd));

  const hasHeader = config.hasHeader !== false;
  const rawHeaders: string[] = [];
  for (let c = parsed.c1; c <= parsed.c2; c++) {
    const fallback = `Column ${colName(c)}`;
    rawHeaders.push(hasHeader ? normalizeHeader(map.get(`${parsed.r1}_${c}`), fallback) : fallback);
  }
  const deduped = dedupeHeaders(rawHeaders);
  const rows: any[][] = [];
  const startRow = hasHeader ? parsed.r1 + 1 : parsed.r1;
  for (let r = startRow; r <= parsed.r2; r++) {
    const row: any[] = [];
    for (let c = parsed.c1; c <= parsed.c2; c++) row.push(map.get(`${r}_${c}`) ?? null);
    rows.push(row);
  }
  return {
    ok: true,
    range: config.range,
    headers: deduped.headers,
    rows,
    warnings: deduped.warnings,
    inputRows: rows.length,
    outputRows: rows.length,
    stepsApplied: 0,
  };
}

function columnIndex(headers: string[], requested: string | undefined, warnings: string[]): number {
  const raw = String(requested ?? '').trim();
  if (!raw) return -1;
  const numeric = raw.match(/^#?(\d+)$/);
  if (numeric) {
    const idx = Number(numeric[1]) - 1;
    if (idx >= 0 && idx < headers.length) return idx;
  }
  const idx = headers.findIndex((header) => header.toLowerCase() === raw.toLowerCase());
  if (idx >= 0) return idx;
  warnings.push(`Column "${raw}" was not found.`);
  return -1;
}

function columnIndexes(headers: string[], requested: string[] | undefined, warnings: string[]): number[] {
  if (!requested?.length) return headers.map((_, idx) => idx);
  const indexes = requested.map((column) => columnIndex(headers, column, warnings)).filter((idx) => idx >= 0);
  return [...new Set(indexes)];
}

function parseNumber(value: any): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value ?? '').trim();
  if (!text) return null;
  const percent = text.endsWith('%');
  const cleaned = text.replace(/[$,\s]/g, '').replace(/%$/, '');
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return percent ? n / 100 : n;
}

function parseDate(value: any): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number' && Number.isFinite(value) && value > 1) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return new Date(excelEpoch + value * 86400000).toISOString().slice(0, 10);
  }
  const text = String(value ?? '').trim();
  if (!text) return null;
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

function compare(left: any, op: SheetTransformFilterOp, right?: string): boolean {
  if (op === 'empty') return isBlank(left);
  if (op === 'notempty') return !isBlank(left);
  const lnum = parseNumber(left);
  const rnum = parseNumber(right);
  if (lnum != null && rnum != null && ['=', '!=', '>', '>=', '<', '<='].includes(op)) {
    if (op === '=') return lnum === rnum;
    if (op === '!=') return lnum !== rnum;
    if (op === '>') return lnum > rnum;
    if (op === '>=') return lnum >= rnum;
    if (op === '<') return lnum < rnum;
    return lnum <= rnum;
  }
  const leftText = String(left ?? '').toLowerCase();
  const rightText = String(right ?? '').toLowerCase();
  if (op === '=') return leftText === rightText;
  if (op === '!=') return leftText !== rightText;
  if (op === 'contains') return leftText.includes(rightText);
  if (op === 'notcontains') return !leftText.includes(rightText);
  if (op === 'beginsWith') return leftText.startsWith(rightText);
  if (op === 'endsWith') return leftText.endsWith(rightText);
  return false;
}

function sortable(value: any): string | number {
  const n = parseNumber(value);
  return n ?? String(value ?? '').toLowerCase();
}

function aggregate(values: any[], op: SheetTransformAggregate): number {
  if (op === 'count') return values.filter((value) => !isBlank(value)).length;
  const nums = values.map(parseNumber).filter((value): value is number => value != null);
  if (!nums.length) return 0;
  if (op === 'sum') return nums.reduce((sum, value) => sum + value, 0);
  if (op === 'avg') return nums.reduce((sum, value) => sum + value, 0) / nums.length;
  if (op === 'min') return Math.min(...nums);
  return Math.max(...nums);
}

function calculated(left: any, right: any, formula: SheetTransformCalculatedFormula, warnings: string[]): number | null {
  const lnum = parseNumber(left);
  const rnum = parseNumber(right);
  if (lnum == null || rnum == null) return null;
  if (formula === 'sum') return lnum + rnum;
  if (formula === 'difference') return lnum - rnum;
  if (formula === 'product') return lnum * rnum;
  if (rnum === 0) {
    warnings.push('Calculated ratio skipped a divide-by-zero row.');
    return null;
  }
  return lnum / rnum;
}

function withDedupedHeaders(headers: string[], warnings: string[]): string[] {
  const deduped = dedupeHeaders(headers);
  warnings.push(...deduped.warnings);
  return deduped.headers;
}

export function runSheetTransform(sheet: any, config: SheetTransformConfig): SheetTransformResult {
  const result = readSource(sheet, config);
  if (!result.ok) return result;
  let headers = [...result.headers];
  let rows = result.rows.map((row) => [...row]);
  const warnings = [...result.warnings];
  let stepsApplied = 0;

  for (const step of config.steps) {
    switch (step.type) {
      case 'select_columns': {
        const indexes = columnIndexes(headers, step.columns, warnings);
        if (!indexes.length) break;
        headers = indexes.map((idx) => headers[idx]);
        rows = rows.map((row) => indexes.map((idx) => row[idx]));
        stepsApplied++;
        break;
      }
      case 'rename_columns': {
        headers = headers.map((header) => {
          const match = Object.entries(step.renames).find(([from]) => from.toLowerCase() === header.toLowerCase());
          return match?.[1]?.trim() || header;
        });
        stepsApplied++;
        break;
      }
      case 'filter_rows': {
        const idx = columnIndex(headers, step.column, warnings);
        if (idx < 0) break;
        rows = rows.filter((row) => compare(row[idx], step.op, step.value));
        stepsApplied++;
        break;
      }
      case 'sort_rows': {
        const idx = columnIndex(headers, step.column, warnings);
        if (idx < 0) break;
        rows = rows.map((row, order) => ({ row, order })).sort((a, b) => {
          const av = sortable(a.row[idx]);
          const bv = sortable(b.row[idx]);
          let cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
          if (cmp === 0) cmp = a.order - b.order;
          return step.order === 'desc' ? -cmp : cmp;
        }).map((item) => item.row);
        stepsApplied++;
        break;
      }
      case 'split_column': {
        const idx = columnIndex(headers, step.column, warnings);
        if (idx < 0) break;
        const delimiter = String(step.delimiter ?? '').trim();
        if (!delimiter) {
          warnings.push('Split delimiter cannot be blank.');
          break;
        }
        const splitRows = rows.map((row) => {
          const raw = String(row[idx] ?? '');
          const parts = raw.split(delimiter);
          return step.trim === false ? parts : parts.map((part) => cleanText(part));
        });
        const width = Math.max(1, step.into?.length ?? 0, ...splitRows.map((parts) => parts.length));
        const splitHeaders = Array.from({ length: width }, (_, partIdx) => {
          const named = step.into?.[partIdx]?.trim();
          return named || `${headers[idx]} ${partIdx + 1}`;
        });
        const normalizedRows = splitRows.map((parts) => Array.from({ length: width }, (_, partIdx) => parts[partIdx] ?? null));
        if (step.removeSource) {
          headers = withDedupedHeaders([...headers.slice(0, idx), ...splitHeaders, ...headers.slice(idx + 1)], warnings);
          rows = rows.map((row, rowIdx) => [...row.slice(0, idx), ...normalizedRows[rowIdx], ...row.slice(idx + 1)]);
        } else {
          headers = withDedupedHeaders([...headers, ...splitHeaders], warnings);
          rows = rows.map((row, rowIdx) => [...row, ...normalizedRows[rowIdx]]);
        }
        stepsApplied++;
        break;
      }
      case 'remove_blanks': {
        const indexes = columnIndexes(headers, step.columns, warnings);
        if (!indexes.length) break;
        const mode = step.mode ?? 'all';
        rows = rows.filter((row) => mode === 'any' ? indexes.every((idx) => !isBlank(row[idx])) : indexes.some((idx) => !isBlank(row[idx])));
        stepsApplied++;
        break;
      }
      case 'remove_duplicates': {
        const indexes = columnIndexes(headers, step.columns, warnings);
        if (!indexes.length) break;
        const seen = new Set<string>();
        rows = rows.filter((row) => {
          const key = JSON.stringify(indexes.map((idx) => row[idx]));
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        stepsApplied++;
        break;
      }
      case 'trim_clean_text': {
        const indexes = columnIndexes(headers, step.columns, warnings);
        if (!indexes.length) break;
        rows = rows.map((row) => row.map((value, idx) => indexes.includes(idx) ? cleanText(value) : value));
        stepsApplied++;
        break;
      }
      case 'normalize_number': {
        const indexes = columnIndexes(headers, step.columns, warnings);
        if (!indexes.length) break;
        rows = rows.map((row) => row.map((value, idx) => indexes.includes(idx) ? (parseNumber(value) ?? value) : value));
        stepsApplied++;
        break;
      }
      case 'normalize_date': {
        const indexes = columnIndexes(headers, step.columns, warnings);
        if (!indexes.length) break;
        rows = rows.map((row) => row.map((value, idx) => indexes.includes(idx) ? (parseDate(value) ?? value) : value));
        stepsApplied++;
        break;
      }
      case 'add_calculated_column': {
        const left = columnIndex(headers, step.left, warnings);
        const right = columnIndex(headers, step.right, warnings);
        if (left < 0 || right < 0) break;
        headers = [...headers, step.name.trim() || `${step.left}_${step.formula}_${step.right}`];
        rows = rows.map((row) => [...row, calculated(row[left], row[right], step.formula, warnings)]);
        stepsApplied++;
        break;
      }
      case 'group_by': {
        const groupIndexes = columnIndexes(headers, step.groupBy, warnings);
        const aggs = step.aggregations.map((agg) => ({ ...agg, idx: columnIndex(headers, agg.column, warnings) })).filter((agg) => agg.idx >= 0);
        if (!groupIndexes.length || !aggs.length) break;
        const groups = new Map<string, any[][]>();
        for (const row of rows) {
          const key = JSON.stringify(groupIndexes.map((idx) => row[idx]));
          groups.set(key, [...(groups.get(key) ?? []), row]);
        }
        headers = [
          ...groupIndexes.map((idx) => headers[idx]),
          ...aggs.map((agg) => agg.as?.trim() || `${agg.op}_${headers[agg.idx]}`),
        ];
        rows = [...groups.entries()].map(([key, groupedRows]) => [
          ...JSON.parse(key),
          ...aggs.map((agg) => aggregate(groupedRows.map((row) => row[agg.idx]), agg.op)),
        ]);
        stepsApplied++;
        break;
      }
      case 'unpivot_columns': {
        const keyIndexes = columnIndexes(headers, step.keyColumns, warnings);
        if (!keyIndexes.length) break;
        const valueIndexes = step.valueColumns?.length
          ? columnIndexes(headers, step.valueColumns, warnings)
          : headers.map((_, idx) => idx).filter((idx) => !keyIndexes.includes(idx));
        if (!valueIndexes.length) {
          warnings.push('No value columns available to unpivot.');
          break;
        }
        const nextHeaders = [
          ...keyIndexes.map((idx) => headers[idx]),
          step.nameColumn?.trim() || 'Attribute',
          step.valueColumn?.trim() || 'Value',
        ];
        const nextRows: any[][] = [];
        for (const row of rows) {
          const keys = keyIndexes.map((idx) => row[idx]);
          for (const valueIdx of valueIndexes) {
            const value = row[valueIdx];
            if (step.skipBlanks && isBlank(value)) continue;
            nextRows.push([...keys, headers[valueIdx], value]);
          }
        }
        headers = withDedupedHeaders(nextHeaders, warnings);
        rows = nextRows;
        stepsApplied++;
        break;
      }
      default:
        break;
    }
  }

  return {
    ok: true,
    range: config.range,
    headers,
    rows,
    warnings: [...new Set(warnings)],
    inputRows: result.inputRows,
    outputRows: rows.length,
    stepsApplied,
  };
}

export function sheetTransformResultToCelldata(result: Pick<SheetTransformResult, 'headers' | 'rows'>, origin: { r: number; c: number } = { r: 0, c: 0 }): SheetTransformCelldata {
  const celldata: any[] = [];
  result.headers.forEach((header, idx) => celldata.push({ r: origin.r, c: origin.c + idx, v: cellValue(header, true) }));
  result.rows.forEach((row, rowIdx) => {
    row.forEach((value, colIdx) => celldata.push({ r: origin.r + rowIdx + 1, c: origin.c + colIdx, v: cellValue(value) }));
  });
  return {
    celldata,
    nRows: result.rows.length + 1,
    nCols: result.headers.length,
  };
}
