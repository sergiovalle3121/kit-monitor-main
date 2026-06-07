import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RMA_DISPOSITIONS, RMA_STATUSES } from '../rma-state';
import type { RmaDisposition, RmaStatus } from '../rma-state';
import type { RmaSeverity } from '../entities/rma-case.entity';

const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export class CreateRmaDto {
  @ApiProperty({ example: 'Unidad no enciende tras 2 semanas' })
  @IsString()
  @Length(3, 255)
  failureDescription: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  customerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 80)
  partNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 80)
  serialNumber?: string;

  @ApiPropertyOptional({ enum: SEVERITIES })
  @IsOptional()
  @IsIn(SEVERITIES)
  severity?: RmaSeverity;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  programId?: string;
}

export class TransitionRmaDto {
  @ApiProperty({ enum: RMA_STATUSES, example: 'INVESTIGATING' })
  @IsIn(RMA_STATUSES)
  status: RmaStatus;

  @ApiPropertyOptional({ enum: RMA_DISPOSITIONS, description: 'Disposición (al pasar a DISPOSITION).' })
  @IsOptional()
  @IsIn(RMA_DISPOSITIONS as unknown as string[])
  disposition?: RmaDisposition;

  @ApiPropertyOptional({ description: 'Causa raíz (al investigar/disponer).' })
  @IsOptional()
  @IsString()
  rootCause?: string;
}
