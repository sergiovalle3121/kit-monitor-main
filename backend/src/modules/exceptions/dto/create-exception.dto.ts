export class CreateExceptionDto {
  kitId: number;
  type: 'missing_material' | 'excess' | 'quality' | 'other';
  partNumber?: string;
  description: string;
}
