export class CreateVisualAidDto {
  model: string;
  title: string;
  process: string;
  area?: string;
  revision?: string;
  isActive?: boolean;
  notes?: string;
  uploadedBy?: string;
  annotations?: any;
}
