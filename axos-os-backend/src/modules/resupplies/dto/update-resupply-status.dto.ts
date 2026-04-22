import { ResupplyStatus } from '../entities/resupply.entity';

export class UpdateResupplyStatusDto {
  status: ResupplyStatus;
  actorName: string;
  quantityDelivered?: number;
  reason?: string;
}
