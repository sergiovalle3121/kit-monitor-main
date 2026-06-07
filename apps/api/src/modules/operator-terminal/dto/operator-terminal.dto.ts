import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConfirmProductionDto {
  @ApiProperty({ description: 'WO en ejecución.' })
  @IsString()
  woId: string;

  @ApiProperty({ example: 'EST-10' })
  @IsString()
  @Length(1, 32)
  station: string;

  @ApiPropertyOptional({ description: 'NP escaneado (poka-yoke).' })
  @IsOptional()
  @IsString()
  @Length(0, 64)
  scannedPart?: string;

  @ApiPropertyOptional({ example: 1, description: 'Cantidad terminada (modo cantidad×factor).' })
  @IsOptional()
  @IsInt()
  @Min(1)
  units?: number;

  @ApiPropertyOptional({ description: 'Serial de la unidad (programas con genealogía).' })
  @IsOptional()
  @IsString()
  @Length(0, 80)
  unitSerial?: string;

  @ApiPropertyOptional({ description: 'Clave de idempotencia (evita doble conteo).' })
  @IsOptional()
  @IsString()
  @Length(0, 80)
  idempotencyKey?: string;
}

const ANDON_TYPES = ['ANDON_MATERIAL', 'ANDON_QUALITY', 'ANDON_MACHINE', 'ANDON_HELP', 'ANDON_SAFETY'];
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export class RaiseAndonDto {
  @ApiProperty({ enum: ANDON_TYPES })
  @IsIn(ANDON_TYPES)
  type: 'ANDON_MATERIAL' | 'ANDON_QUALITY' | 'ANDON_MACHINE' | 'ANDON_HELP' | 'ANDON_SAFETY';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  woId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 32)
  line?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 32)
  station?: string;

  @ApiPropertyOptional({ enum: SEVERITIES })
  @IsOptional()
  @IsIn(SEVERITIES)
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  note?: string;
}

export class ReportDefectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  woId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 32)
  line?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 32)
  station?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  part?: string;

  @ApiPropertyOptional({ enum: SEVERITIES })
  @IsOptional()
  @IsIn(SEVERITIES)
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @ApiProperty({ example: 'Soldadura fría en J3' })
  @IsString()
  @Length(1, 500)
  note: string;
}
