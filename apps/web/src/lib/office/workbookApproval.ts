import { workbookSignature } from './workbookPerformance';

export type WorkbookApprovalStatus = 'draft' | 'in_review' | 'approved' | 'rejected';

export interface WorkbookApprovalSignoff {
  status: WorkbookApprovalStatus;
  requestedBy?: string | null;
  requestedAt?: string | null;
  requestedContentSignature?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  approvedContentSignature?: string | null;
  rejectedBy?: string | null;
  rejectedAt?: string | null;
  rejectedContentSignature?: string | null;
  notes?: string | null;
}

export type WorkbookApprovalSnapshotStatus = 'untracked' | 'matched' | 'changed';

export interface WorkbookApprovalSnapshotComparison {
  status: WorkbookApprovalSnapshotStatus;
  approvalStatus: WorkbookApprovalStatus;
  expectedSignature: string | null;
  currentSignature: string;
}

export const DEFAULT_WORKBOOK_APPROVAL: WorkbookApprovalSignoff = {
  status: 'draft',
  requestedBy: null,
  requestedAt: null,
  requestedContentSignature: null,
  approvedBy: null,
  approvedAt: null,
  approvedContentSignature: null,
  rejectedBy: null,
  rejectedAt: null,
  rejectedContentSignature: null,
  notes: null,
};

export const WORKBOOK_APPROVAL_LABELS: Record<WorkbookApprovalStatus, string> = {
  draft: 'Draft',
  in_review: 'In review',
  approved: 'Approved',
  rejected: 'Rejected',
};

const VALID_STATUSES = new Set<WorkbookApprovalStatus>(['draft', 'in_review', 'approved', 'rejected']);

export function normalizeWorkbookApproval(input: unknown): WorkbookApprovalSignoff {
  if (!input || typeof input !== 'object') return { ...DEFAULT_WORKBOOK_APPROVAL };
  const raw = input as Record<string, unknown>;
  const status = typeof raw.status === 'string' && VALID_STATUSES.has(raw.status as WorkbookApprovalStatus)
    ? raw.status as WorkbookApprovalStatus
    : 'draft';
  const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null;
  return {
    status,
    requestedBy: text(raw.requestedBy),
    requestedAt: text(raw.requestedAt),
    requestedContentSignature: text(raw.requestedContentSignature),
    approvedBy: text(raw.approvedBy),
    approvedAt: text(raw.approvedAt),
    approvedContentSignature: text(raw.approvedContentSignature),
    rejectedBy: text(raw.rejectedBy),
    rejectedAt: text(raw.rejectedAt),
    rejectedContentSignature: text(raw.rejectedContentSignature),
    notes: text(raw.notes),
  };
}

export function workbookApprovalContentSignature(content: unknown): string {
  if (Array.isArray(content)) return workbookSignature({ sheets: content });
  if (!content || typeof content !== 'object') return workbookSignature({});
  const signable = { ...(content as Record<string, unknown>) };
  delete signable.approval;
  return workbookSignature(signable);
}

export function compareWorkbookApprovalSnapshot(content: unknown, current?: unknown): WorkbookApprovalSnapshotComparison {
  const approval = normalizeWorkbookApproval(current ?? (content && typeof content === 'object' ? (content as Record<string, unknown>).approval : null));
  const expectedSignature = approval.status === 'approved'
    ? approval.approvedContentSignature ?? null
    : approval.status === 'in_review'
      ? approval.requestedContentSignature ?? null
      : null;
  const currentSignature = workbookApprovalContentSignature(content);
  return {
    approvalStatus: approval.status,
    expectedSignature,
    currentSignature,
    status: expectedSignature ? (expectedSignature === currentSignature ? 'matched' : 'changed') : 'untracked',
  };
}

export function requestWorkbookReview(current: unknown, requestedBy: string, notes?: string, content?: unknown): WorkbookApprovalSignoff {
  const approval = normalizeWorkbookApproval(current);
  const requestedContentSignature = content === undefined
    ? approval.requestedContentSignature
    : workbookApprovalContentSignature(content);
  return {
    ...approval,
    status: 'in_review',
    requestedBy: requestedBy.trim() || 'AXOS user',
    requestedAt: new Date().toISOString(),
    requestedContentSignature,
    approvedBy: null,
    approvedAt: null,
    approvedContentSignature: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectedContentSignature: null,
    notes: notes?.trim() || approval.notes || null,
  };
}
