/**
 * State machine for expense reports (FIN / AP).
 *
 * DRAFT ─▶ SUBMITTED ─▶ APPROVED ─▶ REIMBURSED
 *   │           │
 *   │           └─▶ REJECTED ─▶ DRAFT   (fix & resubmit)
 *   └─▶ CANCELLED
 *
 * Pure + side-effect free for isolated unit testing.
 */

export type ExpenseStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'REIMBURSED'
  | 'CANCELLED';

export const EXPENSE_STATUSES: ExpenseStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'REIMBURSED',
  'CANCELLED',
];

const TRANSITIONS: Record<ExpenseStatus, ExpenseStatus[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'REJECTED'],
  APPROVED: ['REIMBURSED'],
  REJECTED: ['DRAFT'],
  REIMBURSED: [],
  CANCELLED: [],
};

export function isTerminal(status: ExpenseStatus): boolean {
  return TRANSITIONS[status]?.length === 0;
}

export function canTransition(from: ExpenseStatus, to: ExpenseStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStates(from: ExpenseStatus): ExpenseStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function assertTransition(from: ExpenseStatus, to: ExpenseStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Cannot move an expense report from ${from} to ${to}. ` +
        `Allowed: ${nextStates(from).join(', ') || '(none — terminal)'}.`,
    );
  }
}
