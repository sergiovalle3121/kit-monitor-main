import {
  canTransition,
  assertTransition,
  isTerminal,
  nextStates,
  ExpenseStatus,
} from './expense-state';

describe('expense report state machine', () => {
  it('allows the approval + reimbursement path', () => {
    expect(canTransition('DRAFT', 'SUBMITTED')).toBe(true);
    expect(canTransition('SUBMITTED', 'APPROVED')).toBe(true);
    expect(canTransition('APPROVED', 'REIMBURSED')).toBe(true);
  });

  it('allows rejection back to draft for resubmission', () => {
    expect(canTransition('SUBMITTED', 'REJECTED')).toBe(true);
    expect(canTransition('REJECTED', 'DRAFT')).toBe(true);
  });

  it('allows cancelling a draft', () => {
    expect(canTransition('DRAFT', 'CANCELLED')).toBe(true);
  });

  it('forbids illegal jumps', () => {
    expect(canTransition('DRAFT', 'APPROVED')).toBe(false);
    expect(canTransition('REIMBURSED', 'APPROVED')).toBe(false);
  });

  it('treats REIMBURSED and CANCELLED as terminal', () => {
    (['REIMBURSED', 'CANCELLED'] as ExpenseStatus[]).forEach((s) => {
      expect(isTerminal(s)).toBe(true);
      expect(nextStates(s)).toHaveLength(0);
    });
  });

  it('assertTransition throws on illegal moves', () => {
    expect(() => assertTransition('REIMBURSED', 'DRAFT')).toThrow(
      /Cannot move an expense report/,
    );
    expect(() => assertTransition('DRAFT', 'SUBMITTED')).not.toThrow();
  });
});
