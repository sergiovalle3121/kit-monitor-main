export class CreateMaterialRequestDto {
  kitId: number;
  /** Optional explicit requester; falls back to the authenticated user. */
  requestedBy?: string;
  note?: string;
  workOrder?: string;
  line?: string | number;
  station?: string;
  partNumber?: string;
  requestedQty?: number;
  unit?: string;
}
