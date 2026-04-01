export class CreateResupplyDto {
  kitId: number;
  partNumber: string;
  description?: string;
  quantityRequested: number;
  reason?: string;
}
