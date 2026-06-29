/* eslint-disable @typescript-eslint/no-explicit-any */
import { auditDataValidations, formatDataValidationAudit, type DataValidationAudit } from './dataValidationAudit';
import { auditFormulaErrors, formatFormulaErrorAudit, type FormulaErrorAudit } from './formulaErrorAudit';
import { evaluateWorkbookPublishGate, type WorkbookPublishGate, type WorkbookPublishGateStatus } from './workbookPublishGate';

export type SheetQualityPreflightStatus = WorkbookPublishGateStatus;

export interface SheetQualityPreflight {
  status: SheetQualityPreflightStatus;
  score: number;
  canExport: boolean;
  formulaErrors: FormulaErrorAudit;
  dataValidations: DataValidationAudit;
  publishGate: WorkbookPublishGate;
  blockerCount: number;
  warningCount: number;
  issueCount: number;
  findings: string[];
}

function validationPenalty(audit: DataValidationAudit): number {
  if (!audit.invalid) return 0;
  return Math.min(30, audit.invalid * 10);
}

function qualityStatus(gateStatus: WorkbookPublishGateStatus, validationInvalid: number): SheetQualityPreflightStatus {
  if (gateStatus === 'blocked') return 'blocked';
  if (gateStatus === 'review' || validationInvalid > 0) return 'review';
  return 'pass';
}

export function analyzeSheetQualityPreflight(content: any, now = new Date()): SheetQualityPreflight {
  const formulaErrors = auditFormulaErrors(content);
  const dataValidations = auditDataValidations(content);
  const publishGate = evaluateWorkbookPublishGate(content, now);
  const score = Math.max(0, publishGate.score - validationPenalty(dataValidations));
  const status = qualityStatus(publishGate.status, dataValidations.invalid);
  const findings = [
    ...publishGate.report.findings.slice(0, 5).map((finding) => `${finding.severity.toUpperCase()} [${finding.code}] ${finding.message}`),
    ...formulaErrors.findings.slice(0, 3).map((finding) => `FORMULA ${finding.sheetName}!${finding.cell} ${finding.error}`),
    ...dataValidations.findings.slice(0, 3).map((finding) => `VALIDATION ${finding.sheetName}!${finding.cell} ${finding.type}: ${finding.value}`),
  ];
  return {
    status,
    score,
    canExport: status !== 'blocked',
    formulaErrors,
    dataValidations,
    publishGate,
    blockerCount: publishGate.critical,
    warningCount: publishGate.warnings + (dataValidations.invalid ? 1 : 0),
    issueCount: publishGate.report.findings.length + formulaErrors.total + dataValidations.invalid,
    findings,
  };
}

export function formatSheetQualityPreflight(preflight: SheetQualityPreflight): string {
  const headline = preflight.status === 'pass'
    ? `Data quality preflight passed - score ${preflight.score}/100`
    : preflight.status === 'review'
      ? `Data quality preflight needs review - score ${preflight.score}/100`
      : `Data quality preflight blocked - score ${preflight.score}/100`;
  return [
    headline,
    `Formula errors: ${preflight.formulaErrors.total}`,
    `Invalid data validations: ${preflight.dataValidations.invalid}/${preflight.dataValidations.rules}`,
    formatFormulaErrorAudit(preflight.formulaErrors),
    formatDataValidationAudit(preflight.dataValidations),
    ...preflight.findings.slice(0, 8),
  ].filter(Boolean).join('\n');
}
