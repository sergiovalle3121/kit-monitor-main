import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PURCHASE_ORDER_STATUSES } from '../po-state';
import type { PurchaseOrderStatus } from '../po-state';
import type { PurchaseOrderPriority } from '../entities/purchase-order.entity';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];

export class CreatePurchaseOrderDto {
  @ApiProperty({ example: 'Resistencias 0402 10k — lote Q3' })
  @IsString()
  @Length(3, 200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  supplierName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  supplierId?: string;

  @ApiPropertyOptional({ enum: PRIORITIES })
  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: PurchaseOrderPriority;

  @ApiPropertyOptional({ example: 12500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalValue?: number;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  programId?: string;

  @ApiPropertyOptional({ example: '2026-07-15' })
  @IsOptional()
  @IsString()
  requiredDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePurchaseOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  supplierName?: string;

  @ApiPropertyOptional({ enum: PRIORITIES })
  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: PurchaseOrderPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requiredDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  promisedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class TransitionPurchaseOrderDto {
  @ApiProperty({ enum: PURCHASE_ORDER_STATUSES, example: 'ISSUED' })
  @IsIn(PURCHASE_ORDER_STATUSES)
  status: PurchaseOrderStatus;

  @ApiPropertyOptional({ description: 'Fecha prometida por el proveedor (al confirmar).' })
  @IsOptional()
  @IsString()
  promisedDate?: string;
}
