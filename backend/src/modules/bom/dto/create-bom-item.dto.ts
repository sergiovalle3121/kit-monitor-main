export class CreateBomItemDto {
  model: string;
  partNumber: string;
  description?: string;
  location?: string;
  usageFactor: number;
  unit?: string; // defaults to 'EA'
}
