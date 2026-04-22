export class RespondCancellationRequestDto {
  action: 'accept' | 'reject';
  respondedBy?: string;
}
