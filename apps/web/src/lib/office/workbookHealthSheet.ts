/* eslint-disable @typescript-eslint/no-explicit-any */
import { analyzeWorkbookHealth, type WorkbookHealthFinding, type WorkbookHealthReport } from './workbookHealth';

function healthCell(value: string | number, opts: { bold?: boolean; severity?: WorkbookHealthFinding['severity'] } = {}) {
  const isNumber = typeof value === 'number';
  const palette = opts.severity === 'critical'
    ? { bg: '#fee2e2', fc: '#991b1b' }
    : opts.severity === 'warning'
      ? { bg: '#fef3c7', fc: '#92400e' }
      : opts.severity === 'info'
        ? { bg: '#dbeafe', fc: '#1e3a8a' }
        : opts.bold
          ? { bg: '#ecfeff', fc: '#164e63' }
          : {};
  return {
    v: value,
    m: String(value),
    ct: { fa: 'General', t: isNumber ? 'n' : 's' },
    ...(opts.bold ? { bl: 1 } : {}),
    ...palette,
  };
}

export function buildWorkbookHealthSheet(
  report: WorkbookHealthReport,
  generatedAt = new Date(),
  order = 0,
  name = 'AXOS Workbook Health',
): { name: string; order: number; row: number; column: number; celldata: any[]; config: Record<string, unknown> } {
  const celldata: any[] = [
    { r: 0, c: 0, v: healthCell('AXOS Workbook Health', { bold: true }) },
    { r: 1, c: 0, v: healthCell('Generated at', { bold: true }) },
    { r: 1, c: 1, v: healthCell(generatedAt.toISOString()) },
    { r: 2, c: 0, v: healthCell('Score', { bold: true }) },
    { r: 2, c: 1, v: healthCell(report.score) },
    { r: 3, c: 0, v: healthCell('Workbook scale', { bold: true }) },
    { r: 3, c: 1, v: healthCell(report.label) },
    { r: 5, c: 0, v: healthCell('Severity', { bold: true }) },
    { r: 5, c: 1, v: healthCell('Code', { bold: true }) },
    { r: 5, c: 2, v: healthCell('Message', { bold: true }) },
  ];
  if (!report.findings.length) {
    celldata.push({ r: 6, c: 0, v: healthCell('info', { severity: 'info' }) });
    celldata.push({ r: 6, c: 1, v: healthCell('healthy') });
    celldata.push({ r: 6, c: 2, v: healthCell('Sin hallazgos relevantes.') });
  } else {
    report.findings.forEach((finding, index) => {
      const r = index + 6;
      celldata.push({ r, c: 0, v: healthCell(finding.severity, { severity: finding.severity }) });
      celldata.push({ r, c: 1, v: healthCell(finding.code) });
      celldata.push({ r, c: 2, v: healthCell(finding.message) });
    });
  }
  return {
    name,
    order,
    row: Math.max(30, report.findings.length + 10),
    column: 4,
    celldata,
    config: {
      columnlen: { 0: 120, 1: 220, 2: 640 },
      frozen: { type: 'row' },
    },
  };
}

export function upsertWorkbookHealthSheet(
  sheets: any[],
  content: any,
  generatedAt = new Date(),
  name = 'AXOS Workbook Health',
): { sheets: any[]; report: WorkbookHealthReport } {
  const report = analyzeWorkbookHealth(content, generatedAt);
  const next = sheets.map((sheet) => ({ ...sheet }));
  const index = next.findIndex((sheet) => sheet?.name === name);
  const order = index >= 0 ? (next[index]?.order ?? index) : next.length;
  const healthSheet = buildWorkbookHealthSheet(report, generatedAt, order, name);
  if (index >= 0) next[index] = { ...next[index], ...healthSheet };
  else next.push(healthSheet);
  return { sheets: next.map((sheet, i) => ({ ...sheet, order: sheet.order ?? i })), report };
}
