import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BOM_ITEM_CATEGORIES,
  BOM_NODE_STATUSES,
  type BomItemCategory,
  type BomNodeStatus,
} from '../bom-state';

// ── Node ─────────────────────────────────────────────────────────────────────
export class CreateBomNodeDto {
  @ApiProperty({ description: 'UUID del material/ensamble (debe existir en MM).' })
  @IsString()
  materialId: string;

  @ApiPropertyOptional({ example: '1.0' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  revision?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  baseQuantity?: number;

  @ApiPropertyOptional({ example: 'EA' })
  @IsOptional()
  @IsString()
  @Length(1, 16)
  baseUom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateBomNodeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 20)
  revision?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  baseQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 16)
  baseUom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class TransitionBomNodeDto {
  @ApiProperty({ enum: BOM_NODE_STATUSES })
  @IsIn(BOM_NODE_STATUSES)
  status: BomNodeStatus;
}

// ── Line ─────────────────────────────────────────────────────────────────────
export class CreateBomLineDto {
  @ApiProperty({ description: 'UUID del material componente (debe existir en MM).' })
  @IsString()
  materialId: string;

  @ApiPropertyOptional({ example: '0010' })
  @IsOptional()
  @IsString()
  @Length(1, 12)
  findNumber?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ example: 'EA' })
  @IsOptional()
  @IsString()
  @Length(1, 16)
  uom?: string;

  @ApiPropertyOptional({ example: 'R1, R2, C1-C10' })
  @IsOptional()
  @IsString()
  @Length(0, 255)
  refDes?: string;

  @ApiPropertyOptional({ enum: BOM_ITEM_CATEGORIES })
  @IsOptional()
  @IsIn(BOM_ITEM_CATEGORIES)
  itemCategory?: BomItemCategory;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  scrapPct?: number;

  @ApiPropertyOptional({ enum: ['MAKE', 'BUY'] })
  @IsOptional()
  @IsIn(['MAKE', 'BUY'])
  makeBuy?: 'MAKE' | 'BUY';

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  phantom?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 40)
  alternateGroup?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateBomLineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 12)
  findNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 16)
  uom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  refDes?: string;

  @ApiPropertyOptional({ enum: BOM_ITEM_CATEGORIES })
  @IsOptional()
  @IsIn(BOM_ITEM_CATEGORIES)
  itemCategory?: BomItemCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  scrapPct?: number;

  @ApiPropertyOptional({ enum: ['MAKE', 'BUY'] })
  @IsOptional()
  @IsIn(['MAKE', 'BUY'])
  makeBuy?: 'MAKE' | 'BUY';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  phantom?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 40)
  alternateGroup?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
