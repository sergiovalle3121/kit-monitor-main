import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NcrSeverity, NcrSourceType } from '../entities/ncr.entity';

export class CreateNcrDto {
  @ApiProperty({ enum: NcrSeverity, example: NcrSeverity.MAJOR })
  @IsEnum(NcrSeverity)
  severity: NcrSeverity;

  @ApiProperty({ enum: NcrSourceType, example: NcrSourceType.IN_PROCESS })
  @IsEnum(NcrSourceType)
  sourceType: NcrSourceType;

  @ApiProperty({ example: 'PCB-2024-A' })
  @IsNotEmpty()
  @IsString()
  partNumber: string;

  @ApiProperty({ example: 'Mechanical' })
  @IsNotEmpty()
  @IsString()
  category: string;

  @ApiProperty({ example: 'Component misaligned on board position J3' })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({ example: 12 })
  @IsNumber()
  @Min(0)
  quantityAffected: number;

  @ApiPropertyOptional({ example: 'LOT-2024-001' })
  @IsOptional()
  @IsString()
  lotNumber?: string;

  @ApiPropertyOptional({ example: 'SN-00123' })
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional({ example: 'WO-2024-0042' })
  @IsOptional()
  @IsString()
  workOrder?: string;

  @ApiPropertyOptional({ example: 'BLDG-A' })
  @IsOptional()
  @IsString()
  building?: string;

  @ApiPropertyOptional({ example: 'WH-QC' })
  @IsOptional()
  @IsString()
  warehouse?: string;

  @ApiPropertyOptional({ example: '3' })
  @IsOptional()
  @IsString()
  line?: string;

  @ApiPropertyOptional({ example: 'CUSTOMER-X' })
  @IsOptional()
  @IsString()
  customer?: string;

  @ApiPropertyOptional({ example: 'PROG-ALPHA' })
  @IsOptional()
  @IsString()
  program?: string;

  @ApiPropertyOptional({ example: 'MODEL-WH200' })
  @IsOptional()
  @IsString()
  model?: string;
}

export class UpdateNcrStatusDto {
  @ApiProperty({
    enum: ['open', 'under_review', 'contained', 'dispositioned', 'closed'],
  })
  @IsNotEmpty()
  @IsString()
  status: string;

  @ApiPropertyOptional({ example: 'Scrapped per QE-007' })
  @IsOptional()
  @IsString()
  dispositionNotes?: string;
}
