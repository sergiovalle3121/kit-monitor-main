import {
  canAdvanceCandidate,
  canTransitionRequisition,
  canTransitionReview,
  nextCandidateStages,
  nextRequisitionStates,
  nextReviewStates,
} from './hr-lifecycle';

describe('hr-lifecycle (state machines)', () => {
  describe('requisitions', () => {
    it('allows OPEN → ON_HOLD / FILLED / CANCELLED', () => {
      expect(canTransitionRequisition('OPEN', 'FILLED')).toBe(true);
      expect(canTransitionRequisition('OPEN', 'ON_HOLD')).toBe(true);
      expect(canTransitionRequisition('OPEN', 'CANCELLED')).toBe(true);
    });

    it('allows reopening a FILLED requisition but nothing from CANCELLED', () => {
      expect(canTransitionRequisition('FILLED', 'OPEN')).toBe(true);
      expect(canTransitionRequisition('CANCELLED', 'OPEN')).toBe(false);
      expect(nextRequisitionStates('CANCELLED')).toHaveLength(0);
    });
  });

  describe('candidates', () => {
    it('walks the funnel forward only', () => {
      expect(canAdvanceCandidate('APPLIED', 'SCREEN')).toBe(true);
      expect(canAdvanceCandidate('SCREEN', 'INTERVIEW')).toBe(true);
      expect(canAdvanceCandidate('INTERVIEW', 'OFFER')).toBe(true);
      expect(canAdvanceCandidate('OFFER', 'HIRED')).toBe(true);
      // cannot skip stages
      expect(canAdvanceCandidate('APPLIED', 'OFFER')).toBe(false);
      // cannot move out of a terminal stage
      expect(canAdvanceCandidate('HIRED', 'REJECTED')).toBe(false);
      expect(nextCandidateStages('REJECTED')).toHaveLength(0);
    });

    it('can reject or withdraw from any open stage', () => {
      for (const stage of ['APPLIED', 'SCREEN', 'INTERVIEW', 'OFFER'] as const) {
        expect(canAdvanceCandidate(stage, 'REJECTED')).toBe(true);
        expect(canAdvanceCandidate(stage, 'WITHDRAWN')).toBe(true);
      }
    });
  });

  describe('reviews', () => {
    it('flows DRAFT → SUBMITTED → CALIBRATED → CLOSED', () => {
      expect(canTransitionReview('DRAFT', 'SUBMITTED')).toBe(true);
      expect(canTransitionReview('SUBMITTED', 'CALIBRATED')).toBe(true);
      expect(canTransitionReview('CALIBRATED', 'CLOSED')).toBe(true);
      expect(canTransitionReview('DRAFT', 'CLOSED')).toBe(false);
      expect(nextReviewStates('CLOSED')).toHaveLength(0);
    });
  });
});
