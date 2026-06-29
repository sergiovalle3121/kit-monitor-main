/* eslint-disable @typescript-eslint/no-explicit-any */
import { auditDataValidations, type DataValidationAudit, type DataValidationFinding } from './dataValidationAudit';

function validationCell(value: string | number, invalid = false, bold = false) {
  return {
    v: value,
    m: String(value),
    ct: { fa: 'General', t: typeof value === 'number' ? 'n' : 's' },
    ...(bold ? { bl: 1, bg: '#f1f5f9', fc: '#0f172a' } : {}),
    ...(invalid ? { bg: '#fee2e2', fc: '#991b1b' } : {}),
  };
}

export function buildDataValidationSheet(
  audit: DataValidationAudit,
  order = 0,
  name = 'AXOS Validation Audit',
): { name: string; order: number; row: number; column: number; celldata: any[]; config: Record<string, unknown> } {
  const headers = ['Sheet', 'Cell', 'Type', 'Value', 'Rule'];
  const celldata: any[] = [
    { r: 0, c: 0, v: validationCell('AXOS Validation Audit', false, true) },
    { r: 1, c: 0, v: validationCell('Rules', false, true) },
    { r: 1, c: 1, v: validationCell(audit.rules) },
    { r: 2, c: 0, v: validationCell('Invalid', false, true) },
    { r: 2, c: 1, v: validationCell(audit.invalid, audit.invalid > 0) },
  ];
  headers.forEach((header, c) => celldata.push({ r: 4, c, v: validationCell(header, false, true) }));
  if (!audit.findings.length) {
    celldata.push({ r: 5, c: 0, v: validationCell(audit.rules ? 'Sin valores inválidos visibles' : 'Sin reglas de validación') });
  } else {
    audit.findings.forEach((finding: DataValidationFinding, index: number) => {
      const r = index + 5;
      celldata.push({ r, c: 0, v: validationCell(finding.sheetName, true) });
      celldata.push({ r, c: 1, v: validationCell(finding.cell, true) });
      celldata.push({ r, c: 2, v: validationCell(finding.type, true) });
      celldata.push({ r, c: 3, v: validationCell(finding.value, true) });
      celldata.push({ r, c: 4, v: validationCell(finding.rule, true) });
    });
  }
  return {
    name,
    order,
    row: Math.max(25, audit.findings.length + 9),
    column: headers.length + 1,
    celldata,
    config: { columnlen: { 0: 180, 1: 90, 2: 150, 3: 220, 4: 360 }, frozen: { type: 'row' } },
  };
}

export function upsertDataValidationSheet(
  sheets: any[],
  content: any,
  name = 'AXOS Validation Audit',
): { sheets: any[]; audit: DataValidationAudit } {
  const audit = auditDataValidations(content);
  const next = sheets.map((sheet) => ({ ...sheet }));
  const index = next.findIndex((sheet) => sheet?.name === name);
  const order = index >= 0 ? (next[index]?.order ?? index) : next.length;
  const validationSheet = buildDataValidationSheet(audit, order, name);
  if (index >= 0) next[index] = { ...next[index], ...validationSheet };
  else next.push(validationSheet);
  return { sheets: next.map((sheet, i) => ({ ...sheet, order: sheet.order ?? i })), audit };
}
