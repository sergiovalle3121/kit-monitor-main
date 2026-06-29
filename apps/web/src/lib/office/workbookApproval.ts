export type WorkbookApprovalStatus = 'draft' | 'in_review' | 'approved' | 'rejected';

export interface WorkbookApprovalSignoff {
  status: WorkbookApprovalStatus;
  requestedBy?: string | null;
  requestedAt?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectedBy?: string | null;
  rejectedAt?: string | null;
  notes?: string | null;
}

export const DEFAULT_WORKBOOK_APPROVAL: WorkbookApprovalSignoff = {
  status: 'draft',
  requestedBy: null,
  requestedAt: null,
  approvedBy: null,
  approvedAt: null,
  rejectedBy: null,
  rejectedAt: null,
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
    approvedBy: text(raw.approvedBy),
    approvedAt: text(raw.approvedAt),
    rejectedBy: text(raw.rejectedBy),
    rejectedAt: text(raw.rejectedAt),
    notes: text(raw.notes),
  };
}

export function requestWorkbookReview(current: unknown, requestedBy: string, notes?: string): WorkbookApprovalSignoff {
  const approval = normalizeWorkbookApproval(current);
  return {
    ...approval,
    status: 'in_review',
    requestedBy: requestedBy.trim() || 'AXOS user',
    requestedAt: new Date().toISOString(),
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    notes: notes?.trim() || approval.notes || null,
  };
}
