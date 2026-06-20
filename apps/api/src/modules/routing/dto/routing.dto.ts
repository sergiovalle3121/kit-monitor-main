import {
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ROUTING_STATUSES, type RoutingStatus } from '../routing-logic';

// ── Routing header ───────────────────────────────────────────────────────────
export class CreateRoutingDto {
  @ApiProperty({ description: 'UUID del material/ensamble (debe existir en MM).' })
  @IsString()
  materialId: string;

  @ApiPropertyOptional({ example: '1.0' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  revision?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 160)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateRoutingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 20)
  revision?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 160)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class TransitionRoutingDto {
  @ApiProperty({ enum: ROUTING_STATUSES })
  @IsIn(ROUTING_STATUSES)
  status: RoutingStatus;
}

// ── Operation ────────────────────────────────────────────────────────────────
export class CreateOperationDto {
  @ApiProperty({ example: 'SMT' })
  @IsString()
  @Length(1, 160)
  name: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sequence?: number;

  @ApiPropertyOptional({ example: 'Línea SMT 1' })
  @IsOptional()
  @IsString()
  @Length(0, 120)
  workCenter?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  setupTimeMin?: number;

  @ApiPropertyOptional({ example: 1.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  runTimePerUnitMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  visualAidRef?: string;
}

export class UpdateOperationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 160)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sequence?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  workCenter?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  setupTimeMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  runTimePerUnitMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  visualAidRef?: string;
}

// ── Operation ↔ material (BOM bridge) ────────────────────────────────────────
export class CreateOperationMaterialDto {
  @ApiProperty({ description: 'UUID del material consumido (debe existir en MM).' })
  @IsString()
  materialId: string;

  @ApiPropertyOptional({ description: 'UUID de la línea de BOM asociada (opcional).' })
  @IsOptional()
  @IsString()
  bomLineId?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  qtyPerUnit?: number;

  @ApiPropertyOptional({ example: 'EA' })
  @IsOptional()
  @IsString()
  @Length(1, 16)
  uom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
