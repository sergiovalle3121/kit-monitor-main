import {
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { INITIATIVE_STATUSES } from '../initiative-state';
import type { InitiativeStatus } from '../initiative-state';
import type {
  InitiativeMethodology,
  InitiativePriority,
} from '../entities/improvement-initiative.entity';

const METHODOLOGIES = ['KAIZEN', 'LEAN', 'SIX_SIGMA', 'FIVE_S', 'OTHER'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];

export class CreateInitiativeDto {
  @ApiProperty({ example: 'Reducir scrap en SMT línea 3' })
  @IsString()
  @Length(3, 200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: METHODOLOGIES, example: 'KAIZEN' })
  @IsOptional()
  @IsIn(METHODOLOGIES)
  methodology?: InitiativeMethodology;

  @ApiPropertyOptional({ enum: PRIORITIES, example: 'MEDIUM' })
  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: InitiativePriority;

  @ApiPropertyOptional({ example: 'SMT' })
  @IsOptional()
  @IsString()
  @Length(0, 120)
  area?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  programId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  ownerEmail?: string;

  @ApiPropertyOptional({ example: 25000, description: 'Ahorro anual estimado.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedSavings?: number;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;
}

export class UpdateInitiativeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: METHODOLOGIES })
  @IsOptional()
  @IsIn(METHODOLOGIES)
  methodology?: InitiativeMethodology;

  @ApiPropertyOptional({ enum: PRIORITIES })
  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: InitiativePriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  area?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  programId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  ownerEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedSavings?: number;

  @ApiPropertyOptional({ description: 'Ahorro realizado/verificado.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualSavings?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;
}

export class TransitionInitiativeDto {
  @ApiProperty({ enum: INITIATIVE_STATUSES, example: 'IN_PROGRESS' })
  @IsIn(INITIATIVE_STATUSES)
  status: InitiativeStatus;

  @ApiPropertyOptional({ description: 'Ahorro verificado (al pasar a VERIFIED).' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualSavings?: number;
}
