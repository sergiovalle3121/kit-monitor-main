export class CreateKitMaterialDto {
  kitId: number;
  partNumber: string;
  description?: string;
  quantityRequired: number;
  quantityActual?: number;
  unit?: string;
}
