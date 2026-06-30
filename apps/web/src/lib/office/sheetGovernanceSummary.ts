/* eslint-disable @typescript-eslint/no-explicit-any */
import { auditWorkbookProtection } from './protectionAudit';
import { evaluateWorkbookPublishGate } from './workbookPublishGate';
import { scanXlsxCompatibility } from './xlsxCompatibility';

export type SheetGovernanceStatus = 'ready' | 'review' | 'blocked';

export interface SheetGovernanceSummary {
  status: SheetGovernanceStatus;
  score: number;
  openComments: number;
  resolvedComments: number;
  assignedComments: number;
  protectedSheets: number;
  protectedRanges: number;
  connectorRanges: number;
  unprotectedConnectors: number;
  xlsxUnsupported: number;
  xlsxReview: number;
  gateCritical: number;
  gateWarnings: number;
  messages: string[];
}

function commentsOf(content: any): any[] {
  return Array.isArray(content?.comments) ? content.comments : [];
}

export function summarizeSheetGovernance(content: any, now = new Date()): SheetGovernanceSummary {
  const comments = commentsOf(content);
  const protection = auditWorkbookProtection(content);
  const gate = evaluateWorkbookPublishGate(content, now);
  const xlsx = scanXlsxCompatibility(content);
  const openComments = comments.filter((comment) => !comment?.resolved).length;
  const resolvedComments = comments.filter((comment) => !!comment?.resolved).length;
  const assignedComments = comments.filter((comment) => !!(comment?.assignee || comment?.assignedTo || comment?.assigneeId)).length;
  const unprotectedConnectors = protection.unprotectedConnectors.length;

  const blocked = gate.status === 'blocked' || xlsx.unsupportedCount > 0 || unprotectedConnectors > 0;
  const review = !blocked && (gate.status === 'review' || openComments > 0 || assignedComments > 0 || xlsx.reviewCount > 0);
  const status: SheetGovernanceStatus = blocked ? 'blocked' : review ? 'review' : 'ready';

  const messages: string[] = [];
  if (gate.blockers.length) {
    messages.push(...gate.blockers.slice(0, 3).map((finding) => finding.message));
  }
  if (unprotectedConnectors) {
    messages.push(`${unprotectedConnectors} AXOS connector range(s) are missing enforced range protection.`);
  }
  if (xlsx.unsupportedCount) {
    messages.push(`${xlsx.unsupportedCount} unsupported XLSX item(s) must be reviewed before export.`);
  }
  if (openComments) {
    messages.push(`${openComments} open comment thread(s) need review before controlled release.`);
  }
  if (assignedComments) {
    messages.push(`${assignedComments} assigned comment thread(s) are waiting on owners.`);
  }
  if (gate.warnings) {
    messages.push(`${gate.warnings} workbook health warning(s) require review.`);
  }
  if (xlsx.reviewCount) {
    messages.push(`${xlsx.reviewCount} XLSX compatibility item(s) need roundtrip review.`);
  }
  if (protection.lockedRanges || protection.sheetLocks) {
    messages.push(`${protection.sheetLocks} sheet lock(s) and ${protection.lockedRanges} locked range(s) are active.`);
  }
  if (!messages.length) {
    messages.push('No visible governance blockers were detected for this sheet workbook.');
  }

  return {
    status,
    score: Math.min(gate.score, xlsx.score),
    openComments,
    resolvedComments,
    assignedComments,
    protectedSheets: protection.sheetLocks,
    protectedRanges: protection.lockedRanges,
    connectorRanges: protection.connectorRanges,
    unprotectedConnectors,
    xlsxUnsupported: xlsx.unsupportedCount,
    xlsxReview: xlsx.reviewCount,
    gateCritical: gate.critical,
    gateWarnings: gate.warnings,
    messages,
  };
}

export function formatSheetGovernanceSummary(summary: SheetGovernanceSummary): string {
  const label = summary.status === 'ready'
    ? 'Sheets governance ready'
    : summary.status === 'review'
      ? 'Sheets governance needs review'
      : 'Sheets governance blocked';
  return [
    `${label} - score ${summary.score}/100`,
    `Open comments: ${summary.openComments}`,
    `Protected ranges: ${summary.protectedRanges}`,
    `Unprotected connectors: ${summary.unprotectedConnectors}`,
    `XLSX unsupported/review: ${summary.xlsxUnsupported}/${summary.xlsxReview}`,
    ...summary.messages.map((message) => `- ${message}`),
  ].join('\n');
}
