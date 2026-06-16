import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DOWNTIME_REASONS } from '../oee';
import type { DowntimeReason } from '../oee';

export class OpenDowntimeDto {
  @ApiProperty({ example: 'L1' })
  @IsString()
  @Length(1, 32)
  line: string;

  @ApiPropertyOptional({ example: 'EST-20' })
  @IsOptional()
  @IsString()
  @Length(0, 32)
  station?: string;

  @ApiPropertyOptional({ description: 'WO afectada (opcional).' })
  @IsOptional()
  @IsString()
  @Length(0, 36)
  woId?: string;

  @ApiProperty({ enum: DOWNTIME_REASONS, example: 'EQUIPMENT' })
  @IsIn(DOWNTIME_REASONS)
  reasonCode: DowntimeReason;

  @ApiPropertyOptional({ example: 'Falla en banda transportadora' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  reasonNote?: string;

  @ApiPropertyOptional({
    description: 'Inicio del paro (ISO). Default: ahora.',
  })
  @IsOptional()
  @IsISO8601()
  startAt?: string;
}

export class CloseDowntimeDto {
  @ApiPropertyOptional({ description: 'Fin del paro (ISO). Default: ahora.' })
  @IsOptional()
  @IsISO8601()
  endAt?: string;

  @ApiPropertyOptional({
    enum: DOWNTIME_REASONS,
    description: 'Recategorizar la razón al cerrar.',
  })
  @IsOptional()
  @IsIn(DOWNTIME_REASONS)
  reasonCode?: DowntimeReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  reasonNote?: string;
}

export class SetHxhTargetDto {
  @ApiProperty({ example: 'L1' })
  @IsString()
  @Length(1, 32)
  line: string;

  @ApiPropertyOptional({
    example: 'A',
    description: 'Turno (etiqueta). Default: A.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 16)
  shift?: string;

  @ApiProperty({ example: 8, description: 'Hora del día 0–23.' })
  @IsInt()
  @Min(0)
  @Max(23)
  hour: number;

  @ApiProperty({ example: 50, description: 'Meta de piezas para esa hora.' })
  @IsNumber()
  @Min(0)
  targetQty: number;

  @ApiPropertyOptional({ example: 'MODEL-X' })
  @IsOptional()
  @IsString()
  @Length(0, 64)
  model?: string;

  @ApiPropertyOptional({
    example: '2026-06-16',
    description: 'Override por día (YYYY-MM-DD). Vacío = plantilla.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'effectiveDate debe ser YYYY-MM-DD.',
  })
  effectiveDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  notes?: string;
}
