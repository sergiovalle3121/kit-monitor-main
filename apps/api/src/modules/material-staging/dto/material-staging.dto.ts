import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export class GenerateStagingDto {
  @ApiProperty({ description: 'WO a surtir.' })
  @IsString()
  woId: string;

  @ApiPropertyOptional({ example: 0.15, description: 'Punto kanban como fracción del requerido (default 0.15).' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  kanbanFraction?: number;
}

export class ConfirmStagedDto {
  @ApiProperty({ example: 1000, description: 'Cantidad montada confirmada.' })
  @IsNumber()
  @Min(0)
  stagedQty: number;
}

export class ShortageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 32)
  reason?: string;

  @ApiPropertyOptional({ enum: PRIORITIES })
  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

export class RaiseReplenishDto {
  @ApiProperty()
  @IsString()
  woId: string;

  @ApiProperty({ example: 'EST-10' })
  @IsString()
  @Length(1, 32)
  station: string;

  @ApiProperty({ example: 'CAP-0402-100NF' })
  @IsString()
  @Length(1, 64)
  part: string;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @Min(0)
  qty: number;

  @ApiPropertyOptional({ enum: PRIORITIES })
  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 32)
  reason?: string;
}
