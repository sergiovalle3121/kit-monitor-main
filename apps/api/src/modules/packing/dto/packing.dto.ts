import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  HANDLING_UNIT_STATUSES,
  HANDLING_UNIT_TYPES,
} from '../packing.rules';
import type { HandlingUnitContent } from '../entities/handling-unit.entity';
import type { HandlingUnitStatus, HandlingUnitType } from '../packing.rules';

export class CreateHandlingUnitDto {
  @ApiPropertyOptional({ description: 'Embarque outbound (id) al que pertenece.' })
  @IsOptional()
  @IsString()
  @Length(0, 36)
  shipmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 32)
  shipmentFolio?: string;

  @ApiPropertyOptional({ enum: HANDLING_UNIT_TYPES })
  @IsOptional()
  @IsIn(HANDLING_UNIT_TYPES)
  type?: HandlingUnitType;

  @ApiPropertyOptional({ description: 'Unidad padre (tarima que contiene esta caja).' })
  @IsOptional()
  @IsString()
  @Length(0, 36)
  parentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  lengthCm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  widthCm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  heightCm?: number;

  @ApiPropertyOptional({ description: 'Líneas de contenido [{ partNumber, quantity, serials? }].' })
  @IsOptional()
  @IsArray()
  contents?: HandlingUnitContent[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  shipToName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  shipToAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  fromName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  poNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateHandlingUnitDto {
  @ApiPropertyOptional({ enum: HANDLING_UNIT_TYPES })
  @IsOptional()
  @IsIn(HANDLING_UNIT_TYPES)
  type?: HandlingUnitType;

  @ApiPropertyOptional({ enum: HANDLING_UNIT_STATUSES })
  @IsOptional()
  @IsIn(HANDLING_UNIT_STATUSES)
  status?: HandlingUnitStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 36)
  parentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  lengthCm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  widthCm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  heightCm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  contents?: HandlingUnitContent[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  shipToName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  shipToAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  fromName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  poNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
