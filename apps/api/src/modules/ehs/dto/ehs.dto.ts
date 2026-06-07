import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { INCIDENT_STATUSES } from '../incident-state';
import type { IncidentStatus } from '../incident-state';
import type {
  IncidentSeverity,
  IncidentType,
} from '../entities/safety-incident.entity';

const TYPES = [
  'NEAR_MISS',
  'FIRST_AID',
  'RECORDABLE',
  'LOST_TIME',
  'ENVIRONMENTAL',
  'PROPERTY_DAMAGE',
];
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export class CreateIncidentDto {
  @ApiProperty({ example: 'Casi-caída por derrame de aceite en pasillo B' })
  @IsString()
  @Length(3, 200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: TYPES, example: 'NEAR_MISS' })
  @IsOptional()
  @IsIn(TYPES)
  type?: IncidentType;

  @ApiPropertyOptional({ enum: SEVERITIES, example: 'LOW' })
  @IsOptional()
  @IsIn(SEVERITIES)
  severity?: IncidentSeverity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  area?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 160)
  injuredPerson?: string;

  @ApiPropertyOptional({ example: '2026-06-07T14:30:00Z' })
  @IsOptional()
  @IsString()
  occurredAt?: string;
}

export class UpdateIncidentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: TYPES })
  @IsOptional()
  @IsIn(TYPES)
  type?: IncidentType;

  @ApiPropertyOptional({ enum: SEVERITIES })
  @IsOptional()
  @IsIn(SEVERITIES)
  severity?: IncidentSeverity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  area?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 160)
  injuredPerson?: string;

  @ApiPropertyOptional({ description: 'Días perdidos (LTIR).' })
  @IsOptional()
  @IsInt()
  @Min(0)
  lostDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rootCause?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correctiveAction?: string;
}

export class TransitionIncidentDto {
  @ApiProperty({ enum: INCIDENT_STATUSES, example: 'INVESTIGATING' })
  @IsIn(INCIDENT_STATUSES)
  status: IncidentStatus;

  @ApiPropertyOptional({ description: 'Causa raíz (al investigar).' })
  @IsOptional()
  @IsString()
  rootCause?: string;

  @ApiPropertyOptional({ description: 'Acción correctiva (al definir acción).' })
  @IsOptional()
  @IsString()
  correctiveAction?: string;

  @ApiPropertyOptional({ description: 'Días perdidos (lesión con tiempo perdido).' })
  @IsOptional()
  @IsInt()
  @Min(0)
  lostDays?: number;
}
