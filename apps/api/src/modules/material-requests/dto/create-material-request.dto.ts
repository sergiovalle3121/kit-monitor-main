export class CreateMaterialRequestDto {
  kitId: number;
  /** Optional explicit requester; falls back to the authenticated user. */
  requestedBy?: string;
  note?: string;
}
