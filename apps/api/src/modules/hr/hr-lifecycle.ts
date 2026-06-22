/**
 * HR — pure state machines for the talent-acquisition and performance flows.
 * Kept dependency-free and unit-tested, matching the repo pattern (cert-status,
 * incident-state). The service calls `assert*Transition` before persisting.
 */

export type RequisitionStatus = 'OPEN' | 'ON_HOLD' | 'FILLED' | 'CANCELLED';
export type CandidateStage =
  | 'APPLIED'
  | 'SCREEN'
  | 'INTERVIEW'
  | 'OFFER'
  | 'HIRED'
  | 'REJECTED'
  | 'WITHDRAWN';
export type ReviewStatus = 'DRAFT' | 'SUBMITTED' | 'CALIBRATED' | 'CLOSED';

const REQUISITION_FLOW: Record<RequisitionStatus, RequisitionStatus[]> = {
  OPEN: ['ON_HOLD', 'FILLED', 'CANCELLED'],
  ON_HOLD: ['OPEN', 'CANCELLED'],
  FILLED: ['OPEN'], // reopened if a hire falls through
  CANCELLED: [],
};

const CANDIDATE_FLOW: Record<CandidateStage, CandidateStage[]> = {
  APPLIED: ['SCREEN', 'REJECTED', 'WITHDRAWN'],
  SCREEN: ['INTERVIEW', 'REJECTED', 'WITHDRAWN'],
  INTERVIEW: ['OFFER', 'REJECTED', 'WITHDRAWN'],
  OFFER: ['HIRED', 'REJECTED', 'WITHDRAWN'],
  HIRED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

const REVIEW_FLOW: Record<ReviewStatus, ReviewStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['CALIBRATED', 'DRAFT'],
  CALIBRATED: ['CLOSED', 'SUBMITTED'],
  CLOSED: [],
};

export const ACTIVE_REQUISITION_STATES: RequisitionStatus[] = ['OPEN', 'ON_HOLD'];
export const OPEN_CANDIDATE_STAGES: CandidateStage[] = ['APPLIED', 'SCREEN', 'INTERVIEW', 'OFFER'];

export function canTransitionRequisition(from: RequisitionStatus, to: RequisitionStatus): boolean {
  return (REQUISITION_FLOW[from] ?? []).includes(to);
}

export function canAdvanceCandidate(from: CandidateStage, to: CandidateStage): boolean {
  return (CANDIDATE_FLOW[from] ?? []).includes(to);
}

export function canTransitionReview(from: ReviewStatus, to: ReviewStatus): boolean {
  return (REVIEW_FLOW[from] ?? []).includes(to);
}

export function nextRequisitionStates(from: RequisitionStatus): RequisitionStatus[] {
  return REQUISITION_FLOW[from] ?? [];
}

export function nextCandidateStages(from: CandidateStage): CandidateStage[] {
  return CANDIDATE_FLOW[from] ?? [];
}

export function nextReviewStates(from: ReviewStatus): ReviewStatus[] {
  return REVIEW_FLOW[from] ?? [];
}
