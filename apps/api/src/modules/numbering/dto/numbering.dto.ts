import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RESET_POLICIES } from '../numbering.format';
import type { ResetPolicy } from '../numbering.format';

export class CreateSequenceDto {
  @ApiProperty({ example: 'PURCHASE_ORDER', description: 'Clave del tipo de documento (se normaliza a MAYÚSCULAS).' })
  @IsString()
  @Length(2, 64)
  docType: string;

  @ApiPropertyOptional({ example: 'Orden de Compra' })
  @IsOptional()
  @IsString()
  @Length(0, 120)
  name?: string;

  @ApiPropertyOptional({ example: 'PO' })
  @IsOptional()
  @IsString()
  @Length(0, 16)
  prefix?: string;

  @ApiPropertyOptional({ example: '{PREFIX}-{YYYY}-{SEQ}' })
  @IsOptional()
  @IsString()
  @Length(3, 64)
  pattern?: string;

  @ApiPropertyOptional({ example: 6, minimum: 1, maximum: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  padding?: number;

  @ApiPropertyOptional({ enum: RESET_POLICIES, example: 'YEARLY' })
  @IsOptional()
  @IsIn(RESET_POLICIES)
  resetPolicy?: ResetPolicy;

  @ApiPropertyOptional({ example: 1, description: 'Valor inicial del contador.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  startAt?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  description?: string;
}

export class UpdateSequenceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 16)
  prefix?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 64)
  pattern?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  padding?: number;

  @ApiPropertyOptional({ enum: RESET_POLICIES })
  @IsOptional()
  @IsIn(RESET_POLICIES)
  resetPolicy?: ResetPolicy;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ description: 'Corrige manualmente el siguiente valor del contador.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  nextValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  description?: string;
}

export class AllocateDto {
  @ApiProperty({ example: 'PURCHASE_ORDER' })
  @IsString()
  @Length(2, 64)
  docType: string;

  @ApiPropertyOptional({ example: 1, minimum: 1, maximum: 1000, description: 'Cantidad de folios contiguos a reservar.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  count?: number;
}
