import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { NpiGateStatus } from '../npi-state';

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
