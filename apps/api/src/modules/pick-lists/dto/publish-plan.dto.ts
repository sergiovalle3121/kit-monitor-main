export class PublishPlanDto {
  planId: number;
  /** Optional explicit actor; falls back to the authenticated user. */
  actor?: string;
}
