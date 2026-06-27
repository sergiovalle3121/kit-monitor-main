import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { NpiGateStatus } from '../npi-state';
import { NPI_RISK_SEVERITIES, NPI_RISK_STATUSES } from '../npi-risk-state';
import type { NpiRiskSeverity, NpiRiskStatus } from '../npi-risk-state';

/**
 * Create (or reuse, idempotent by model+revision) an NPI project. Seeds one
 * PENDING gate per phase. Advisory orchestration only — never touches
 * product-models.
 */
export class CreateNpiProjectDto {
  @ApiProperty({ description: 'Número de modelo (ProductModel.modelNumber).' })
  @IsString()
  @Length(1, 40)
  modelNumber: string;

  @ApiPropertyOptional({ description: 'Revisión del modelo.', example: '1.0' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  revision?: string;

  @ApiPropertyOptional({ description: 'Cliente (opcional).' })
  @IsOptional()
  @IsString()
  @Length(0, 160)
  customer?: string;

  @ApiPropertyOptional({ description: 'Programa / familia (opcional).' })
  @IsOptional()
  @IsString()
  @Length(0, 64)
  programId?: string;

  @ApiPropertyOptional({ description: 'Notas libres.' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

/** Capture an on-demand readiness snapshot for a model+revision. */
export class SnapshotReadinessDto {
  @ApiProperty({ description: 'Número de modelo.' })
  @IsString()
  @Length(1, 40)
  model: string;

  @ApiPropertyOptional({ description: 'Revisión.', example: '1.0' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  revision?: string;

  @ApiPropertyOptional({ description: 'Proyecto NPI asociado (opcional).' })
  @IsOptional()
  @IsString()
  @Length(1, 36)
  projectId?: string;

  @ApiPropertyOptional({ description: 'Nota libre del snapshot.' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  note?: string;
}

/** Create an advisory risk on a launch. */
export class CreateNpiRiskDto {
  @ApiProperty({ description: 'Título corto del riesgo.' })
  @IsString()
  @Length(1, 200)
  title: string;

  @ApiPropertyOptional({ description: 'Detalle / impacto del riesgo.' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @ApiPropertyOptional({ enum: NPI_RISK_SEVERITIES, default: 'MEDIUM' })
  @IsOptional()
  @IsIn(NPI_RISK_SEVERITIES)
  severity?: NpiRiskSeverity;

  @ApiPropertyOptional({ description: 'Dueño (nombre, correo o rol).' })
  @IsOptional()
  @IsString()
  @Length(0, 200)
  owner?: string;

  @ApiPropertyOptional({ description: 'Fecha objetivo (ISO 8601).' })
  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Plan de mitigación / notas.' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  mitigation?: string;
}

/** Update a risk: any field, incl. status (OPEN / MITIGATING / CLOSED). */
export class UpdateNpiRiskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @ApiPropertyOptional({ enum: NPI_RISK_SEVERITIES })
  @IsOptional()
  @IsIn(NPI_RISK_SEVERITIES)
  severity?: NpiRiskSeverity;

  @ApiPropertyOptional({ enum: NPI_RISK_STATUSES })
  @IsOptional()
  @IsIn(NPI_RISK_STATUSES)
  status?: NpiRiskStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  owner?: string;

  @ApiPropertyOptional({ description: 'Fecha objetivo (ISO 8601).' })
  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  mitigation?: string;
}

const GATE_DECISIONS: NpiGateStatus[] = ['PASSED', 'FAILED', 'WAIVED'];

/** Decide a gate: PASSED / FAILED / WAIVED, with optional notes. */
export class DecideGateDto {
  @ApiProperty({ enum: GATE_DECISIONS })
  @IsIn(GATE_DECISIONS)
  decision: 'PASSED' | 'FAILED' | 'WAIVED';

  @ApiPropertyOptional({ description: 'Justificación de la decisión.' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}
