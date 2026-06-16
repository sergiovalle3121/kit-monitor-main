import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FAI_RESULTS } from '../fai-state';
import type { FaiResult } from '../fai-state';

export class FaiMeasurementDto {
  @ApiProperty({ example: 'Altura de carcasa' })
  @IsString()
  @Length(1, 120)
  characteristic: string;

  @ApiPropertyOptional({ example: 10.0 })
  @IsOptional()
  @IsNumber()
  nominal?: number;

  @ApiPropertyOptional({
    example: 9.8,
    description: 'Límite inferior de especificación.',
  })
  @IsOptional()
  @IsNumber()
  lsl?: number;

  @ApiPropertyOptional({
    example: 10.2,
    description: 'Límite superior de especificación.',
  })
  @IsOptional()
  @IsNumber()
  usl?: number;

  @ApiProperty({ example: 10.05 })
  @IsNumber()
  actual: number;

  @ApiPropertyOptional({ example: 'mm' })
  @IsOptional()
  @IsString()
  @Length(0, 16)
  unit?: string;
}

export class CreateFaiDto {
  @ApiProperty({ description: 'WO a la que pertenece la primera pieza.' })
  @IsString()
  @Length(1, 36)
  woId: string;

  @ApiPropertyOptional({ example: 'EST-10' })
  @IsOptional()
  @IsString()
  @Length(0, 32)
  station?: string;

  @ApiPropertyOptional({ description: 'Serial de la pieza inspeccionada.' })
  @IsOptional()
  @IsString()
  @Length(0, 80)
  serial?: string;

  @ApiPropertyOptional({
    type: [FaiMeasurementDto],
    description: 'Mediciones iniciales (opcional).',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FaiMeasurementDto)
  measurements?: FaiMeasurementDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

export class SubmitFaiDto {
  @ApiProperty({
    description: 'true = aprueba (libera la WO); false = rechaza.',
  })
  @IsBoolean()
  pass: boolean;

  @ApiProperty({ description: 'Inspector que firma — obligatorio.' })
  @IsString()
  @Length(2, 200)
  inspector: string;

  @ApiPropertyOptional({
    type: [FaiMeasurementDto],
    description: 'Mediciones (reemplazan las capturadas).',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FaiMeasurementDto)
  measurements?: FaiMeasurementDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 80)
  serial?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 32)
  station?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

export class FaiQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  woId?: string;

  @ApiPropertyOptional({ enum: FAI_RESULTS })
  @IsOptional()
  @IsIn(FAI_RESULTS)
  result?: FaiResult;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  line?: string;
}
