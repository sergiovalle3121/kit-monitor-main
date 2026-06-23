import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TOOL_STATUSES, TOOL_TYPES } from '../tool-life';
import type { ToolStatus, ToolType } from '../tool-life';

export class CreateToolDto {
  @ApiProperty({ example: 'Molde carcasa frontal' })
  @IsString()
  @Length(2, 160)
  name: string;

  @ApiPropertyOptional({ enum: TOOL_TYPES })
  @IsOptional()
  @IsIn(TOOL_TYPES as unknown as string[])
  type?: ToolType;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  cavities?: number;

  @ApiProperty({ example: 1000000, description: 'Vida nominal en disparos.' })
  @IsInt()
  @Min(0)
  lifeShots: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  shotsUsed?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 160)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  programId?: string;
}

export class RecordUsageDto {
  @ApiProperty({ example: 5000, description: 'Disparos a sumar.' })
  @IsInt()
  @Min(1)
  shots: number;
}

export class SetToolStatusDto {
  @ApiProperty({ enum: TOOL_STATUSES, example: 'IN_USE' })
  @IsIn(TOOL_STATUSES as unknown as string[])
  status: ToolStatus;
}

export class CheckoutToolDto {
  @ApiPropertyOptional({ description: 'Id de la WO destino (preferido — enriquece folio/modelo).' })
  @IsOptional()
  @IsString()
  @Length(1, 36)
  workOrderId?: string;

  @ApiPropertyOptional({ description: 'Folio de la WO si no se tiene el id.' })
  @IsOptional()
  @IsString()
  @Length(1, 32)
  workOrderFolio?: string;

  @ApiPropertyOptional({ description: 'Quién presta (cribbero). Default: usuario en sesión.' })
  @IsOptional()
  @IsString()
  @Length(0, 255)
  by?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  notes?: string;
}

export class CheckinToolDto {
  @ApiPropertyOptional({ description: 'Quién recibe. Default: usuario en sesión.' })
  @IsOptional()
  @IsString()
  @Length(0, 255)
  by?: string;

  @ApiPropertyOptional({ description: 'Disparos consumidos durante el préstamo (se suman a la vida vía la lógica de usage).' })
  @IsOptional()
  @IsInt()
  @Min(0)
  shots?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  notes?: string;
}

export class RecordCalibrationDto {
  @ApiPropertyOptional({ description: 'Fecha de esta calibración (ISO). Default: hoy.' })
  @IsOptional()
  @IsDateString()
  calibratedAt?: string;

  @ApiPropertyOptional({ description: 'Próxima calibración (ISO).' })
  @IsOptional()
  @IsDateString()
  nextDate?: string;

  @ApiPropertyOptional({ description: 'Intervalo en días; deriva la próxima si no se da nextDate.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  intervalDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  notes?: string;
}

export class RecordPmDto {
  @ApiPropertyOptional({ description: 'Fecha de este mantenimiento preventivo (ISO). Default: hoy.' })
  @IsOptional()
  @IsDateString()
  performedAt?: string;

  @ApiPropertyOptional({ description: 'Próximo PM (ISO).' })
  @IsOptional()
  @IsDateString()
  nextDate?: string;

  @ApiPropertyOptional({ description: 'Intervalo en días; deriva el próximo si no se da nextDate.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  intervalDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  notes?: string;
}
