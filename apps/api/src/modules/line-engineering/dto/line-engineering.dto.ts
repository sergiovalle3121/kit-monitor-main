import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStationDto {
  @ApiProperty({ example: 'AX-1000' })
  @IsString()
  @Length(1, 64)
  model: string;

  @ApiPropertyOptional({ example: 'A' })
  @IsOptional()
  @IsString()
  @Length(1, 16)
  revision?: string;

  @ApiProperty({ example: 'SMT-1' })
  @IsString()
  @Length(1, 32)
  line: string;

  @ApiProperty({ example: 'EST-10' })
  @IsString()
  @Length(1, 32)
  station: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  sequence?: number;

  @ApiPropertyOptional({
    example: 'CAP-0402-100NF',
    description: 'Expected NP (poka-yoke).',
  })
  @IsOptional()
  @IsString()
  @Length(0, 64)
  npExpected?: string;

  @ApiPropertyOptional({
    example: 2,
    description: 'Qty per unit (supports fractions).',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  useFactor?: number;

  @ApiPropertyOptional({
    example: 45,
    description: 'Standard time per unit (sec).',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stdTimeSec?: number;

  @ApiPropertyOptional({ example: 'F-12' })
  @IsOptional()
  @IsString()
  @Length(0, 48)
  feederPosition?: string;

  @ApiPropertyOptional({ example: 'https://aids.axos/np/cap-0402.pdf' })
  @IsOptional()
  @IsString()
  @Length(0, 512)
  visualAidUrl?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  ctq?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  programId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  notes?: string;
}

export class UpdateStationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  sequence?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  npExpected?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  useFactor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  stdTimeSec?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 48)
  feederPosition?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 512)
  visualAidUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ctq?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class QualifyModelLineDto {
  @ApiProperty({ example: 'AX-1000' })
  @IsString()
  @Length(1, 64)
  model: string;

  @ApiPropertyOptional({ example: 'A' })
  @IsOptional()
  @IsString()
  @Length(1, 16)
  revision?: string;

  @ApiProperty({ example: 'SMT-1' })
  @IsString()
  @Length(1, 32)
  line: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  changeoverMinutes?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taktTargetSec?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  programId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  notes?: string;
}

export class UpdateModelLineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  changeoverMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  taktTargetSec?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  notes?: string;
}

// ── 2D layout editor (additive) ──────────────────────────────────────────────

/** Canvas/footprint config for a model+revision layout. */
export class LayoutFootprintDto {
  @ApiPropertyOptional({
    example: 20000,
    description: 'Footprint width along X (in unit).',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  footprintW?: number;

  @ApiPropertyOptional({
    example: 10000,
    description: 'Footprint length along Y (in unit).',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  footprintH?: number;

  @ApiPropertyOptional({ example: 'mm', enum: ['mm', 'm'] })
  @IsOptional()
  @IsIn(['mm', 'm'])
  unit?: string;

  @ApiPropertyOptional({
    example: 500,
    description: 'Grid / snap step (in unit).',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  gridSize?: number;
}

/** One station's physical placement on the layout. */
export class LayoutPositionDto {
  @ApiProperty({ description: 'Station id (sf_line_stations.id).' })
  @IsString()
  @Length(1, 64)
  id: string;

  @ApiProperty({ example: 1000 })
  @IsNumber()
  x: number;

  @ApiProperty({ example: 2000 })
  @IsNumber()
  y: number;

  @ApiPropertyOptional({ example: 1200 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  w?: number;

  @ApiPropertyOptional({ example: 800 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  h?: number;

  @ApiPropertyOptional({ example: 0, description: 'Rotation in degrees.' })
  @IsOptional()
  @IsNumber()
  rotation?: number;
}

/** Placement of the DXF background over the footprint (Fase 2). */
export class DxfMetaDto {
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  offsetX?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  offsetY?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  scale?: number;

  @ApiPropertyOptional({ example: 0, description: 'Rotation in degrees.' })
  @IsOptional()
  @IsNumber()
  rotation?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @ApiPropertyOptional({
    example: 0.5,
    description: 'Background opacity 0..1.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  opacity?: number;
}

/** A directed material-flow link between two stations (Fase 4). */
export class LayoutConnectorDto {
  @ApiProperty({ description: 'Source station id.' })
  @IsString()
  @Length(1, 64)
  from: string;

  @ApiProperty({ description: 'Target station id.' })
  @IsString()
  @Length(1, 64)
  to: string;

  @ApiPropertyOptional({
    example: 'flow',
    enum: ['flow', 'conveyor', 'return'],
  })
  @IsOptional()
  @IsIn(['flow', 'conveyor', 'return'])
  kind?: string;
}

/** A non-station equipment/asset placed on the plan (Fase 5). */
export class LayoutAssetDto {
  @ApiProperty()
  @IsString()
  @Length(1, 64)
  id: string;

  @ApiProperty({ example: 'workbench' })
  @IsString()
  @Length(1, 24)
  kind: string;

  @ApiProperty({ example: 1000 })
  @IsNumber()
  x: number;

  @ApiProperty({ example: 2000 })
  @IsNumber()
  y: number;

  @ApiProperty({ example: 1200 })
  @IsNumber()
  @Min(1)
  w: number;

  @ApiProperty({ example: 800 })
  @IsNumber()
  @Min(1)
  h: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  rotation?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  label?: string;
}

/** A free-text label or a dimension line on the plan (Fase 7). */
export class LayoutAnnotationDto {
  @ApiProperty()
  @IsString()
  @Length(1, 64)
  id: string;

  @ApiProperty({ enum: ['text', 'dim'] })
  @IsIn(['text', 'dim'])
  type: string;

  @ApiProperty({ example: 1000 })
  @IsNumber()
  x: number;

  @ApiProperty({ example: 2000 })
  @IsNumber()
  y: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  x2?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  y2?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 240)
  text?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 16)
  color?: string;
}

export class LayoutCellDto {
  @ApiProperty()
  @IsString()
  @Length(1, 64)
  id: string;

  @ApiProperty({ example: 'Celda SMT' })
  @IsString()
  @Length(1, 48)
  name: string;

  @ApiProperty({ example: '#6366f1' })
  @IsString()
  @Length(1, 16)
  color: string;

  @ApiProperty({ type: [String], description: 'Station ids in the cell.' })
  @IsArray()
  @IsString({ each: true })
  stationIds: string[];
}

/** Persist a model+revision layout: footprint config + station placements. */
export class SaveLayoutDto {
  @ApiProperty({ example: 'AX-1000' })
  @IsString()
  @Length(1, 64)
  model: string;

  @ApiPropertyOptional({ example: 'A' })
  @IsOptional()
  @IsString()
  @Length(1, 16)
  revision?: string;

  @ApiPropertyOptional({ type: LayoutFootprintDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LayoutFootprintDto)
  footprint?: LayoutFootprintDto;

  @ApiPropertyOptional({
    type: [LayoutPositionDto],
    description: 'Placed stations.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LayoutPositionDto)
  positions?: LayoutPositionDto[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Station ids to unplace (clear coords).',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cleared?: string[];

  @ApiPropertyOptional({
    type: DxfMetaDto,
    description: 'DXF background placement (does not touch the DXF data).',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DxfMetaDto)
  dxf?: DxfMetaDto;

  @ApiPropertyOptional({
    type: [LayoutConnectorDto],
    description: 'Directed flow links between stations.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LayoutConnectorDto)
  connectors?: LayoutConnectorDto[];

  @ApiPropertyOptional({
    type: [LayoutAssetDto],
    description: 'Equipment/assets placed on the plan.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LayoutAssetDto)
  assets?: LayoutAssetDto[];

  @ApiPropertyOptional({
    type: [LayoutAnnotationDto],
    description: 'Text labels / dimension lines on the plan.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LayoutAnnotationDto)
  annotations?: LayoutAnnotationDto[];

  @ApiPropertyOptional({
    type: [LayoutCellDto],
    description: 'Manufacturing cells / zones grouping stations.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LayoutCellDto)
  cells?: LayoutCellDto[];
}

/** Upload/replace the DXF background of a model+revision layout. */
export class UploadDxfDto {
  @ApiProperty({ example: 'AX-1000' })
  @IsString()
  @Length(1, 64)
  model: string;

  @ApiPropertyOptional({ example: 'A' })
  @IsOptional()
  @IsString()
  @Length(1, 16)
  revision?: string;

  @ApiProperty({ example: 'planta-smt.dxf' })
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiProperty({ description: 'Raw DXF text content.' })
  @IsString()
  @MaxLength(12_000_000)
  data: string;
}

/** Clone a layout from one model+revision onto another (Fase 8). */
export class CloneLayoutDto {
  @ApiProperty({ example: 'AX-1000' })
  @IsString()
  @Length(1, 64)
  fromModel: string;

  @ApiPropertyOptional({ example: 'A' })
  @IsOptional()
  @IsString()
  @Length(1, 16)
  fromRevision?: string;

  @ApiProperty({ example: 'AX-2000' })
  @IsString()
  @Length(1, 64)
  toModel: string;

  @ApiPropertyOptional({ example: 'A' })
  @IsOptional()
  @IsString()
  @Length(1, 16)
  toRevision?: string;
}

export class CreateSnapshotDto {
  @ApiProperty({ example: 'AX-1000' })
  @IsString()
  @Length(1, 64)
  model: string;

  @ApiPropertyOptional({ example: 'A' })
  @IsOptional()
  @IsString()
  @Length(1, 16)
  revision?: string;

  @ApiPropertyOptional({ example: 'Antes de mover SMT-3' })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;
}

export class SetApprovalDto {
  @ApiProperty({ example: 'AX-1000' })
  @IsString()
  @Length(1, 64)
  model: string;

  @ApiPropertyOptional({ example: 'A' })
  @IsOptional()
  @IsString()
  @Length(1, 16)
  revision?: string;

  @ApiProperty({ enum: ['draft', 'in_review', 'approved'] })
  @IsIn(['draft', 'in_review', 'approved'])
  status: string;

  @ApiPropertyOptional({ example: 'Aprobado por IE tras revisión' })
  @IsOptional()
  @IsString()
  @Length(0, 240)
  note?: string;
}
