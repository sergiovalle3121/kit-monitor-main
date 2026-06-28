import { analyzeWorkbookHealth, type WorkbookHealthFinding, type WorkbookHealthReport } from './workbookHealth';

export type WorkbookPublishGateStatus = 'pass' | 'review' | 'blocked';

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
  const report = analyzeWorkbookHealth(content, now);
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
