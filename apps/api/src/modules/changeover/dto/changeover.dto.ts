import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CHANGEOVER_STATUSES } from '../changeover-state';
import type { ChangeoverStatus } from '../changeover-state';

export class ChecklistItemDto {
  @ApiProperty({ example: 'mount_feeders' })
  @IsString()
  @Length(1, 60)
  key: string;

  @ApiProperty({ example: 'Montar feeders del nuevo modelo' })
  @IsString()
  @Length(1, 160)
  label: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  done?: boolean;
}

export class OpenChangeoverDto {
  @ApiProperty({ example: 'SMT-1' })
  @IsString()
  @Length(1, 32)
  line: string;

  @ApiPropertyOptional({ example: 'AX-1000', description: 'Modelo saliente.' })
  @IsOptional()
  @IsString()
  @Length(0, 64)
  fromModel?: string;

  @ApiPropertyOptional({ example: 'AX-2000', description: 'Modelo entrante.' })
  @IsOptional()
  @IsString()
  @Length(0, 64)
  toModel?: string;

  @ApiPropertyOptional({ description: 'WO saliente.' })
  @IsOptional()
  @IsString()
  @Length(0, 36)
  fromWoId?: string;

  @ApiPropertyOptional({
    description: 'WO entrante — enriquece modelo/folio destino.',
  })
  @IsOptional()
  @IsString()
  @Length(0, 36)
  toWoId?: string;

  @ApiPropertyOptional({ example: 30, description: 'Objetivo SMED (min).' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  targetMinutes?: number;

  @ApiPropertyOptional({
    type: [ChecklistItemDto],
    description: 'Checklist de setup.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  checklist?: ChecklistItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  operator?: string;

  @ApiPropertyOptional({
    description: 'Arranca el cronómetro de inmediato (línea abajo).',
  })
  @IsOptional()
  @IsBoolean()
  start?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

export class ChecklistToggleDto {
  @ApiProperty({ example: 'mount_feeders' })
  @IsString()
  @Length(1, 60)
  key: string;

  @ApiProperty({ description: 'Marca / desmarca el paso.' })
  @IsBoolean()
  done: boolean;

  @ApiPropertyOptional({ description: 'Quién lo completó.' })
  @IsOptional()
  @IsString()
  @Length(0, 200)
  by?: string;
}

export class CompleteChangeoverDto {
  @ApiPropertyOptional({
    description: 'Cerrar aunque queden pasos del checklist pendientes.',
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

export class ChangeoverQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  line?: string;

  @ApiPropertyOptional({ enum: CHANGEOVER_STATUSES })
  @IsOptional()
  @IsIn(CHANGEOVER_STATUSES)
  status?: ChangeoverStatus;
}
