import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DISPOSITIONS } from '../hold-state';
import type { Disposition } from '../hold-state';

const ORIGINS = ['IQC', 'IN_PROCESS', 'OQC'];
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export class CreateHoldDto {
  @ApiPropertyOptional({ enum: ORIGINS })
  @IsOptional()
  @IsIn(ORIGINS)
  origin?: 'IQC' | 'IN_PROCESS' | 'OQC';

  @ApiProperty({ example: 'CAP-0402-100NF' })
  @IsString()
  @Length(1, 64)
  part: string;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @Min(0)
  qty: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  lot?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 80)
  serial?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  woId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 32)
  station?: string;

  @ApiPropertyOptional({ example: 'Soldadura fría' })
  @IsOptional()
  @IsString()
  @Length(0, 120)
  defectType?: string;

  @ApiPropertyOptional({ enum: SEVERITIES })
  @IsOptional()
  @IsIn(SEVERITIES)
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 512)
  photoUrl?: string;
}

export class DispositionDto {
  @ApiProperty({ enum: DISPOSITIONS })
  @IsIn(DISPOSITIONS)
  disposition: Disposition;

  @ApiProperty({ description: 'Firma (workflow) — obligatoria.' })
  @IsString()
  @Length(2, 200)
  signedBy: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;

  @ApiPropertyOptional({ description: 'Desviación/waiver (obligatorio para USE_AS_IS).' })
  @IsOptional()
  @IsString()
  @Length(0, 120)
  waiver?: string;

  @ApiPropertyOptional({ description: 'SCAR / nota de débito (RTV).' })
  @IsOptional()
  @IsString()
  @Length(0, 120)
  scarRef?: string;
}

export class ReinspectDto {
  @ApiProperty({ description: 'true = pasa (libera), false = falla (vuelve a retrabajo).' })
  pass: boolean;

  @ApiPropertyOptional({ description: 'Horas de retrabajo registradas.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  reworkHours?: number;

  @ApiPropertyOptional({ description: 'Cantidad a scrap si re-inspección falla definitivamente.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  scrapQty?: number;
}
