import {
  IsBoolean,
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
import {
  ALTERNATE_TYPES,
  AVL_STATUSES,
  MAKE_BUY_VALUES,
  MATERIAL_ITEM_TYPES,
  MATERIAL_LIFECYCLE_STATUSES,
} from '../material-state';
import type {
  AlternateType,
  AvlStatus,
  MakeBuy,
  MaterialItemType,
  MaterialLifecycle,
} from '../material-state';

// ── Material ─────────────────────────────────────────────────────────────────
export class CreateMaterialDto {
  @ApiProperty({ example: 'Resistor 10kΩ 0402 1%' })
  @IsString()
  @Length(2, 255)
  description: string;

  @ApiPropertyOptional({
    description: 'Número de parte interno. Si se omite, se asigna folio MAT-.',
    example: 'RES-10K-0402',
  })
  @IsOptional()
  @IsString()
  @Length(1, 60)
  partNumber?: string;

  @ApiPropertyOptional({ enum: MATERIAL_ITEM_TYPES, example: 'PURCHASED' })
  @IsOptional()
  @IsIn(MATERIAL_ITEM_TYPES)
  itemType?: MaterialItemType;

  @ApiPropertyOptional({ example: 'Resistores' })
  @IsOptional()
  @IsString()
  @Length(0, 80)
  category?: string;

  @ApiPropertyOptional({ example: 'EA' })
  @IsOptional()
  @IsString()
  @Length(1, 16)
  baseUom?: string;

  @ApiPropertyOptional({ enum: MAKE_BUY_VALUES })
  @IsOptional()
  @IsIn(MAKE_BUY_VALUES)
  makeBuy?: MakeBuy;

  @ApiPropertyOptional({ example: 0.0021 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  standardCost?: number;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ example: 0.0001 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional({ example: 'kg' })
  @IsOptional()
  @IsString()
  @Length(1, 8)
  weightUom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Atributos de spec, enlaces, etc.' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateMaterialDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 255)
  description?: string;

  @ApiPropertyOptional({ enum: MATERIAL_ITEM_TYPES })
  @IsOptional()
  @IsIn(MATERIAL_ITEM_TYPES)
  itemType?: MaterialItemType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 80)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 16)
  baseUom?: string;

  @ApiPropertyOptional({ enum: MAKE_BUY_VALUES })
  @IsOptional()
  @IsIn(MAKE_BUY_VALUES)
  makeBuy?: MakeBuy;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  standardCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 8)
  weightUom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class TransitionMaterialDto {
  @ApiProperty({ enum: MATERIAL_LIFECYCLE_STATUSES, example: 'ACTIVE' })
  @IsIn(MATERIAL_LIFECYCLE_STATUSES)
  status: MaterialLifecycle;
}

// ── AVL ──────────────────────────────────────────────────────────────────────
export class CreateAvlDto {
  @ApiProperty({ example: 'Yageo' })
  @IsString()
  @Length(1, 160)
  manufacturer: string;

  @ApiProperty({ example: 'RC0402FR-0710KL' })
  @IsString()
  @Length(1, 120)
  mpn: string;

  @ApiPropertyOptional({ enum: AVL_STATUSES, example: 'APPROVED' })
  @IsOptional()
  @IsIn(AVL_STATUSES)
  status?: AvlStatus;

  @ApiPropertyOptional({ example: 1, description: '1 = preferido.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  preference?: number;

  @ApiPropertyOptional({ example: 28 })
  @IsOptional()
  @IsInt()
  @Min(0)
  leadTimeDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateAvlDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 160)
  manufacturer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 120)
  mpn?: string;

  @ApiPropertyOptional({ enum: AVL_STATUSES })
  @IsOptional()
  @IsIn(AVL_STATUSES)
  status?: AvlStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  preference?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  leadTimeDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// ── Material alternate ───────────────────────────────────────────────────────
export class CreateMaterialAltDto {
  @ApiProperty({ description: 'UUID del material alternante/sustituto.' })
  @IsString()
  altMaterialId: string;

  @ApiPropertyOptional({ enum: ALTERNATE_TYPES, example: 'ALTERNATE' })
  @IsOptional()
  @IsIn(ALTERNATE_TYPES)
  type?: AlternateType;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  bidirectional?: boolean;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  ratio?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
