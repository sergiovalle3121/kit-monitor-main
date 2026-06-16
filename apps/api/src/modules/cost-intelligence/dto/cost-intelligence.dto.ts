import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';

/**
 * Parameterizable costing rates shared by the live endpoints and snapshot close.
 * Both are optional — labor falls back to a recorded actual or a default rate,
 * overhead to a recorded actual or a default absorption rate.
 */
export class CostingRatesDto {
  @ApiPropertyOptional({ example: 45, description: 'USD por hora de mano de obra.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  laborRate?: number;

  @ApiPropertyOptional({ example: 0.18, description: 'Tasa de absorción de overhead.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  overheadRate?: number;
}

/**
 * Freeze a period-close snapshot. Provide a WO (single) or a program (all of its
 * WOs). The period is `YYYY-MM`; once a (WO, period) snapshot exists it is not
 * recomputed unless `force` is set.
 */
export class CreateSnapshotDto extends CostingRatesDto {
  @ApiProperty({ example: '2026-06', description: 'Periodo contable YYYY-MM.' })
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'period debe ser YYYY-MM' })
  period: string;

  @ApiPropertyOptional({ description: 'WO a cerrar (id). Requerido si no hay programId.' })
  @IsOptional()
  @IsString()
  @Length(1, 36)
  woId?: string;

  @ApiPropertyOptional({ description: 'Programa a cerrar (todas sus WOs).' })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  programId?: string;

  @ApiPropertyOptional({ description: 'Recalcular y sobrescribir un snapshot existente.' })
  @IsOptional()
  force?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}
