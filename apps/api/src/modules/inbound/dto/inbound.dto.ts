import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RECEIPT_STATUSES } from '../receipt-state';
import type { ReceiptStatus } from '../receipt-state';

export class CreateReceiptDto {
  @ApiProperty({ example: 'RES-0402-10K' })
  @IsString()
  @Length(1, 80)
  partNumber: string;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ example: 'PCS' })
  @IsOptional()
  @IsString()
  @Length(0, 12)
  uom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  supplierName?: string;

  @ApiPropertyOptional({ example: 'PO-2026-000001' })
  @IsOptional()
  @IsString()
  @Length(0, 32)
  poFolio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  lotNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  serialNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 32)
  dateCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  programId?: string;
}

export class TransitionReceiptDto {
  @ApiProperty({ enum: RECEIPT_STATUSES, example: 'INSPECTING' })
  @IsIn(RECEIPT_STATUSES)
  status: ReceiptStatus;

  @ApiPropertyOptional({ description: 'Código de rechazo (al cuarentenar/rechazar).' })
  @IsOptional()
  @IsString()
  @Length(0, 48)
  rejectCode?: string;
}
