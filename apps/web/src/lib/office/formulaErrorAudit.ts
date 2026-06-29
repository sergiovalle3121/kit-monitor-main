/* eslint-disable @typescript-eslint/no-explicit-any */

export type SpreadsheetErrorCode = '#VALUE!' | '#DIV/0!' | '#N/A' | '#REF!' | '#NAME?' | '#NUM!' | '#NULL!';

export interface FormulaErrorFinding {
  sheetIndex: number;
  sheetName: string;
  cell: string;
  error: SpreadsheetErrorCode;
  formula?: string;
}

export interface FormulaErrorAudit {
  total: number;
  byError: Record<SpreadsheetErrorCode, number>;
  findings: FormulaErrorFinding[];
}

const ERROR_CODES: SpreadsheetErrorCode[] = ['#VALUE!', '#DIV/0!', '#N/A', '#REF!', '#NAME?', '#NUM!', '#NULL!'];

function colName(n: number): string {
  let s = '';
  for (let x = n + 1; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(((x - 1) % 26) + 65) + s;
  return s;
}

function errorFromCell(cell: any): SpreadsheetErrorCode | null {
  const value = cell?.v && typeof cell.v === 'object' ? (cell.v.v ?? cell.v.m) : cell?.v;
  const text = String(value ?? '').trim().toUpperCase();
  return ERROR_CODES.find((code) => text === code) ?? null;
}

export function auditFormulaErrors(content: any): FormulaErrorAudit {
  const sheets = Array.isArray(content) ? content : Array.isArray(content?.sheets) ? content.sheets : [];
  const findings: FormulaErrorFinding[] = [];
  sheets.forEach((sheet: any, sheetIndex: number) => {
    for (const cell of sheet?.celldata ?? []) {
      const error = errorFromCell(cell);
      if (!error) continue;
      const formula = cell?.v && typeof cell.v === 'object' && cell.v.f ? String(cell.v.f) : undefined;
      findings.push({
        sheetIndex,
        sheetName: sheet?.name ?? `Hoja ${sheetIndex + 1}`,
        cell: `${colName(cell.c ?? 0)}${(cell.r ?? 0) + 1}`,
        error,
        formula,
      });
    }
  });
  const byError = Object.fromEntries(ERROR_CODES.map((code) => [code, 0])) as Record<SpreadsheetErrorCode, number>;
  findings.forEach((finding) => { byError[finding.error]++; });
  return { total: findings.length, byError, findings };
}

export function formatFormulaErrorAudit(audit: FormulaErrorAudit): string {
  if (!audit.total) return 'Sin errores de fórmula visibles.';
  const totals = ERROR_CODES.filter((code) => audit.byError[code]).map((code) => `${code}: ${audit.byError[code]}`).join(' · ');
  const samples = audit.findings.slice(0, 8).map((finding) => `${finding.sheetName}!${finding.cell} ${finding.error}${finding.formula ? ` (${finding.formula})` : ''}`);
  return [`${audit.total} error(es) de fórmula visibles`, totals, ...samples].join('\n');
}
