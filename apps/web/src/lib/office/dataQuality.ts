/* eslint-disable @typescript-eslint/no-explicit-any */
import { auditDataValidations, type DataValidationAudit } from './dataValidationAudit';
import { auditFormulaErrors, type FormulaErrorAudit, type SpreadsheetErrorCode } from './formulaErrorAudit';
import { summarizeConnectorFreshness } from './axosConnectors';
import { rawOf } from './sheetOps';

export type DataQualitySeverity = 'critical' | 'warning' | 'info';
export type DataQualityIssueType =
  | 'validation'
  | 'formula_error'
  | 'blank_required'
  | 'duplicate_key'
  | 'negative_quantity'
  | 'invalid_date'
  | 'connector_freshness'
  | 'connector_failure'
  | 'unsupported_xlsx';

export interface DataQualityIssue {
  id: string;
  type: DataQualityIssueType;
  severity: DataQualitySeverity;
  sheetIndex?: number;
  sheetName?: string;
  cell?: string;
  range?: string;
  field?: string;
  value?: string;
  message: string;
  suggestedFix: string;
}

export interface DataQualityReport {
  checkedAt: string;
  score: number;
  issues: DataQualityIssue[];
  critical: number;
  warnings: number;
  info: number;
  validation: DataValidationAudit;
  formulaErrors: FormulaErrorAudit;
}

const MAX_ISSUES = 200;
const FORMULA_CRITICAL: SpreadsheetErrorCode[] = ['#REF!', '#NAME?'];

function sheetsOf(content: any): any[] {
  return Array.isArray(content) ? content : Array.isArray(content?.sheets) ? content.sheets : [];
}

function colName(n: number): string {
  let s = '';
  for (let x = n + 1; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(((x - 1) % 26) + 65) + s;
  return s;
}

function cellRef(r: number, c: number): string {
  return `${colName(c)}${r + 1}`;
}

function normalizeHeader(value: any): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function display(value: any): string {
  if (value == null) return '';
  if (typeof value === 'object') return String(value.m ?? value.v ?? value.f ?? '');
  return String(value);
}

function toFiniteNumber(value: any): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/,/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function isDateLike(value: any): boolean {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  const text = String(value ?? '').trim();
  if (!text) return true;
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(text)) return !Number.isNaN(Date.parse(text));
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(text)) return !Number.isNaN(Date.parse(text));
  return !Number.isNaN(Date.parse(text));
}

function isKeyHeader(header: string): boolean {
  return /\b(sku|part|parte|material|component|componente|serial|serie|lot|lote|wo|work order|orden|ncr|po|supplier|proveedor|model|modelo|revision)\b/.test(header);
}

function isQuantityHeader(header: string): boolean {
  return /\b(qty|quantity|cantidad|disponible|available|on hand|reserved|reservado|incoming|transito|stock|inventory|inventario|demanda|demand|shortage|scrap)\b/.test(header);
}

function isDateHeader(header: string): boolean {
  return /\b(date|fecha|eta|due|need|inicio|fin|start|end|vencimiento|caducidad)\b/.test(header);
}

function cellMap(sheet: any): Map<string, any> {
  return new Map<string, any>((sheet?.celldata ?? []).map((cell: any) => [`${cell.r}_${cell.c}`, cell]));
}

function valueAt(map: Map<string, any>, r: number, c: number): any {
  return rawOf(map.get(`${r}_${c}`));
}

function findHeaderRow(sheet: any): number | null {
  const rows = new Map<number, number>();
  for (const cell of sheet?.celldata ?? []) {
    if (cell.r > 20) continue;
    const value = display(rawOf(cell)).trim();
    if (!value) continue;
    rows.set(cell.r, (rows.get(cell.r) ?? 0) + 1);
  }
  const candidates = [...rows.entries()].filter(([, count]) => count >= 2);
  if (!candidates.length) return null;
  candidates.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  return candidates[0][0];
}

function rowHasAnyData(map: Map<string, any>, row: number, cols: number[]): boolean {
  return cols.some((c) => display(valueAt(map, row, c)).trim() !== '');
}

function pushIssue(issues: DataQualityIssue[], issue: DataQualityIssue): void {
  if (issues.length < MAX_ISSUES) issues.push(issue);
}

function addValidationIssues(issues: DataQualityIssue[], validation: DataValidationAudit) {
  validation.findings.forEach((finding, index) => {
    pushIssue(issues, {
      id: `validation-${finding.sheetIndex}-${finding.cell}-${index}`,
      type: 'validation',
      severity: finding.type === 'required' ? 'critical' : 'warning',
      sheetIndex: finding.sheetIndex,
      sheetName: finding.sheetName,
      cell: finding.cell,
      field: finding.type,
      value: finding.value,
      message: `${finding.sheetName}!${finding.cell} violates ${finding.type} validation.`,
      suggestedFix: 'Correct the value or update the workbook validation rule if the rule is obsolete.',
    });
  });
}

function addFormulaIssues(issues: DataQualityIssue[], formulaErrors: FormulaErrorAudit) {
  formulaErrors.findings.forEach((finding, index) => {
    pushIssue(issues, {
      id: `formula-${finding.sheetIndex}-${finding.cell}-${index}`,
      type: 'formula_error',
      severity: FORMULA_CRITICAL.includes(finding.error) ? 'critical' : 'warning',
      sheetIndex: finding.sheetIndex,
      sheetName: finding.sheetName,
      cell: finding.cell,
      field: finding.formula,
      value: finding.error,
      message: `${finding.sheetName}!${finding.cell} shows formula error ${finding.error}.`,
      suggestedFix: 'Review references, function names, and upstream connector/table ranges.',
    });
  });
}

function addSheetHeuristicIssues(issues: DataQualityIssue[], content: any) {
  const sheets = sheetsOf(content);
  sheets.forEach((sheet, sheetIndex) => {
    const headerRow = findHeaderRow(sheet);
    if (headerRow == null) return;
    const map = cellMap(sheet);
    const maxRow = Math.max(headerRow, ...((sheet?.celldata ?? []) as any[]).map((cell) => Number(cell.r ?? 0)));
    const headers = ((sheet?.celldata ?? []) as any[])
      .filter((cell) => cell.r === headerRow)
      .map((cell) => ({ c: Number(cell.c ?? 0), label: display(rawOf(cell)).trim(), normalized: normalizeHeader(rawOf(cell)) }))
      .filter((header) => header.label);
    const columns = headers.map((header) => header.c);
    if (!columns.length) return;

    for (const header of headers) {
      const isKey = isKeyHeader(header.normalized);
      const isQty = isQuantityHeader(header.normalized);
      const isDate = isDateHeader(header.normalized);
      const seen = new Map<string, number[]>();

      for (let r = headerRow + 1; r <= maxRow; r++) {
        if (!rowHasAnyData(map, r, columns)) continue;
        const raw = valueAt(map, r, header.c);
        const text = display(raw).trim();
        const ref = cellRef(r, header.c);

        if (isKey && !text) {
          pushIssue(issues, {
            id: `blank-${sheetIndex}-${r}-${header.c}`,
            type: 'blank_required',
            severity: 'critical',
            sheetIndex,
            sheetName: sheet?.name ?? `Sheet ${sheetIndex + 1}`,
            cell: ref,
            field: header.label,
            message: `${header.label} is blank in ${sheet?.name ?? `Sheet ${sheetIndex + 1}`}!${ref}.`,
            suggestedFix: 'Fill the industrial key field or remove the incomplete row before publishing.',
          });
        }

        if (isKey && text) {
          const key = text.toLowerCase();
          seen.set(key, [...(seen.get(key) ?? []), r]);
        }

        if (isQty) {
          const n = toFiniteNumber(raw);
          if (n != null && n < 0) {
            pushIssue(issues, {
              id: `negative-${sheetIndex}-${r}-${header.c}`,
              type: 'negative_quantity',
              severity: 'critical',
              sheetIndex,
              sheetName: sheet?.name ?? `Sheet ${sheetIndex + 1}`,
              cell: ref,
              field: header.label,
              value: String(n),
              message: `${header.label} is negative at ${sheet?.name ?? `Sheet ${sheetIndex + 1}`}!${ref}.`,
              suggestedFix: 'Confirm inventory/quantity sign, adjustment reason, or source connector refresh.',
            });
          }
        }

        if (isDate && text && !isDateLike(raw)) {
          pushIssue(issues, {
            id: `date-${sheetIndex}-${r}-${header.c}`,
            type: 'invalid_date',
            severity: 'warning',
            sheetIndex,
            sheetName: sheet?.name ?? `Sheet ${sheetIndex + 1}`,
            cell: ref,
            field: header.label,
            value: text,
            message: `${header.label} is not a valid date at ${sheet?.name ?? `Sheet ${sheetIndex + 1}`}!${ref}.`,
            suggestedFix: 'Normalize the date to ISO format or a valid Excel serial date.',
          });
        }
      }

      if (isKey) {
        for (const [value, rows] of seen.entries()) {
          if (rows.length < 2) continue;
          pushIssue(issues, {
            id: `duplicate-${sheetIndex}-${header.c}-${value}`,
            type: 'duplicate_key',
            severity: 'warning',
            sheetIndex,
            sheetName: sheet?.name ?? `Sheet ${sheetIndex + 1}`,
            cell: cellRef(rows[0], header.c),
            range: rows.map((r) => cellRef(r, header.c)).join(', '),
            field: header.label,
            value,
            message: `${header.label} value "${value}" appears ${rows.length} times in ${sheet?.name ?? `Sheet ${sheetIndex + 1}`}.`,
            suggestedFix: 'Deduplicate the key or split intentional repeated rows with a stronger compound key.',
          });
        }
      }
    }
  });
}

function addConnectorIssues(issues: DataQualityIssue[], content: any, now: Date) {
  const connectors = Array.isArray(content?.connectors) ? content.connectors : [];
  const sheets = sheetsOf(content);
  const freshness = summarizeConnectorFreshness(connectors, now);
  freshness.reports.forEach((report) => {
    if (report.status === 'fresh') return;
    const instance = connectors.find((connector: any) => connector.id === report.id);
    const sheet = sheets[instance?.sheetIndex ?? -1];
    pushIssue(issues, {
      id: `connector-freshness-${report.id}`,
      type: 'connector_freshness',
      severity: report.status === 'due' ? 'info' : 'warning',
      sheetIndex: instance?.sheetIndex,
      sheetName: sheet?.name,
      range: instance?.range,
      field: report.label,
      value: report.status,
      message: `${report.label} connector is ${report.status}${report.ageMinutes == null ? '' : ` after ${report.ageMinutes} minutes`}.`,
      suggestedFix: 'Refresh the connector before using this workbook for an ERP/MES decision.',
    });
  });
  connectors
    .filter((connector: any) => ['failed', 'error'].includes(String(connector?.status ?? connector?.lastStatus ?? '').toLowerCase()) || !!connector?.lastError || !!connector?.error)
    .forEach((connector: any) => {
      const sheet = sheets[connector.sheetIndex ?? -1];
      pushIssue(issues, {
        id: `connector-failure-${connector.id ?? connector.type}`,
        type: 'connector_failure',
        severity: 'critical',
        sheetIndex: connector.sheetIndex,
        sheetName: sheet?.name,
        range: connector.range,
        field: connector.label ?? connector.type,
        value: String(connector.lastError ?? connector.error ?? connector.status ?? connector.lastStatus ?? 'failed'),
        message: `${connector.label ?? connector.type} connector has a failed refresh state.`,
        suggestedFix: 'Retry refresh, verify connector parameters, or escalate the tenant-safe endpoint failure.',
      });
    });
}

function addUnsupportedXlsxIssues(issues: DataQualityIssue[], content: any) {
  const unsupported = Array.isArray(content?.unsupportedXlsxFeatures) ? content.unsupportedXlsxFeatures : [];
  unsupported.slice(0, 20).forEach((feature: any, index: number) => {
    pushIssue(issues, {
      id: `unsupported-xlsx-${index}`,
      type: 'unsupported_xlsx',
      severity: 'warning',
      value: String(feature?.type ?? feature?.kind ?? feature ?? 'unsupported'),
      message: `Unsupported XLSX feature requires review: ${String(feature?.type ?? feature?.kind ?? feature ?? 'unknown')}.`,
      suggestedFix: 'Review the import warning before exporting or using this workbook as evidence.',
    });
  });
}

export function auditDataQuality(content: any, now = new Date()): DataQualityReport {
  const validation = auditDataValidations(content);
  const formulaErrors = auditFormulaErrors(content);
  const issues: DataQualityIssue[] = [];
  addValidationIssues(issues, validation);
  addFormulaIssues(issues, formulaErrors);
  addSheetHeuristicIssues(issues, content);
  addConnectorIssues(issues, content, now);
  addUnsupportedXlsxIssues(issues, content);
  issues.sort((a, b) => {
    const rank: Record<DataQualitySeverity, number> = { critical: 0, warning: 1, info: 2 };
    return rank[a.severity] - rank[b.severity] || String(a.sheetName ?? '').localeCompare(String(b.sheetName ?? '')) || String(a.cell ?? a.range ?? '').localeCompare(String(b.cell ?? b.range ?? ''));
  });
  const critical = issues.filter((issue) => issue.severity === 'critical').length;
  const warnings = issues.filter((issue) => issue.severity === 'warning').length;
  const info = issues.filter((issue) => issue.severity === 'info').length;
  const score = Math.max(0, 100 - critical * 14 - warnings * 6 - info * 2);
  return { checkedAt: now.toISOString(), score, issues, critical, warnings, info, validation, formulaErrors };
}

export function formatDataQualityReport(report: DataQualityReport): string {
  if (!report.issues.length) return `Data quality ${report.score}/100\nNo visible industrial data issues detected.`;
  const lines = [
    `Data quality ${report.score}/100`,
    `${report.critical} critical | ${report.warnings} warning | ${report.info} info`,
    ...report.issues.slice(0, 12).map((issue) => {
      const target = issue.sheetName ? `${issue.sheetName}!${issue.cell ?? issue.range ?? ''}` : (issue.cell ?? issue.range ?? 'Workbook');
      return `${issue.severity.toUpperCase()} [${issue.type}] ${target}: ${issue.message}`;
    }),
  ];
  if (report.issues.length > 12) lines.push(`${report.issues.length - 12} more issue(s) in the report sheet.`);
  return lines.join('\n');
}

function qualityCell(value: string | number, severity?: DataQualitySeverity, bold = false) {
  const tone = severity === 'critical'
    ? { bg: '#fee2e2', fc: '#991b1b' }
    : severity === 'warning'
      ? { bg: '#fef3c7', fc: '#92400e' }
      : severity === 'info'
        ? { bg: '#e0f2fe', fc: '#075985' }
        : {};
  return {
    v: value,
    m: String(value),
    ct: { fa: 'General', t: typeof value === 'number' ? 'n' : 's' },
    ...(bold ? { bl: 1, bg: tone.bg ?? '#f1f5f9', fc: tone.fc ?? '#0f172a' } : tone),
  };
}

export function buildDataQualitySheet(report: DataQualityReport, order = 0, name = 'AXOS Data Quality'): any {
  const headers = ['Severity', 'Type', 'Sheet', 'Cell / Range', 'Field', 'Value', 'Issue', 'Suggested fix'];
  const celldata: any[] = [
    { r: 0, c: 0, v: qualityCell('AXOS Data Quality', undefined, true) },
    { r: 1, c: 0, v: qualityCell('Score', undefined, true) },
    { r: 1, c: 1, v: qualityCell(report.score, report.score < 80 ? 'warning' : undefined) },
    { r: 2, c: 0, v: qualityCell('Critical', 'critical', true) },
    { r: 2, c: 1, v: qualityCell(report.critical, report.critical ? 'critical' : undefined) },
    { r: 2, c: 2, v: qualityCell('Warning', 'warning', true) },
    { r: 2, c: 3, v: qualityCell(report.warnings, report.warnings ? 'warning' : undefined) },
    { r: 2, c: 4, v: qualityCell('Info', 'info', true) },
    { r: 2, c: 5, v: qualityCell(report.info, report.info ? 'info' : undefined) },
    { r: 3, c: 0, v: qualityCell('Checked at', undefined, true) },
    { r: 3, c: 1, v: qualityCell(report.checkedAt) },
  ];
  headers.forEach((header, c) => celldata.push({ r: 5, c, v: qualityCell(header, undefined, true) }));
  if (!report.issues.length) {
    celldata.push({ r: 6, c: 0, v: qualityCell('No visible industrial data issues detected.') });
  } else {
    report.issues.forEach((issue, index) => {
      const r = index + 6;
      const target = issue.cell ?? issue.range ?? '';
      [
        issue.severity,
        issue.type,
        issue.sheetName ?? '',
        target,
        issue.field ?? '',
        issue.value ?? '',
        issue.message,
        issue.suggestedFix,
      ].forEach((value, c) => celldata.push({ r, c, v: qualityCell(value, issue.severity, c === 0) }));
    });
  }
  return {
    name,
    order,
    row: Math.max(30, report.issues.length + 12),
    column: headers.length + 1,
    celldata,
    config: {
      columnlen: { 0: 100, 1: 150, 2: 150, 3: 110, 4: 150, 5: 160, 6: 420, 7: 420 },
      frozen: { type: 'rangeRow', range: { row_focus: 5, column_focus: 0 } },
    },
  };
}

export function upsertDataQualitySheet(content: any, name = 'AXOS Data Quality', now = new Date()): { content: any; report: DataQualityReport } {
  const report = auditDataQuality(content, now);
  const originalSheets = sheetsOf(content);
  const sheets = originalSheets.map((sheet) => ({ ...sheet, status: 0 }));
  const index = sheets.findIndex((sheet) => sheet?.name === name);
  const order = index >= 0 ? (sheets[index]?.order ?? index) : sheets.length;
  const qualitySheet = { ...buildDataQualitySheet(report, order, name), status: 1 };
  if (index >= 0) sheets[index] = { ...sheets[index], ...qualitySheet };
  else sheets.push(qualitySheet);
  const ordered = sheets.map((sheet, i) => ({ ...sheet, order: sheet.order ?? i }));
  return { content: Array.isArray(content) ? ordered : { ...content, sheets: ordered }, report };
}
