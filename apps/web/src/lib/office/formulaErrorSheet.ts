/* eslint-disable @typescript-eslint/no-explicit-any */
import { auditFormulaErrors, type FormulaErrorAudit, type FormulaErrorFinding } from './formulaErrorAudit';

function errorCell(value: string | number, error?: FormulaErrorFinding['error'], bold = false) {
  const critical = error === '#REF!';
  const warning = !!error && error !== '#REF!';
  return {
    v: value,
    m: String(value),
    ct: { fa: 'General', t: typeof value === 'number' ? 'n' : 's' },
    ...(bold ? { bl: 1, bg: '#f8fafc', fc: '#0f172a' } : {}),
    ...(critical ? { bg: '#fee2e2', fc: '#991b1b' } : {}),
    ...(warning ? { bg: '#fef3c7', fc: '#92400e' } : {}),
  };
}

export function buildFormulaErrorSheet(
  audit: FormulaErrorAudit,
  order = 0,
  name = 'AXOS Formula Errors',
): { name: string; order: number; row: number; column: number; celldata: any[]; config: Record<string, unknown> } {
  const headers = ['Sheet', 'Cell', 'Error', 'Formula'];
  const celldata: any[] = [
    { r: 0, c: 0, v: errorCell('Visible Formula Errors', undefined, true) },
    { r: 1, c: 0, v: errorCell('Total', undefined, true) },
    { r: 1, c: 1, v: errorCell(audit.total) },
  ];
  headers.forEach((header, c) => celldata.push({ r: 3, c, v: errorCell(header, undefined, true) }));
  if (!audit.findings.length) {
    celldata.push({ r: 4, c: 0, v: errorCell('Sin errores visibles') });
  } else {
    audit.findings.forEach((finding, index) => {
      const r = index + 4;
      celldata.push({ r, c: 0, v: errorCell(finding.sheetName) });
      celldata.push({ r, c: 1, v: errorCell(finding.cell) });
      celldata.push({ r, c: 2, v: errorCell(finding.error, finding.error) });
      celldata.push({ r, c: 3, v: errorCell(finding.formula ?? '') });
    });
  }
  return {
    name,
    order,
    row: Math.max(25, audit.findings.length + 8),
    column: headers.length + 1,
    celldata,
    config: { columnlen: { 0: 180, 1: 90, 2: 110, 3: 420 }, frozen: { type: 'row' } },
  };
}

export function upsertFormulaErrorSheet(
  sheets: any[],
  content: any,
  name = 'AXOS Formula Errors',
): { sheets: any[]; audit: FormulaErrorAudit } {
  const audit = auditFormulaErrors(content);
  const next = sheets.map((sheet) => ({ ...sheet }));
  const index = next.findIndex((sheet) => sheet?.name === name);
  const order = index >= 0 ? (next[index]?.order ?? index) : next.length;
  const errorSheet = buildFormulaErrorSheet(audit, order, name);
  if (index >= 0) next[index] = { ...next[index], ...errorSheet };
  else next.push(errorSheet);
  return { sheets: next.map((sheet, i) => ({ ...sheet, order: sheet.order ?? i })), audit };
}
