export class CreateStepDto {
  model: string;
  revision?: string;
  sequence?: number;
  name: string;
  stationType?: string;
  visualAidId?: string | null;
  instructions?: string;
}

export class UpdateStepDto {
  sequence?: number;
  name?: string;
  stationType?: string;
  visualAidId?: string | null;
  instructions?: string;
}

export class AddStepMaterialDto {
  partNumber: string;
  description?: string;
  qtyPerUnit: number;
  unit?: string;
}
