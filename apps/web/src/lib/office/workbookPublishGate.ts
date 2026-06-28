import { analyzeWorkbookHealth, type WorkbookHealthFinding, type WorkbookHealthReport } from './workbookHealth';
import { auditFormulaErrors, type SpreadsheetErrorCode } from './formulaErrorAudit';

export type WorkbookPublishGateStatus = 'pass' | 'review' | 'blocked';

// Maps visible spreadsheet error codes to publish-gate finding codes.
const VISIBLE_ERROR_FINDINGS: { code: SpreadsheetErrorCode; finding: string; severity: WorkbookHealthFinding['severity'] }[] = [
  { code: '#REF!', finding: 'formula-ref-errors', severity: 'critical' },
  { code: '#NAME?', finding: 'formula-name-errors', severity: 'critical' },
  { code: '#DIV/0!', finding: 'formula-div-zero-errors', severity: 'warning' },
  { code: '#VALUE!', finding: 'formula-value-errors', severity: 'warning' },
  { code: '#N/A', finding: 'formula-na-errors', severity: 'warning' },
  { code: '#NUM!', finding: 'formula-num-errors', severity: 'warning' },
  { code: '#NULL!', finding: 'formula-null-errors', severity: 'warning' },
];

function visibleErrorFindings(content: unknown): WorkbookHealthFinding[] {
  const audit = auditFormulaErrors(content);
  const findings: WorkbookHealthFinding[] = [];
  for (const { code, finding, severity } of VISIBLE_ERROR_FINDINGS) {
    const count = audit.byError[code];
    if (count) findings.push({ severity, code: finding, message: `${count} celda(s) con error ${code} visible.` });
  }
  return findings;
}

export interface WorkbookPublishGate {
  status: WorkbookPublishGateStatus;
  canPublish: boolean;
  score: number;
  critical: number;
  warnings: number;
  info: number;
  blockers: WorkbookHealthFinding[];
  reviewItems: WorkbookHealthFinding[];
  report: WorkbookHealthReport;
}

export function evaluateWorkbookPublishGate(content: unknown, now = new Date()): WorkbookPublishGate {
  const baseReport = analyzeWorkbookHealth(content, now);
  const errorFindings = visibleErrorFindings(content);
  const errorPenalty = errorFindings.reduce((sum, finding) => sum + (finding.severity === 'critical' ? 35 : finding.severity === 'warning' ? 15 : 5), 0);
  const report: WorkbookHealthReport = {
    ...baseReport,
    findings: [...baseReport.findings, ...errorFindings],
    score: Math.max(0, baseReport.score - errorPenalty),
  };
  const critical = report.findings.filter((finding) => finding.severity === 'critical');
  const warnings = report.findings.filter((finding) => finding.severity === 'warning');
  const info = report.findings.filter((finding) => finding.severity === 'info');
  const status: WorkbookPublishGateStatus = critical.length || report.score < 50
    ? 'blocked'
    : warnings.length || report.score < 85
      ? 'review'
      : 'pass';
  return {
    status,
    canPublish: status !== 'blocked',
    score: report.score,
    critical: critical.length,
    warnings: warnings.length,
    info: info.length,
    blockers: status === 'blocked' ? critical : [],
    reviewItems: [...warnings, ...info],
    report,
  };
}

export function formatWorkbookPublishGate(gate: WorkbookPublishGate): string {
  const headline = gate.status === 'pass'
    ? `Preflight aprobado · score ${gate.score}/100`
    : gate.status === 'review'
      ? `Preflight requiere revisión · score ${gate.score}/100`
      : `Preflight bloqueado · score ${gate.score}/100`;
  const counts = `Críticos: ${gate.critical} · Warnings: ${gate.warnings} · Info: ${gate.info}`;
  const findings = gate.status === 'blocked'
    ? gate.blockers.map((finding) => `BLOCKER [${finding.code}] ${finding.message}`)
    : gate.reviewItems.slice(0, 8).map((finding) => `${finding.severity.toUpperCase()} [${finding.code}] ${finding.message}`);
  return [headline, counts, ...findings].join('\n');
}
