export class CreateResupplyDto {
  kitId: number;
  partNumber: string;
  description?: string;
  quantityRequested: number;
  reason?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  sourceWarehouseId?: string;
  sourceLocation?: string;
  destinationWarehouseId?: string;
  destinationLocation?: string;
}
